// 70vh bottom sheet showing every post for a single day. Row tap
// closes Day sheet and opens Card sheet (via sequential store
// transition - the store switches activeSheet from 'day' to 'card').

import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';
import { useAllPosts } from '../hooks/usePosts.js';
import { useMetricsFor } from '../hooks/useMetrics.js';
import {
  parseISODate, dowShortSunFirst, dayNumber, monthAbbr, formatTime12
} from '../shared/dateUtils.js';
import {
  STAGE_LABELS, STAGE_COLOR_VAR, PILLAR_LABELS, OWNER_COLOR_VAR
} from '../shared/constants.js';
import { AgeBadge } from '../shared/AgeBadge.jsx';
import { MetricsLine } from '../shared/MetricsLine.jsx';
import { PillarThumb } from '../shared/PillarThumb.jsx';

const AGED_STAGES = new Set(['awaiting_approval', 'awaiting_brand_input', 'brief_done']);

function Row({ post, onOpen }) {
  const metrics = useMetricsFor(post);
  const stageColor = STAGE_COLOR_VAR[post.stage]
    ? `var(${STAGE_COLOR_VAR[post.stage]})`
    : 'var(--c-text-dim)';
  const ownerColor = OWNER_COLOR_VAR[post.owner]
    ? `var(${OWNER_COLOR_VAR[post.owner]})`
    : 'var(--c-text-dim)';
  const pillarLabel = PILLAR_LABELS[post.content_pillar] || '';

  let publishedTime = '';
  if (post.stage === 'published' && post.status_changed_at) {
    const pd = new Date(post.status_changed_at);
    if (!isNaN(pd.getTime())) publishedTime = formatTime12(pd);
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--c-divider-subtle)',
        padding: '10px 12px',
        cursor: 'pointer',
        textAlign: 'left'
      }}>
      <PillarThumb post={post} size={44} />
      <div style={{ width: '3px', background: ownerColor, alignSelf: 'stretch', margin: '0 10px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
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
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 7px',
            background: 'var(--c-bg-2)',
            borderRadius: '2px',
            flexShrink: 0
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '5px', background: stageColor }} />
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '8.5px',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'var(--c-text-mid)'
            }}>{STAGE_LABELS[post.stage] || post.stage}</span>
          </span>
          {post.stage === 'published' ? (
            <MetricsLine metrics={metrics} publishedAt={publishedTime} />
          ) : AGED_STAGES.has(post.stage) ? (
            <AgeBadge statusChangedAt={post.status_changed_at} />
          ) : null}
          {pillarLabel ? (
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '8px',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'var(--c-text-dim)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>{pillarLabel}</span>
          ) : null}
        </div>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--c-text-dim)', flexShrink: 0 }} />
    </button>
  );
}

export function DaySheet() {
  const day = usePlanStore((s) => s.currentDay);
  const closeDay = usePlanStore((s) => s.closeDay);
  const openMiniCard = usePlanStore((s) => s.openMiniCard);
  const allPosts = useAllPosts();

  const posts = useMemo(() => {
    if (!day) return [];
    const y = day.getFullYear();
    const m = day.getMonth();
    const d = day.getDate();
    return allPosts.filter((p) => {
      const pd = parseISODate(p.target_date);
      if (!pd) return false;
      return pd.getFullYear() === y && pd.getMonth() === m && pd.getDate() === d;
    });
  }, [allPosts, day]);

  if (!day) return null;

  const headerTitle = `${dowShortSunFirst(day)} - ${dayNumber(day)} ${monthAbbr(day)}`;

  function handleOpen(post) {
    // Sequential transition - close day sheet, then open card.
    setTimeout(() => openMiniCard(post), 240);
    closeDay();
  }

  return (
    <>
      <div
        onClick={closeDay}
        style={{
          position: 'fixed', inset: 0,
          background: 'var(--backdrop-tint, rgba(0,0,0,.3))',
          zIndex: 2400
        }} />
      <div
        className="plan-mini-card-sheet-enter"
        style={{
          position: 'fixed',
          left: 0, right: 0, bottom: 0,
          height: '70vh',
          background: 'var(--c-bg)',
          zIndex: 2450,
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '480px',
          margin: '0 auto',
          boxShadow: '0 -30px 80px -20px rgba(0,0,0,.5)'
        }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: '1px solid var(--c-divider-soft)',
          gap: '8px'
        }}>
          <button type="button" aria-label="Close" onClick={closeDay}
            style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--c-text-mid)' }}>
            <ChevronDown size={20} />
          </button>
          <div style={{
            flex: 1,
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '11px',
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--c-text-loud)'
          }}>{headerTitle}</div>
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '9.5px',
            color: 'var(--c-text-dim)'
          }}>{posts.length} post{posts.length === 1 ? '' : 's'}</span>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {posts.length === 0 ? (
            <div style={{
              padding: '40px 24px',
              textAlign: 'center',
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '13px',
              color: 'var(--c-text-dim)',
              fontStyle: 'italic'
            }}>Nothing scheduled for this day.</div>
          ) : posts.map((p) => <Row key={p.id} post={p} onOpen={handleOpen} />)}
        </div>
      </div>
    </>
  );
}
