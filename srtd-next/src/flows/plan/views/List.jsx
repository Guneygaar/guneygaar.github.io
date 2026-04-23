// Week-grouped list view. Monday-first week boundaries. Stage pill
// taps apply stage filter. Date block taps open native date picker
// for inline reschedule.

import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { usePosts } from '../hooks/usePosts.js';
import { usePlanStore } from '../store/planStore.js';
import { useDatePicker } from '../hooks/useDatePicker.js';
import { useMetricsFor } from '../hooks/useMetrics.js';
import {
  parseISODate, dayNumber, dowShortMonFirst, weekRangeMonFirst,
  weekKey, formatWeekHeader, formatTime12
} from '../shared/dateUtils.js';
import {
  STAGE_LABELS, STAGE_COLOR_VAR, PILLAR_LABELS, OWNER_COLOR_VAR
} from '../shared/constants.js';
import { AgeBadge } from '../shared/AgeBadge.jsx';
import { PillarThumb } from '../shared/PillarThumb.jsx';
import { MetricsLine } from '../shared/MetricsLine.jsx';

const AGED_STAGES = new Set(['awaiting_approval', 'awaiting_brand_input', 'brief_done']);

function PostRow({ post, triggerPicker }) {
  const openCard = usePlanStore((s) => s.openCard);
  const setFilter = usePlanStore((s) => s.setFilter);
  const metrics = useMetricsFor(post);
  const d = parseISODate(post.target_date);
  const stageColor = STAGE_COLOR_VAR[post.stage]
    ? `var(${STAGE_COLOR_VAR[post.stage]})`
    : 'var(--c-text-dim)';
  const ownerColor = OWNER_COLOR_VAR[post.owner]
    ? `var(${OWNER_COLOR_VAR[post.owner]})`
    : 'var(--c-text-dim)';
  const pillarLabel = PILLAR_LABELS[post.content_pillar] || '';

  const publishedAtIso = post.status_changed_at || post.updated_at;
  let publishedTime = '';
  if (post.stage === 'published' && publishedAtIso) {
    const pd = new Date(publishedAtIso);
    if (!isNaN(pd.getTime())) publishedTime = formatTime12(pd);
  }

  return (
    <div
      onClick={() => openCard(post)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--c-bg)',
        borderBottom: '1px solid var(--c-divider-subtle)',
        cursor: 'pointer',
        minHeight: '64px'
      }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); triggerPicker(post); }}
        style={{
          width: '42px',
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          padding: '10px 0 10px 12px',
          textAlign: 'left',
          cursor: 'pointer'
        }}>
        <div style={{
          fontFamily: 'Fraunces, serif',
          fontSize: '18px',
          fontWeight: 500,
          color: 'var(--c-text-loud)',
          lineHeight: 1
        }}>{d ? dayNumber(d) : '-'}</div>
        <div style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '8px',
          color: 'var(--c-text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '.1em',
          marginTop: '4px'
        }}>{d ? dowShortMonFirst(d) : ''}</div>
      </button>

      <div style={{ padding: '10px 10px 10px 8px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <PillarThumb post={post} size={44} />
      </div>

      <div style={{ width: '3px', background: ownerColor, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0, padding: '10px 12px' }}>
        <div style={{
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 600,
          fontSize: '13.5px',
          color: 'var(--c-text-loud)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>{post.title || 'Untitled'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', flexWrap: 'nowrap', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFilter({ stage: post.stage }); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'var(--c-bg-2)',
              border: 'none',
              padding: '3px 7px',
              cursor: 'pointer',
              borderRadius: '2px',
              flexShrink: 0
            }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '5px', background: stageColor }} />
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '8.5px',
              textTransform: 'uppercase',
              letterSpacing: '.1em',
              color: 'var(--c-text-mid)'
            }}>{STAGE_LABELS[post.stage] || post.stage}</span>
          </button>
          {post.stage === 'published' ? (
            <MetricsLine metrics={metrics} publishedAt={publishedTime || (d ? `${dayNumber(d)} ${dowShortMonFirst(d)}` : '')} />
          ) : AGED_STAGES.has(post.stage) ? (
            <AgeBadge statusChangedAt={post.status_changed_at} />
          ) : null}
          {pillarLabel ? (
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '8px',
              textTransform: 'uppercase',
              letterSpacing: '.1em',
              color: 'var(--c-text-dim)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>{pillarLabel}</span>
          ) : null}
        </div>
      </div>

      <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <ChevronRight size={14} style={{ color: 'var(--c-text-dim)' }} />
      </div>
    </div>
  );
}

export function List() {
  const posts = usePosts();
  const { triggerPicker } = useDatePicker();

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const p of posts) {
      const d = parseISODate(p.target_date);
      if (!d) continue;
      const k = weekKey(d);
      if (!groups.has(k)) {
        const r = weekRangeMonFirst(d);
        groups.set(k, { start: r.start, end: r.end, items: [] });
      }
      groups.get(k).items.push(p);
    }
    const arr = Array.from(groups.values()).sort((a, b) => a.start - b.start);
    for (const g of arr) g.items.sort((a, b) => (a.target_date || '').localeCompare(b.target_date || ''));
    return arr;
  }, [posts]);

  if (posts.length === 0) {
    return (
      <div style={{
        padding: '80px 24px',
        textAlign: 'center',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '14px',
        color: 'var(--c-text-dim)'
      }}>No posts match this filter.</div>
    );
  }

  return (
    <div>
      {grouped.map((g) => (
        <section key={g.start.toISOString()}>
          <header style={{
            position: 'sticky',
            top: 0,
            background: 'var(--c-bg-2)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--c-divider-soft)',
            borderBottom: '1px solid var(--c-divider-subtle)',
            zIndex: 5
          }}>
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '9.5px',
              textTransform: 'uppercase',
              letterSpacing: '.14em',
              color: 'var(--c-text-mid)'
            }}>{formatWeekHeader(g.start, g.end)}</span>
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '9.5px',
              color: 'var(--c-text-dim)'
            }}>{g.items.length} post{g.items.length === 1 ? '' : 's'}</span>
          </header>
          {g.items.map((p) => (
            <PostRow key={p.id} post={p} triggerPicker={triggerPicker} />
          ))}
        </section>
      ))}
    </div>
  );
}
