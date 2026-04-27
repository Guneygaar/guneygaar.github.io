// PR-2 plan-feature sheets. All five share a common SlideUp shell that
// matches the CommentActionSheet pattern: backdrop + max-w-[430px] panel
// pinned to the bottom, Esc closes, focus trap, prefers-reduced-motion
// respected. CSS vars only.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, FilePlus, Link2, Trash2, CornerDownRight, Check, RotateCcw } from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';
import { STAGE_LABELS, STAGE_COLOR_VAR } from '../shared/constants.js';
import { PILLARS, FORMATS } from '../../../core/mappings.js';

if (!Array.isArray(PILLARS) || PILLARS.length === 0) {
  throw new Error('PlanSheets: PILLARS constant missing from core/mappings.js');
}
if (!Array.isArray(FORMATS) || FORMATS.length === 0) {
  throw new Error('PlanSheets: FORMATS constant missing from core/mappings.js');
}

const FONT_BODY = '"DM Sans", sans-serif';
const FONT_HEAD = 'Fraunces, serif';
const FONT_MONO = '"IBM Plex Mono", monospace';

const TRIGGER_LABELS = {
  sent_for_alignment: 'Sent for alignment',
  changes_requested:  'Changes requested',
  aligned:            'Aligned',
  manual_snapshot:    'Snapshot'
};

const TRIGGER_COLOR = {
  sent_for_alignment: '--c-amber',
  changes_requested:  '--c-stage-input',
  aligned:            '--c-green',
  manual_snapshot:    '--c-text-soft'
};

function relativeTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
}

function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function SlideUp({ title, onClose, children, fixedHeight }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reduced = prefersReducedMotion();

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.5)',
        zIndex: 2500
      }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={reduced ? '' : 'plan-mini-card-sheet-enter'}
        style={{
          position: 'fixed',
          left: 0, right: 0, bottom: 0,
          maxWidth: '430px',
          margin: '0 auto',
          maxHeight: fixedHeight ? 'auto' : '85vh',
          background: 'var(--c-bg)',
          borderTop: '1px solid var(--c-divider-warm)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          zIndex: 2501,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -30px 80px -20px rgba(0,0,0,.5)'
        }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 12px 12px 16px',
          borderBottom: '1px solid var(--c-divider-soft)'
        }}>
          <div style={{
            flex: 1,
            fontFamily: FONT_HEAD,
            fontSize: '16px',
            fontWeight: 500,
            color: 'var(--c-text-loud)'
          }}>{title}</div>
          <button type="button" aria-label="Close" onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            padding: '6px 10px',
            cursor: 'pointer',
            fontFamily: FONT_MONO,
            fontSize: '7px',
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: 'var(--c-terracotta-1)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <X size={12} />
            Close
          </button>
        </header>
        <div style={{ overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </>
  );
}

export function HistoryPanel() {
  const versions = usePlanStore((s) => s.planVersions);
  const close = usePlanStore((s) => s.closePlanSheet);
  const showToast = usePlanStore((s) => s.showToast);
  return (
    <SlideUp title={`History (${versions.length})`} onClose={close}>
      <div style={{ padding: '12px 16px 24px' }}>
        {versions.length === 0 ? (
          <div style={{ fontFamily: FONT_BODY, fontSize: '13px', color: 'var(--c-text-dim)' }}>
            No versions yet.
          </div>
        ) : versions.map((v) => {
          const color = `var(${TRIGGER_COLOR[v.trigger_event] || '--c-text-soft'})`;
          const cellCount = v.snapshot_jsonb && Array.isArray(v.snapshot_jsonb.cells)
            ? v.snapshot_jsonb.cells.length
            : (v.snapshot_jsonb && Array.isArray(v.snapshot_jsonb.cell_ids) ? v.snapshot_jsonb.cell_ids.length : 0);
          return (
            <div key={v.id || v.version_number} style={{
              padding: '12px',
              border: '1px solid var(--c-divider-soft)',
              background: 'var(--c-bg-2)',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontFamily: FONT_MONO,
                  fontSize: '7px',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--c-text-soft)',
                  padding: '3px 6px',
                  border: '1px solid var(--c-divider-soft)'
                }}>v{v.version_number}</span>
                <span style={{
                  fontFamily: FONT_MONO,
                  fontSize: '8px',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--c-text-loud)',
                  padding: '3px 6px',
                  border: `1px solid ${color}`,
                  background: `color-mix(in srgb, ${color} 14%, transparent)`
                }}>{TRIGGER_LABELS[v.trigger_event] || v.trigger_event}</span>
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: FONT_MONO,
                  fontSize: '7px',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--c-text-soft)'
                }}>{relativeTime(v.created_at)}</span>
              </div>
              <div style={{
                marginTop: '8px',
                fontFamily: FONT_BODY,
                fontSize: '13px',
                color: 'var(--c-text-loud)'
              }}>{v.triggered_by_name || 'Unknown'}{v.triggered_by_role ? ` - ${v.triggered_by_role}` : ''}</div>
              <div style={{
                marginTop: '4px',
                fontFamily: FONT_MONO,
                fontSize: '7px',
                letterSpacing: '.18em',
                textTransform: 'uppercase',
                color: 'var(--c-text-soft)'
              }}>{cellCount} cell{cellCount === 1 ? '' : 's'}</div>
              <button type="button" onClick={() => showToast({ msg: 'Diff view ships in PR-2.1', duration: 2000 })} style={{
                marginTop: '8px',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: FONT_MONO,
                fontSize: '9px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--c-terracotta-1)'
              }}>Diff -&gt;</button>
            </div>
          );
        })}
      </div>
    </SlideUp>
  );
}

