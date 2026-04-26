// PR-2 Plan view. Sheet grid (date x channel) for the active plan,
// with role-aware action bar and PCS integration on tap. Renders only
// when usePlanStore.currentView === 'plan'. Tokens consumed via CSS
// vars from tokens.css; never hardcoded hex.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, X } from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';
import { openInPcs } from '../shared/openInPcs.js';
import { CreatePlanWizard } from '../sheets/CreatePlanWizard.jsx';

const DEFAULT_CHANNELS = ['linkedin', 'instagram', 'twitter'];

const CHANNEL_LABELS = {
  linkedin:  'LI',
  instagram: 'IG',
  twitter:   'X',
  tiktok:    'TT',
  facebook:  'FB',
  youtube:   'YT'
};

const CELL_STATUS_LABELS = {
  draft:               'Draft',
  aligned:             'Aligned',
  changes_requested:   'Changes',
  spawned:             'Spawned',
  linked:              'Linked'
};

const CELL_STATUS_COLOR = {
  draft:               '--c-text-dim',
  aligned:             '--c-green',
  changes_requested:   '--c-stage-input',
  spawned:             '--c-text-soft',
  linked:              '--c-text-soft'
};

const PLAN_STATUS_LABELS = {
  draft:                'Draft',
  awaiting_alignment:   'Awaiting alignment',
  aligned:              'Aligned',
  changes_requested:    'Changes requested',
  archived:             'Archived'
};

const PLAN_STATUS_COLOR = {
  draft:               '--c-text-dim',
  awaiting_alignment:  '--c-amber',
  aligned:             '--c-green',
  changes_requested:   '--c-stage-input',
  archived:            '--c-text-soft'
};

const FONT_BODY = '"DM Sans", sans-serif';
const FONT_HEAD = 'Fraunces, serif';
const FONT_MONO = '"IBM Plex Mono", monospace';

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

function dayDOW(dateISO) {
  const parts = (dateISO || '').split('-');
  if (parts.length !== 3) return '';
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()];
}

function dayNumber(dateISO) {
  const parts = (dateISO || '').split('-');
  if (parts.length !== 3) return '';
  return String(Number(parts[2]));
}

function dayIsWeekend(dateISO) {
  const dow = dayDOW(dateISO);
  return dow === 'SAT' || dow === 'SUN';
}

function rangeDates(startISO, endISO) {
  const sp = (startISO || '').split('-');
  const ep = (endISO   || '').split('-');
  if (sp.length !== 3 || ep.length !== 3) return [];
  const s = new Date(Number(sp[0]), Number(sp[1]) - 1, Number(sp[2]));
  const e = new Date(Number(ep[0]), Number(ep[1]) - 1, Number(ep[2]));
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return [];
  const out = [];
  const cur = new Date(s);
  const pad = (n) => String(n).padStart(2, '0');
  while (cur <= e && out.length < 100) {
    out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function StatusPill({ status }) {
  const color = `var(${PLAN_STATUS_COLOR[status] || '--c-text-dim'})`;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 8px',
      border: `1px solid ${color}`,
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      fontFamily: FONT_MONO,
      fontSize: '8px',
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: 'var(--c-text-loud)'
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '5px', background: color }} />
      {PLAN_STATUS_LABELS[status] || status}
    </span>
  );
}

function VersionChip({ v }) {
  return (
    <span style={{
      fontFamily: FONT_MONO,
      fontSize: '7px',
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: 'var(--c-text-soft)',
      padding: '3px 6px',
      border: '1px solid var(--c-divider-soft)'
    }}>v{v || 1}</span>
  );
}

function ProgressBar({ counts, total }) {
  if (!total) return null;
  const segs = [
    { key: 'draft',             color: 'var(--c-text-dim)' },
    { key: 'aligned',           color: 'var(--c-green)' },
    { key: 'changes_requested', color: 'var(--c-stage-input)' },
    { key: 'spawned',           color: 'var(--c-text-soft)' }
  ];
  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '6px',
      background: 'var(--c-bg-2)',
      overflow: 'hidden',
      marginTop: '10px'
    }}>
      {segs.map((s) => {
        const c = counts[s.key] || 0;
        if (!c) return null;
        const w = `${(c / total) * 100}%`;
        return <div key={s.key} style={{ width: w, background: s.color }} />;
      })}
    </div>
  );
}

