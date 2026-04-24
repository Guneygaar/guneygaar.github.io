// Full-height bottom sheet for a single post. Pinned action bar
// bottom, role-gated tabs + action matrix. Stage changes in PR 1
// are stubbed to toast - no real writes to posts.stage.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, MessageSquare,
  ExternalLink, Check, Send, X
} from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';
import { useMetricsFor } from '../hooks/useMetrics.js';
import { useReasonFor } from '../hooks/useReasons.js';
import { useDatePicker } from '../hooks/useDatePicker.js';
import {
  fetchCommentsForMiniCard, patchStage
} from '../api/planApi.js';
import { createComment } from '../../../core/api/comments.js';
import { KebabMenu } from './KebabMenu.jsx';
import { Lightbox } from './Lightbox.jsx';
import { RecallSheet } from './RecallSheet.jsx';
import {
  parseISODate, dayNumber, dowShortSunFirst, monthAbbr, formatTime12,
  daysBetween, formatRelativeTime
} from '../shared/dateUtils.js';
import {
  STAGE_LABELS, STAGE_COLOR_VAR, PILLAR_LABELS, PILLAR_COLOR_VAR
} from '../shared/constants.js';
import { AgeBadge } from '../shared/AgeBadge.jsx';
import { ReasonBlock } from '../shared/ReasonBlock.jsx';

