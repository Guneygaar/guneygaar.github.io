import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { BottomSheet, Avatar } from '../../../core/ui/index.js';
import { deletePost } from '../../../core/api/posts.js';
import { copyToClipboard } from '../../../core/bridges/clipboard.js';
import { openWhatsAppShare, buildShortUrl } from '../../../core/bridges/whatsapp.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { useOptimisticPatch } from '../../../core/hooks/useOptimisticPatch.js';
import { useIsClient } from '../../../core/stores/appState.js';
import { pcsFlow } from '../index.js';
import { STAGE_LABELS, ownerToRole, titleCase } from '../utils/stage.js';
import { FORMATS, PILLARS, LOCATIONS } from '../../../core/mappings.js';

const ROLE_TO_OWNER_LABEL = {
  admin: 'Admin', servicing: 'Servicing',
  creative: 'Creative', client: 'Client',
};

const STAGES_BY_GROUP = {
  progression: [
    { value: 'brief',                label: 'Brief',                token: 'brief' },
    { value: 'in_production',        label: 'In production',        token: 'production' },
    { value: 'ready',                label: 'Ready',                token: 'ready' },
    { value: 'awaiting_approval',    label: 'Awaiting approval',    token: 'ready' },
    { value: 'awaiting_brand_input', label: 'Awaiting brand input', token: 'input' },
    { value: 'scheduled',            label: 'Scheduled',            token: 'scheduled' },
    { value: 'published',            label: 'Published',            token: 'scheduled' },
  ],
  offpath: [
    { value: 'parked',   label: 'Parked',   token: null },
    { value: 'rejected', label: 'Rejected', token: null },
  ],
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
          maxHeight: expanded ? 9999 : 0,
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

function ReadOnlyRow({ field, label, value, placeholder = false }) {
  return (
    <div className="overflow-hidden" data-field={field}>
      <div
        className="flex items-center justify-between px-[18px] py-3 min-h-12 border-t border-divider-subtle"
      >
        <div className="font-sans text-lg font-medium text-text-loud">{label}</div>
        <div className="flex items-center gap-2 max-w-[65%]">
          <div className={`font-sans text-lg truncate ${placeholder ? 'text-text-dim italic' : 'text-text-mid'}`}>
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageOptions({ post, onSelect, onPublishCommit }) {
  const [pendingPublish, setPendingPublish] = useState(false);
  const currentStage = post?.stage || '';

  function onTap(value) {
    if (pendingPublish) {
      // User was mid-publish and tapped a different stage.
      // Cancel publish flow and commit the new stage.
      if (value !== 'published') {
        setPendingPublish(false);
        onSelect(value);
      }
      return;
    }
    if (value === 'published') {
      setPendingPublish(true);
      return;
    }
    onSelect(value);
  }

  function onPublishCancel() {
    setPendingPublish(false);
  }

  function onPublishSave(url) {
    setPendingPublish(false);
    onPublishCommit(url);
  }

  return (
    <div>
      <div className="font-mono text-xs tracking-widest uppercase
                      text-text-dim px-3 pt-1 pb-2">
        Progression
      </div>
      {STAGES_BY_GROUP.progression.map((s) => (
        <React.Fragment key={s.value}>
          <StageChoice
            stage={s}
            isCurrent={!pendingPublish && s.value === currentStage}
            isPendingSelected={pendingPublish && s.value === 'published'}
            onTap={() => onTap(s.value)}
          />
          {pendingPublish && s.value === 'published' ? (
            <PublishUrlPanel
              existingUrl={post?.linkedin_link || ''}
              onCancel={onPublishCancel}
              onSave={onPublishSave}
            />
          ) : null}
        </React.Fragment>
      ))}

      <div className="font-mono text-xs tracking-widest uppercase
                      text-text-dim px-3 pt-4 pb-2">
        Off-path
      </div>
      {STAGES_BY_GROUP.offpath.map((s) => (
        <StageChoice
          key={s.value}
          stage={s}
          isCurrent={!pendingPublish && s.value === currentStage}
          isPendingSelected={false}
          onTap={() => onTap(s.value)}
        />
      ))}
    </div>
  );
}

function StageChoice({ stage, isCurrent, isPendingSelected, onTap }) {
  const selected = isCurrent || isPendingSelected;
  const dotStyle = stage.token
    ? { backgroundColor: `var(--c-stage-${stage.token})` }
    : { backgroundColor: 'var(--c-text-dim)' };
  return (
    <button
      onClick={onTap}
      className={`w-full flex items-center gap-3 px-3 py-2.5
                  rounded-block text-left mb-px
                  ${selected ? 'bg-bg-2 font-medium' : ''}
                  active:bg-bg-2`}
      style={{ transition: 'background 0.1s ease' }}
    >
      <span
        className={`w-[18px] h-[18px] rounded-full flex items-center
                    justify-center flex-shrink-0 border-[1.5px]
                    ${selected
                        ? 'border-terracotta bg-terracotta'
                        : 'border-border-neutral'}`}
        style={{ transition: 'all 0.18s ease' }}
      >
        {selected ? (
          <span
            className="w-[7px] h-[7px] rounded-full"
            style={{ backgroundColor: '#fff' }}
          />
        ) : null}
      </span>
      <span
        className="flex-1 font-sans text-lg text-text-loud"
      >
        {stage.label}
      </span>
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={dotStyle}
      />
    </button>
  );
}

function PublishUrlPanel({ existingUrl, onCancel, onSave }) {
  const [url, setUrl] = useState(existingUrl || '');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const trimmed = url.trim();
  const isEmpty = trimmed.length === 0;
  const isValid = /^https?:\/\/(www\.)?linkedin\.com\//.test(trimmed);
  const showError = touched && !isEmpty && !isValid;
  const canSubmit = isValid;

  function onInputChange(e) {
    setUrl(e.target.value);
    if (!touched) setTouched(true);
  }

  function onSubmit() {
    if (!canSubmit) return;
    onSave(trimmed);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div
      className="bg-bg-2 rounded-card p-3.5 ml-8 mr-3 mb-2.5 mt-1"
      style={{
        animation: 'pcsPublishPanelIn 0.22s cubic-bezier(0.2,0,0.1,1)',
      }}
    >
      <div className="font-mono text-xs tracking-widest uppercase
                      text-text-dim mb-2">
        LinkedIn URL
      </div>
      <input
        ref={inputRef}
        type="url"
        value={url}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        placeholder="https://linkedin.com/posts/..."
        autoComplete="off"
        spellCheck="false"
        className={`w-full bg-bg-pill rounded-input px-3.5 py-3
                    font-sans text-lg text-text-loud outline-none
                    border
                    ${showError ? 'border-red' : 'border-divider-soft'}`}
        style={{
          WebkitAppearance: 'none',
          appearance: 'none',
          minHeight: 44,
          transition: 'border-color 0.15s ease',
        }}
      />
      <div
        className={`text-sm mt-2 ${showError ? 'text-red' : 'text-text-soft'}`}
        style={{ transition: 'color 0.15s ease' }}
      >
        {showError
          ? 'URL must be a linkedin.com link.'
          : 'Required. Client email includes this link.'}
      </div>
      <div className="flex justify-end gap-2 mt-3.5">
        <button
          onClick={onCancel}
          className="font-sans text-lg font-medium text-text-soft
                     px-3.5 py-2 rounded-block active:bg-bg-3"
          style={{ transition: 'background 0.1s ease' }}
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`font-sans text-lg font-medium px-4 py-2
                      rounded-block
                      ${canSubmit
                          ? 'bg-terracotta text-bg'
                          : 'bg-text-dim opacity-40 cursor-not-allowed'}`}
          style={{ color: canSubmit ? '#fff' : undefined,
                   transition: 'opacity 0.15s ease' }}
        >
          Publish
        </button>
      </div>
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
  const { commit } = useOptimisticPatch();
  const isClient = useIsClient();

  if (!post) return null;

  function toggleField(name) {
    if (!canEdit) return;
    setExpandedField((cur) => (cur === name ? null : name));
  }

  async function savePatch(column, value, auditField) {
    await commit(column, value, { auditField, actor });
    setExpandedField(null);
  }

  async function saveStage(newStage) {
    await commit('stage', newStage, {
      stage: true,
      auditField: 'stage',
      actor,
    });
    setExpandedField(null);
  }

  async function savePublish(url) {
    await commit('stage', 'published', {
      stage: true,
      auditField: 'stage',
      actor,
      extraPatch: { linkedin_link: url },
    });
    setExpandedField(null);
  }

  async function saveOwner(user) {
    if (!user) {
      await commit('owner', null, {
        auditField: 'owner',
        actor,
        extraPatch: { owner_user_id: null },
      });
    } else {
      const roleLabel = ROLE_TO_OWNER_LABEL[String(user.role || '').toLowerCase()] || 'Creative';
      await commit('owner', roleLabel, {
        auditField: 'owner',
        label: 'Owner',
        actor,
        extraPatch: { owner_user_id: user.id },
      });
    }
    setExpandedField(null);
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

  function onCanvaOpen() {
    if (!post.canva_link) return;
    logClick('pcs_react_panel_canva', {});
    if (typeof window !== 'undefined') window.open(post.canva_link, '_blank');
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

      {isClient ? (
        <>
          <ReadOnlyRow
            field="stage"
            label="Stage"
            value={STAGE_LABELS[post.stage] || post.stage || 'Not set'}
            placeholder={!post.stage}
          />

          <ReadOnlyRow
            field="owner"
            label="Owner"
            value={post.owner || 'Not set'}
            placeholder={!post.owner}
          />

          <ReadOnlyRow
            field="date"
            label="Date"
            value={post.target_date ? formatDateLong(post.target_date) : 'Not set'}
            placeholder={!post.target_date}
          />

          <ReadOnlyRow
            field="format"
            label="Format"
            value={post.format || 'Not set'}
            placeholder={!post.format}
          />

          <ReadOnlyRow
            field="pillar"
            label="Pillar"
            value={pillarDisplay(post.content_pillar) || 'Not set'}
            placeholder={!post.content_pillar}
          />

          <ReadOnlyRow
            field="location"
            label="Location"
            value={post.location || 'Not set'}
            placeholder={!post.location}
          />

          {post.canva_link ? (
            <ActionRow
              label="Canva"
              value={shortenUrl(post.canva_link)}
              onClick={onCanvaOpen}
            />
          ) : (
            <ReadOnlyRow
              field="canva"
              label="Canva"
              value="Not set"
              placeholder
            />
          )}
        </>
      ) : (
        <>
          <SheetRow
            field="stage"
            label="Stage"
            value={STAGE_LABELS[post.stage] || post.stage || 'Not set'}
            expanded={expandedField === 'stage'}
            onToggle={() => toggleField('stage')}
          >
            <StageOptions
              post={post}
              onSelect={saveStage}
              onPublishCommit={savePublish}
            />
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
        </>
      )}

      <div className="font-mono text-xs tracking-widest uppercase text-text-dim px-[18px] pt-3 pb-1.5">SHARE</div>

      <ActionRow label="Copy link" value={buildShortUrl(post.post_id)} onClick={onCopy} />
      <ActionRow label="Share on WhatsApp" onClick={onWa} />
      {post.linkedin_link ? (
        <ActionRow label="Open on LinkedIn" onClick={onLi} />
      ) : null}

      {isAdmin && !isClient ? (
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
