import React, { useRef, useState, useEffect } from 'react';
import { Heart, Reply, Check, CircleDot, Quote, MapPin } from 'lucide-react';
import { Avatar } from '../../../core/ui/index.js';
import { timeAgo } from '../utils/timeAgo.js';
import { renderRichText } from '../utils/mentions.jsx';
import { roleFromEmail, findUserRole } from '../utils/users.js';
import { getImageAttachments, getTaskAttachments } from '../utils/attachments.js';
import { groupReactions } from '../utils/reactions.js';
import { addReaction, removeReaction } from '../../../core/api/reactions.js';
import { resolveComment, unresolveComment } from '../../../core/api/comments.js';
import { useAppState } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { pcsFlow } from '../index.js';
import { CommentLightbox } from './CommentLightbox.jsx';

const LIKE_EMOJI = '\u2661';

export function CommentRow({ comment, userRoles, reactions, currentEmail, isInternal, onReply, onLongPress }) {
  const expanded = usePcsStore((s) => s.expandedComments.has(comment.id));
  const toggle = usePcsStore((s) => s.toggleExpanded);
  const post = usePcsStore((s) => s.post);
  const flashCommentId = usePcsStore((s) => s.flashCommentId);
  const flashComment = usePcsStore((s) => s.flashComment);
  const requestCarouselScroll = usePcsStore((s) => s.requestCarouselScroll);
  const requestCaptionExpand = usePcsStore((s) => s.requestCaptionExpand);
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [flashing, setFlashing] = useState(false);
  const currentRole = useAppState((s) => s.user?.role || '');
  const isAdmin = String(currentRole).toLowerCase() === 'admin';
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

  const anchorBadge = (() => {
    const t = comment.anchor_type;
    const p = comment.anchor_payload || null;
    if (!t || !p) return null;
    const isResolved = !!comment.resolved;
    if (t === 'caption') {
      const snippet = typeof p.text === 'string' ? p.text : '';
      if (!snippet) return null;
      const captionLive = post && typeof post.caption === 'string' ? post.caption : '';
      const present = !isResolved && captionLive.indexOf(snippet) >= 0;
      const trimmed = snippet.length > 60 ? snippet.slice(0, 60) + '…' : snippet;
      const cls = present
        ? 'inline-flex items-center gap-1 max-w-full px-1.5 py-[2px] mt-1 mr-1 font-mono text-2xs tracking-wide uppercase text-terracotta border-l-2 border-terracotta bg-bg-2 rounded-sm2'
        : 'inline-flex items-center gap-1 max-w-full px-1.5 py-[2px] mt-1 mr-1 font-mono text-2xs tracking-wide uppercase text-text-dim border-l-2 border-border-neutral bg-bg-2 rounded-sm2';
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
        <span
          className={cls}
          style={{ cursor: present ? 'pointer' : 'default' }}
          onClick={onClick}
          role={present ? 'button' : undefined}
          aria-label={present ? 'Scroll to caption anchor' : 'Anchored text removed'}
        >
          <Quote size={9} />
          <span className="truncate" style={{ maxWidth: 220 }}>
            {present
              ? <>anchored to: <span className="italic normal-case">{trimmed}</span></>
              : <><span className="italic normal-case">{trimmed}</span> · text removed</>}
          </span>
        </span>
      );
    }
    if (t === 'photo') {
      const ii = typeof p.image_index === 'number' ? p.image_index : 0;
      const present = !isResolved;
      const cls = present
        ? 'inline-flex items-center gap-1 px-1.5 py-[2px] mt-1 mr-1 font-mono text-2xs tracking-wide uppercase text-terracotta border-l-2 border-terracotta bg-bg-2 rounded-sm2'
        : 'inline-flex items-center gap-1 px-1.5 py-[2px] mt-1 mr-1 font-mono text-2xs tracking-wide uppercase text-text-dim border-l-2 border-border-neutral bg-bg-2 rounded-sm2';
      const onClick = present ? (e) => {
        e.stopPropagation();
        try { requestCarouselScroll(ii); } catch (err) {}
        setTimeout(() => {
          try { flashComment(comment.id); } catch (err) {}
          setTimeout(() => { try { flashComment(null); } catch (err) {} }, 1600);
        }, 250);
      } : undefined;
      return (
        <span
          className={cls}
          style={{ cursor: present ? 'pointer' : 'default' }}
          onClick={onClick}
          role={present ? 'button' : undefined}
          aria-label={present ? 'Scroll to photo anchor' : 'Photo anchor cleared'}
        >
          <MapPin size={9} />
          <span>photo {ii + 1} {'·'} pin</span>
        </span>
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

  return (
    <div
      data-comment-row-id={comment.id}
      className={`flex gap-2.5 px-3 py-3 border-b border-divider-soft last:border-b-divider-warm ${isReply ? 'ml-[70px] pl-0' : ''}${flashing ? ' anchor-row-flash' : ''}`}
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
          {anchorBadge}
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