export function CommentsPanel() {
  const comments = usePlanStore((s) => s.planComments);
  const close = usePlanStore((s) => s.closePlanSheet);
  const addComment = usePlanStore((s) => s.addPlanComment);
  const [draft, setDraft] = useState('');

  const sorted = useMemo(() => {
    return [...comments].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [comments]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    addComment({ planCellId: null, message: text });
    setDraft('');
  }

  return (
    <SlideUp title={`Comments (${sorted.length})`} onClose={close}>
      <div style={{ padding: '12px 16px 16px' }}>
        {sorted.length === 0 ? (
          <div style={{ fontFamily: FONT_BODY, fontSize: '13px', color: 'var(--c-text-dim)' }}>
            No comments yet.
          </div>
        ) : sorted.map((c) => {
          const initial = (c.author || '?').charAt(0).toUpperCase();
          const role = (c.author_role || '').toLowerCase();
          const roleColor = role === 'client'
            ? 'var(--c-role-client)'
            : role === 'admin'
              ? 'var(--c-role-admin)'
              : role === 'creative'
                ? 'var(--c-role-creative)'
                : 'var(--c-role-servicing)';
          return (
            <div key={c.id} style={{
              padding: '10px 0',
              borderBottom: '1px solid var(--c-divider-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span aria-hidden style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '24px',
                  border: `1.5px solid ${roleColor}`,
                  background: `color-mix(in srgb, ${roleColor} 14%, transparent)`,
                  fontFamily: FONT_MONO,
                  fontSize: '9px',
                  color: 'var(--c-text-loud)'
                }}>{initial}</span>
                <span style={{
                  fontFamily: FONT_BODY,
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--c-text-loud)'
                }}>{c.author || 'Unknown'}</span>
                <span style={{
                  fontFamily: FONT_MONO,
                  fontSize: '7px',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--c-text-soft)'
                }}>{c.author_role || ''}</span>
                <span style={{
                  fontFamily: FONT_MONO,
                  fontSize: '7px',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--c-text-soft)',
                  padding: '2px 6px',
                  border: '1px solid var(--c-divider-soft)'
                }}>{c.plan_cell_id ? 'Cell' : 'Plan-level'}</span>
                <span style={{
                  fontFamily: FONT_MONO,
                  fontSize: '7px',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--c-text-soft)'
                }}>v{c.version_number || 1}</span>
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: FONT_MONO,
                  fontSize: '7px',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--c-text-soft)'
                }}>{relativeTime(c.created_at)}</span>
              </div>
              <div style={{
                marginTop: '6px',
                fontFamily: FONT_HEAD,
                fontSize: '13px',
                fontStyle: 'italic',
                color: 'var(--c-text-loud)'
              }}>{c.message || ''}</div>
              {c.resolved ? (
                <span style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  fontFamily: FONT_MONO,
                  fontSize: '7px',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--c-green)'
                }}>Resolved</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: 'var(--c-bg)',
        borderTop: '1px solid var(--c-divider-soft)',
        padding: '10px 12px',
        display: 'flex',
        gap: '8px'
      }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment..."
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            padding: '8px 10px',
            background: 'var(--c-bg-2)',
            border: '1px solid var(--c-divider-soft)',
            color: 'var(--c-text-loud)',
            fontFamily: FONT_BODY,
            fontSize: '13px',
            outline: 'none'
          }} />
        <button type="button" onClick={send} disabled={!draft.trim()} style={{
          padding: '8px 14px',
          fontFamily: FONT_MONO,
          fontSize: '9px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          background: 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))',
          color: '#fff',
          border: 'none',
          opacity: draft.trim() ? 1 : 0.5,
          cursor: draft.trim() ? 'pointer' : 'not-allowed'
        }}>Send</button>
      </div>
    </SlideUp>
  );
}

