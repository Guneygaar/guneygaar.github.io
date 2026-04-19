import React from 'react';
import { ownerToRole, titleCase } from '../utils/stage.js';
import { formatTargetDate, daysUntil } from '../utils/time.js';

function isOverdue(iso, stage) {
  if (!iso) return false;
  if (stage === 'published' || stage === 'rejected' || stage === 'parked') return false;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return target < today.getTime();
}

function Chip({ onClick, canEdit, className = '', children }) {
  return (
    <button
      onClick={canEdit ? onClick : undefined}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-pill border font-sans text-base font-medium whitespace-nowrap flex-shrink-0 transition-colors ${canEdit ? 'cursor-pointer hover:bg-bg-3' : 'cursor-default'} bg-bg-2 border-border-neutral text-text-mid ${className}`}
    >
      {children}
    </button>
  );
}

export function PropertiesTable({ post, canEdit, onEdit }) {
  if (!post) return null;
  const ownerUser = post.owner_user_id && typeof post.owner_user_id === 'object' ? post.owner_user_id : null;
  const roleKey = ownerUser?.role ? String(ownerUser.role).toLowerCase() : ownerToRole(post.owner);
  const displayName = ownerUser?.name || post.owner || null;
  const targetFmt = formatTargetDate(post.target_date);
  const overdue = isOverdue(post.target_date, post.stage);
  const fmt = post.format;
  const pillar = post.content_pillar ? titleCase(post.content_pillar) : null;
  const loc = post.location;

  const open = (which) => (e) => { e.stopPropagation(); if (canEdit && onEdit) onEdit(which); };

  const ownerColorClass =
    roleKey === 'client' ? 'text-role-client border-role-client/30 bg-role-client/5' :
    roleKey === 'servicing' ? 'text-role-servicing border-role-servicing/30 bg-role-servicing/5' :
    roleKey === 'creative' ? 'text-role-creative border-role-creative/30 bg-role-creative/5' :
    roleKey === 'admin' ? 'text-role-admin border-role-admin/30 bg-role-admin/5' : '';

  return (
    <div
      className="flex gap-1.5 px-3 py-2.5 border-b border-divider-warm overflow-x-auto overflow-y-hidden scrollbar-none"
      style={{ touchAction: 'pan-x' }}
    >
      {displayName && (
        <Chip canEdit={canEdit} onClick={open('owner')} className={ownerColorClass}>
          {displayName}
          {canEdit && <span className="text-2xs opacity-50">▾</span>}
        </Chip>
      )}
      {(targetFmt || canEdit) && (
        <Chip canEdit={canEdit} onClick={open('target')} className={overdue ? 'text-amber border-amber/30 bg-amber/5' : ''}>
          {targetFmt || '+ Date'}
          {canEdit && <span className="text-2xs opacity-50">▾</span>}
        </Chip>
      )}
      {(fmt || canEdit) && (
        <Chip canEdit={canEdit} onClick={open('format')} className={fmt ? 'text-terracotta border-terracotta/30 bg-terracotta/5' : 'text-text-dim'}>
          {fmt || '+ Format'}
          {canEdit && <span className="text-2xs opacity-50">▾</span>}
        </Chip>
      )}
      {(pillar || canEdit) && (
        <Chip canEdit={canEdit} onClick={open('pillar')} className={pillar ? '' : 'text-text-dim'}>
          {pillar || '+ Pillar'}
          {canEdit && <span className="text-2xs opacity-50">▾</span>}
        </Chip>
      )}
      {(loc || canEdit) && (
        <Chip canEdit={canEdit} onClick={open('location')} className={loc ? '' : 'text-text-dim'}>
          {loc || '+ Location'}
          {canEdit && <span className="text-2xs opacity-50">▾</span>}
        </Chip>
      )}
    </div>
  );
}