function CellChip({ status }) {
  const color = `var(${CELL_STATUS_COLOR[status] || '--c-text-dim'})`;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      marginTop: '5px',
      padding: '3px 6px',
      border: `1px solid ${color}`,
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      fontFamily: FONT_MONO,
      fontSize: '9px',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--c-text-loud)'
    }}>
      {CELL_STATUS_LABELS[status] || status}
    </span>
  );
}

function ConceptCell({ cell, role, onTap, onAdd, onRemove }) {
  const [hover, setHover] = useState(false);
  if (!cell) {
    if (role === 'client') return <div style={{ flex: 1 }} />;
    return (
      <button
        type="button"
        onClick={onAdd}
        style={{
          flex: 1,
          minHeight: '64px',
          textAlign: 'left',
          padding: '8px 10px',
          background: 'transparent',
          border: '1px dashed var(--c-divider-warm)',
          color: 'var(--c-text-dim)',
          fontFamily: FONT_BODY,
          fontSize: '13px',
          cursor: 'pointer'
        }}>
        + Add concept
      </button>
    );
  }
  const canRemove = role !== 'client' && typeof onRemove === 'function';
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex'
      }}>
      <button
        type="button"
        onClick={() => onTap(cell)}
        style={{
          flex: 1,
          minHeight: '64px',
          textAlign: 'left',
          padding: '8px 24px 8px 10px',
          background: 'var(--c-bg-2)',
          border: '1px solid var(--c-divider-soft)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column'
        }}>
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: '13px',
          lineHeight: 1.35,
          color: 'var(--c-text-loud)',
          whiteSpace: 'normal',
          wordBreak: 'break-word'
        }}>{cell.concept || 'Untitled concept'}</div>
        <CellChip status={cell.cell_status} />
      </button>
      {canRemove ? (
        <button
          type="button"
          aria-label="Remove concept"
          onClick={(e) => { e.stopPropagation(); onRemove(cell.id); }}
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: 'transparent',
            border: 'none',
            padding: '2px',
            cursor: 'pointer',
            color: 'var(--c-text-mid)',
            opacity: hover ? 1 : 0.6,
            transition: 'opacity 120ms ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

function SheetRow({ dateISO, channels, cellsByKey, postsByCellId, role, onTap, onAdd, onRemove }) {
  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      paddingTop: '10px',
      paddingBottom: '10px',
      borderBottom: '1px solid var(--c-divider-subtle)'
    }}>
      <div style={{ width: '54px', flexShrink: 0, paddingRight: '6px' }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: '7px',
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: 'var(--c-text-soft)'
        }}>{dayDOW(dateISO)}</div>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: '18px',
          fontWeight: 500,
          lineHeight: 1,
          color: 'var(--c-text-loud)',
          marginTop: '4px'
        }}>{dayNumber(dateISO)}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {channels.map((ch) => {
          const stack = cellsByKey[`${dateISO}|${ch}`] || [];
          if (stack.length === 0) {
            return (
              <div key={ch} style={{ display: 'flex', alignItems: 'stretch', gap: '6px' }}>
                <div style={{
                  width: '34px',
                  fontFamily: FONT_MONO,
                  fontSize: '9px',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--c-text-soft)',
                  paddingTop: '8px',
                  flexShrink: 0
                }}>{CHANNEL_LABELS[ch] || ch}</div>
                <ConceptCell
                  cell={null}
                  role={role}
                  onAdd={() => onAdd(dateISO, ch, 0)}
                />
              </div>
            );
          }
          return (
            <div key={ch} style={{ display: 'flex', alignItems: 'stretch', gap: '6px' }}>
              <div style={{
                width: '34px',
                fontFamily: FONT_MONO,
                fontSize: '9px',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--c-text-soft)',
                paddingTop: '8px',
                flexShrink: 0
              }}>{CHANNEL_LABELS[ch] || ch}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {stack.map((c) => (
                  <ConceptCell
                    key={c.id}
                    cell={c}
                    role={role}
                    onTap={onTap}
                    onRemove={onRemove}
                  />
                ))}
                {role !== 'client' ? (
                  <button
                    type="button"
                    onClick={() => onAdd(dateISO, ch, stack.length)}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'transparent',
                      border: 'none',
                      padding: '2px 0',
                      cursor: 'pointer',
                      fontFamily: FONT_MONO,
                      fontSize: '9px',
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: 'var(--c-text-dim)'
                    }}>+ Add concept</button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CtaButton({ label, onClick, variant = 'terra', disabled }) {
  const base = {
    padding: '8px 14px',
    fontFamily: FONT_MONO,
    fontSize: '9px',
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    border: 'none'
  };
  if (variant === 'terra') {
    return (
      <button type="button" onClick={onClick} disabled={disabled} style={{
        ...base,
        background: 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))',
        color: '#fff'
      }}>{label}</button>
    );
  }
  if (variant === 'border') {
    return (
      <button type="button" onClick={onClick} disabled={disabled} style={{
        ...base,
        background: 'transparent',
        color: 'var(--c-text-loud)',
        border: '1px solid var(--c-divider-warm)'
      }}>{label}</button>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      ...base,
      background: 'transparent',
      color: 'var(--c-text-mid)'
    }}>{label}</button>
  );
}

