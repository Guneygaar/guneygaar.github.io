import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Avatar } from '../../../core/ui/index.js';
import { ownerToRole, titleCase } from '../utils/stage.js';
import { formatTargetDate, daysUntil } from '../utils/time.js';
import { patchPost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { useAppState } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { FORMATS, PILLARS, LOCATIONS } from '../../../core/mappings.js';

const ROLE_TO_OWNER_LABEL = { admin: 'Admin', servicing: 'Servicing', creative: 'Creative', client: 'Client' };
const DROPDOWN_MIN_WIDTH = 220;

function isOverdue(iso, stage) {
  if (!iso) return false;
  if (stage === 'published' || stage === 'rejected' || stage === 'parked') return false;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return target < today.getTime();
}

function quickDateOffset(days) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function Chip({ onClick, canEdit, active, className = '', children }) {
  return (
    <button
      type="button"
      onClick={canEdit ? onClick : undefined}
      aria-expanded={active ? 'true' : 'false'}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-pill border font-sans text-base font-medium whitespace-nowrap flex-shrink-0 transition-colors ${canEdit ? 'cursor-pointer hover:bg-bg-3' : 'cursor-default'} bg-bg-2 border-border-neutral text-text-mid ${active ? 'ring-2 ring-terracotta/40' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

function DropdownShell({ rect, onClose, children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    const onScroll = () => onClose();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const margin = 8;
  const preferredLeft = rect.left;
  const maxLeft = vw - DROPDOWN_MIN_WIDTH - margin;
  const left = Math.max(margin, Math.min(preferredLeft, maxLeft));
  const top = rect.bottom + 6;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-transparent" style={{ zIndex: 40 }} />
      <div
        className="fixed bg-bg-3 border border-border-neutral rounded-[14px] shadow-overlay overflow-hidden"
        style={{
          zIndex: 50,
          top,
          left,
          minWidth: DROPDOWN_MIN_WIDTH,
          maxHeight: '60vh',
          transform: mounted ? 'scale(1)' : 'scale(0.95)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 140ms ease-out, opacity 140ms ease-out',
          transformOrigin: 'top left'
        }}
        role="menu"
      >
        <div className="overflow-y-auto scrollbar-none" style={{ maxHeight: '60vh' }}>
          {children}
        </div>
      </div>
    </>
  );
}

function OptionRow({ selected, onClick, children, leading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-bg-2 ${selected ? 'bg-bg-2' : ''}`}
    >
      {leading}
      <span className="flex-1 text-sm text-text-loud">{children}</span>
      {selected && <Check size={14} className="text-terracotta flex-shrink-0" />}
    </button>
  );
}

export function PropertiesTable({ post, canEdit, userRoles }) {
  const actor = useAppState((s) => s.user?.email || '');
  const [drop, setDrop] = useState(null);

  if (!post) return null;

  const ownerUser = post.owner_user_id && typeof post.owner_user_id === 'object' ? post.owner_user_id : null;
  const roleKey = ownerUser?.role ? String(ownerUser.role).toLowerCase() : ownerToRole(post.owner);
  const displayName = ownerUser?.name || post.owner || null;
  const targetFmt = formatTargetDate(post.target_date);
  const overdue = isOverdue(post.target_date, post.stage);
  const fmt = post.format;
  const pillar = post.content_pillar ? titleCase(post.content_pillar) : null;
  const loc = post.location;
  const currentOwnerId = (post.owner_user_id && (post.owner_user_id.id || post.owner_user_id)) || null;

  async function savePatch(patch, auditField, oldValue, newValue) {
    try {
      const updated = await patchPost(post.post_id, { ...patch, updated_by: actor });
      writeAudit({ postId: post.post_id, field: auditField, oldValue, newValue, actor }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      logClick('pcs_react_prop_edit', { field: auditField });
      toast('Saved', 'success');
    } catch (err) {
      logError(err, { context: 'pcs_react_prop_edit', field: auditField });
      toast('Save failed', 'error');
    }
    setDrop(null);
  }

  async function saveOwner(user) {
    const roleLabel = ROLE_TO_OWNER_LABEL[String(user.role || '').toLowerCase()] || 'Creative';
    try {
      const updated = await patchPost(post.post_id, { owner: roleLabel, owner_user_id: user.id, updated_by: actor });
      writeAudit({ postId: post.post_id, field: 'owner', oldValue: post.owner, newValue: roleLabel, actor }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      logClick('pcs_react_owner_set', { userId: user.id });
      toast('Owner updated', 'success');
    } catch (err) {
      logError(err, { context: 'pcs_react_owner_set' });
      toast('Failed to set owner', 'error');
    }
    setDrop(null);
  }

  function openDrop(which, e) {
    if (!canEdit) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDrop({ which, rect });
  }

  const ownerColorClass =
    roleKey === 'client' ? 'text-role-client' :
    roleKey === 'servicing' ? 'text-role-servicing' :
    roleKey === 'creative' ? 'text-role-creative' :
    roleKey === 'admin' ? 'text-role-admin' : '';

  return (
    <>
      <div
        className="flex gap-1.5 px-3 py-2.5 border-b border-divider-warm overflow-x-auto overflow-y-hidden scrollbar-none"
        style={{ touchAction: 'pan-x' }}
      >
        {displayName && (
          <Chip canEdit={canEdit} active={drop?.which === 'owner'} onClick={(e) => openDrop('owner', e)} className={ownerColorClass}>
            {displayName}
            {canEdit && <span className="text-2xs opacity-50">{'\u25BE'}</span>}
          </Chip>
        )}
        {(targetFmt || canEdit) && (
          <Chip canEdit={canEdit} active={drop?.which === 'target'} onClick={(e) => openDrop('target', e)} className={overdue ? 'text-amber' : ''}>
            {targetFmt || '+ Date'}
            {canEdit && <span className="text-2xs opacity-50">{'\u25BE'}</span>}
          </Chip>
        )}
        {(fmt || canEdit) && (
          <Chip canEdit={canEdit} active={drop?.which === 'format'} onClick={(e) => openDrop('format', e)} className={fmt ? 'text-terracotta' : 'text-text-dim'}>
            {fmt || '+ Format'}
            {canEdit && <span className="text-2xs opacity-50">{'\u25BE'}</span>}
          </Chip>
        )}
        {(pillar || canEdit) && (
          <Chip canEdit={canEdit} active={drop?.which === 'pillar'} onClick={(e) => openDrop('pillar', e)} className={pillar ? '' : 'text-text-dim'}>
            {pillar || '+ Pillar'}
            {canEdit && <span className="text-2xs opacity-50">{'\u25BE'}</span>}
          </Chip>
        )}
        {(loc || canEdit) && (
          <Chip canEdit={canEdit} active={drop?.which === 'location'} onClick={(e) => openDrop('location', e)} className={loc ? '' : 'text-text-dim'}>
            {loc || '+ Location'}
            {canEdit && <span className="text-2xs opacity-50">{'\u25BE'}</span>}
          </Chip>
        )}
      </div>

      {drop && drop.which === 'owner' && (
        <DropdownShell rect={drop.rect} onClose={() => setDrop(null)}>
          <div className="py-1">
            {(Array.isArray(userRoles) ? userRoles : []).map((u) => {
              const r = ownerToRole(u.role);
              const selected = currentOwnerId === u.id;
              return (
                <OptionRow
                  key={u.id}
                  selected={selected}
                  onClick={() => saveOwner(u)}
                  leading={<Avatar name={u.display_name || u.name} role={r} size="md" avatarUrl={u.avatar_url} />}
                >
                  <span className="block text-text-loud truncate">{u.display_name || u.name}</span>
                  <span className="block font-mono text-2xs text-text-soft tracking-wide uppercase">{titleCase(r)}</span>
                </OptionRow>
              );
            })}
          </div>
        </DropdownShell>
      )}

      {drop && drop.which === 'target' && (
        <DropdownShell rect={drop.rect} onClose={() => setDrop(null)}>
          <div className="py-1">
            <OptionRow onClick={() => savePatch({ target_date: quickDateOffset(0) }, 'target_date', post.target_date, quickDateOffset(0))}>Today</OptionRow>
            <OptionRow onClick={() => savePatch({ target_date: quickDateOffset(1) }, 'target_date', post.target_date, quickDateOffset(1))}>Tomorrow</OptionRow>
            <OptionRow onClick={() => savePatch({ target_date: quickDateOffset(3) }, 'target_date', post.target_date, quickDateOffset(3))}>In 3 days</OptionRow>
            <OptionRow onClick={() => savePatch({ target_date: quickDateOffset(7) }, 'target_date', post.target_date, quickDateOffset(7))}>Next week</OptionRow>
            <div className="border-t border-divider-soft p-3">
              <label htmlFor="pcs-quick-date" className="block font-mono text-2xs text-text-soft tracking-widest uppercase mb-1.5">Custom date</label>
              <input
                id="pcs-quick-date"
                type="date"
                defaultValue={post.target_date || ''}
                min="2020-01-01"
                max="2035-12-31"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) savePatch({ target_date: v }, 'target_date', post.target_date, v);
                }}
                className="w-full px-3 py-2 rounded-sm2 bg-bg-2 border border-border-neutral text-text-loud text-sm"
                style={{ WebkitAppearance: 'none', appearance: 'none' }}
              />
              {post.target_date && (
                <button
                  type="button"
                  onClick={() => savePatch({ target_date: null }, 'target_date', post.target_date, null)}
                  className="mt-2 w-full px-3 py-1.5 rounded-sm2 border border-divider-soft text-2xs font-mono tracking-widest uppercase text-text-soft hover:text-text-mid"
                >
                  Clear date
                </button>
              )}
            </div>
          </div>
        </DropdownShell>
      )}

      {drop && drop.which === 'format' && (
        <DropdownShell rect={drop.rect} onClose={() => setDrop(null)}>
          <div className="py-1">
            {FORMATS.map((f) => (
              <OptionRow key={f} selected={post.format === f} onClick={() => savePatch({ format: f }, 'format', post.format, f)}>{f}</OptionRow>
            ))}
            {post.format && (
              <OptionRow onClick={() => savePatch({ format: null }, 'format', post.format, null)}>
                <span className="text-text-soft">Clear</span>
              </OptionRow>
            )}
          </div>
        </DropdownShell>
      )}

      {drop && drop.which === 'pillar' && (
        <DropdownShell rect={drop.rect} onClose={() => setDrop(null)}>
          <div className="py-1">
            {PILLARS.map((p) => {
              const v = p.toLowerCase();
              return (
                <OptionRow key={v} selected={post.content_pillar === v} onClick={() => savePatch({ content_pillar: v }, 'content_pillar', post.content_pillar, v)}>{p}</OptionRow>
              );
            })}
            {post.content_pillar && (
              <OptionRow onClick={() => savePatch({ content_pillar: null }, 'content_pillar', post.content_pillar, null)}>
                <span className="text-text-soft">Clear</span>
              </OptionRow>
            )}
          </div>
        </DropdownShell>
      )}

      {drop && drop.which === 'location' && (
        <DropdownShell rect={drop.rect} onClose={() => setDrop(null)}>
          <div className="py-1">
            {LOCATIONS.map((l) => (
              <OptionRow key={l} selected={post.location === l} onClick={() => savePatch({ location: l }, 'location', post.location, l)}>{l}</OptionRow>
            ))}
            {post.location && (
              <OptionRow onClick={() => savePatch({ location: null }, 'location', post.location, null)}>
                <span className="text-text-soft">Clear</span>
              </OptionRow>
            )}
          </div>
        </DropdownShell>
      )}
    </>
  );
}
