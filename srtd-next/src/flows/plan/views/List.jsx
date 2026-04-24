// Week-grouped list view. Monday-first week boundaries. Stage pill
// taps apply stage filter. Long-press on the date number opens the
// native date picker; long-press on the title swaps it for an inline
// input. Both gestures are gated off for client role.

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { JumpPill } from './JumpPill.jsx';
import { usePosts } from '../hooks/usePosts.js';
import { usePlanStore } from '../store/planStore.js';
import { useDatePicker } from '../hooks/useDatePicker.js';
import { useMetricsFor } from '../hooks/useMetrics.js';
import { useLongPress } from '../hooks/useLongPress.js';
import { patchPostTitle } from '../api/planApi.js';
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
const LONG_PRESS_GUARD_MS = 400;

function rowClickGuarded(handler) {
  return (e) => {
    if (window.__planLastLongPressAt && Date.now() - window.__planLastLongPressAt < LONG_PRESS_GUARD_MS) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handler(e);
  };
}

function PostRow({ post, triggerPicker }) {
  const openMiniCard = usePlanStore((s) => s.openMiniCard);
  const setFilter = usePlanStore((s) => s.setFilter);
  const role = usePlanStore((s) => s.role);
  const updatePostInPlace = usePlanStore.setState;
  const planPosts = usePlanStore((s) => s.posts);
  const currentPost = usePlanStore((s) => s.currentPost);
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

  const editingEnabled = role !== 'client';
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(post.title || '');

  const dateLongPress = useLongPress({
    enabled: editingEnabled,
    onLongPress: () => triggerPicker(post)
  });

  const titleLongPress = useLongPress({
    enabled: editingEnabled,
    onLongPress: () => {
      setTitleDraft(post.title || '');
      setEditingTitle(true);
    }
  });

  const cancelTitleEdit = useCallback(() => {
    setEditingTitle(false);
    setTitleDraft(post.title || '');
  }, [post.title]);

  const commitTitle = useCallback(async () => {
    const next = (titleDraft || '').trim();
    setEditingTitle(false);
    const prev = post.title || '';
    if (!next || next === prev) {
      setTitleDraft(prev);
      return;
    }

    const nextPosts = planPosts.map((p) =>
      p.id === post.id ? { ...p, title: next } : p
    );
    const nextCurrent = currentPost && currentPost.id === post.id
      ? { ...currentPost, title: next }
      : currentPost;
    updatePostInPlace({ posts: nextPosts, currentPost: nextCurrent });

    try {
      await patchPostTitle(post.id, next);
    } catch (err) {
      const revertPosts = usePlanStore.getState().posts.map((p) =>
        p.id === post.id ? { ...p, title: prev } : p
      );
      const curNow = usePlanStore.getState().currentPost;
      const revertCur = curNow && curNow.id === post.id
        ? { ...curNow, title: prev }
        : curNow;
      updatePostInPlace({ posts: revertPosts, currentPost: revertCur });
      const showToast = usePlanStore.getState().showToast;
      if (typeof showToast === 'function') {
        showToast({ msg: 'Title save failed', duration: 3000, undoAction: null });
      }
    }
  }, [titleDraft, post.id, post.title, planPosts, currentPost, updatePostInPlace]);

  return (
    <div
      onClick={rowClickGuarded(() => openMiniCard(post))}
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
        className="plan-list-date-btn"
        {...dateLongPress}
        style={{
          width: '42px',
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          padding: '10px 0 10px 12px',
          textAlign: 'left',
          cursor: editingEnabled ? 'pointer' : 'inherit',
          touchAction: 'manipulation'
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
        {editingTitle ? (
          <input
            type="text"
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onFocus={(e) => { try { e.target.select(); } catch (err) { /* noop */ } }}
            onBlur={() => { commitTitle(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTitle();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelTitleEdit();
              }
            }}
            style={{
              width: '100%',
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 600,
              fontSize: '13.5px',
              color: 'var(--c-text-loud)',
              background: 'transparent',
              border: '1px solid var(--c-terracotta)',
              padding: '2px 6px',
              outline: 'none',
              borderRadius: '3px'
            }}
          />
        ) : (
          <div
            className="plan-list-title"
            {...titleLongPress}
            style={{
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 600,
              fontSize: '13.5px',
              color: 'var(--c-text-loud)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              padding: '2px 6px',
              margin: '0 -6px',
              borderRadius: '3px',
              touchAction: 'manipulation'
            }}>
            {post.title || 'Untitled'}
          </div>
        )}
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

  const currentWeekIso = useMemo(() => weekKey(new Date()), []);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const p of posts) {
      const d = parseISODate(p.target_date);
      if (!d) continue;
      const k = weekKey(d);
      if (!groups.has(k)) {
        const r = weekRangeMonFirst(d);
        groups.set(k, { key: k, start: r.start, end: r.end, items: [] });
      }
      groups.get(k).items.push(p);
    }
    const arr = Array.from(groups.values()).sort((a, b) => a.start - b.start);
    for (const g of arr) g.items.sort((a, b) => (a.target_date || '').localeCompare(b.target_date || ''));
    return arr;
  }, [posts]);

  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set([currentWeekIso]));

  const toggleWeek = useCallback((iso) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      return next;
    });
  }, []);

  const currentWeekHeaderRef = useRef(null);
  const hasCurrentWeek = useMemo(
    () => grouped.some((g) => g.key === currentWeekIso),
    [grouped, currentWeekIso]
  );
  const didAutoScrollRef = useRef(false);
  useEffect(() => {
    if (didAutoScrollRef.current) return;
    if (!hasCurrentWeek) return;
    const el = currentWeekHeaderRef.current;
    if (!el || typeof el.scrollIntoView !== 'function') return;
    try {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
    } catch (e) {
      el.scrollIntoView({ block: 'start' });
    }
    didAutoScrollRef.current = true;
  }, [hasCurrentWeek]);

  const jumpToCurrentWeek = useCallback(() => {
    setExpandedWeeks((prev) => {
      if (prev.has(currentWeekIso)) return prev;
      const next = new Set(prev);
      next.add(currentWeekIso);
      return next;
    });
    const el = currentWeekHeaderRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        el.scrollIntoView({ block: 'start' });
      }
    }
  }, [currentWeekIso]);

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
      {grouped.map((g) => {
        const isExpanded = expandedWeeks.has(g.key);
        const isCurrent = g.key === currentWeekIso;
        return (
          <section key={g.key}>
            <button
              type="button"
              ref={isCurrent ? currentWeekHeaderRef : null}
              onClick={() => toggleWeek(g.key)}
              style={{
                position: 'sticky',
                top: 0,
                background: 'var(--c-bg-2)',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--c-divider-soft)',
                borderBottom: '1px solid var(--c-divider-subtle)',
                zIndex: 5,
                width: '100%',
                border: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit'
              }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {isExpanded
                  ? <ChevronDown size={13} style={{ color: 'var(--c-text-mid)', flexShrink: 0 }} />
                  : <ChevronRight size={13} style={{ color: 'var(--c-text-mid)', flexShrink: 0 }} />}
                <span style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '9.5px',
                  textTransform: 'uppercase',
                  letterSpacing: '.14em',
                  color: isCurrent ? 'var(--c-terracotta-1)' : 'var(--c-text-mid)'
                }}>{formatWeekHeader(g.start, g.end)}{isCurrent ? ' - This Week' : ''}</span>
              </span>
              <span style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '9.5px',
                color: 'var(--c-text-dim)'
              }}>{g.items.length} post{g.items.length === 1 ? '' : 's'}</span>
            </button>
            {isExpanded ? g.items.map((p) => (
              <PostRow key={p.id} post={p} triggerPicker={triggerPicker} />
            )) : null}
          </section>
        );
      })}
      <JumpPill
        targetRef={currentWeekHeaderRef}
        isExpanded={expandedWeeks.has(currentWeekIso)}
        isPresent={hasCurrentWeek}
        onJump={jumpToCurrentWeek}
      />
    </div>
  );
}