export function ConfirmSendSheet() {
  const close = usePlanStore((s) => s.closePlanSheet);
  const send = usePlanStore((s) => s.sendPlanForAlignment);
  const cells = usePlanStore((s) => s.planCells);
  return (
    <SlideUp title="Send for alignment" onClose={close}>
      <div style={{ padding: '16px' }}>
        {cells.length > 0 ? (
          <div style={{
            marginBottom: '12px',
            maxHeight: '180px',
            overflowY: 'auto',
            border: '1px solid var(--c-divider-soft)',
            background: 'var(--c-bg-2)'
          }}>
            {cells.map((c) => (
              <div key={c.id} style={{
                padding: '8px 10px',
                borderBottom: '1px solid var(--c-divider-subtle)',
                fontFamily: FONT_BODY,
                fontSize: '13px',
                color: 'var(--c-text-loud)',
                lineHeight: 1.35,
                wordBreak: 'break-word'
              }}>{c.title || c.concept || 'Untitled concept'}</div>
            ))}
          </div>
        ) : null}
        <div style={{
          fontFamily: FONT_HEAD,
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--c-text-loud)'
        }}>Send {cells.length} concept{cells.length === 1 ? '' : 's'} for alignment?</div>
        <div style={{
          marginTop: '8px',
          fontFamily: FONT_BODY,
          fontSize: '13px',
          color: 'var(--c-text-mid)'
        }}>The client will be notified and the plan locks until they align or request changes.</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button type="button" onClick={close} style={{
            flex: 1,
            padding: '10px 14px',
            background: 'transparent',
            border: '1px solid var(--c-divider-warm)',
            color: 'var(--c-text-loud)',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}>Cancel</button>
          <button type="button" onClick={send} style={{
            flex: 1,
            padding: '10px 14px',
            background: 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))',
            border: 'none',
            color: '#fff',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}>Send</button>
        </div>
      </div>
    </SlideUp>
  );
}

export function ConfirmAlignSheet() {
  const close = usePlanStore((s) => s.closePlanSheet);
  const align = usePlanStore((s) => s.alignPlan);
  const cells = usePlanStore((s) => s.planCells);
  return (
    <SlideUp title="Align this plan" onClose={close} fixedHeight>
      <div style={{ padding: '16px' }}>
        <div style={{
          fontFamily: FONT_HEAD,
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--c-text-loud)'
        }}>Align this plan?</div>
        <div style={{
          marginTop: '8px',
          fontFamily: FONT_BODY,
          fontSize: '13px',
          color: 'var(--c-text-mid)'
        }}>{cells.length} post{cells.length === 1 ? '' : 's'} will be created in Brief and routed to your team.</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button type="button" onClick={close} style={{
            flex: 1,
            padding: '10px 14px',
            background: 'transparent',
            border: '1px solid var(--c-divider-warm)',
            color: 'var(--c-text-loud)',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}>Cancel</button>
          <button type="button" onClick={align} style={{
            flex: 1,
            padding: '10px 14px',
            background: 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))',
            border: 'none',
            color: '#fff',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}>Align</button>
        </div>
      </div>
    </SlideUp>
  );
}

