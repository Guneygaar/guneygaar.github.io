// PR-2 Plan view. Sheet grid (date x channel) for the active plan,
// with role-aware action bar and PCS integration on tap. Renders only
// when usePlanStore.currentView === 'plan'. Tokens consumed via CSS
// vars from tokens.css; never hardcoded hex.

import React, { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, X } from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';
import { openInPcs } from '../shared/openInPcs.js';
import { CreatePlanWizard } from '../sheets/CreatePlanWizard.jsx';
import { useCellDatePicker } from '../hooks/useCellDatePicker.js';

const DEFAULT_CHANNELS = ['linkedin', 'instagram', 'twitter'];

export const CHANNEL_LABELS = {
  linkedin:  'LinkedIn',
  instagram: 'Instagram',
  twitter:   'X',
  tiktok:    'TikTok',
  facebook:  'Facebook',
  youtube:   'YouTube'
};

const CELL_STATUS_LABELS = {
  draft:               'Draft',
  aligned:             'Aligned',
  changes_requested:   'Changes',
  spawned:             'Spawned',
  linked:              'Linked'
};

const PLAN_STATUS_LABELS = {
  draft:                'Draft',
  awaiting_alignment:   'Awaiting alignment',
  aligned:              'Aligned',
  changes_requested:    'Changes requested',
  archived:             'Archived'
};

const FONT_BODY = '"DM Sans", sans-serif';
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

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatMonthDay(iso) {
  const parts = (iso || '').split('-');
  if (parts.length !== 3) return '';
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return '';
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatPlanRange(startISO, endISO) {
  const s = formatMonthDay(startISO);
  const e = formatMonthDay(endISO);
  if (!s && !e) return '';
  if (!e) return s;
  if (!s) return e;
  return `${s} – ${e}`;
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
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 7px',
      borderRadius: '3px',
      background: 'var(--status-bg)',
      border: '1px solid var(--border-3)',
      fontFamily: FONT_MONO,
      fontSize: '9px',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--text-1)'
    }}>
      {PLAN_STATUS_LABELS[status] || status}
    </span>
  );
}

function VersionChip({ v }) {
  return (
    <span style={{
      fontFamily: FONT_MONO,
      fontSize: '9px',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--text-2)',
      padding: '3px 7px',
      borderRadius: '3px',
      border: '1px solid var(--border-2)'
    }}>v{v || 1}</span>
  );
}

function ProgressBar({ counts, total }) {
  if (!total) return null;
  const segs = [
    { key: 'draft',             color: 'var(--text-3)' },
    { key: 'aligned',           color: 'var(--c-green)' },
    { key: 'changes_requested', color: 'var(--accent)' },
    { key: 'spawned',           color: 'var(--text-2)' }
  ];
  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '6px',
      background: 'var(--surface-2)',
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
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 7px',
      borderRadius: '3px',
      background: 'var(--status-bg)',
      border: '1px solid var(--border-3)',
      fontFamily: FONT_MONO,
      fontSize: '9px',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--text-1)'
    }}>
      {CELL_STATUS_LABELS[status] || status}
    </span>
  );
}

function MetaChip({ label }) {
  if (!label) return null;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 7px',
      borderRadius: '3px',
      border: '1px solid var(--border-2)',
      fontFamily: FONT_MONO,
      fontSize: '9px',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--text-2)'
    }}>{label}</span>
  );
}

