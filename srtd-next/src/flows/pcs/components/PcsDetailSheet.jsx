import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { BottomSheet, Avatar } from '../../../core/ui/index.js';
import { usePcsStore } from '../pcsStore.js';
import { patchPost, updatePostStage, deletePost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { copyToClipboard } from '../../../core/bridges/clipboard.js';
import { openWhatsAppShare, buildShortUrl } from '../../../core/bridges/whatsapp.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { pcsFlow } from '../index.js';
import { STAGE_LABELS, STAGE_TOKEN, ownerToRole, titleCase } from '../utils/stage.js';
import { FORMATS, PILLARS, LOCATIONS } from '../../../core/mappings.js';

const ROLE_TO_OWNER_LABEL = {
  admin: 'Admin', servicing: 'Servicing',
  creative: 'Creative', client: 'Client',
};

const TRANSITIONS = {
  brief_done:           { forward: ['in_production'], back: [], off: ['parked', 'rejected'] },
  in_production:        { forward: ['ready'], back: ['brief_done'], off: ['parked', 'rejected'] },
  ready:                { forward: ['awaiting_approval'], back: ['in_production'], off: ['parked', 'rejected'] },
  awaiting_approval:    { forward: ['scheduled'], back: ['awaiting_brand_input', 'in_production'], off: ['parked', 'rejected'] },
  awaiting_brand_input: { forward: ['awaiting_approval'], back: ['in_production'], off: ['parked', 'rejected'] },
  scheduled:            { forward: ['published'], back: ['awaiting_approval'], off: ['parked'] },
  published:            { forward: [], back: [], off: ['parked'] },
  parked:               { forward: ['in_production'], back: [], off: ['rejected'] },
  rejected:             { forward: [], back: [], off: ['parked'] },
  brief:                { forward: ['in_production'], back: [], off: ['parked', 'rejected'] }
};

function formatDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function pillarDisplay(v) {
  if (!v) return '';
  return String(v).charAt(0).toUpperCase() + String(v).slice(1);
}

function shortenUrl(url) {
  if (!url) return '';
  return String(url).replace(/^https?:\/\//, '');
}

function SheetRow({ field, label, value, placeholder = false, expanded, onToggle, children }) {
  return (
    <div className={`overflow-hidden ${expanded ? 'expanded' : ''}`} data-field={field}>
      <div
        onClick={onToggle}
        className="flex items-center justify-between px-[18px] py-3 min-h-12 cursor-pointer border-t border-divider-subtle active:bg-bg-2"
        style={{ transition: 'background 0.1s ease, transform 0.08s ease' }}
      >
        <div className="font-sans text-lg font-medium text-text-loud">{label}</div>
        <div className="flex items-center gap-2 max-w-[65%]">
          <div className={`font-sans text-lg truncate ${placeholder ? 'text-text-dim italic' : 'text-text-mid'}`}>
            {value}
          </div>
          <ChevronRight
            size={13}
            strokeWidth={2}
            className="text-text-dim flex-shrink-0"
            style={{
              transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
              transition: 'transform 0.22s cubic-bezier(0.2, 0, 0.1, 1)',
            }}
          />
        </div>
      </div>
      <div
        style={{
          maxHeight: expanded ? 480 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.28s cubic-bezier(0.2, 0, 0.1, 1)',
        }}
      >
        <div
          className="px-[18px] pt-0.5 pb-3.5"
          style={{
            opacity: expanded ? 1 : 0,
            transition: 'opacity 0.18s ease 0.04s',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function ActionRow({ label, value = null, onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-[18px] py-3 min-h-12 cursor-pointer border-t border-divider-subtle active:bg-bg-2"
      style={{ transition: 'background 0.1s ease' }}
    >
      <div className="font-sans text-lg font-medium text-text-loud">{label}</div>
      <div className="flex items-center gap-2 max-w-[65%]">
        {value ? (
          <div className="font-sans text-lg text-text-dim truncate">{value}</div>
        ) : null}
        <ChevronRight size={13} strokeWidth={2} className="text-text-dim flex-shrink-0" />
      </div>
    </div>
  );
}

function StageOptions({ post, onSelect }) {
  const t = TRANSITIONS[post.stage] || { forward: [], back: [], off: [] };
  const groups = [
    { key: 'forward', label: 'Forward', items: t.forward },
    { key: 'back', label: 'Back', items: t.back },
    { key: 'off', label: 'Off-path', items: t.off },
  ].filter(g => g.items.length > 0);

  if (groups.length === 0) {
    return <div className="text-text-dim font-sans text-base py-1">No further transitions available.</div>;
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="font-mono text-2xs text-text-soft tracking-widest uppercase mb-1.5">{g.label}</div>
          <div className="space-y-1.5">
            {g.items.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSelect(s)}
                className="w-full flex items-center gap-2.5 px-3 py-3 rounded-sm2 bg-bg-2 hover:bg-bg-3 text-left"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `var(--c-${STAGE_TOKEN[s] || 'stage-production'})` }}
                />
                <span className="text-lg text-text-loud">{STAGE_LABELS[s] || s}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OwnerOptions({ userRoles, currentOwnerId, onSelect, onClear }) {
  const list = Array.isArray(userRoles) ? userRoles : [];
  return (
    <div className="space-y-1">
      {list.map((u) => {
        const r = ownerToRole(u.role);
        const selected = currentOwnerId === u.id;
        return (
          <button
            key={u.id}
            type="button"
            onClick={() => onSelect(u)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm2 text-left ${selected ? 'bg-bg-2' : 'hover:bg-bg-2'}`}
          >
            <Avatar name={u.display_name || u.name} role={r} size="md" avatarUrl={u.avatar_url} />
            <div className="flex-1 min-w-0">
              <div className="text-text-loud text-base truncate">{u.display_name || u.name}</div>
              <div className="font-mono text-2xs text-text-soft tracking-wide uppercase">{titleCase(r)}</div>
            </div>
          </button>
        );
      })}
      {currentOwnerId && (
        <button
          type="button"
          onClick={onClear}
          className="w-full px-3 py-2.5 text-left rounded-sm2 hover:bg-bg-2 text-text-soft text-base"
        >
          Clear owner
        </button>
      )}
    </div>
  );
}

function OptionList({ options, current, onSelect, onClear }) {
  return (
    <div className="space-y-1">
      {options.map((opt) => {
        const value = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const normalized = value.toLowerCase ? value.toLowerCase() : value;
        const selected = String(current || '').toLowerCase() === String(normalized).toLowerCase() || current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={`w-full px-3 py-2.5 text-left rounded-sm2 text-text-loud text-base ${selected ? 'bg-bg-2' : 'hover:bg-bg-2'}`}
          >
            {label}
          </button>
        );
      })}
      {current && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="w-full px-3 py-2.5 text-left rounded-sm2 hover:bg-bg-2 text-text-soft text-base"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function PillarList({ current, onSelect, onClear }) {
  return (
    <div className="space-y-1">
      {PILLARS.map((p) => {
        const dbVal = p.toLowerCase();
        const selected = String(current || '').toLowerCase() === dbVal;
        return (
          <button
            key={dbVal}
            type="button"
            onClick={() => onSelect(dbVal)}
            className={`w-full px-3 py-2.5 text-left rounded-sm2 text-text-loud text-base ${selected ? 'bg-bg-2' : 'hover:bg-bg-2'}`}
          >
            {p}
          </button>
        );
      })}
      {current && (
        <button
          type="button"
          onClick={onClear}
          className="w-full px-3 py-2.5 text-left rounded-sm2 hover:bg-bg-2 text-text-soft text-base"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function DateInput({ value, onChange, onClear }) {
  return (
    <div>
      <input
        type="date"
        defaultValue={value || ''}
        min="2020-01-01"
        max="2035-12-31"
        onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
        className="w-full px-3 py-3 rounded-sm2 bg-bg-2 border border-border-neutral text-text-loud text-base"
        style={{ WebkitAppearance: 'none', appearance: 'none', minHeight: 56 }}
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 w-full px-3 py-2 rounded-sm2 border border-divider-soft text-2xs font-mono tracking-widest uppercase text-text-soft hover:text-text-mid"
        >
          Clear date
        </button>
      )}
    </div>
  );
}

function TextInput({ value, placeholder, onSave }) {
  const [v, setV] = useState(value || '');
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        className="w-full px-3 py-3 rounded-sm2 bg-bg-2 border border-border-neutral text-text-loud text-base"
      />
      <button
        type="button"
        onClick={() => onSave(v.trim())}
        className="w-full px-3 py-2.5 rounded-sm2 bg-terracotta-grad text-text-loud font-sans text-base font-medium"
      >
        Save
      </button>
    </div>
  );
}

function UrlInput({ value, placeholder, onSave }) {
  const [v, setV] = useState(value || '');
  return (
    <div className="space-y-2">
      <input
        type="url"
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        className="w-full px-3 py-3 rounded-sm2 bg-bg-2 border border-border-neutral text-text-loud text-base"
      />
      <button
        type="button"
        onClick={() => onSave(v.trim())}
        className="w-full px-3 py-2.5 rounded-sm2 bg-terracotta-grad text-text-loud font-sans text-base font-medium"
      >
        Save
      </button>
    </div>
  );
}

export function PcsDetailSheet({ post, isAdmin, canEdit, userRoles, open, onClose, actor }) {
  const [expandedField, setExpandedField] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!post) return null;

  function toggleField(name) {
    if (!canEdit) return;
    setExpandedField((cur) => (cur === name ? null : name));
  }

  async function savePatch(column, value, auditField) {
    if (busy) return;
    setBusy(true);
    try {
      const patch = { [column]: value, updated_by: actor };
      const updated = await patchPost(post.post_id, patch);
      writeAudit({
        postId: post.post_id, field: auditField,
        oldValue: post[column], newValue: value, actor,
      }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      logClick('pcs_react_panel_edit', { field: auditField });
      toast('Saved', 'success');
      setExpandedField(null);
    } catch (err) {
      logError(err, { context: 'pcs_react_panel_edit', field: auditField });
      toast('Save failed', 'error');
    }
    setBusy(false);
  }

  async function saveStage(newStage) {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await updatePostStage(post.post_id, newStage, actor);
      writeAudit({
        postId: post.post_id, field: 'stage',
        oldValue: post.stage, newValue: newStage, actor,
      }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      logClick('pcs_react_panel_edit', { field: 'stage' });
      toast(`Moved to ${STAGE_LABELS[newStage] || newStage}`, 'success');
      setExpandedField(null);
    } catch (err) {
      logError(err, { context: 'pcs_react_panel_edit', field: 'stage' });
      toast('Failed to move stage', 'error');
    }
    setBusy(false);
  }

  async function saveOwner(user) {
    if (busy) return;
    setBusy(true);
    try {
      let patch;
      if (user == null) {
        patch = { owner_user_id: null, owner: null, updated_by: actor };
      } else {
        const roleLabel = ROLE_TO_OWNER_LABEL[String(user.role || '').toLowerCase()] || 'Creative';
        patch = { owner_user_id: user.id, owner: roleLabel, updated_by: actor };
      }
      const updated = await patchPost(post.post_id, patch);
      writeAudit({
        postId: post.post_id, field: 'owner',
        oldValue: post.owner, newValue: user == null ? null : (ROLE_TO_OWNER_LABEL[String(user.role || '').toLowerCase()] || 'Creative'),
        actor,
      }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      logClick('pcs_react_panel_edit', { field: 'owner' });
      toast(user == null ? 'Owner cleared' : 'Owner updated', 'success');
      setExpandedField(null);
    } catch (err) {
      logError(err, { context: 'pcs_react_panel_edit', field: 'owner' });
      toast('Save failed', 'error');
    }
    setBusy(false);
  }

  async function onCopy() {
    const text = (post.title || 'Post') + '\n' + buildShortUrl(post.post_id);
    const ok = await copyToClipboard(text);
    logClick('pcs_react_panel_copy', { ok });
    toast(ok ? 'Link copied' : 'Copy failed', ok ? 'success' : 'error');
    setTimeout(onClose, 130);
  }

  function onWa() {
    const hasCaption = !!(post.caption && post.caption.trim());
    if (!hasCaption) { toast('Add a caption before sharing', 'warning'); return; }
    logClick('pcs_react_panel_wa_share', {});
    openWhatsAppShare(post.title, post.post_id);
    setTimeout(onClose, 130);
  }

  function onLi() {
    if (!post.linkedin_link) return;
    logClick('pcs_react_panel_linkedin', {});
    if (typeof window !== 'undefined') window.open(post.linkedin_link, '_blank');
    setTimeout(onClose, 130);
  }

  async function onDelete() {
    if (busy) return;
    if (!window.confirm(`Delete this post permanently?\n\n${post.title || post.post_id}`)) return;
    setBusy(true);
    try {
      await deletePost(post.post_id);
      logClick('pcs_react_panel_delete', { postId: post.post_id });
      toast('Post deleted', 'success');
      pcsFlow.close();
    } catch (err) {
      logError(err, { context: 'pcs_react_panel_delete' });
      toast('Delete failed', 'error');
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="font-mono text-xs tracking-widest uppercase text-text-dim px-[18px] pt-3 pb-1.5">METADATA</div>

      <SheetRow
        field="stage"
        label="Stage"
        value={STAGE_LABELS[post.stage] || post.stage || 'Not set'}
        expanded={expandedField === 'stage'}
        onToggle={() => toggleField('stage')}
      >
        <StageOptions post={post} onSelect={saveStage} />
      </SheetRow>

      <SheetRow
        field="owner"
        label="Owner"
        value={post.owner || 'Not set'}
        placeholder={!post.owner}
        expanded={expandedField === 'owner'}
        onToggle={() => toggleField('owner')}
      >
        <OwnerOptions
          userRoles={userRoles}
          currentOwnerId={post.owner_user_id}
          onSelect={saveOwner}
          onClear={() => saveOwner(null)}
        />
      </SheetRow>

      <SheetRow
        field="date"
        label="Date"
        value={post.target_date ? formatDateLong(post.target_date) : 'Not set'}
        placeholder={!post.target_date}
        expanded={expandedField === 'date'}
        onToggle={() => toggleField('date')}
      >
        <DateInput
          value={post.target_date}
          onChange={(v) => savePatch('target_date', v, 'date')}
          onClear={() => savePatch('target_date', null, 'date')}
        />
      </SheetRow>

      <SheetRow
        field="format"
        label="Format"
        value={post.format || 'Not set'}
        placeholder={!post.format}
        expanded={expandedField === 'format'}
        onToggle={() => toggleField('format')}
      >
        <OptionList
          options={FORMATS}
          current={post.format}
          onSelect={(v) => savePatch('format', v, 'format')}
          onClear={() => savePatch('format', null, 'format')}
        />
      </SheetRow>

      <SheetRow
        field="pillar"
        label="Pillar"
        value={pillarDisplay(post.content_pillar) || 'Not set'}
        placeholder={!post.content_pillar}
        expanded={expandedField === 'pillar'}
        onToggle={() => toggleField('pillar')}
      >
        <PillarList
          current={post.content_pillar}
          onSelect={(v) => savePatch('content_pillar', v, 'content_pillar')}
          onClear={() => savePatch('content_pillar', null, 'content_pillar')}
        />
      </SheetRow>

      <SheetRow
        field="location"
        label="Location"
        value={post.location || 'Not set'}
        placeholder={!post.location}
        expanded={expandedField === 'location'}
        onToggle={() => toggleField('location')}
      >
        <OptionList
          options={LOCATIONS}
          current={post.location}
          onSelect={(v) => savePatch('location', v, 'location')}
          onClear={() => savePatch('location', null, 'location')}
        />
      </SheetRow>

      <SheetRow
        field="canva"
        label="Canva"
        value={shortenUrl(post.canva_link) || 'Not set'}
        placeholder={!post.canva_link}
        expanded={expandedField === 'canva'}
        onToggle={() => toggleField('canva')}
      >
        <UrlInput
          value={post.canva_link}
          placeholder="https://canva.com/..."
          onSave={(v) => savePatch('canva_link', v || null, 'canva_link')}
        />
      </SheetRow>

      <div className="font-mono text-xs tracking-widest uppercase text-text-dim px-[18px] pt-3 pb-1.5">SHARE</div>

      <ActionRow label="Copy link" value={buildShortUrl(post.post_id)} onClick={onCopy} />
      <ActionRow label="Share on WhatsApp" onClick={onWa} />
      {post.linkedin_link ? (
        <ActionRow label="Open on LinkedIn" onClick={onLi} />
      ) : null}

      {isAdmin ? (
        <>
          <div className="font-mono text-xs tracking-widest uppercase text-text-dim px-[18px] pt-3 pb-1.5">DANGER</div>
          <button
            onClick={onDelete}
            disabled={busy}
            className="block w-[calc(100%-28px)] mx-[14px] mb-2.5 mt-1.5 p-3 border border-divider-subtle bg-transparent rounded-card text-red font-sans text-lg font-medium text-center disabled:opacity-50"
            style={{ transition: 'all 0.12s ease' }}
          >
            Delete post
          </button>
        </>
      ) : null}
    </BottomSheet>
  );
}