export function ChangesSheet() {
  const close = usePlanStore((s) => s.closePlanSheet);
  const cells = usePlanStore((s) => s.planCells);
  const submit = usePlanStore((s) => s.requestChanges);
  const [selected, setSelected] = useState(() => new Set());
  const [message, setMessage] = useState('');

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  return (
    <SlideUp title="Request changes" onClose={close}>
      <div style={{ padding: '12px 16px' }}>
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: '13px',
          color: 'var(--c-text-mid)',
          marginBottom: '10px'
        }}>Select the concepts that need revision.</div>
        {cells.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 12px',
              marginBottom: '6px',
              background: selected.has(c.id) ? 'color-mix(in srgb, var(--c-stage-input) 14%, transparent)' : 'var(--c-bg-2)',
              border: `1px solid ${selected.has(c.id) ? 'var(--c-stage-input)' : 'var(--c-divider-soft)'}`,
              cursor: 'pointer',
              textAlign: 'left'
            }}>
            <span style={{
              width: '16px',
              height: '16px',
              border: `1.5px solid ${selected.has(c.id) ? 'var(--c-stage-input)' : 'var(--c-divider-warm)'}`,
              background: selected.has(c.id) ? 'var(--c-stage-input)' : 'transparent',
              flexShrink: 0
            }} />
            <span style={{
              flex: 1,
              fontFamily: FONT_BODY,
              fontSize: '13px',
              color: 'var(--c-text-loud)'
            }}>{c.concept || 'Untitled'}</span>
            <span style={{
              fontFamily: FONT_MONO,
              fontSize: '7px',
              letterSpacing: '.18em',
              textTransform: 'uppercase',
              color: 'var(--c-text-soft)'
            }}>{(c.cell_date || '').slice(5)} - {c.channel}</span>
          </button>
        ))}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional message"
          rows={3}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '12px',
            padding: '10px 12px',
            background: 'var(--c-bg-2)',
            border: '1px solid var(--c-divider-soft)',
            color: 'var(--c-text-loud)',
            fontFamily: FONT_BODY,
            fontSize: '13px',
            resize: 'vertical',
            outline: 'none'
          }} />
      </div>
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: 'var(--c-bg)',
        borderTop: '1px solid var(--c-divider-soft)',
        padding: '10px 12px',
        display: 'flex',
        gap: '8px'
      }}>
        <button type="button" onClick={close} style={{
          flex: 1,
          padding: '10px 14px',
          background: 'transparent',
          border: '1px solid var(--c-divider-warm)',
          color: 'var(--c-text-loud)',
          fontFamily: FONT_MONO,
          fontSize: '9px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          cursor: 'pointer'
        }}>Cancel</button>
        <button type="button" disabled={selected.size === 0} onClick={() => submit([...selected], message)} style={{
          flex: 1,
          padding: '10px 14px',
          background: 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))',
          border: 'none',
          color: '#fff',
          fontFamily: FONT_MONO,
          fontSize: '9px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          cursor: selected.size ? 'pointer' : 'not-allowed',
          opacity: selected.size ? 1 : 0.5
        }}>Submit ({selected.size})</button>
      </div>
    </SlideUp>
  );
}

const CELL_INPUT_STYLE = {
  display: 'block',
  width: '100%',
  padding: '10px 12px',
  background: 'var(--c-bg-2)',
  border: '1px solid var(--c-divider-soft)',
  color: 'var(--c-text-loud)',
  fontFamily: FONT_BODY,
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box'
};

const CELL_LABEL_STYLE = {
  display: 'block',
  marginTop: '12px',
  marginBottom: '4px',
  fontFamily: FONT_MONO,
  fontSize: '7px',
  letterSpacing: '.18em',
  textTransform: 'uppercase',
  color: 'var(--c-text-soft)'
};

