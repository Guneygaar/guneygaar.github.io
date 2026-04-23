// Full-height bottom sheet for a single post. Pinned action bar
// bottom, role-gated tabs + action matrix. Stage changes in PR 1
// are stubbed to toast - no real writes to posts.stage.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, MessageSquare,
  ExternalLink, Check
} from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';
import { useMetricsFor } from '../hooks/useMetrics.js';
import { useReasonFor } from '../hooks/useReasons.js';
import {
  fetchCommentsForCard, fetchActivityForCard
} from '../api/planApi.js';
import { KebabMenu } from './KebabMenu.jsx';
import { Lightbox } from './Lightbox.jsx';
import {
  parseISODate, dayNumber, dowShortSunFirst, monthAbbr, formatTime12,
  daysBetween
} from '../shared/dateUtils.js';
import {
  STAGE_LABELS, STAGE_COLOR_VAR, PILLAR_LABELS, PILLAR_COLOR_VAR
} from '../shared/constants.js';
import { AgeBadge } from '../shared/AgeBadge.jsx';
import { MetricsLine } from '../shared/MetricsLine.jsx';
import { ReasonBlock } from '../shared/ReasonBlock.jsx';

function normalizePlanImages(raw) {
  if (!raw) return [];
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch (e) { return []; }
  }
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map(function (item) {
        if (!item) return null;
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item.url) return item.url;
        return null;
      })
      .filter(function (u) { return typeof u === 'string' && u.length > 0; });
  }
  if (typeof value === 'object' && Array.isArray(value.urls)) {
    return value.urls.filter(function (u) { return typeof u === 'string' && u.length > 0; });
  }
  return [];
}

function openInPCS(postId) {
  if (!postId) return;
  const bridge = window.SortedReact && window.SortedReact.flows && window.SortedReact.flows.pcs;
  if (bridge && typeof bridge.open === 'function') {
    bridge.open(postId);
    return;
  }
  console.error('[plan/cardsheet] PCS bridge missing; falling back to URL deep link');
  // Fallback: URL deep-link path read by index.html on mount.
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('pcs_post', String(postId));
    window.location.assign(url.toString());
  } catch (e) {
    window.location.search = '?pcs_post=' + encodeURIComponent(String(postId));
  }
}

function formatDateLine(post) {
  const d = parseISODate(post.target_date);
  if (!d) return '';
  const dayLabel = `${dowShortSunFirst(d)} - ${dayNumber(d)} ${monthAbbr(d)}`;
  if (post.stage === 'published') {
    const pub = post.status_changed_at ? new Date(post.status_changed_at) : null;
    const time = pub && !isNaN(pub.getTime()) ? formatTime12(pub) : '';
    return `Published - ${dayLabel}${time ? ' - ' + time : ''}`;
  }
  return `${dayLabel} - 10:00 AM`;
}

function lifecycleDays(post) {
  if (!post || !post.created_at) return null;
  const endTs = post.status_changed_at || new Date().toISOString();
  return daysBetween(post.created_at, endTs);
}

