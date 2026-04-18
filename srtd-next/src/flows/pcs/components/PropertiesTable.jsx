import React from 'react';
import { ownerToRole, titleCase } from '../utils/stage.js';
import { formatTargetDate, daysUntil } from '../utils/time.js';

const DOT = '\u00B7';
const DASH = '-';

function isOverdue(iso, stage) {
  if (!iso) return false;
  if (stage === 'published' || stage === 'rejected' || stage === 'parked') return false;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return target < today.getTime();
}

function PropRow({ keyLabel, onClick, canEdit, children }) {
  const cls = `flex items-center gap-3 px-3 py-2.5 border-b border-divider-soft last:border-b-0 min-h-[40px] ${canEdit ? 'cursor-pointer hover:bg-bg-2' : 'cursor-not-allowed'}`;
  return (
    <div className={cls} onClick={canEdit ? onClick : undefined} role={canEdit ? 'button' : undefined} tabIndex={canEdit ? 0 : undefined}>
      <div className="font-mono text-sm text-text-dim tracking-wide uppercase w-[72px] flex-shrink-0">{keyLabel}</div>
      <div className="flex-1 min-w-0 flex items-baseline gap-2 text-lg text-text-loud tracking-tight">{children}</div>
    </div>
  );
}

export function PropertiesTable({ post, canEdit, onEdit }) {
  if (!post) return null;
  const ownerUser = post.owner_user_id && typeof post.owner_user_id === 'object' ? post.owner_user_id : null;
  const roleKey = ownerUser?.role ? String(ownerUser.role).toLowerCase() : ownerToRole(post.owner);
  const displayName = ownerUser?.name || post.owner || DASH;
  const showRoleSuffix = displayName && displayName.toLowerCase() !== roleKey.toLowerCase();
  const targetFmt = formatTargetDate(post.target_date);
  const targetRel = daysUntil(post.target_date);
  const overdue = isOverdue(post.target_date, post.stage);
  const fmt = post.format || DASH;
  const pillar = post.content_pillar ? titleCase(post.content_pillar) : DASH;
  const loc = post.location || DASH;

  const open = (which) => () => { if (canEdit && onEdit) onEdit(which); };

  return (
    <div className="border-b border-divider-warm">
      <PropRow keyLabel="Owner" canEdit={canEdit} onClick={open('owner')}>
        <span>{displayName}</span>
        {showRoleSuffix && <span className="text-text-soft text-sm">{DOT} {titleCase(roleKey)}</span>}
      </PropRow>
      <PropRow keyLabel="Target" canEdit={canEdit} onClick={open('target')}>
        {targetFmt ? (
          <>
            <span className={overdue ? 'text-amber' : ''}>{targetFmt}</span>
            {targetRel && <span className={`text-sm ${overdue ? 'text-amber' : 'text-text-soft'}`}>{DOT} {targetRel}</span>}
          </>
        ) : <span className="text-text-soft">{DASH}</span>}
      </PropRow>
      <PropRow keyLabel="Format" canEdit={canEdit} onClick={open('format')}>
        <span className={fmt !== DASH ? 'text-terracotta' : 'text-text-soft'}>{fmt}</span>
      </PropRow>
      <PropRow keyLabel="Pillar" canEdit={canEdit} onClick={open('pillar')}>
        <span className={pillar !== DASH ? 'text-text-loud' : 'text-text-soft'}>{pillar}</span>
      </PropRow>
      <PropRow keyLabel="Location" canEdit={canEdit} onClick={open('location')}>
        <span className={loc !== DASH ? 'text-text-loud' : 'text-text-soft'}>{loc}</span>
      </PropRow>
    </div>
  );
}