export function PlanCellSheet() {
  const close = usePlanStore((s) => s.closePlanSheet);
  const role = usePlanStore((s) => s.role);
  const cell = usePlanStore((s) => s.activeCell);
  const comments = usePlanStore((s) => s.planComments);
  const update = usePlanStore((s) => s.updatePlanCell);
  const addComment = usePlanStore((s) => s.addPlanComment);
  const resolveComment = usePlanStore((s) => s.resolvePlanComment);
  const [title, setTitle] = useState(cell ? (cell.title || '') : '');
  const [pillar, setPillar] = useState(cell ? (cell.content_pillar || '') : '');
  const [format, setFormat] = useState(cell ? (cell.format || '') : '');
  const [concept, setConcept] = useState(cell ? (cell.concept || '') : '');
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const debounceRef = useRef(null);
  const conceptRef = useRef(null);

  useEffect(() => {
    setTitle(cell ? (cell.title || '') : '');
    setPillar(cell ? (cell.content_pillar || '') : '');
    setFormat(cell ? (cell.format || '') : '');
    setConcept(cell ? (cell.concept || '') : '');
    setReplyTo(null);
  }, [cell && cell.id]);

  useEffect(() => {
    if (conceptRef.current) autoGrow(conceptRef.current);
  }, [concept, cell && cell.id]);

  if (!cell) return null;

  const cellComments = comments
    .filter((c) => c.plan_cell_id === cell.id)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  // Single-level threading: top-level rows + replies grouped under parent.
  const repliesByParent = {};
  for (const c of cellComments) {
    if (c.reply_to) {
      if (!repliesByParent[c.reply_to]) repliesByParent[c.reply_to] = [];
      repliesByParent[c.reply_to].push(c);
    }
  }
  const topLevelComments = cellComments.filter((c) => !c.reply_to);

  const canEdit = role !== 'client';
  const canResolve = role !== 'client';

  function debouncedPatch(patch) {
    if (!canEdit || !cell.id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      update(cell.id, patch);
    }, 800);
  }

  function onTitleChange(v) {
    setTitle(v);
    debouncedPatch({ title: v.trim() ? v : null });
  }

  function onPillarChange(v) {
    setPillar(v);
    if (!canEdit || !cell.id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    update(cell.id, { content_pillar: v || null });
  }

  function onFormatChange(v) {
    setFormat(v);
    if (!canEdit || !cell.id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    update(cell.id, { format: v || null });
  }

  function onConceptChange(v) {
    setConcept(v);
    debouncedPatch({ concept: v });
  }

  async function commitAndClose() {
    if (!canEdit || !cell.id) {
      close();
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      await update(cell.id, {
        title: title.trim() ? title : null,
        content_pillar: pillar || null,
        format: format || null,
        concept
      });
    } catch (e) { /* updatePlanCell handles toast */ }
    close();
  }

  function send() {
    const text = draft.trim();
    if (!text || !cell.id) return;
    addComment({ planCellId: cell.id, message: text, replyTo: replyTo ? replyTo.id : null });
    setDraft('');
    setReplyTo(null);
  }

  const replyToAuthor = replyTo ? (replyTo.author || 'Unknown') : null;

  return (
    <SlideUp title={cell.title || 'Untitled concept'} onClose={close}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: '7px',
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: 'var(--c-text-soft)',
          marginBottom: '8px'
        }}>{(cell.cell_date || '').slice(0, 10)} - {cell.channel}</div>

        <label style={CELL_LABEL_STYLE}>Title</label>
        <input
          type="text"
          value={title}
          readOnly={!canEdit}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title"
          style={CELL_INPUT_STYLE} />

        <label style={CELL_LABEL_STYLE}>Pillar</label>
        <select
          value={pillar}
          disabled={!canEdit}
          onChange={(e) => onPillarChange(e.target.value)}
          style={CELL_INPUT_STYLE}>
          <option value="">- Select pillar -</option>
          {PILLARS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <label style={CELL_LABEL_STYLE}>Format</label>
        <select
          value={format}
          disabled={!canEdit}
          onChange={(e) => onFormatChange(e.target.value)}
          style={CELL_INPUT_STYLE}>
          <option value="">- Select format -</option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <label style={CELL_LABEL_STYLE}>Concept</label>
        <textarea
          ref={conceptRef}
          value={concept}
          readOnly={!canEdit}
          onChange={(e) => onConceptChange(e.target.value)}
          onInput={(e) => autoGrow(e.target)}
          placeholder="Concept..."
          style={{
            ...CELL_INPUT_STYLE,
            resize: 'none',
            minHeight: '120px',
            maxHeight: '60vh',
            overflowY: 'auto',
            lineHeight: 1.5
          }} />

        {canEdit ? (
          <button type="button" onClick={commitAndClose} style={{
            marginTop: '8px',
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid var(--c-divider-warm)',
            color: 'var(--c-text-loud)',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}>Save</button>
        ) : null}

        <div style={{
          marginTop: '16px',
          fontFamily: FONT_MONO,
          fontSize: '7px',
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: 'var(--c-text-soft)'
        }}>Comments ({cellComments.length})</div>

        <div style={{ marginTop: '6px' }}>
          {cellComments.length === 0 ? (
            <div style={{
              fontFamily: FONT_BODY,
              fontSize: '13px',
              color: 'var(--c-text-dim)'
            }}>No comments yet.</div>
          ) : topLevelComments.map((c) => {
            const replies = repliesByParent[c.id] || [];
            const isResolved = !!c.resolved;
            return (
              <div key={c.id} style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--c-divider-subtle)',
                opacity: isResolved ? 0.55 : 1
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <div style={{
                    fontFamily: FONT_BODY,
                    fontSize: '13px',
                    color: 'var(--c-text-loud)',
                    fontWeight: 500
                  }}>{c.author || 'Unknown'}</div>
                  <span style={{
                    fontFamily: FONT_MONO,
                    fontSize: '7px',
                    letterSpacing: '.18em',
                    textTransform: 'uppercase',
                    color: 'var(--c-text-soft)'
                  }}>{c.author_role || ''}</span>
                  <span style={{
                    fontFamily: FONT_MONO,
                    fontSize: '7px',
                    letterSpacing: '.18em',
                    textTransform: 'uppercase',
                    color: 'var(--c-text-soft)',
                    marginLeft: 'auto'
                  }}>{relativeTime(c.created_at)}</span>
                </div>
                <div style={{
                  fontFamily: FONT_HEAD,
                  fontSize: '13px',
                  fontStyle: 'italic',
                  color: 'var(--c-text-loud)',
                  marginTop: '2px',
                  textDecoration: isResolved ? 'line-through' : 'none'
                }}>{c.message || ''}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setReplyTo(c)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontFamily: FONT_MONO,
                      fontSize: '8px',
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: 'var(--c-terracotta-1)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                    <CornerDownRight size={10} />
                    Reply
                  </button>
                  {canResolve ? (
                    <button
                      type="button"
                      onClick={() => resolveComment && resolveComment(c.id, !isResolved)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontFamily: FONT_MONO,
                        fontSize: '8px',
                        letterSpacing: '.14em',
                        textTransform: 'uppercase',
                        color: isResolved ? 'var(--c-text-soft)' : 'var(--c-green)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                      {isResolved ? <RotateCcw size={10} /> : <Check size={10} />}
                      {isResolved ? 'Reopen' : 'Resolve'}
                    </button>
                  ) : null}
                  {isResolved ? (
                    <span style={{
                      fontFamily: FONT_MONO,
                      fontSize: '7px',
                      letterSpacing: '.18em',
                      textTransform: 'uppercase',
                      color: 'var(--c-green)'
                    }}>Resolved</span>
                  ) : null}
                </div>
                {replies.length > 0 ? (
                  <div style={{ marginTop: '6px', paddingLeft: '14px', borderLeft: '2px solid var(--c-divider-soft)' }}>
                    {replies.map((r) => (
                      <div key={r.id} style={{ padding: '6px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: FONT_BODY,
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'var(--c-text-loud)'
                          }}>{r.author || 'Unknown'}</span>
                          <span style={{
                            fontFamily: FONT_MONO,
                            fontSize: '7px',
                            letterSpacing: '.18em',
                            textTransform: 'uppercase',
                            color: 'var(--c-text-soft)'
                          }}>{r.author_role || ''}</span>
                          <span style={{
                            fontFamily: FONT_MONO,
                            fontSize: '7px',
                            letterSpacing: '.18em',
                            textTransform: 'uppercase',
                            color: 'var(--c-text-soft)',
                            marginLeft: 'auto'
                          }}>{relativeTime(r.created_at)}</span>
                        </div>
                        <div style={{
                          fontFamily: FONT_HEAD,
                          fontSize: '12px',
                          fontStyle: 'italic',
                          color: 'var(--c-text-loud)',
                          marginTop: '2px'
                        }}>{r.message || ''}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: 'var(--c-bg)',
        borderTop: '1px solid var(--c-divider-soft)',
        padding: replyTo ? '6px 12px 10px' : '10px 12px'
      }}>
        {replyTo ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 6px',
            marginBottom: '6px',
            background: 'var(--c-bg-2)',
            border: '1px solid var(--c-divider-subtle)',
            fontFamily: FONT_MONO,
            fontSize: '8px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--c-text-soft)'
          }}>
            <CornerDownRight size={10} />
            Replying to {replyToAuthor}
            <button
              type="button"
              aria-label="Cancel reply"
              onClick={() => setReplyTo(null)}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: 'var(--c-text-soft)',
                display: 'inline-flex',
                alignItems: 'center'
              }}>
              <X size={10} />
            </button>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyToAuthor}...` : 'Add a comment...'}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              padding: '8px 10px',
              background: 'var(--c-bg-2)',
              border: '1px solid var(--c-divider-soft)',
              color: 'var(--c-text-loud)',
              fontFamily: FONT_BODY,
              fontSize: '13px',
              outline: 'none'
            }} />
          <button type="button" onClick={send} disabled={!draft.trim()} style={{
            padding: '8px 14px',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            background: 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))',
            color: '#fff',
            border: 'none',
            opacity: draft.trim() ? 1 : 0.5,
            cursor: draft.trim() ? 'pointer' : 'not-allowed'
          }}>Send</button>
        </div>
      </div>
    </SlideUp>
  );
}
// Batch-3: "+ Add concept" options sheet. Two affordances:
//   - New concept     -> creates an empty draft cell at pendingAdd slot
//   - Attach existing -> opens the attachable-post picker
function AddOption({ Icon, label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '14px 16px',
        background: 'var(--c-bg-2)',
        border: '1px solid var(--c-divider-soft)',
        borderRadius: '10px',
        cursor: 'pointer',
        textAlign: 'left'
      }}>
      <span style={{
        width: '36px', height: '36px',
        borderRadius: '10px',
        background: 'var(--c-bg-3)',
        color: 'var(--c-terracotta-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: '14px',
          color: 'var(--c-text-loud)'
        }}>{label}</div>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: '9px',
          letterSpacing: '.08em',
          color: 'var(--c-text-dim)',
          marginTop: '2px',
          textTransform: 'uppercase'
        }}>{sub}</div>
      </div>
    </button>
  );
}

export function AddConceptOptionsSheet() {
  const close = usePlanStore((s) => s.closePlanSheet);
  const pending = usePlanStore((s) => s.pendingAdd);
  const addPlanCell = usePlanStore((s) => s.addPlanCell);
  const openAttachPicker = usePlanStore((s) => s.openAttachPicker);

  const [title, setTitle] = useState('');
  const [concept, setConcept] = useState('');
  const [pillar, setPillar] = useState('');
  const [format, setFormat] = useState('');
  const [saving, setSaving] = useState(false);
  const conceptRef = useRef(null);

  useEffect(() => {
    if (conceptRef.current) autoGrow(conceptRef.current);
  }, [concept]);

  if (!pending) return null;

  async function handleSave() {
    if (saving) return;
    const p = pending;
    setSaving(true);
    try {
      await addPlanCell({
        cell_date: p.dateISO,
        channel: p.channel,
        position: p.position,
        title: title.trim(),
        concept,
        contentPillar: pillar || null,
        format: format || null
      });
      close();
    } finally {
      setSaving(false);
    }
  }

  const canSave = !saving && (title.trim().length > 0 || concept.trim().length > 0);

  return (
    <SlideUp title="Add concept" onClose={close}>
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column' }}>
        <label style={CELL_LABEL_STYLE}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          style={CELL_INPUT_STYLE} />

        <label style={CELL_LABEL_STYLE}>Concept</label>
        <textarea
          ref={conceptRef}
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          onInput={(e) => autoGrow(e.target)}
          placeholder="Concept..."
          style={{
            ...CELL_INPUT_STYLE,
            resize: 'none',
            minHeight: '120px',
            maxHeight: '60vh',
            overflowY: 'auto',
            lineHeight: 1.5
          }} />

        <label style={CELL_LABEL_STYLE}>Pillar</label>
        <select
          value={pillar}
          onChange={(e) => setPillar(e.target.value)}
          style={CELL_INPUT_STYLE}>
          <option value="">- Select pillar -</option>
          {PILLARS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <label style={CELL_LABEL_STYLE}>Format</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          style={CELL_INPUT_STYLE}>
          <option value="">- Select format -</option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))',
            border: 'none',
            color: '#fff',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: canSave ? 'pointer' : 'not-allowed',
            opacity: canSave ? 1 : 0.5,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
          <FilePlus size={12} />
          {saving ? 'Saving...' : 'Save'}
        </button>

        <div style={{
          marginTop: '18px',
          paddingTop: '14px',
          borderTop: '1px solid var(--c-divider-soft)'
        }}>
          <AddOption
            Icon={Link2}
            label="Attach existing post"
            sub="Pick a post from your pipeline"
            onClick={openAttachPicker}
          />
        </div>
      </div>
    </SlideUp>
  );
}

function StagePill({ stage }) {
  const color = `var(${STAGE_COLOR_VAR[stage] || '--c-text-dim'})`;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 6px',
      border: `1px solid ${color}`,
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      fontFamily: FONT_MONO,
      fontSize: '8px',
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: 'var(--c-text-loud)'
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '5px', background: color }} />
      {STAGE_LABELS[stage] || stage}
    </span>
  );
}

export function AttachPostSheet() {
  const close = usePlanStore((s) => s.closePlanSheet);
  const posts = usePlanStore((s) => s.attachablePosts);
  const loading = usePlanStore((s) => s.attachLoading);
  const submitting = usePlanStore((s) => s.attachSubmitting);
  const attach = usePlanStore((s) => s.attachExistingPost);

  return (
    <SlideUp title="Attach existing post" onClose={close}>
      <div style={{ padding: '12px 16px 24px' }}>
        {loading ? (
          <div style={{
            padding: '40px 0',
            textAlign: 'center',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--c-text-dim)'
          }}>Loading posts...</div>
        ) : posts.length === 0 ? (
          <div style={{
            padding: '40px 8px',
            textAlign: 'center',
            fontFamily: FONT_BODY,
            fontSize: '13px',
            color: 'var(--c-text-dim)'
          }}>No unlinked posts available to attach.</div>
        ) : posts.map((p) => (
          <button
            key={p.id || p.post_id}
            type="button"
            disabled={submitting}
            onClick={() => attach(p.post_id || p.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '6px',
              width: '100%',
              padding: '12px',
              marginBottom: '8px',
              background: 'var(--c-bg-2)',
              border: '1px solid var(--c-divider-soft)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
              textAlign: 'left'
            }}>
            <div style={{
              fontFamily: FONT_BODY,
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--c-text-loud)',
              lineHeight: 1.35,
              wordBreak: 'break-word'
            }}>{p.title || 'Untitled post'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <StagePill stage={p.stage} />
              {p.target_date ? (
                <span style={{
                  fontFamily: FONT_MONO,
                  fontSize: '8px',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--c-text-soft)'
                }}>{p.target_date}</span>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </SlideUp>
  );
}

// Batch-3: confirm sheet for per-cell remove. Backed by removeCell()
// in the store, which DELETEs /plan_cells?id=eq.<id> and lets the FK
// SET NULL leave the linked post in the pipeline.
export function RemoveCellConfirm() {
  const close = usePlanStore((s) => s.closePlanSheet);
  const cellId = usePlanStore((s) => s.cellToRemove);
  const removeCell = usePlanStore((s) => s.removeCell);
  return (
    <SlideUp title="Remove concept" onClose={close} fixedHeight>
      <div style={{ padding: '16px' }}>
        <div style={{
          fontFamily: FONT_HEAD,
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--c-text-loud)'
        }}>Remove this concept from plan?</div>
        <div style={{
          marginTop: '8px',
          fontFamily: FONT_BODY,
          fontSize: '13px',
          color: 'var(--c-text-mid)'
        }}>Linked post stays in pipeline.</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button type="button" onClick={close} style={{
            flex: 1,
            padding: '10px 14px',
            background: 'transparent',
            border: '1px solid var(--c-divider-warm)',
            color: 'var(--c-text-loud)',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}>Cancel</button>
          <button type="button" onClick={() => removeCell(cellId)} style={{
            flex: 1,
            padding: '10px 14px',
            background: 'transparent',
            border: '1px solid var(--c-red)',
            color: 'var(--c-red)',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <Trash2 size={12} />
            Remove
          </button>
        </div>
      </div>
    </SlideUp>
  );
}

// Batch-3: confirm sheet for plan-level delete.
export function DeletePlanConfirm() {
  const close = usePlanStore((s) => s.closePlanSheet);
  const deletePlan = usePlanStore((s) => s.deletePlan);
  const busy = usePlanStore((s) => s.deletingPlan);
  return (
    <SlideUp title="Delete plan" onClose={busy ? () => {} : close} fixedHeight>
      <div style={{ padding: '16px' }}>
        <div style={{
          fontFamily: FONT_HEAD,
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--c-text-loud)'
        }}>Delete this plan?</div>
        <div style={{
          marginTop: '8px',
          fontFamily: FONT_BODY,
          fontSize: '13px',
          color: 'var(--c-text-mid)'
        }}>This cannot be undone. All concepts will be removed. Linked posts stay in your pipeline.</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button type="button" disabled={busy} onClick={close} style={{
            flex: 1,
            padding: '10px 14px',
            background: 'transparent',
            border: '1px solid var(--c-divider-warm)',
            color: 'var(--c-text-loud)',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1
          }}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => deletePlan()} style={{
            flex: 1,
            padding: '10px 14px',
            background: 'transparent',
            border: '1px solid var(--c-red)',
            color: 'var(--c-red)',
            fontFamily: FONT_MONO,
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <Trash2 size={12} />
            {busy ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </SlideUp>
  );
}