function GalleryStrip({ post, onImageTap }) {
  const images = normalizePlanImages(post && post.images);
  const scrollerRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    function onScroll() {
      const w = el.clientWidth;
      if (w <= 0) return;
      setActiveIdx(Math.round(el.scrollLeft / w));
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div style={{ padding: '10px 0 2px' }}>
      <div
        ref={scrollerRef}
        className="scrollbar-none"
        style={{
          display: 'flex',
          gap: '8px',
          paddingLeft: '14px',
          paddingRight: '36px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Open photo ${i + 1}`}
            onClick={() => { if (onImageTap) onImageTap(i); }}
            style={{
              flexShrink: 0,
              width: '84%',
              aspectRatio: '4 / 5',
              scrollSnapAlign: 'start',
              background: 'var(--c-bg-2)',
              borderRadius: '10px',
              overflow: 'hidden',
              padding: 0,
              border: 'none',
              cursor: 'pointer',
              display: 'block'
            }}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                touchAction: 'pinch-zoom'
              }}
            />
          </button>
        ))}
      </div>
      {images.length > 1 ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '6px',
          padding: '8px 14px 0'
        }}>
          {images.map((_, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: i === activeIdx ? '16px' : '5px',
                height: '5px',
                borderRadius: '5px',
                background: i === activeIdx ? 'var(--c-text-loud)' : 'var(--c-divider-soft)',
                transition: 'width .18s ease, background .18s ease'
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HeroBlock({ post, onImageTap }) {
  const images = normalizePlanImages(post && post.images);

  if (images.length === 0) {
    return (
      <div className="plan-hero plan-hero-empty">
        <div className={'plan-hero-fallback pillar-' + (post && post.content_pillar ? post.content_pillar.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'default')} />
      </div>
    );
  }

  const heroSrc = images[0];
  const count = images.length;

  return (
    <div
      className="plan-hero"
      onClick={() => { if (onImageTap) onImageTap(0); }}
      style={{ cursor: 'pointer' }}
    >
      <img src={heroSrc} alt="" loading="lazy" decoding="async" className="plan-hero-img" />
      <button
        type="button"
        className="plan-hero-expand"
        aria-label="Expand image"
        onClick={(e) => { e.stopPropagation(); if (onImageTap) onImageTap(0); }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      {count > 1 ? (
        <div className="plan-hero-counter">1 of {count}</div>
      ) : null}
    </div>
  );
}

function Caption({ post, isClient }) {
  const [expanded, setExpanded] = useState(false);
  const caption = typeof post.caption === 'string' ? post.caption : '';
  if (!caption) {
    return (
      <div style={{
        margin: '14px 18px 0',
        padding: '13px 14px',
        background: 'var(--c-bg-2)',
        borderRadius: '8px',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '13px',
        color: 'var(--c-text-dim)',
        fontStyle: 'italic'
      }}>No caption yet.</div>
    );
  }
  const clamp = !isClient && !expanded;
  return (
    <div style={{ margin: '14px 18px 0' }}>
      <div style={{
        position: 'relative',
        padding: '13px 14px',
        background: 'var(--c-bg-2)',
        borderRadius: '8px',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '13.5px',
        lineHeight: 1.55,
        color: 'var(--c-text-loud)',
        whiteSpace: 'pre-wrap',
        maxHeight: clamp ? '120px' : 'none',
        overflow: clamp ? 'hidden' : 'visible'
      }}>
        {caption}
        {clamp ? (
          <div style={{
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            height: '42px',
            background: 'linear-gradient(to bottom, transparent, var(--c-bg-2))',
            pointerEvents: 'none'
          }} />
        ) : null}
      </div>
      {!isClient && caption.length > 240 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '6px 0',
            marginTop: '4px',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '10px',
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--c-terracotta-1)',
            cursor: 'pointer'
          }}>
          {expanded ? 'See less' : 'See more'}
        </button>
      ) : null}
    </div>
  );
}

function roleDotColor(author_role) {
  const r = (author_role || '').toLowerCase();
  if (r === 'admin') return 'var(--c-role-admin)';
  if (r === 'client') return 'var(--c-role-client)';
  if (r === 'creative') return 'var(--c-role-creative)';
  if (r === 'servicing') return 'var(--c-role-servicing)';
  return 'var(--c-text-dim)';
}

function CommentCard({ c }) {
  const author = c.author || '';
  const short = author.includes('@') ? author.split('@')[0] : author;
  const time = c.created_at ? new Date(c.created_at) : null;
  const timeStr = time ? formatTime12(time) : '';
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-divider-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{
          width: '22px', height: '22px',
          borderRadius: '22px',
          background: roleDotColor(c.author_role),
          color: '#fff',
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '9px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>{(short[0] || '?').toUpperCase()}</span>
        <span style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--c-text-loud)'
        }}>{short}</span>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '8px',
          textTransform: 'uppercase',
          letterSpacing: '.1em',
          color: 'var(--c-text-dim)',
          padding: '2px 5px',
          background: 'var(--c-bg-2)',
          borderRadius: '2px'
        }}>{c.author_role || ''}</span>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '9px',
          color: 'var(--c-text-dim)',
          marginLeft: 'auto'
        }}>{timeStr}</span>
      </div>
      <div style={{
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '13px',
        color: 'var(--c-text-mid)',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        background: 'var(--c-bg-2)',
        padding: '8px 10px',
        borderRadius: '8px'
      }}>{c.message || ''}</div>
    </div>
  );
}

