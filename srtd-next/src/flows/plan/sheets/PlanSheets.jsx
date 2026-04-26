// PR-2 plan-feature sheets. All five share a common SlideUp shell that
// matches the CommentActionSheet pattern: backdrop + max-w-[430px] panel
// pinned to the bottom, Esc closes, focus trap, prefers-reduced-motion
// respected. CSS vars only.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';

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
    <SlideUp title="Send for alignment" onClose={close} fixedHeight>
      <div style={{ padding: '16px' }}>
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

export function PlanCellSheet() {
  const close = usePlanStore((s) => s.closePlanSheet);
  const role = usePlanStore((s) => s.role);
  const cell = usePlanStore((s) => s.activeCell);
  const comments = usePlanStore((s) => s.planComments);
  const update = usePlanStore((s) => s.updatePlanCell);
  const addComment = usePlanStore((s) => s.addPlanComment);
  const [concept, setConcept] = useState(cell ? (cell.concept || '') : '');
  const [draft, setDraft] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    setConcept(cell ? (cell.concept || '') : '');
  }, [cell && cell.id]);

  if (!cell) return null;

  const cellComments = comments
    .filter((c) => c.plan_cell_id === cell.id)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  const canEdit = role !== 'client';

  function onConceptChange(v) {
    setConcept(v);
    if (!canEdit || !cell.id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      update(cell.id, { concept: v });
    }, 800);
  }

  function commitConcept() {
    if (!canEdit || !cell.id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    update(cell.id, { concept });
  }

  function send() {
    const text = draft.trim();
    if (!text || !cell.id) return;
    addComment({ planCellId: cell.id, message: text });
    setDraft('');
  }

  return (
    <SlideUp title="Cell" onClose={close}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: '7px',
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: 'var(--c-text-soft)',
          marginBottom: '8px'
        }}>{(cell.cell_date || '').slice(0, 10)} - {cell.channel}</div>
        <textarea
          value={concept}
          readOnly={!canEdit}
          onChange={(e) => onConceptChange(e.target.value)}
          onBlur={commitConcept}
          placeholder="Concept..."
          rows={4}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 12px',
            background: 'var(--c-bg-2)',
            border: '1px solid var(--c-divider-soft)',
            color: 'var(--c-text-loud)',
            fontFamily: FONT_BODY,
            fontSize: '13px',
            resize: 'vertical',
            outline: 'none'
          }} />
        {canEdit ? (
          <button type="button" onClick={commitConcept} style={{
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
          ) : cellComments.map((c) => (
            <div key={c.id} style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--c-divider-subtle)'
            }}>
              <div style={{
                fontFamily: FONT_BODY,
                fontSize: '13px',
                color: 'var(--c-text-loud)',
                fontWeight: 500
              }}>{c.author || 'Unknown'} <span style={{
                fontFamily: FONT_MONO,
                fontSize: '7px',
                letterSpacing: '.18em',
                textTransform: 'uppercase',
                color: 'var(--c-text-soft)',
                marginLeft: '6px'
              }}>{c.author_role || ''}</span></div>
              <div style={{
                fontFamily: FONT_HEAD,
                fontSize: '13px',
                fontStyle: 'italic',
                color: 'var(--c-text-loud)',
                marginTop: '2px'
              }}>{c.message || ''}</div>
            </div>
          ))}
        </div>
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
