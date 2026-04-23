// Rotated kanban. One row per stage, horizontal snap-scroll of
// cards. Card tap is a stub in PR 1 (toast "Opens in real PCS").

import React, { useMemo } from 'react';
import { usePosts } from '../hooks/usePosts.js';
import { usePlanStore } from '../store/planStore.js';
import {
  parseISODate, dayNumber, dowShortMonFirst, monthAbbr, formatTime12
} from '../shared/dateUtils.js';
import {
  STAGE_ORDER_BOARD, STAGE_LABELS, STAGE_COLOR_VAR,
  OWNER_COLOR_VAR, PILLAR_LABELS
} from '../shared/constants.js';
import { AgeBadge } from '../shared/AgeBadge.jsx';
import { PillarThumb } from '../shared/PillarThumb.jsx';

const AGED_STAGES = new Set(['awaiting_approval', 'awaiting_brand_input', 'brief_done']);

function Card({ post }) {
  const showToast = usePlanStore((s) => s.showToast);
  const d = parseISODate(post.target_date);
  const stageColor = STAGE_COLOR_VAR[post.stage]
    ? `var(${STAGE_COLOR_VAR[post.stage]})`
    : 'var(--c-text-dim)';
  const ownerColor = OWNER_COLOR_VAR[post.owner]
    ? `var(${OWNER_COLOR_VAR[post.owner]})`
    : 'var(--c-text-dim)';

  let dateChip = '';
  if (post.stage === 'published') {
    const pub = post.status_changed_at ? new Date(post.status_changed_at) : null;
    const dayStr = d ? `${dayNumber(d)} ${monthAbbr(d)}` : '';
    const timeStr = pub && !isNaN(pub.getTime()) ? formatTime12(pub) : '';
    dateChip = timeStr ? `${dayStr} - ${timeStr}` : dayStr;
  } else if (d) {
    dateChip = `${dayNumber(d)} ${monthAbbr(d)} - ${dowShortMonFirst(d)}`;
  }

  const dim = post.stage === 'rejected' || post.stage === 'parked';

  return (
    <button
      type="button"
      onClick={() => showToast({ msg: 'Opens in real PCS', duration: 3000, undoAction: null })}
      style={{
        width: '138px',
        flexShrink: 0,
        scrollSnapAlign: 'start',
        background: 'var(--c-bg)',
        border: '1px solid var(--c-divider-soft)',
        borderRadius: '6px',
        padding: 0,
        textAlign: 'left',
        cursor: 'pointer',
        opacity: dim ? 0.7 : 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 12', overflow: 'hidden', borderRadius: '6px 6px 0 0' }}>
        <PillarThumb post={post} size="100%" radius={0} labelSize="10px" />
        {dateChip ? (
          <div style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            background: 'rgba(0,0,0,.55)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '8px',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            padding: '3px 7px',
            borderRadius: '100px'
          }}>{dateChip}</div>
        ) : null}
        {AGED_STAGES.has(post.stage) ? (
          <div style={{ position: 'absolute', bottom: '6px', right: '6px' }}>
            <AgeBadge statusChangedAt={post.status_changed_at} dark />
          </div>
        ) : null}
      </div>
      <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <div style={{
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 600,
          fontSize: '12px',
          color: 'var(--c-text-loud)',
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>{post.title || 'Untitled'}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '7.5px',
            textTransform: 'uppercase',
            letterSpacing: '.1em',
            color: 'var(--c-text-dim)'
          }}>{post.owner || ''}</span>
          <span style={{
            width: '20px', height: '20px',
            borderRadius: '20px',
            background: ownerColor,
            flexShrink: 0
          }} />
        </div>
      </div>
    </button>
  );
}

function Row({ stage, items }) {
  const stageColor = STAGE_COLOR_VAR[stage]
    ? `var(${STAGE_COLOR_VAR[stage]})`
    : 'var(--c-text-dim)';
  return (
    <section style={{ borderBottom: '1px solid var(--c-divider-subtle)' }}>
      <header style={{
        padding: '12px 16px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '6px', background: stageColor }} />
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--c-text-mid)'
        }}>{STAGE_LABELS[stage] || stage}</span>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '9.5px',
          color: 'var(--c-text-dim)'
        }}>{items.length}</span>
      </header>
      <div className="scrollbar-none" style={{
        display: 'flex',
        gap: '10px',
        padding: '0 16px 14px',
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
        ) : items.map((p) => <Card key={p.id} post={p} />)}
      </div>
    </section>
  );
}

export function Board() {
  const posts = usePosts();
  const groups = useMemo(() => {
    const map = {};
    for (const s of STAGE_ORDER_BOARD) map[s] = [];
    for (const p of posts) {
      if (map[p.stage]) map[p.stage].push(p);
    }
    return map;
  }, [posts]);

  return (
    <div style={{ paddingBottom: '80px' }}>
      {STAGE_ORDER_BOARD.map((stage) => (
        <Row key={stage} stage={stage} items={groups[stage] || []} />
      ))}
    </div>
  );
}