function ActivityRow({ a }) {
  const t = a.created_at ? new Date(a.created_at) : null;
  const timeStr = t ? formatTime12(t) : '';
  let line;
  if (a.action === 'stage_change') {
    line = `${a.actor || 'Someone'} moved from ${STAGE_LABELS[a.old_stage] || a.old_stage || '?'} to ${STAGE_LABELS[a.new_stage] || a.new_stage || '?'}`;
  } else {
    line = `${a.actor || 'Someone'} - ${a.action || ''}`;
  }
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      padding: '10px 16px',
      borderBottom: '1px solid var(--c-divider-subtle)'
    }}>
      <span style={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '9px',
        color: 'var(--c-text-dim)',
        width: '64px',
        flexShrink: 0,
        paddingTop: '2px'
      }}>{timeStr}</span>
      <span style={{
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '13px',
        color: 'var(--c-text-mid)',
        flex: 1
      }}>{line}</span>
    </div>
  );
}

function ActionBar({ post, role, onApproveStub, onRescheduleStub }) {
  const closeCard = usePlanStore((s) => s.closeCard);
  const stage = post.stage;
  const BTN_STYLE = {
    flex: 1,
    padding: '11px 10px',
    border: 'none',
    borderRadius: '8px',
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px'
  };
  const variant = (kind) => {
    if (kind === 'primary') return { background: 'var(--c-green)', color: '#fff' };
    if (kind === 'dark')    return { background: 'var(--c-text-loud)', color: 'var(--c-bg)' };
    if (kind === 'warn')    return { background: 'var(--c-bg-2)', color: 'var(--c-stage-input)', border: '1px solid var(--c-border-warm)' };
    return { background: 'var(--c-bg-2)', color: 'var(--c-text-mid)', border: '1px solid var(--c-divider-soft)' };
  };

  function btn(label, kind, Icon, onClick, key) {
    const primaryish = kind === 'primary' || kind === 'dark';
    const clickHandler = onClick || (primaryish ? onApproveStub : onRescheduleStub);
    return (
      <button key={key} type="button" onClick={clickHandler} style={{ ...BTN_STYLE, ...variant(kind) }}>
        {Icon ? <Icon size={13} /> : null}
        <span>{label}</span>
      </button>
    );
  }

  const openPcsHandler = () => {
    const pid = post && post.post_id;
    if (!pid) return;
    closeCard();
    openInPCS(pid);
  };
  const openPcsBtn = (key) => btn('Open in PCS', 'dark', ExternalLink, openPcsHandler, key);

  let buttons = [];
  if (stage === 'awaiting_approval') {
    if (role === 'admin') buttons = [
      btn('Recall', 'secondary', RotateCcw, null, 'rc'),
      btn('Nudge client', 'warn', Send, null, 'nc'),
      btn('Force approve', 'primary', Check, null, 'fa'),
      openPcsBtn('op')
    ];
    else if (role === 'agency') buttons = [
      btn('Recall', 'secondary', RotateCcw, null, 'rc'),
      btn('Nudge client', 'primary', Send, null, 'nc'),
      openPcsBtn('op')
    ];
    else if (role === 'client') buttons = [
      btn('Request changes', 'warn', RefreshCcw, null, 'rq'),
      btn('Approve', 'primary', Check, null, 'ap')
    ];
  } else if (stage === 'awaiting_brand_input') {
    if (role === 'admin' || role === 'agency') buttons = [
      openPcsBtn('op')
    ];
  } else if (stage === 'in_production') {
    if (role === 'admin' || role === 'agency') buttons = [
      btn('Save', 'secondary', Save, null, 'sv'),
      btn('Send for approval', 'primary', Send, null, 'sf'),
      openPcsBtn('op')
    ];
  } else if (stage === 'scheduled') {
    if (role === 'admin') buttons = [
      btn('Reschedule', 'secondary', Calendar, null, 'rs'),
      btn('Publish now', 'dark', Send, null, 'pn'),
      openPcsBtn('op')
    ];
    else if (role === 'agency') buttons = [
      btn('Reschedule', 'secondary', Calendar, null, 'rs'),
      openPcsBtn('op')
    ];
  } else if (stage === 'published') {
    if (role === 'admin') buttons = [
      btn('View on LinkedIn', 'secondary', ExternalLink, () => {
        if (post.linkedin_link) window.open(post.linkedin_link, '_blank', 'noopener');
      }, 'vl'),
      btn('Archive', 'secondary', Archive, null, 'ar'),
      openPcsBtn('op')
    ];
    else if (role === 'agency') buttons = [
      btn('View on LinkedIn', 'primary', ExternalLink, () => {
        if (post.linkedin_link) window.open(post.linkedin_link, '_blank', 'noopener');
      }, 'vl'),
      openPcsBtn('op')
    ];
    else buttons = [
      btn('View on LinkedIn', 'primary', ExternalLink, () => {
        if (post.linkedin_link) window.open(post.linkedin_link, '_blank', 'noopener');
      }, 'vl')
    ];
  } else if (stage === 'brief_done') {
    if (role === 'admin') buttons = [
      btn('Rework brief', 'warn', RefreshCcw, null, 'rb'),
      btn('Assign', 'dark', UserPlus, null, 'as'),
      openPcsBtn('op')
    ];
    else if (role === 'agency') buttons = [
      openPcsBtn('op')
    ];
  } else if (stage === 'rejected' || stage === 'parked') {
    if (role === 'admin' || role === 'agency') buttons = [
      btn('Revive', 'secondary', RotateCcw, null, 'rv'),
      openPcsBtn('op')
    ];
  }

  if (buttons.length === 0) {
    return (
      <div style={{
        padding: 'calc(14px + env(safe-area-inset-bottom, 0px)) 14px 14px',
        borderTop: '1px solid var(--c-divider-soft)',
        background: 'var(--c-bg)',
        textAlign: 'center',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '12px',
        fontStyle: 'italic',
        color: 'var(--c-text-dim)'
      }}>No actions at this stage.</div>
    );
  }

  return (
    <div style={{
      padding: '12px 14px calc(12px + env(safe-area-inset-bottom, 0px))',
      borderTop: '1px solid var(--c-divider-soft)',
      background: 'var(--c-bg)',
      display: 'flex',
      gap: '8px'
    }}>
      {buttons}
    </div>
  );
}

