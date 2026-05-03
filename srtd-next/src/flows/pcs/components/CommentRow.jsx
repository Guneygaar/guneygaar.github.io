import React, { useRef, useState, useEffect } from 'react';
import { Heart, Reply, Check, CircleDot, Pin } from 'lucide-react';
import { Avatar } from '../../../core/ui/index.js';
import { timeAgo } from '../utils/timeAgo.js';
import { renderRichText } from '../utils/mentions.jsx';
import { roleFromEmail, findUserRole } from '../utils/users.js';
import { getImageAttachments, getTaskAttachments } from '../utils/attachments.js';
import { groupReactions } from '../utils/reactions.js';
import { addReaction, removeReaction } from '../../../core/api/reactions.js';
import {
  resolveComment, unresolveComment,
  pinComment, unpinComment, pinInternalNote, unpinInternalNote,
} from '../../../core/api/comments.js';
import { useAppState, useIsClient } from '../../../core/stores/appState';
import { usePcsStore } from '../pcsStore.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { pcsFlow } from '../index.js';
import { CommentLightbox } from './CommentLightbox.jsx';

const LIKE_EMOJI = '\u2661';

export function CommentRow({ comment, userRoles, reactions, currentEmail, isInternal, pinnedCount = 0, onReply, onLongPress }) {
  const expanded = usePcsStore((s) => s.expandedComments.has(comment.id));
  const toggle = usePcsStore((s) => s.toggleExpanded);
  const post = usePcsStore((s) => s.post);
  const flashCommentId = usePcsStore((s) => s.flashCommentId);
  const flashComment = usePcsStore((s) => s.flashComment);
  const requestCarouselScroll = usePcsStore((s) => s.requestCarouselScroll);
  const requestCaptionExpand = usePcsStore((s) => s.requestCaptionExpand);
  const [busy, setBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [flashing, setFlashing] = useState(false);
  const currentRole = useAppState((s) => s.user?.role || '');
  const isAdmin = String(currentRole).toLowerCase() === 'admin';
  const isClient = useIsClient();
  const lpTimer = useRef(null);
  const lpFired = useRef(false);

  useEffect(() => {
    if (flashCommentId !== comment.id) return;
    setFlashing(true);
    const tid = setTimeout(() => setFlashing(false), 1600);
    return () => clearTimeout(tid);
  }, [flashCommentId, comment.id]);

  const userRecord = comment.author ? findUserRole(comment.author, userRoles) : null;
  const authorName = comment.author
    ? ((userRecord && (userRecord.display_name || userRecord.name)) || comment.author.split('@')[0] || 'Unknown')
    : 'Unknown';
  const roleKey = comment.author ? roleFromEmail(comment.author, userRoles, comment.author_role || 'creative') : 'unknown';
  const avatarUrl = (userRecord && userRecord.avatar_url) || null;
  const time = timeAgo(comment.created_at);
  const isReply = (comment.depth || 0) > 0;

  const imageAtts = getImageAttachments(comment.attachments);
  const flatImageUrls = imageAtts.flatMap((a) => a.urls);
  const taskAtts = getTaskAttachments(comment.attachments);
  const reactionGroups = groupReactions(reactions, comment.id, currentEmail);
  const myLike = reactionGroups.find((g) => g.emoji === LIKE_EMOJI && g.mine);

  // PR-3.13.1 v2: anchor badge renders as a separate row after the
  // comment body (not inline in the meta line). Photo = 60x60 thumb +
  // pin overlay (no tap). Caption = single-line italic snippet badge
  // with terracotta left border; tap scrolls the matching <mark> into
  // view. Removed-text computed at render — anchor_payload.text not in
  // current post.caption -> greyed + " (text removed)" suffix.
  const anchorRow = (() => {
    const t = comment.anchor_type;
    const p = comment.anchor_payload || null;
    if (!t || !p) return null;
    if (t === 'caption') {
      const snippet = typeof p.text === 'string' ? p.text : '';
      if (!snippet) return null;
      const captionLive = post && typeof post.caption === 'string' ? post.caption : '';
      const present = captionLive.indexOf(snippet) >= 0;
      const trimmed = snippet.length > 80 ? snippet.slice(0, 80) + '…' : snippet;
      const onClick = present ? (e) => {
        e.stopPropagation();
        try { requestCaptionExpand(); } catch (err) {}
        setTimeout(() => {
          try {
            const root = document.querySelector('[data-caption-body]');
            const target = root && root.querySelector(`mark[data-anchor-id="${comment.id}"]`);
            if (target && typeof target.scrollIntoView === 'function') {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } catch (err) { /* noop */ }
          flashComment(comment.id);
          setTimeout(() => { try { flashComment(null); } catch (err) {} }, 1600);
        }, 80);
      } : undefined;
      return (
        <div
          className="flex items-start"
          style={{
            background: 'var(--c-bg-2)',
            borderLeft: present ? '3px solid var(--c-terracotta)' : '3px solid var(--c-divider-warm)',
            borderRadius: 6,
            padding: '6px 10px',
            marginTop: 6,
            cursor: present ? 'pointer' : 'default',
          }}
          onClick={onClick}
          role={present ? 'button' : undefined}
          aria-label={present ? 'Scroll to caption anchor' : 'Anchored text removed'}
        >
          <span
            className="font-serif"
            style={{
              fontSize: 12,
              lineHeight: 1.4,
              color: present ? 'var(--c-text-loud)' : 'var(--c-text-dim)',
              fontStyle: present ? 'italic' : 'normal',
            }}
          >
            {present ? (
              <>
                <span style={{ color: 'var(--c-terracotta)', marginRight: 2 }}>{'“'}</span>
                {trimmed}
                <span style={{ color: 'var(--c-terracotta)', marginLeft: 2 }}>{'”'}</span>
              </>
            ) : (
              <>
                {trimmed}
                <span style={{ fontSize: 10, fontStyle: 'normal', marginLeft: 6 }}>{'(text removed)'}</span>
              </>
            )}
          </span>
        </div>
      );
    }
    if (t === 'photo') {
      const ii = typeof p.image_index === 'number' ? p.image_index : 0;
      const xp = typeof p.x_pct === 'number' ? p.x_pct : 0;
      const yp = typeof p.y_pct === 'number' ? p.y_pct : 0;
      const imgs = Array.isArray(post?.images) ? post.images : (post?.images?.urls || []);
      const src = imgs[ii] || '';
      return (
        <div
          className="flex items-center"
          style={{ gap: 8, marginTop: 6 }}
        >
          <div
            style={{
              position: 'relative',
              width: 60,
              height: 60,
              borderRadius: 6,
              overflow: 'hidden',
              background: 'var(--c-bg-3)',
              flexShrink: 0,
            }}
          >
            {src ? (
              <img
                src={src}
                alt=""
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitUserDrag: 'none',
                  display: 'block',
                }}
              />
            ) : null}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: `calc(${xp}% - 5px)`,
                top: `calc(${yp}% - 5px)`,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--c-anchor-dot)',
                border: '1.5px solid var(--c-anchor-dot-ring)',
                pointerEvents: 'none',
              }}
            />
          </div>
          <div className="flex flex-col" style={{ minWidth: 0 }}>
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 10,
                letterSpacing: '0.06em',
                color: 'var(--c-text-dim)',
                lineHeight: 1.2,
              }}
            >
              Photo {ii + 1}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: 'var(--c-text-dim)',
                lineHeight: 1.3,
                fontFeatureSettings: "'tnum' 1",
              }}
            >
              pin {Math.round(xp)}%, {Math.round(yp)}%
            </span>
          </div>
        </div>
      );
    }
    return null;
  })();

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    try {
      if (myLike) {
        await removeReaction(comment.id, LIKE_EMOJI, currentEmail);
      } else {
        await addReaction(comment.id, LIKE_EMOJI, currentEmail);
      }
      logClick('pcs_react_comment_like', { commentId: comment.id, on: !myLike });
      if (isInternal) await pcsFlow.retryInternalNotes();
      else await pcsFlow.retryComments();
    } catch (err) {
      logError(err, { context: 'pcs_react_comment_like' });
      toast('Like failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // PR-3.14 pin-to-top. Agency-only (effectiveRole !== 'client'), depth 0
  // only. Disabled when 3 already pinned and this row isn't one of them
  // (server enforces the same cap via enforce_pin_limit; UI mirrors it
  // so users never see a Postgres error toast on the happy path). Server
  // INSERTs an audit_log row via log_pin_event AFTER trigger.
  const isDepthZero = (comment.depth || 0) === 0;
  const canPin = !isClient && isDepthZero;
  const pinDisabled = canPin && !comment.pinned && pinnedCount >= 3;

  async function togglePin() {
    if (pinBusy || !canPin || pinDisabled) return;
    setPinBusy(true);
    const next = !comment.pinned;
    try {
      if (isInternal) {
        if (next) await pinInternalNote(comment.id, currentEmail);
        else await unpinInternalNote(comment.id);
      } else {
        if (next) await pinComment(comment.id, currentEmail);
        else await unpinComment(comment.id);
      }
      logClick('pcs_react_comment_pin', { commentId: comment.id, on: next, isInternal: !!isInternal });
      if (isInternal) await pcsFlow.retryInternalNotes();
      else await pcsFlow.retryComments();
    } catch (err) {
      logError(err, { context: 'pcs_react_comment_pin', commentId: comment.id });
      const msg = (err && err.message) || '';
      toast(/Max 3 pinned/.test(msg) ? 'Max 3 pinned per post' : (next ? 'Pin failed' : 'Unpin failed'), 'error');
    } finally {
      setPinBusy(false);
    }
  }

  async function toggleResolve() {
    if (busy) return;
    setBusy(true);
    try {
      if (comment.resolved) {
        await unresolveComment(comment.id);
      } else {
        await resolveComment(comment.id, currentEmail);
      }
      logClick('pcs_react_comment_resolve', { commentId: comment.id, on: !comment.resolved });
      if (isInternal) await pcsFlow.retryInternalNotes();
      else await pcsFlow.retryComments();
    } catch (err) {
      logError(err, { context: 'pcs_react_comment_resolve' });
      toast('Resolve failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  function startLP(e) {
    if (e.target.closest('button, a, input, textarea')) return;
    lpFired.current = false;
    lpTimer.current = setTimeout(() => {
      lpFired.current = true;
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (err) { /* ignore */ }
      onLongPress && onLongPress(comment, isInternal);
    }, 500);
  }
  function cancelLP() {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
  }

  const showPinned = comment.pinned === true && isDepthZero;

  return (
    <div
      data-comment-row-id={comment.id}
      className={`flex gap-2.5 px-3 py-3 border-b border-divider-soft last:border-b-divider-warm ${isReply ? 'ml-[70px] pl-0' : ''}${flashing ? ' anchor-row-flash' : ''}`}
      style={showPinned ? { borderLeft: '3px solid var(--c-terracotta)' } : undefined}
      onTouchStart={startLP}
      onTouchEnd={cancelLP}
      onTouchMove={cancelLP}
      onMouseDown={startLP}
      onMouseUp={cancelLP}
      onMouseLeave={cancelLP}
      onContextMenu={(e) => { e.preventDefault(); onLongPress && onLongPress(comment, isInternal); }}>
      <Avatar name={authorName === 'Unknown' ? 'U' : authorName} role={roleKey} size={isReply ? 'sm' : 'md'} avatarUrl={avatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-[3px] flex-wrap">
          <span className={`text-sm font-semibold tracking-tight ${authorName === 'Unknown' ? 'text-text-dim' : 'text-text-loud'}`}>{authorName}</span>
          <span className="text-text-dim text-2xs">{'\u00B7'}</span>
          <span className="font-mono text-sm text-text-dim">{time}</span>
          {comment.edited_at && <span className="font-mono text-2xs text-text-dim">(edited)</span>}
          {showPinned && (
            <span
              className="inline-flex items-center gap-1 font-mono uppercase"
              style={{
                fontSize: 9,
                letterSpacing: '0.6px',
                color: 'var(--c-terracotta)',
                lineHeight: 1.2,
              }}
              aria-label="Pinned comment"
            >
              <Pin size={9} style={{ stroke: 'var(--c-terracotta)', fill: 'var(--c-terracotta)' }} />
              <span>PINNED</span>
            </span>
          )}
        </div>

        <div
          className="font-serif text-lg leading-[1.5] text-text-loud whitespace-pre-wrap"
          style={expanded ? undefined : { maxHeight: 'calc(1.5em * 3)', overflow: 'hidden', textOverflow: 'clip' }}>
          {renderRichText(comment.message, userRoles)}
        </div>
        {!expanded && comment.message && comment.message.length > 140 && (
          <button onClick={() => toggle(comment.id)} className="font-mono text-sm text-terracotta tracking-wide uppercase mt-1 font-semibold bg-transparent border-0 cursor-pointer p-0">
            Read more
          </button>
        )}

        {anchorRow}

        {flatImageUrls.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {flatImageUrls.slice(0, 6).map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                onClick={() => setLightboxIndex(i)}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                className="w-16 h-16 rounded-sm2 object-cover border border-divider-soft cursor-pointer"
              />
            ))}
          </div>
        )}

        {taskAtts.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-sm2 tint-amber border font-mono text-2xs font-medium text-amber tracking-wide uppercase mt-1 mr-1">
            <CircleDot size={9} />
            <span>Task{t.assigned_to ? ` ${'\u00B7'} ${t.assigned_to}` : ''}</span>
          </span>
        ))}

        {comment.resolved && (
          <span className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-sm2 tint-green border font-mono text-2xs font-medium text-green tracking-wide uppercase mt-1">
            <Check size={9} />
            <span>Resolved</span>
          </span>
        )}

        {reactionGroups.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {reactionGroups.map((g) => (
              <span key={g.emoji} className={`inline-flex items-center gap-1 px-1.5 py-[2px] rounded-sm2 bg-bg-2 border ${g.mine ? 'border-terracotta text-terracotta' : 'border-divider-soft text-text-mid'} text-sm`}>
                <Heart size={10} className={g.mine ? 'text-terracotta' : ''} />
                <span className="font-mono text-2xs text-text-dim">{g.count}</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 mt-2">
          <button onClick={toggleLike} disabled={busy} className={`inline-flex items-center gap-1 text-sm font-medium ${myLike ? 'text-terracotta' : 'text-text-soft hover:text-text-mid'} disabled:opacity-50`}>
            <Heart size={12} /><span>{myLike ? 'Liked' : 'Like'}</span>
          </button>
          <button onClick={() => onReply && onReply(comment)} className="inline-flex items-center gap-1 text-sm text-text-soft hover:text-text-mid font-medium">
            <Reply size={12} /><span>Reply</span>
          </button>
          <button onClick={toggleResolve} disabled={busy} className={`inline-flex items-center gap-1 text-sm font-medium ${comment.resolved ? 'text-green' : 'text-text-soft hover:text-text-mid'} disabled:opacity-50`}>
            <Check size={12} /><span>{comment.resolved ? 'Unresolve' : 'Resolve'}</span>
          </button>
          {canPin && (
            <button
              onClick={togglePin}
              disabled={pinBusy || pinDisabled}
              aria-disabled={pinDisabled || undefined}
              title={pinDisabled ? 'Max 3 pinned' : (comment.pinned ? 'Unpin' : 'Pin to top')}
              className={`inline-flex items-center gap-1 text-sm font-medium ${comment.pinned ? 'text-terracotta' : 'text-text-soft hover:text-text-mid'} disabled:opacity-50`}
              style={pinDisabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
            >
              <Pin
                size={12}
                style={comment.pinned ? { stroke: 'var(--c-terracotta)', fill: 'var(--c-terracotta)' } : undefined}
              />
              <span>{comment.pinned ? 'Unpin' : 'Pin'}</span>
            </button>
          )}
        </div>
      </div>
      {lightboxIndex !== null && (
        <CommentLightbox
          urls={flatImageUrls}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