function ConceptRow({ cell, role, onTap, onRemove, borderTop }) {
  const canRemove = role !== 'client' && typeof onRemove === 'function';
  return (
    <div style={{ position: 'relative', borderTop: borderTop ? '1px solid var(--border-1)' : 'none' }}>
      <button
        type="button"
        onClick={() => onTap(cell)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 36px 12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <CellChip status={cell.cell_status} />
          <MetaChip label={cell.content_pillar} />
          <MetaChip label={cell.format} />
        </div>
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: '15px',
          fontWeight: 500,
          lineHeight: 1.3,
          color: 'var(--text-1)',
          whiteSpace: 'normal',
          wordBreak: 'break-word'
        }}>{cell.title || cell.concept || 'Untitled concept'}</div>
      </button>
      {canRemove ? (
        <button
          type="button"
          aria-label="Remove concept"
          className="plan-x-btn"
          onClick={(e) => { e.stopPropagation(); onRemove(cell.id); }}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'transparent',
            border: 'none',
            padding: '2px',
            cursor: 'pointer',
            color: 'var(--text-2)',
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

function DayCard({ dateISO, cells, role, defaultChannel, onTap, onAdd, onRemove, onDateChange }) {
  const canPickDate = role !== 'client' && cells.length > 0 && typeof onDateChange === 'function';
  const firstCell = cells.find((c) => c && c.id) || null;
  const railInner = (
    <>
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: '9px',
        fontWeight: 500,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'var(--text-2)',
        pointerEvents: 'none'
      }}>{dayDOW(dateISO)}</div>
      <div style={{
        fontFamily: FONT_BODY,
        fontSize: '24px',
        fontWeight: 600,
        letterSpacing: '-.02em',
        lineHeight: 1,
        color: 'var(--text-1)',
        marginTop: '4px',
        pointerEvents: 'none'
      }}>{dayNumber(dateISO)}</div>
    </>
  );
  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: 'var(--surface-1)',
      border: '1px solid var(--border-1)',
      marginBottom: '8px'
    }}>
      <div style={{
        position: 'relative',
        width: '56px',
        flexShrink: 0,
        background: 'var(--surface-2)',
        borderRight: '1px solid var(--border-1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 0'
      }}>
        {railInner}
        {canPickDate ? (
          <input
            type="date"
            aria-label="Change date"
            value={(firstCell?.cell_date || '').slice(0, 10)}
            onChange={(e) => onDateChange(firstCell, e.target.value)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              WebkitAppearance: 'none',
              appearance: 'none',
              background: 'transparent',
              color: 'transparent'
            }}
          />
        ) : null}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {cells.length === 0 ? null : cells.map((c, i) => (
          <ConceptRow
            key={c.id}
            cell={c}
            role={role}
            onTap={onTap}
            onRemove={onRemove}
            borderTop={i > 0}
          />
        ))}
        {role !== 'client' ? (
          <button
            type="button"
            onClick={() => onAdd(dateISO, defaultChannel, cells.length)}
            style={{
              borderTop: cells.length > 0 ? '1px solid var(--border-1)' : 'none',
              background: 'transparent',
              border: cells.length > 0 ? '' : 'none',
              borderTopWidth: cells.length > 0 ? '1px' : 0,
              borderTopStyle: cells.length > 0 ? 'solid' : undefined,
              borderTopColor: cells.length > 0 ? 'var(--border-1)' : undefined,
              padding: '12px 14px',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: FONT_MONO,
              fontSize: '10px',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--text-2)'
            }}>+ Add concept</button>
        ) : null}
      </div>
    </div>
  );
}