export function CardSheet() {
  const post = usePlanStore((s) => s.currentPost);
  const role = usePlanStore((s) => s.role);
  const closeCard = usePlanStore((s) => s.closeCard);
  const navigateCard = usePlanStore((s) => s.navigateCard);
  const showToast = usePlanStore((s) => s.showToast);
  const metrics = useMetricsFor(post);
  const reason = useReasonFor(post);

  const [activeTab, setActiveTab] = useState('comments');
  const [comments, setComments] = useState([]);
  const [commentsError, setCommentsError] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityError, setActivityError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const isClient = role === 'client';
  const canSeeInternal = role === 'admin' || role === 'agency';
  const canSeeActivity = role === 'admin' || role === 'agency';

  const postImages = useMemo(
    () => normalizePlanImages(post && post.images),
    [post && post.images]
  );

  const posts = usePlanStore((s) => s.posts);
  const navIndex = useMemo(() => {
    if (!post || !posts || posts.length === 0) return { hasPrev: false, hasNext: false };
    const sorted = [...posts].sort((a, b) => {
      const da = a.target_date || '';
      const db = b.target_date || '';
      if (da !== db) return da < db ? -1 : 1;
      const pa = a.post_id || '';
      const pb = b.post_id || '';
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
    const idx = sorted.findIndex((p) => p.id === post.id);
    if (idx < 0) return { hasPrev: false, hasNext: false };
    return { hasPrev: idx > 0, hasNext: idx < sorted.length - 1 };
  }, [post && post.id, posts]);
  const hasPrev = navIndex.hasPrev;
  const hasNext = navIndex.hasNext;

  useEffect(() => {
    if (!post || !post.post_id) { setComments([]); return; }
    let cancelled = false;
    setCommentsError(null);
    fetchCommentsForCard(post.post_id, role).then((rows) => {
      if (cancelled) return;
      setComments(rows);
    }).catch((err) => {
      if (cancelled) return;
      setCommentsError((err && err.message) || 'Failed to load comments');
    });
    return () => { cancelled = true; };
  }, [post && post.post_id, role]);

  useEffect(() => {
    if (!post || !post.post_id) { setActivity([]); return; }
    if (isClient) { setActivity([]); return; }
    let cancelled = false;
    setActivityError(null);
    fetchActivityForCard(post.post_id).then((rows) => {
      if (cancelled) return;
      setActivity(rows);
    }).catch((err) => {
      if (cancelled) return;
      setActivityError((err && err.message) || 'Failed to load activity');
    });
    return () => { cancelled = true; };
  }, [post && post.post_id, isClient]);

  if (!post) return null;

  const commentsVisible = comments.filter((c) => {
    const v = (c.visibility || 'all').toLowerCase();
    return v === 'all';
  });
  const commentsInternal = comments.filter((c) => {
    const v = (c.visibility || 'all').toLowerCase();
    return v === 'servicing' || v === 'internal';
  });

  const stageColor = STAGE_COLOR_VAR[post.stage]
    ? `var(${STAGE_COLOR_VAR[post.stage]})`
    : 'var(--c-text-dim)';
  const pillarColor = PILLAR_COLOR_VAR[post.content_pillar]
    ? `var(${PILLAR_COLOR_VAR[post.content_pillar]})`
    : 'var(--c-text-dim)';
  const pillarLabel = PILLAR_LABELS[post.content_pillar] || '';

  const lifeDays = lifecycleDays(post);
  const dateLine = formatDateLine(post);

  const AGED_STAGES = new Set(['awaiting_approval', 'awaiting_brand_input', 'brief_done']);

  const onApproveStub = () => {
    closeCard();
    showToast({ msg: 'Sent to publish queue', duration: 3000 });
  };
  const onRescheduleStub = () => {
    showToast({ msg: 'Stage action wired up in PR 3', duration: 2500 });
  };
  const onKebabAction = (key) => {
    showToast({ msg: `${key} wired up next`, duration: 2000 });
  };

  return (
    <>
      <div
        onClick={closeCard}
        style={{
          position: 'fixed', inset: 0,
          background: 'var(--backdrop-tint, rgba(0,0,0,.3))',
          zIndex: 2500
        }} />
      <div
        className="plan-card-sheet-enter"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--c-bg)',
          zIndex: 2600,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '480px',
          margin: '0 auto',
          boxShadow: '0 -30px 80px -20px rgba(0,0,0,.5)'
        }}>
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'var(--c-bg)',
          borderBottom: '1px solid var(--c-divider-soft)',
          padding: '8px 12px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <button type="button" aria-label="Close" onClick={closeCard}
            style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--c-text-mid)' }}>
            <ChevronDown size={20} />
          </button>
          <button
            type="button"
            aria-label="Previous post"
            disabled={!hasPrev}
            onClick={hasPrev ? () => navigateCard('prev') : undefined}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              cursor: hasPrev ? 'pointer' : 'default',
              color: 'var(--c-text-mid)',
              opacity: hasPrev ? 1 : 0.3
            }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: 'Fraunces, serif',
            fontSize: '14px',
            fontWeight: 500,
            letterSpacing: '-.01em',
            color: 'var(--c-text-loud)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            padding: '0 4px'
          }}>{post.title || 'Untitled'}</div>
          <button
            type="button"
            aria-label="Next post"
            disabled={!hasNext}
            onClick={hasNext ? () => navigateCard('next') : undefined}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              cursor: hasNext ? 'pointer' : 'default',
              color: 'var(--c-text-mid)',
              opacity: hasNext ? 1 : 0.3
            }}>
            <ChevronRight size={18} />
          </button>
          <KebabMenu post={post} role={role} onAction={onKebabAction} />
        </header>

        <div
          style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {isClient
            ? <GalleryStrip post={post} onImageTap={setLightboxIndex} />
            : <HeroBlock post={post} onImageTap={setLightboxIndex} />}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 18px 0'
          }}>
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '9.5px',
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--c-text-dim)'
            }}>{dateLine}</span>
            {pillarLabel ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 7px',
                background: 'var(--c-bg-2)',
                borderRadius: '2px',
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '9px',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: 'var(--c-text-mid)'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: pillarColor }} />
                {pillarLabel}
              </span>
            ) : null}
          </div>

          <h2 style={{
            fontFamily: 'Fraunces, serif',
            fontSize: '26px',
            fontWeight: 500,
            letterSpacing: '-.02em',
            padding: '10px 18px 0',
            margin: 0,
            color: 'var(--c-text-loud)'
          }}>{post.title || 'Untitled'}</h2>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            margin: '10px 18px 0',
            flexWrap: 'wrap'
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              background: 'var(--c-bg-2)',
              borderRadius: '2px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '6px', background: stageColor }} />
              <span style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '9px',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: 'var(--c-text-mid)'
              }}>{STAGE_LABELS[post.stage] || post.stage}</span>
            </span>
            {lifeDays != null ? (
              <span style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '9.5px',
                color: 'var(--c-text-dim)'
              }}>{` - Brief -> ${STAGE_LABELS[post.stage] || post.stage}: ${lifeDays}d`}</span>
            ) : null}
            {AGED_STAGES.has(post.stage) ? (
              <AgeBadge statusChangedAt={post.status_changed_at} />
            ) : null}
          </div>

          {post.stage === 'published' ? (
            <div style={{
              margin: '10px 18px 0',
              padding: '10px 12px',
              background: 'var(--c-bg-2)',
              borderRadius: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              {[
                ['Impressions', metrics ? (metrics.impressions || 0) : 0],
                ['Clicks',      metrics ? (metrics.clicks || 0) : 0],
                ['Likes',       metrics ? (metrics.likes || 0) : 0],
                ['Comments',    metrics ? (metrics.comments || 0) : 0],
                ['Reposts',     metrics ? (metrics.reposts || 0) : 0],
                ['ER',          metrics ? `${((metrics.engagement_rate || 0) * 100).toFixed(2)}%` : '-']
              ].map(([label, value]) => (
                <div key={label} style={{ minWidth: '72px' }}>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: '16px', fontWeight: 500, color: 'var(--c-text-loud)' }}>
                    {value}
                  </div>
                  <div style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '8px',
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: 'var(--c-text-dim)'
                  }}>{label}</div>
                </div>
              ))}
              <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                <MetricsLine metrics={metrics} publishedAt={dateLine} />
              </div>
            </div>
          ) : null}

          {(post.stage === 'rejected' || post.stage === 'parked') ? (
            <ReasonBlock stage={post.stage} reason={reason} />
          ) : null}

          <Caption post={post} isClient={isClient} />

          {!isClient ? (
            <div style={{ padding: '12px 18px 0' }}>
              <button
                type="button"
                onClick={() => showToast({ msg: 'Compose opens in real PCS', duration: 2500 })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--c-text-loud)',
                  color: 'var(--c-bg)',
                  border: 'none',
                  borderRadius: '100px',
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '10px',
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}>
                <MessageSquarePlus size={14} />
                <span style={{ flex: 1, textAlign: 'left' }}>Write a comment</span>
                <ChevronRight size={14} />
              </button>
            </div>
          ) : null}

          <div style={{
            display: 'flex',
            gap: '0',
            margin: '16px 18px 0',
            borderBottom: '1px solid var(--c-divider-soft)'
          }}>
            {(() => {
              const tabs = [];
              tabs.push({ key: 'comments', label: `Comments (${commentsVisible.length})` });
              if (canSeeInternal) tabs.push({ key: 'internal', label: `Internal (${commentsInternal.length})` });
              if (canSeeActivity) tabs.push({ key: 'activity', label: `Activity (${activity.length})` });
              return tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 0',
                    marginRight: '18px',
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '10px',
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: activeTab === t.key ? 'var(--c-text-loud)' : 'var(--c-text-dim)',
                    borderBottom: activeTab === t.key ? '2px solid var(--c-text-loud)' : '2px solid transparent',
                    cursor: 'pointer'
                  }}>{t.label}</button>
              ));
            })()}
          </div>

          <div style={{ padding: '0 0 20px' }}>
            {activeTab === 'comments' ? (
              commentsError ? (
                <div style={{ padding: '20px 18px', color: 'var(--c-red)', fontFamily: '"DM Sans", sans-serif', fontSize: '13px' }}>
                  {commentsError}
                </div>
              ) : commentsVisible.length === 0 ? (
                <div style={{ padding: '20px 18px', color: 'var(--c-text-dim)', fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontStyle: 'italic' }}>
                  No comments yet.
                </div>
              ) : commentsVisible.map((c) => <CommentCard key={c.id} c={c} />)
            ) : null}

            {activeTab === 'internal' && canSeeInternal ? (
              commentsInternal.length === 0 ? (
                <div style={{ padding: '20px 18px', color: 'var(--c-text-dim)', fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontStyle: 'italic' }}>
                  No internal notes.
                </div>
              ) : commentsInternal.map((c) => <CommentCard key={c.id} c={c} />)
            ) : null}

            {activeTab === 'activity' && canSeeActivity ? (
              activityError ? (
                <div style={{ padding: '20px 18px', color: 'var(--c-red)', fontFamily: '"DM Sans", sans-serif', fontSize: '13px' }}>
                  {activityError}
                </div>
              ) : activity.length === 0 ? (
                <div style={{ padding: '20px 18px', color: 'var(--c-text-dim)', fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontStyle: 'italic' }}>
                  No activity yet.
                </div>
              ) : activity.map((a) => <ActivityRow key={a.id} a={a} />)
            ) : null}
          </div>
        </div>

        <ActionBar
          post={post}
          role={role}
          onApproveStub={onApproveStub}
          onRescheduleStub={onRescheduleStub}
        />
      </div>
      {lightboxIndex !== null && postImages.length > 0 ? (
        <Lightbox
          images={postImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </>
  );
}
