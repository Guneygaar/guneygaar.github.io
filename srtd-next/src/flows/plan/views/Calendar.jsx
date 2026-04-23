// Month grid view. Monday-first. Cells show up to 2 thumb previews.
// Cell tap opens DaySheet. Thumb tap bypasses DaySheet and opens
// CardSheet directly.

import React, { useMemo } from 'react';
import { usePosts } from '../hooks/usePosts.js';
import { usePlanStore } from '../store/planStore.js';
import {
  parseISODate, buildMonthGrid, sameDay, formatYYYYMMDD
} from '../shared/dateUtils.js';
import {
  STAGE_COLOR_VAR, PILLAR_LABELS
} from '../shared/constants.js';
import { PillarThumb } from '../shared/PillarThumb.jsx';

const DOW_HEADERS = ['M','T','W','T','F','S','S'];

function ThumbMini({ post }) {
  const openCard = usePlanStore((s) => s.openCard);
  const stageColor = STAGE_COLOR_VAR[post.stage]
    ? `var(${STAGE_COLOR_VAR[post.stage]})`
    : 'var(--c-text-dim)';
  const dim = post.stage === 'rejected' || post.stage === 'parked';
  const approvalInset = post.stage === 'awaiting_approval'
    ? `inset 0 0 0 1.5px ${stageColor}`
    : 'none';

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openCard(post); }}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        borderRadius: '3px',
        overflow: 'hidden',
        opacity: dim ? 0.5 : 1,
        background: 'transparent',
        boxShadow: approvalInset,
        marginBottom: '2px'
      }}>
      <PillarThumb post={post} size="100%" radius={0} labelSize="6px" showLabel={true} />
      <span style={{
        position: 'absolute',
        top: '3px',
        right: '3px',
        width: '4px',
        height: '4px',
        borderRadius: '4px',
        background: stageColor,
        boxShadow: '0 0 0 1px rgba(0,0,0,.4)'
      }} />
      <span style={{
        position: 'absolute',
        bottom: '2px',
        left: '3px',
        color: '#fff',
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '6.5px',
        textTransform: 'uppercase',
        letterSpacing: '.06em',
        textShadow: '0 1px 2px rgba(0,0,0,.9)',
        pointerEvents: 'none'
      }}>{PILLAR_LABELS[post.content_pillar] || ''}</span>
    </button>
  );
}

function Cell({ date, posts, isToday, isOffMonth }) {
  const openDay = usePlanStore((s) => s.openDay);
  const preview = posts.slice(0, 2);
  const extra = Math.max(0, posts.length - preview.length);
  return (
    <button
      type="button"
      onClick={() => date && openDay(date)}
      style={{
        position: 'relative',
        minHeight: '98px',
        background: 'var(--c-bg)',
        border: '1px solid var(--c-divider-subtle)',
        borderRadius: '6px',
        padding: '6px 5px 5px',
        cursor: date ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        opacity: isOffMonth ? 0.25 : 1,
        textAlign: 'left'
      }}>
      {date ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '9.5px',
              color: 'var(--c-text-mid)'
            }}>{date.getDate()}</span>
            {posts.length > 1 ? (
              <span style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '8px',
                color: 'var(--c-text-dim)'
              }}>{posts.length}</span>
            ) : null}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {preview.map((p) => (
              <ThumbMini key={p.id} post={p} />
            ))}
            {extra > 0 ? (
              <span style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '8px',
                fontWeight: 600,
                color: 'var(--c-text-soft)',
                marginTop: '2px'
              }}>+{extra}</span>
            ) : null}
          </div>
          {isToday ? (
            <span style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              width: '6px',
              height: '6px',
              borderRadius: '6px',
              background: 'var(--c-amber)',
              boxShadow: '0 0 0 2px var(--c-bg)'
            }} />
          ) : null}
        </>
      ) : null}
    </button>
  );
}

export function Calendar() {
  const posts = usePosts();
  const monthStart = usePlanStore((s) => s.monthStart);

  const startDate = useMemo(() => parseISODate(monthStart), [monthStart]);
  const grid = useMemo(() => buildMonthGrid(startDate), [startDate]);
  const postsByDay = useMemo(() => {
    const map = {};
    for (const p of posts) {
      if (!p.target_date) continue;
      const key = p.target_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [posts]);

  const today = new Date();

  return (
    <div style={{ padding: '12px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px',
        marginBottom: '6px'
      }}>
        {DOW_HEADERS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '8.5px',
            textTransform: 'uppercase',
            letterSpacing: '.12em',
            color: 'var(--c-text-dim)',
            padding: '4px 0'
          }}>{d}</div>
        ))}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px'
      }}>
        {Array.from({ length: grid.leading }).map((_, i) => (
          <Cell key={`lead-${i}`} date={null} posts={[]} isToday={false} isOffMonth={true} />
        ))}
        {grid.days.map((d) => {
          const key = formatYYYYMMDD(d);
          return (
            <Cell
              key={key}
              date={d}
              posts={postsByDay[key] || []}
              isToday={sameDay(d, today)}
              isOffMonth={false}
            />
          );
        })}
      </div>
    </div>
  );
}