function CtaButton({ label, onClick, variant = 'accent', disabled }) {
  const base = {
    padding: '6px 12px',
    fontFamily: FONT_MONO,
    fontSize: '9px',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    border: 'none',
    borderRadius: '3px'
  };
  if (variant === 'accent') {
    return (
      <button type="button" onClick={onClick} disabled={disabled} style={{
        ...base,
        background: 'var(--accent)',
        color: '#fff'
      }}>{label}</button>
    );
  }
  if (variant === 'border') {
    return (
      <button type="button" onClick={onClick} disabled={disabled} style={{
        ...base,
        background: 'transparent',
        color: 'var(--text-1)',
        border: '1px solid var(--border-3)'
      }}>{label}</button>
    );
  }
  if (variant === 'badge') {
    return (
      <span style={{
        ...base,
        cursor: 'default',
        background: 'var(--status-bg)',
        border: '1px solid var(--border-3)',
        color: 'var(--text-1)',
        display: 'inline-flex',
        alignItems: 'center'
      }}>{label}</span>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      ...base,
      background: 'transparent',
      color: 'var(--text-2)'
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

  const { triggerCellPicker } = useCellDatePicker();

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const activeChannels = useMemo(() => {
    if (Array.isArray(channels) && channels.length > 0) return channels.map((c) => c.channel);
    return DEFAULT_CHANNELS;
  }, [channels]);

  const { counts, channelSet } = useMemo(() => {
    const ct = { draft: 0, aligned: 0, changes_requested: 0, spawned: 0, linked: 0 };
    const set = new Set();
    for (const c of cells) {
      ct[c.cell_status] = (ct[c.cell_status] || 0) + 1;
      if (c.channel) set.add(c.channel);
    }
    return { counts: ct, channelSet: set };
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
        fontSize: '10px',
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: 'var(--text-3)'
      }}>Loading plan...</div>
    );
  }

  if (planError) {
    return (
      <div style={{
        padding: '80px 24px',
        textAlign: 'center',
        fontFamily: FONT_BODY
      }}>
        <div style={{ fontSize: '13px', color: 'var(--c-red)' }}>{planError}</div>
        <button
          type="button"
          onClick={() => { usePlanStore.setState({ planError: null }); loadPlan(); }}
          style={{
            marginTop: '14px',
            padding: '8px 14px',
            background: 'transparent',
            border: '1px solid var(--border-3)',
            color: 'var(--text-1)',
            fontFamily: FONT_MONO,
            fontSize: '10px',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            borderRadius: '3px'
          }}>Retry</button>
      </div>
    );
  }

  if (!plan) {
    return (
      <>
        <div style={{ maxWidth: '430px', margin: '0 auto', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px',
            margin: '0 auto 16px',
            background: 'var(--surface-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-2)'
          }}>
            <CalendarIcon size={24} />
          </div>
          <div style={{
            fontFamily: FONT_BODY,
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text-1)'
          }}>No plan yet</div>
          {canCreatePlan ? (
            <>
              <div style={{
                marginTop: '8px',
                fontFamily: FONT_BODY,
                fontSize: '14px',
                lineHeight: 1.5,
                color: 'var(--text-2)'
              }}>Plan your content for the month: link existing posts, add new concepts, send for alignment.</div>
              <button
                type="button"
                onClick={() => openWizard()}
                style={{
                  marginTop: '20px',
                  padding: '10px 18px',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  fontFamily: FONT_MONO,
                  fontSize: '10px',
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                <Plus size={13} />
                Create plan
              </button>
            </>
          ) : (
            <div style={{
              marginTop: '8px',
              fontFamily: FONT_BODY,
              fontSize: '14px',
              lineHeight: 1.5,
              color: 'var(--text-2)'
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
  const defaultChannel = activeChannels[0] || channelChannels[0] || 'linkedin';
  const cellsByDate = {};
  for (const c of cells) {
    const k = (c.cell_date || '').slice(0, 10);
    if (!cellsByDate[k]) cellsByDate[k] = [];
    cellsByDate[k].push(c);
  }
  for (const k of Object.keys(cellsByDate)) {
    cellsByDate[k].sort((a, b) => {
      const ai = activeChannels.indexOf(a.channel);
      const bi = activeChannels.indexOf(b.channel);
      const aw = ai < 0 ? 99 : ai;
      const bw = bi < 0 ? 99 : bi;
      if (aw !== bw) return aw - bw;
      return (a.position || 0) - (b.position || 0);
    });
  }

  let statusRowEnd = null;
  if (role === 'client') {
    if (plan.plan_status === 'awaiting_alignment') {
      statusRowEnd = (
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <CtaButton label="Changes" variant="border" onClick={() => openPlanSheet('changes')} />
          <CtaButton label="Align month" onClick={() => openPlanSheet('align')} />
        </div>
      );
    }
  } else {
    if (plan.plan_status === 'awaiting_alignment') {
      statusRowEnd = <span style={{ marginLeft: 'auto' }}><CtaButton label="Awaiting client" variant="badge" /></span>;
    } else if (plan.plan_status === 'aligned') {
      statusRowEnd = <span style={{ marginLeft: 'auto' }}><CtaButton label="Plan aligned" variant="badge" /></span>;
    } else {
      statusRowEnd = (
        <span style={{ marginLeft: 'auto' }}>
          <CtaButton label="Send for alignment" onClick={() => openPlanSheet('send')} />
        </span>
      );
    }
  }

  return (
    <div>
      <style>{`
        .plan-x-btn { opacity: 0.55; transition: opacity .1s ease; }
        .plan-x-btn:active { opacity: 1; }
        [data-plan-root] .plan-action-link { color: var(--text-2); }
        [data-plan-root] .plan-action-link:hover { color: var(--text-1); }
        [data-plan-root] .plan-day-card-input::-webkit-calendar-picker-indicator {
          opacity: 0; cursor: pointer; width: 100%; height: 100%;
        }
      `}</style>
      <section style={{ padding: '14px 16px 14px', borderBottom: '1px solid var(--border-1)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexShrink: 0
          }}>
            <button type="button" aria-label="Previous plan" onClick={() => loadAdjacentPlan('prev')} style={{
              background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--text-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{
              fontFamily: FONT_BODY,
              fontSize: '16px',
              fontWeight: 500,
              letterSpacing: '-.01em',
              color: 'var(--text-1)',
              whiteSpace: 'nowrap'
            }}>{formatPlanRange(plan.period_start, plan.period_end) || (plan.title || 'Untitled plan')}</div>
            <button type="button" aria-label="Next plan" onClick={() => loadAdjacentPlan('next')} style={{
              background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--text-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            {canCreatePlan ? (
              <button type="button" onClick={() => openWizard()} style={{
                background: 'transparent',
                border: '1px solid var(--border-2)',
                borderRadius: '3px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontFamily: FONT_MONO,
                fontSize: '9px',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'var(--text-2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}>
                <Plus size={10} />
                Create plan
              </button>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <StatusPill status={plan.plan_status} />
          <VersionChip v={plan.current_version} />
          {statusRowEnd}
        </div>
        <div style={{
          marginTop: '10px',
          fontFamily: FONT_MONO,
          fontSize: '10px',
          letterSpacing: '.02em',
          color: 'var(--text-3)'
        }}>{total} concept{total === 1 ? '' : 's'} · {channelChannels.length} channel{channelChannels.length === 1 ? '' : 's'}{sentVersion ? ` · sent ${relativeTime(sentVersion.created_at)}` : ''}</div>
        <ProgressBar counts={counts} total={total} />
      </section>

      <section style={{
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border-1)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <button type="button" className="plan-action-link" onClick={() => openPlanSheet('history')} style={{
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          fontFamily: FONT_MONO,
          fontSize: '10px',
          letterSpacing: '.08em',
          textTransform: 'uppercase'
        }}>History ({versions.length})</button>
        <button type="button" className="plan-action-link" onClick={() => openPlanSheet('comments')} style={{
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          fontFamily: FONT_MONO,
          fontSize: '10px',
          letterSpacing: '.08em',
          textTransform: 'uppercase'
        }}>Comments ({unresolvedComments})</button>
        <button type="button" className="plan-action-link" onClick={() => usePlanStore.getState().sharePlan()} style={{
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          fontFamily: FONT_MONO,
          fontSize: '10px',
          letterSpacing: '.08em',
          textTransform: 'uppercase'
        }}>Share</button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setShowWeekends(!showWeekends)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            cursor: 'pointer',
            fontFamily: FONT_MONO,
            fontSize: '10px',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: showWeekends ? 'var(--accent)' : 'var(--text-3)'
          }}>{showWeekends ? 'Hide weekends' : 'Show weekends'}</button>
      </section>

      <section style={{ padding: '14px 16px 96px' }}>
        {dates.length === 0 ? (
          <div style={{
            padding: '40px 0',
            textAlign: 'center',
            fontFamily: FONT_BODY,
            fontSize: '13px',
            color: 'var(--text-3)'
          }}>No dates in this plan range.</div>
        ) : dates.map((dISO) => {
          const dayCells = cellsByDate[dISO] || [];
          if (role === 'client' && dayCells.length === 0) return null;
          return (
            <DayCard
              key={dISO}
              dateISO={dISO}
              cells={dayCells}
              role={role}
              defaultChannel={defaultChannel}
              onTap={handleCellTap}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onDateChange={triggerCellPicker}
            />
          );
        })}
      </section>
      {wizardOpen ? <CreatePlanWizard /> : null}
    </div>
  );
}

export default PlanView;