export function PlanView() {
  const role = usePlanStore((s) => s.role);
  const plan = usePlanStore((s) => s.plan);
  const cells = usePlanStore((s) => s.planCells);
  const versions = usePlanStore((s) => s.planVersions);
  const comments = usePlanStore((s) => s.planComments);
  const channels = usePlanStore((s) => s.workspaceChannels);
  const showWeekends = usePlanStore((s) => s.showWeekends);
  const planLoading = usePlanStore((s) => s.planLoading);
  const planError = usePlanStore((s) => s.planError);
  const allPosts = usePlanStore((s) => s.posts);

  const loadPlan = usePlanStore((s) => s.loadPlan);
  const setShowWeekends = usePlanStore((s) => s.setShowWeekends);
  const openPlanSheet = usePlanStore((s) => s.openPlanSheet);
  const setActiveCell = usePlanStore((s) => s.setActiveCell);
  const loadAdjacentPlan = usePlanStore((s) => s.loadAdjacentPlan);
  const openAddConceptSheet = usePlanStore((s) => s.openAddConceptSheet);
  const openRemoveCellSheet = usePlanStore((s) => s.openRemoveCellSheet);

  const wizardOpen = usePlanStore((s) => s.wizardOpen);
  const openWizard = usePlanStore((s) => s.openWizard);
  const canCreatePlan = role === 'servicing' || role === 'admin';

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const activeChannels = useMemo(() => {
    if (Array.isArray(channels) && channels.length > 0) return channels.map((c) => c.channel);
    return DEFAULT_CHANNELS;
  }, [channels]);

  const { cellsByKey, counts, channelSet } = useMemo(() => {
    const by = {};
    const ct = { draft: 0, aligned: 0, changes_requested: 0, spawned: 0, linked: 0 };
    const set = new Set();
    for (const c of cells) {
      const k = `${(c.cell_date || '').slice(0,10)}|${c.channel}`;
      if (!by[k]) by[k] = [];
      by[k].push(c);
      ct[c.cell_status] = (ct[c.cell_status] || 0) + 1;
      if (c.channel) set.add(c.channel);
    }
    for (const k of Object.keys(by)) {
      by[k].sort((a, b) => (a.position || 0) - (b.position || 0));
    }
    return { cellsByKey: by, counts: ct, channelSet: set };
  }, [cells]);

  const dates = useMemo(() => {
    if (!plan) return [];
    const all = rangeDates(plan.period_start, plan.period_end);
    return showWeekends ? all : all.filter((d) => !dayIsWeekend(d));
  }, [plan, showWeekends]);

  const postsByCellId = useMemo(() => {
    const by = {};
    for (const p of allPosts) {
      if (p.plan_cell_id) by[p.plan_cell_id] = p;
    }
    return by;
  }, [allPosts]);

  function handleCellTap(cell) {
    const linkedPost = cell.id ? postsByCellId[cell.id] : null;
    if ((cell.cell_status === 'spawned' || cell.cell_status === 'linked') && linkedPost) {
      openInPcs(linkedPost, allPosts.filter((p) => !!p.plan_cell_id));
      return;
    }
    setActiveCell(cell, null);
    openPlanSheet('cell');
  }

  function handleAdd(dateISO, channel, position) {
    if (role === 'client') return;
    openAddConceptSheet(dateISO, channel, position);
  }

  function handleRemove(cellId) {
    if (role === 'client') return;
    openRemoveCellSheet(cellId);
  }

  const channelChannels = useMemo(() => {
    const merged = [...activeChannels];
    for (const ch of channelSet) {
      if (!merged.includes(ch)) merged.push(ch);
    }
    return merged;
  }, [activeChannels, channelSet]);

  if (planLoading) {
    return (
      <div style={{
        padding: '80px 24px',
        textAlign: 'center',
        fontFamily: FONT_MONO,
        fontSize: '9px',
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: 'var(--c-text-dim)'
      }}>Loading plan...</div>
    );
  }

  if (planError) {
    return (
      <div style={{
        padding: '80px 24px',
        textAlign: 'center',
        fontFamily: FONT_BODY,
        fontSize: '13px',
        color: 'var(--c-red)'
      }}>{planError}</div>
    );
  }

  if (!plan) {
    return (
      <>
        <div style={{ maxWidth: '430px', margin: '0 auto', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px',
            margin: '0 auto 16px',
            background: 'var(--c-bg-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--c-text-mid)'
          }}>
            <CalendarIcon size={24} />
          </div>
          <div style={{
            fontFamily: FONT_HEAD,
            fontSize: '20px',
            fontWeight: 500,
            color: 'var(--c-text-loud)'
          }}>No plan yet</div>
          {canCreatePlan ? (
            <>
              <div style={{
                marginTop: '8px',
                fontFamily: FONT_BODY,
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--c-text-mid)'
              }}>Plan your content for the month: link existing posts, add new concepts, send for alignment.</div>
              <button
                type="button"
                onClick={() => openWizard()}
                style={{
                  marginTop: '20px',
                  padding: '11px 20px',
                  background: 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))',
                  color: '#fff',
                  border: 'none',
                  fontFamily: FONT_MONO,
                  fontSize: '9px',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), 0 4px 12px -4px color-mix(in srgb, var(--c-terracotta-2) 50%, transparent)'
                }}>
                <Plus size={13} />
                Create plan
              </button>
            </>
          ) : (
            <div style={{
              marginTop: '8px',
              fontFamily: FONT_BODY,
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--c-text-mid)'
            }}>Your team hasn't shared a plan with you yet. You'll see it here when they do.</div>
          )}
        </div>
        {wizardOpen ? <CreatePlanWizard /> : null}
      </>
    );
  }

  const total = cells.length;
  const unresolvedComments = comments.filter((c) => !c.resolved).length;
  const sentVersion = versions.find((v) => v.trigger_event === 'sent_for_alignment');

  // Action bar CTA shape per role
  let primary = null;
  if (role === 'client') {
    if (plan.plan_status === 'awaiting_alignment') {
      primary = (
        <div style={{ display: 'flex', gap: '8px' }}>
          <CtaButton label="Changes" variant="border" onClick={() => openPlanSheet('changes')} />
          <CtaButton label="Align month" onClick={() => openPlanSheet('align')} />
        </div>
      );
    }
  } else {
    if (plan.plan_status === 'awaiting_alignment') {
      primary = <CtaButton label="Awaiting client" disabled />;
    } else if (plan.plan_status === 'aligned') {
      primary = <CtaButton label="Plan aligned" disabled />;
    } else {
      primary = <CtaButton label="Send for alignment" onClick={() => openPlanSheet('send')} />;
    }
  }

  return (
    <div style={{ maxWidth: '430px', margin: '0 auto' }}>
      <section style={{ padding: '16px 12px 12px' }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: '7px',
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: 'var(--c-text-soft)'
        }}>Workspace</div>
        <div style={{
          marginTop: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button type="button" aria-label="Previous plan" onClick={() => loadAdjacentPlan('prev')} style={{
            background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--c-text-mid)'
          }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{
            flex: 1,
            fontFamily: FONT_HEAD,
            fontSize: '16px',
            fontWeight: 500,
            color: 'var(--c-text-loud)'
          }}>{plan.title || 'Untitled plan'}</div>
          <button type="button" aria-label="Next plan" onClick={() => loadAdjacentPlan('next')} style={{
            background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--c-text-mid)'
          }}>
            <ChevronRight size={16} />
          </button>
          {canCreatePlan ? (
            <button type="button" onClick={() => openWizard()} style={{
              background: 'transparent',
              border: '1px solid var(--c-divider-warm)',
              padding: '4px 8px',
              cursor: 'pointer',
              fontFamily: FONT_MONO,
              fontSize: '8px',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--c-text-mid)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Plus size={10} />
              Create plan
            </button>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <StatusPill status={plan.plan_status} />
          <VersionChip v={plan.current_version} />
        </div>
        <div style={{
          marginTop: '8px',
          fontFamily: FONT_MONO,
          fontSize: '7px',
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: 'var(--c-text-soft)'
        }}>{total} concept{total === 1 ? '' : 's'} - {channelChannels.length} channel{channelChannels.length === 1 ? '' : 's'}{sentVersion ? ` - sent ${relativeTime(sentVersion.created_at)}` : ''}</div>
        <ProgressBar counts={counts} total={total} />
      </section>

      <section style={{
        position: 'sticky',
        top: '44px',
        zIndex: 10,
        background: 'var(--c-bg)',
        borderBottom: '1px solid var(--c-divider-soft)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <button type="button" onClick={() => openPlanSheet('history')} style={{
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          fontFamily: FONT_MONO,
          fontSize: '9px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--c-text-mid)'
        }}>History ({versions.length})</button>
        <button type="button" onClick={() => openPlanSheet('comments')} style={{
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          fontFamily: FONT_MONO,
          fontSize: '9px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--c-text-mid)'
        }}>Comments ({unresolvedComments})</button>
        <button type="button" onClick={() => usePlanStore.getState().sharePlan()} style={{
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          fontFamily: FONT_MONO,
          fontSize: '9px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--c-text-mid)'
        }}>Share</button>
        <div style={{ marginLeft: 'auto' }}>{primary}</div>
      </section>

      <section style={{ padding: '6px 16px 96px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 0 6px',
          borderBottom: '1px solid var(--c-divider-soft)'
        }}>
          <div style={{
            width: '54px',
            fontFamily: FONT_MONO,
            fontSize: '7px',
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: 'var(--c-text-soft)'
          }}>Date</div>
          <div style={{ flex: 1, display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {channelChannels.map((ch) => (
              <span key={ch} style={{
                fontFamily: FONT_MONO,
                fontSize: '7px',
                letterSpacing: '.18em',
                textTransform: 'uppercase',
                color: 'var(--c-text-soft)',
                padding: '3px 6px',
                border: '1px solid var(--c-divider-soft)'
              }}>{CHANNEL_LABELS[ch] || ch}</span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowWeekends(!showWeekends)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px 0',
              cursor: 'pointer',
              fontFamily: FONT_MONO,
              fontSize: '9px',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: showWeekends ? 'var(--c-terracotta-1)' : 'var(--c-text-dim)'
            }}>{showWeekends ? 'Hide weekends' : 'Show weekends'}</button>
        </div>

        {dates.length === 0 ? (
          <div style={{
            padding: '40px 0',
            textAlign: 'center',
            fontFamily: FONT_BODY,
            fontSize: '13px',
            color: 'var(--c-text-dim)'
          }}>No dates in this plan range.</div>
        ) : dates.map((dISO) => {
          const dayHasContent = channelChannels.some((ch) => (cellsByKey[`${dISO}|${ch}`] || []).length > 0);
          if (role === 'client' && !dayHasContent) return null;
          return (
            <SheetRow
              key={dISO}
              dateISO={dISO}
              channels={channelChannels}
              cellsByKey={cellsByKey}
              postsByCellId={postsByCellId}
              role={role}
              onTap={handleCellTap}
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
          );
        })}
      </section>
      {wizardOpen ? <CreatePlanWizard /> : null}
    </div>
  );
}

export default PlanView;
