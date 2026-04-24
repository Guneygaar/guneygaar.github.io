import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MoreVertical, Undo2, BellRing, Send, Calendar as CalendarIcon,
  ArrowUpFromLine, UserPlus, RefreshCw, RotateCcw, ChevronRight
} from 'lucide-react';
import { useOptimisticPatch } from '../../../core/hooks/useOptimisticPatch.js';
import { createComment } from '../../../core/api/comments.js';
import { apiFetch } from '../../../core/api/client.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { useAppState } from '../../../core/stores/appState.js';
import { STAGE_LABELS } from '../utils/stage.js';

const ICONS = {
  recall: Undo2,
  nudge_client: BellRing,
  send_for_approval: Send,
  reschedule: CalendarIcon,
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
  brief:                ['assign', 'rework_brief'],
  in_production:        ['recall', 'send_for_approval'],
  ready:                ['recall', 'send_for_approval'],
  awaiting_approval:    ['recall', 'nudge_client'],
  awaiting_brand_input: ['recall', 'nudge_client'],
  scheduled:            ['recall', 'reschedule', 'publish_now'],
  rejected:             ['revive'],
  parked:               ['revive'],
  published:            []
};

const RECALL_STAGE_ORDER = [
  'brief',
  'in_production',
  'ready',
  'awaiting_brand_input',
  'awaiting_approval',
  'scheduled',
  'published'
];

function earlierStages(currentStage) {
  const idx = RECALL_STAGE_ORDER.indexOf(currentStage);
  if (idx <= 0) return [];
  return RECALL_STAGE_ORDER.slice(0, idx);
}

function effectiveRoleTitleCase() {
  const user = useAppState.getState().user || {};
  const raw = String(user.effectiveRole || user.role || '').toLowerCase();
  if (raw === 'admin') return 'Admin';
  if (raw === 'servicing') return 'Servicing';
  if (raw === 'creative') return 'Creative';
  if (raw === 'client') return 'Client';
  return 'Admin';
}

export function PcsKebabMenu({ post, actor, canEdit, onOpenSheet, onReschedule }) {
  const [open, setOpen] = useState(false);
  const [recallMode, setRecallMode] = useState(false);
  const rootRef = useRef(null);
  const { commit } = useOptimisticPatch();

  const stage = post && post.stage;
  const items = useMemo(() => {
    if (!canEdit) return null;
    return STAGE_MATRIX[stage] || [];
  }, [canEdit, stage]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target)) return;
      setOpen(false);
      setRecallMode(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') { setOpen(false); setRecallMode(false); }
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

  function dismiss() {
    setOpen(false);
    setRecallMode(false);
  }

  async function saveStage(newStage, auditLabel) {
    try {
      await commit('stage', newStage, { stage: true, auditField: 'stage', actor });
      logClick('pcs_react_kebab_stage', { to: newStage });
    } catch (err) {
      logError(err, { context: 'pcs_react_kebab_stage', to: newStage });
    }
  }

  async function nudgeClient() {
    const message = window.prompt('Message to client:', 'Could you please take a look?');
    if (message == null) return;
    const trimmed = String(message).trim();
    if (!trimmed) return;
    const email = (useAppState.getState().user && useAppState.getState().user.email) || '';
    if (!email) {
      toast('Session expired, please refresh', 'error');
      return;
    }
    try {
      await createComment({
        post_id: post.post_id,
        author: email,
        author_role: effectiveRoleTitleCase(),
        message: trimmed,
        visibility: 'all',
        post_title: post.title || '',
        created_at: new Date().toISOString()
      });
      logClick('pcs_react_kebab_nudge', { post_id: post.post_id });
      toast('Client nudged', 'success');
    } catch (err) {
      logError(err, { context: 'pcs_react_kebab_nudge' });
      toast((err && err.message) || 'Nudge failed', 'error');
    }
  }

  async function onItem(key) {
    if (key === 'recall') {
      setRecallMode(true);
      return;
    }
    if (key === 'send_for_approval') {
      dismiss();
      saveStage('awaiting_approval');
      return;
    }
    if (key === 'publish_now') {
      dismiss();
      const ok = window.confirm('Publish now?');
      if (!ok) return;
      saveStage('published');
      return;
    }
    if (key === 'revive') {
      dismiss();
      saveStage('in_production');
      return;
    }
    if (key === 'reschedule') {
      dismiss();
      if (typeof onReschedule === 'function') onReschedule();
      else if (typeof onOpenSheet === 'function') onOpenSheet();
      return;
    }
    if (key === 'nudge_client') {
      dismiss();
      nudgeClient();
      return;
    }
    if (key === 'assign') {
      dismiss();
      if (typeof onOpenSheet === 'function') onOpenSheet();
      return;
    }
    if (key === 'rework_brief') {
      dismiss();
      if (typeof onOpenSheet === 'function') onOpenSheet();
      return;
    }
  }

  function pickRecall(toStage) {
    dismiss();
    saveStage(toStage);
    // Log a semantic 'recalled' activity row alongside the commit's
    // built-in audit write so surface-level activity feeds read cleanly.
    apiFetch('/activity_log', {
      method: 'POST',
      body: JSON.stringify({
        post_id: post.post_id,
        actor: actor || '',
        action: 'recalled',
        old_stage: stage,
        new_stage: toStage,
        created_at: new Date().toISOString()
      })
    }).catch((err) => {
      logError(err, { context: 'pcs_react_kebab_recall_activity' });
    });
  }

  if (!items) return null;

  const recallOptions = recallMode ? earlierStages(stage) : [];

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setOpen((v) => !v); setRecallMode(false); }}
        className="w-9 h-9 inline-flex items-center justify-center rounded-sm2 text-text-mid hover:text-text-loud active:bg-bg-2 active:scale-[0.96]"
        style={{ transition: 'background 0.08s ease, color 0.1s ease, transform 0.08s ease' }}
      >
        <MoreVertical size={17} strokeWidth={1.75} />
      </button>

      {open ? (
        <div
          role="menu"
          className="rounded-card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: '220px',
            background: 'var(--c-bg-2)',
            border: '1px solid var(--c-divider-soft)',
            boxShadow: '0 8px 24px -8px rgba(0,0,0,.4)',
            zIndex: 30,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {recallMode ? (
            <>
              <div style={{
                padding: '8px 10px 6px',
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '10px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--c-text-dim)'
              }}>
                Recall to
              </div>
              {recallOptions.length === 0 ? (
                <div style={{
                  padding: '10px 12px',
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '12px',
                  color: 'var(--c-text-dim)',
                  fontStyle: 'italic'
                }}>No earlier stage</div>
              ) : recallOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  onClick={() => pickRecall(s)}
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
                  <span>{STAGE_LABELS[s] || s}</span>
                </button>
              ))}
            </>
          ) : (
            items.length === 0 ? (
              <div style={{
                padding: '10px 12px',
                fontFamily: '"DM Sans", sans-serif',
                fontSize: '12px',
                color: 'var(--c-text-dim)',
                fontStyle: 'italic'
              }}>No actions</div>
            ) : items.map((key) => {
              const Icon = ICONS[key];
              const showChevron = key === 'recall' || key === 'assign' || key === 'rework_brief' || key === 'reschedule';
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  onClick={() => onItem(key)}
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
                  {Icon ? <Icon size={15} strokeWidth={1.75} /> : null}
                  <span style={{ flex: 1 }}>{LABELS[key]}</span>
                  {showChevron ? <ChevronRight size={12} strokeWidth={1.75} style={{ color: 'var(--c-text-dim)' }} /> : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
