// Briefs section at the top of the Plan Board for client role only.
// Reads requests from planStore (seeded by loadRequests in Plan.jsx),
// buckets them into Assigned (status !== 'closed') and Closed (status
// === 'closed'), and renders each bucket as a section whose visual
// language matches the stage sections in Board.jsx (same typography,
// same tokens, same spacing primitives).
//
// Tap handler is a no-op that logs to console; wiring to a detail
// view is deferred to a follow-up PR per the parent task.

import React from 'react';
import { FileText } from 'lucide-react';
import { useRequests } from '../hooks/useRequests.js';
import { STAGE_COLOR_VAR } from '../shared/constants.js';
import {
  parseISODate, dayNumber, dowShortMonFirst, monthAbbr
} from '../shared/dateUtils.js';

function formatTargetChip(iso) {
  const d = parseISODate(iso);
  if (!d) return '';
  return `${dayNumber(d)} ${monthAbbr(d)} - ${dowShortMonFirst(d)}`;
}

function BriefTile({ request }) {
  const isClosed = request && request.status === 'closed';
  const pillLabel = isClosed ? 'CLOSED' : 'ASSIGNED';
  const pillColor = isClosed
    ? 'var(--c-text-dim)'
    : `var(${STAGE_COLOR_VAR.awaiting_approval})`;

  const total = Number(request && request.total_posts);
  const completed = Number(request && request.completed_posts);
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 1;
  const safeCompleted = Number.isFinite(completed) && completed >= 0 ? completed : 0;
  const progress = `${safeCompleted} of ${safeTotal} posts published`;
  const dateChip = formatTargetChip(request && request.target_date);

  return (
    <button
      type="button"
      onClick={() => {
        // eslint-disable-next-line no-console
        console.log('[briefs] tap', request && request.id);
      }}
      style={{
        width: '220px',
        flexShrink: 0,
        scrollSnapAlign: 'start',
        background: 'var(--c-bg)',
        border: '1px solid var(--c-divider-soft)',
        borderRadius: '6px',
        padding: '10px 12px',
        textAlign: 'left',
        cursor: 'pointer',
        opacity: isClosed ? 0.7 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '8px',
          fontWeight: 700,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: pillColor,
          border: '1px solid ' + pillColor,
          padding: '2px 6px',
          borderRadius: '100px'
        }}>{pillLabel}</span>
        {dateChip ? (
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '8px',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--c-text-dim)'
          }}>{dateChip}</span>
        ) : null}
      </div>
      <div style={{
        fontFamily: '"DM Sans", sans-serif',
        fontWeight: 600,
        fontSize: '13px',
        color: 'var(--c-text-loud)',
        lineHeight: 1.3,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden'
      }}>{(request && request.title) || 'Untitled brief'}</div>
      <div style={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '9px',
        letterSpacing: '.06em',
        color: 'var(--c-text-mid)'
      }}>{progress}</div>
    </button>
  );
}

function Bucket({ label, items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '8px 16px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '9.5px',
          fontWeight: 600,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--c-text-mid)'
        }}>{label}</span>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '9px',
          color: 'var(--c-text-dim)'
        }}>{items.length}</span>
      </div>
      <div className="scrollbar-none" style={{
        display: 'flex',
        gap: '10px',
        padding: '0 16px 12px',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory'
      }}>
        {items.length === 0 ? (
          <div style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '12px',
            fontStyle: 'italic',
            color: 'var(--c-text-dim)',
            padding: '8px 0'
          }}>Nothing here</div>
        ) : items.map((r) => <BriefTile key={r.id} request={r} />)}
      </div>
    </div>
  );
}

function BriefsHeader({ label, count }) {
  return (
    <header style={{
      padding: '12px 16px 4px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <FileText size={12} style={{ color: 'var(--c-text-mid)' }} />
      <span style={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: 'var(--c-text-mid)'
      }}>{label}</span>
      <span style={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '9.5px',
        color: 'var(--c-text-dim)'
      }}>{count}</span>
    </header>
  );
}

export function BriefsAssignedSection() {
  const { assigned } = useRequests();
  return (
    <section style={{ borderBottom: '1px solid var(--c-divider-subtle)' }}>
      <BriefsHeader label="Briefs" count={assigned.length} />
      <Bucket label={`Assigned ${assigned.length}`} items={assigned} />
    </section>
  );
}

export function BriefsCompletedSection() {
  const { closed } = useRequests();
  return (
    <section style={{ borderBottom: '1px solid var(--c-divider-subtle)' }}>
      <BriefsHeader label="Briefs completed" count={closed.length} />
      <Bucket label={`Closed ${closed.length}`} items={closed} />
    </section>
  );
}

export function BriefsSection() {
  const { assigned, closed } = useRequests();
  return (
    <section style={{ borderBottom: '1px solid var(--c-divider-subtle)' }}>
      <BriefsHeader label="Briefs" count={assigned.length + closed.length} />
      <Bucket label={`Assigned ${assigned.length}`} items={assigned} />
      <Bucket label={`Closed ${closed.length}`} items={closed} />
    </section>
  );
}