function normalizePlanImages(raw) {
  if (!raw) return [];
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (e) {
      if (typeof window !== 'undefined' && typeof window.logError === 'function') {
        window.logError('normalizePlanImages parse', e);
      }
      return [];
    }
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
  console.error('[plan/minicard] PCS bridge missing; falling back to URL deep link');
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

function formatStatNumber(n) {
  if (n == null) return '-';
  if (n >= 10000) return (n / 1000).toFixed(0) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function Carousel({ post, onImageTap }) {
  const images = normalizePlanImages(post.images);
  const count = images.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const stripRef = useRef(null);
  const tapStateRef = useRef({ x: 0, y: 0, t: 0 });

  const handleScroll = function () {
    if (!stripRef.current || count <= 1) return;
    const scrollLeft = stripRef.current.scrollLeft;
    const width = stripRef.current.clientWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== currentIndex) setCurrentIndex(newIndex);
  };

  const handleTouchStart = function (e) {
    const t = e.touches[0];
    tapStateRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const handleTouchEnd = function (e) {
    const end = e.changedTouches[0];
    const start = tapStateRef.current;
    const dx = Math.abs(end.clientX - start.x);
    const dy = Math.abs(end.clientY - start.y);
    const dt = Date.now() - start.t;
    if (dx < 10 && dy < 10 && dt < 300) {
      e.preventDefault();
      onImageTap(0);
    }
  };

  const handleClick = function () {
    onImageTap(0);
  };

  if (count === 0) {
    return (
      <div className="plan-carousel plan-carousel-empty">
        <div className={'plan-carousel-fallback pillar-' + (post.content_pillar ? post.content_pillar.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'default')} />
      </div>
    );
  }

  return (
    <div className="plan-carousel">
      <div
        ref={stripRef}
        className={count > 1 ? 'plan-carousel-strip' : 'plan-carousel-single'}
        onScroll={handleScroll}
      >
        {images.map(function (src, i) {
          return (
            <div
              className="plan-carousel-slide"
              key={i}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={handleClick}
              role="button"
              tabIndex={0}
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                className="plan-carousel-img"
                draggable="false"
              />
            </div>
          );
        })}
      </div>
      {count > 1 ? (
        <div className="plan-carousel-counter">{currentIndex + 1} of {count}</div>
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

function MiniCommentCard({ c, onReply, onResolve }) {
  const author = c.author || '';
  const short = author.includes('@') ? author.split('@')[0] : author;
  const isResolved = c.resolved === true;

  const handleBodyTap = function () { if (onReply) onReply(c); };
  const handleReplyClick = function (e) {
    e.stopPropagation();
    if (onReply) onReply(c);
  };
  const handleResolveClick = function (e) {
    e.stopPropagation();
    if (onResolve) onResolve(c);
  };

  return (
    <div
      className={'plan-comment-card' + (isResolved ? ' plan-comment-card-resolved' : '')}
      onClick={handleBodyTap}
      role="button"
      tabIndex={0}
      style={{ margin: '0 16px 10px' }}
    >
      <div className="plan-comment-head">
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
        <span className="plan-comment-author">{short}</span>
        <span className="plan-comment-role">{c.author_role || ''}</span>
        <span className="plan-comment-time">{formatRelativeTime(c.created_at)}</span>
        {isResolved ? <span className="plan-comment-resolved-pill">Resolved</span> : null}
      </div>
      <div className="plan-comment-body" style={{ whiteSpace: 'pre-wrap' }}>{c.message || ''}</div>
      <div className="plan-comment-actions">
        <button type="button" className="plan-comment-action" onClick={handleReplyClick}>
          Reply
        </button>
        {!isResolved ? (
          <button type="button" className="plan-comment-action" onClick={handleResolveClick}>
            Resolve
          </button>
        ) : null}
      </div>
    </div>
  );
}

function titleCaseRole(role) {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'client') return 'Client';
  if (r === 'creative') return 'Creative';
  if (r === 'servicing' || r === 'agency') return 'Servicing';
  return r ? r.charAt(0).toUpperCase() + r.slice(1).toLowerCase() : '';
}

const InlineComposer = React.forwardRef(function InlineComposer(props, ref) {
  const { postId, postTitle, role, visibility, replyTo, onDismissReply, onPosted } = props;
  const effectiveVisibility = visibility || 'all';
  const showToast = usePlanStore((s) => s.showToast);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const taRef = useRef(null);

  React.useImperativeHandle(ref, function () {
    return {
      focus: function () { if (taRef.current) taRef.current.focus(); },
    };
  });

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(160, Math.max(56, el.scrollHeight));
    el.style.height = next + 'px';
  }

  useEffect(() => { autoGrow(); }, [text]);

  async function submit() {
    const message = text.trim();
    if (!message || sending) return;
    const email = (window.AppState && window.AppState.user && window.AppState.user.email) || '';
    if (!email) {
      showToast({ msg: 'Session expired, please refresh', duration: 3000 });
      return;
    }
    const authorRole = titleCaseRole(role);
    const nowIso = new Date().toISOString();
    const replyToId = replyTo && replyTo.id ? replyTo.id : null;
    const payload = {
      post_id: postId,
      author: email,
      author_role: authorRole,
      message,
      visibility: effectiveVisibility,
      reply_to: replyToId,
      post_title: postTitle || '',
      created_at: nowIso
    };

    const optimistic = {
      id: `_local_${Date.now()}`,
      _optimistic: true,
      post_id: postId,
      author: email,
      author_role: authorRole,
      message,
      visibility: effectiveVisibility,
      reply_to: replyToId,
      created_at: nowIso
    };
    setSending(true);
    onPosted({ phase: 'optimistic', row: optimistic });
    try {
      const rows = await createComment(payload);
      const saved = Array.isArray(rows) ? rows[0] : rows;
      onPosted({ phase: 'success', tempId: optimistic.id, row: saved || optimistic });
      setText('');
    } catch (err) {
      onPosted({ phase: 'rollback', tempId: optimistic.id });
      showToast({ msg: (err && err.message) || 'Send failed', duration: 3000 });
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const placeholder = replyTo ? 'Write a reply' : 'Write a comment';
  const quoteAuthor = replyTo ? (replyTo.author || 'Anonymous') : '';
  const quoteAuthorShort = quoteAuthor.includes('@') ? quoteAuthor.split('@')[0] : quoteAuthor;
  const quoteText = replyTo ? (replyTo.message || '') : '';
  const quoteTextClipped = quoteText.length > 80 ? quoteText.slice(0, 80) + '...' : quoteText;

  return (
    <div style={{
      padding: '10px 16px 16px',
      borderTop: '1px solid var(--c-divider-subtle)',
      background: 'var(--c-bg)'
    }}>
      {replyTo ? (
        <div className="plan-composer-quote">
          <div className="plan-composer-quote-stripe" />
          <div className="plan-composer-quote-content">
            <div className="plan-composer-quote-author">{quoteAuthorShort || 'Anonymous'}</div>
            <div className="plan-composer-quote-text">{quoteTextClipped}</div>
          </div>
          <button
            type="button"
            className="plan-composer-quote-dismiss"
            onClick={onDismissReply}
            aria-label="Cancel reply"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <textarea
          ref={taRef}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          style={{
            flex: 1,
            minHeight: '56px',
            maxHeight: '160px',
            resize: 'none',
            padding: '10px 12px',
            background: 'var(--c-bg-2)',
            border: '1px solid var(--c-divider-soft)',
            borderRadius: '10px',
            color: 'var(--c-text-loud)',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '13.5px',
            lineHeight: 1.45,
            outline: 'none'
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || sending}
          style={{
            padding: '10px 14px',
            background: 'var(--c-text-loud)',
            color: 'var(--c-bg)',
            border: 'none',
            borderRadius: '8px',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '10px',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            fontWeight: 600,
            cursor: (!text.trim() || sending) ? 'default' : 'pointer',
            opacity: (!text.trim() || sending) ? 0.4 : 1
          }}>
          <Send size={13} />
        </button>
      </div>
    </div>
  );
});

function ActionBar({ post, role, onApprove, onComment }) {
  const closeMiniCard = usePlanStore((s) => s.closeMiniCard);
  const stage = post.stage;

  const BTN_STYLE = {
    flex: 1,
    padding: '12px 10px',
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

  const ghost = {
    background: 'var(--c-bg-2)',
    color: 'var(--c-text-loud)',
    border: '1px solid var(--c-divider-soft)'
  };
  const solid = {
    background: 'var(--c-text-loud)',
    color: 'var(--c-bg)',
    border: 'none'
  };
  const approveStyle = {
    background: 'var(--c-terracotta-1)',
    color: '#fff',
    border: 'none'
  };

  function CommentBtn() {
    return (
      <button
        type="button"
        onClick={onComment}
        style={{ ...BTN_STYLE, ...ghost }}
      >
        <MessageSquare size={13} />
        <span>Comment</span>
      </button>
    );
  }

  function OpenPcsBtn() {
    return (
      <button
        type="button"
        onClick={() => {
          const pid = post && post.post_id;
          if (!pid) return;
          closeMiniCard();
          openInPCS(pid);
        }}
        style={{ ...BTN_STYLE, ...solid }}
      >
        <ExternalLink size={13} />
        <span>Open</span>
      </button>
    );
  }

  function LinkedInBtn() {
    const disabled = !post.linkedin_link;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!post.linkedin_link) return;
          window.open(post.linkedin_link, '_blank', 'noopener,noreferrer');
        }}
        style={{
          ...BTN_STYLE,
          ...solid,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'default' : 'pointer'
        }}
      >
        <ExternalLink size={13} />
        <span>View on LinkedIn</span>
      </button>
    );
  }

  function ApproveBtn() {
    return (
      <button
        type="button"
        onClick={onApprove}
        style={{ ...BTN_STYLE, ...approveStyle }}
      >
        <Check size={13} />
        <span>Approve</span>
      </button>
    );
  }

  let buttons = null;
  if (stage === 'published') {
    buttons = [<LinkedInBtn key="vl" />];
  } else if (role === 'client') {
    if (stage === 'awaiting_approval') {
      buttons = [<CommentBtn key="cm" />, <ApproveBtn key="ap" />];
    } else if (stage === 'awaiting_brand_input') {
      buttons = [<CommentBtn key="cm" />];
    } else {
      buttons = [<CommentBtn key="cm" />];
    }
  } else {
    buttons = [<CommentBtn key="cm" />, <OpenPcsBtn key="op" />];
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

export function MiniCardSheet() {
  const post = usePlanStore((s) => s.currentPost);
  const role = usePlanStore((s) => s.role);
  const closeMiniCard = usePlanStore((s) => s.closeMiniCard);
  const navigateMiniCard = usePlanStore((s) => s.navigateMiniCard);
  const showToast = usePlanStore((s) => s.showToast);
  const metrics = useMetricsFor(post);
  const reason = useReasonFor(post);

  const [comments, setComments] = useState([]);
  const [commentsError, setCommentsError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const composerRef = useRef(null);

  const isClient = role === 'client';

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
    fetchCommentsForMiniCard(post.post_id, role).then((rows) => {
      if (cancelled) return;
      setComments(rows);
    }).catch((err) => {
      if (cancelled) return;
      setCommentsError((err && err.message) || 'Failed to load comments');
    });
    return () => { cancelled = true; };
  }, [post && post.post_id, role]);

  if (!post) return null;

  const commentsVisible = comments.filter((c) => {
    const v = (c.visibility || 'all').toLowerCase();
    return v === 'all';
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

  const AGED_STAGES = new Set(['awaiting_approval', 'awaiting_brand_input']);

  const [recallOpen, setRecallOpen] = useState(false);
  const { triggerPicker } = useDatePicker();

  const onApprove = () => {
    closeMiniCard();
    showToast({ msg: 'Sent to publish queue', duration: 3000 });
  };
  const onComment = () => {
    setTimeout(function () {
      if (composerRef.current) composerRef.current.focus();
    }, 50);
  };

  const handlePosted = (evt) => {
    if (evt.phase === 'optimistic') {
      setComments((prev) => [...prev, evt.row]);
      return;
    }
    if (evt.phase === 'success') {
      setComments((prev) => prev.map((c) => (c.id === evt.tempId ? evt.row : c)));
      setReplyTo(null);
      return;
    }
    if (evt.phase === 'rollback') {
      setComments((prev) => prev.filter((c) => c.id !== evt.tempId));
    }
  };

  const handleReply = (c) => {
    setReplyTo(c);
    setTimeout(function () {
      if (composerRef.current) composerRef.current.focus();
    }, 50);
  };

  const handleResolve = async (c) => {
    if (!c || !c.id) return;
    setComments((prev) => prev.map((row) => (row.id === c.id ? { ...row, resolved: true } : row)));
    try {
      const token = (typeof window !== 'undefined' && window.sb_access_token) || (typeof localStorage !== 'undefined' && localStorage.getItem('sb_access_token')) || '';
      const apiFetch = typeof window !== 'undefined' ? window.apiFetch : null;
      if (typeof apiFetch === 'function') {
        await apiFetch('/post_comments?id=eq.' + encodeURIComponent(c.id), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({ resolved: true, resolved_at: new Date().toISOString() })
        });
      } else {
        throw new Error('apiFetch unavailable');
      }
      showToast({ msg: 'Resolved', duration: 2000 });
    } catch (err) {
      setComments((prev) => prev.map((row) => (row.id === c.id ? { ...row, resolved: false } : row)));
      showToast({ msg: (err && err.message) || 'Could not resolve. Try again.', duration: 3000 });
    }
  };

  const runPatchStage = async (newStage, successMsg) => {
    if (!post || !post.id) return;
    try {
      await patchStage(post.id, newStage);
      showToast({ msg: successMsg || 'Stage updated', duration: 2500 });
    } catch (err) {
      showToast({ msg: (err && err.message) || 'Stage update failed', duration: 3000 });
    }
  };

  const onKebabAction = async (key) => {
    if (!post) return;

    if (key === 'recall') {
      setRecallOpen(true);
      return;
    }

    if (key === 'send_for_approval') {
      runPatchStage('awaiting_approval', 'Sent for approval');
      return;
    }

    if (key === 'publish_now') {
      const ok = window.confirm('Publish now?');
      if (!ok) return;
      runPatchStage('published', 'Published');
      return;
    }

    if (key === 'revive') {
      runPatchStage('in_production', 'Revived');
      return;
    }

    if (key === 'reschedule') {
      triggerPicker(post);
      return;
    }

    if (key === 'nudge_client') {
      const message = window.prompt('Message to client:', 'Could you please take a look?');
      if (message == null) return;
      const trimmed = String(message).trim();
      if (!trimmed) return;
      const email = (window.AppState && window.AppState.user && window.AppState.user.email) || '';
      if (!email) {
        showToast({ msg: 'Session expired, please refresh', duration: 3000 });
        return;
      }
      const titleCase = role === 'admin' ? 'Admin' : 'Servicing';
      try {
        await createComment({
          post_id: post.post_id,
          author: email,
          author_role: titleCase,
          message: trimmed,
          visibility: 'all',
          post_title: post.title || '',
          created_at: new Date().toISOString()
        });
        showToast({ msg: 'Client nudged', duration: 2500 });
      } catch (err) {
        showToast({ msg: (err && err.message) || 'Nudge failed', duration: 3000 });
      }
      return;
    }

    if (key === 'assign' || key === 'rework_brief') {
      showToast({ msg: `${key === 'assign' ? 'Assign' : 'Rework brief'} coming soon`, duration: 2500 });
      return;
    }
  };

  const onRecallPick = (stage) => {
    setRecallOpen(false);
    runPatchStage(stage, `Recalled to ${stage}`);
  };

  return (
    <>
      <div
        onClick={closeMiniCard}
        style={{
          position: 'fixed', inset: 0,
          background: 'var(--backdrop-tint, rgba(0,0,0,.3))',
          zIndex: 2500
        }} />
      <div
        className="plan-mini-card-sheet-enter"
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
          <button type="button" aria-label="Close" onClick={closeMiniCard}
            style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--c-text-mid)' }}>
            <ChevronDown size={20} />
          </button>
          <button
            type="button"
            aria-label="Previous post"
            disabled={!hasPrev}
            onClick={hasPrev ? () => navigateMiniCard('prev') : undefined}
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
            onClick={hasNext ? () => navigateMiniCard('next') : undefined}
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
          <Carousel post={post} onImageTap={setLightboxIndex} />

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

          {post.stage === 'published' && metrics ? (
            <div className="plan-stats">
              <div className="plan-stats-primary">
                <div className="plan-stats-hero">
                  <span className="plan-stats-hero-num">
                    {metrics.impressions != null ? metrics.impressions.toLocaleString('en-US') : '-'}
                  </span>
                  <div className="plan-stats-hero-label">Impressions</div>
                </div>
                {typeof metrics.engagement_rate === 'number' ? (
                  <div className="plan-stats-er-pill">{metrics.engagement_rate.toFixed(2)}% ER</div>
                ) : null}
              </div>
              <div className="plan-stats-secondary">
                <div className="plan-stats-cell">
                  <div className="plan-stats-cell-num">{formatStatNumber(metrics.clicks)}</div>
                  <div className="plan-stats-cell-label">Clicks</div>
                </div>
                <div className="plan-stats-cell">
                  <div className="plan-stats-cell-num">{formatStatNumber(metrics.likes)}</div>
                  <div className="plan-stats-cell-label">Likes</div>
                </div>
                <div className="plan-stats-cell">
                  <div className="plan-stats-cell-num">{formatStatNumber(metrics.comments)}</div>
                  <div className="plan-stats-cell-label">Comments</div>
                </div>
                <div className="plan-stats-cell">
                  <div className="plan-stats-cell-num">{formatStatNumber(metrics.reposts)}</div>
                  <div className="plan-stats-cell-label">Reposts</div>
                </div>
              </div>
            </div>
          ) : null}

          {(post.stage === 'rejected' || post.stage === 'parked') ? (
            <ReasonBlock stage={post.stage} reason={reason} />
          ) : null}

          <Caption post={post} isClient={isClient} />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '16px 18px 0',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--c-divider-soft)',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '10px',
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--c-text-loud)'
          }}>
            <span>Comments ({commentsVisible.length})</span>
          </div>

          <div style={{ padding: '12px 0 20px' }}>
            {commentsError ? (
              <div style={{ padding: '20px 18px', color: 'var(--c-red)', fontFamily: '"DM Sans", sans-serif', fontSize: '13px' }}>
                {commentsError}
              </div>
            ) : commentsVisible.length === 0 ? (
              <div style={{ padding: '20px 18px', color: 'var(--c-text-dim)', fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontStyle: 'italic' }}>
                No comments yet.
              </div>
            ) : commentsVisible.map((c) => (
              <MiniCommentCard
                key={c.id}
                c={c}
                onReply={handleReply}
                onResolve={handleResolve}
              />
            ))}
            <InlineComposer
              ref={composerRef}
              postId={post.post_id}
              postTitle={post.title}
              role={role}
              visibility="all"
              replyTo={replyTo}
              onDismissReply={function () { setReplyTo(null); }}
              onPosted={handlePosted}
            />
          </div>
        </div>

        <ActionBar
          post={post}
          role={role}
          onApprove={onApprove}
          onComment={onComment}
        />
      </div>
      {lightboxIndex !== null && postImages.length > 0 ? (
        <Lightbox
          images={postImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
      {recallOpen ? (
        <RecallSheet
          currentStage={post.stage}
          onPick={onRecallPick}
          onClose={() => setRecallOpen(false)}
        />
      ) : null}
    </>
  );
}
