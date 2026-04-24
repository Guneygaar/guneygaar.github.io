// Kebab menu for MiniCardSheet top bar. Hidden for clients. Shows a
// stage-appropriate action matrix. Dismisses on item tap, outside
// click, or Escape.
//
// Role gating: planStore exposes 'admin' | 'agency' | 'client'. The
// store collapses creative + servicing into 'agency' (see setRole in
// planStore.js), so this component treats both roles as full-matrix.
// Client users see nothing.

import React, { useEffect, useRef, useState } from 'react';
import {
  MoreVertical, Undo2, BellRing, Send, Calendar, ArrowUpFromLine,
  UserPlus, RefreshCw, RotateCcw
} from 'lucide-react';

const ICONS = {
  recall: Undo2,
  nudge_client: BellRing,
  send_for_approval: Send,
  reschedule: Calendar,
  publish_now: ArrowUpFromLine,
  assign: UserPlus,
  rework_brief: RefreshCw,
  revive: RotateCcw
};

const LABELS = {
  recall: 'Recall',
  nudge_client: 'Nudge client',
  send_for_approval: 'Send for approval',
  reschedule: 'Reschedule',
  publish_now: 'Publish now',
  assign: 'Assign',
  rework_brief: 'Rework brief',
  revive: 'Revive'
};

const STAGE_MATRIX = {
  awaiting_approval:    ['recall', 'nudge_client'],
  awaiting_brand_input: ['recall', 'nudge_client'],
  in_production:        ['recall', 'send_for_approval'],
  scheduled:            ['recall', 'reschedule', 'publish_now'],
  brief_done:           ['recall', 'assign', 'rework_brief'],
  rejected:             ['revive'],
  parked:               ['revive'],
  published:            []
};

function itemsFor(role, stage) {
  if (role === 'client') return null;
  const base = STAGE_MATRIX[stage];
  if (!base) return [];
  return base;
}

export function KebabMenu({ post, role, onAction }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const stage = post && post.stage;
  const items = itemsFor(role, stage);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items === null) return null;

  function handleItem(key) {
    setOpen(false);
    if (typeof onAction === 'function') onAction(key);
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '6px',
          cursor: 'pointer',
          color: 'var(--c-text-mid)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <MoreVertical size={18} />
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: '200px',
            background: 'var(--c-bg-2)',
            border: '1px solid var(--c-divider-soft)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px -8px rgba(0,0,0,.4)',
            zIndex: 20,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {items.length === 0 ? (
            <div
              style={{
                padding: '10px 12px',
                fontFamily: '"DM Sans", sans-serif',
                fontSize: '12px',
                color: 'var(--c-text-dim)',
                fontStyle: 'italic'
              }}
            >
              No actions
            </div>
          ) : (
            items.map((key) => {
              const Icon = ICONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  onClick={() => handleItem(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '9px 10px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: '13px',
                    color: 'var(--c-text-loud)'
                  }}
                >
                  {Icon ? <Icon size={15} /> : null}
                  <span>{LABELS[key]}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
