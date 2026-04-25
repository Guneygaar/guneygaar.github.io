import React, { useRef, useState } from 'react';
import { Heart, Reply, Check, CircleDot } from 'lucide-react';
import { Avatar } from '../../../core/ui/index.js';
import { timeAgo } from '../utils/timeAgo.js';
import { renderRichText } from '../utils/mentions.jsx';
import { displayNameFromEmail, roleFromEmail, findUserRole } from '../utils/users.js';
import { getImageAttachments, getTaskAttachments } from '../utils/attachments.js';
import { groupReactions } from '../utils/reactions.js';
import { resolveParent } from '../utils/threading.js';
import { addReaction, removeReaction } from '../../../core/api/reactions.js';
import { resolveComment, unresolveComment } from '../../../core/api/comments.js';
import { useAppState } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { pcsFlow } from '../index.js';
import { CommentLightbox } from './CommentLightbox.jsx';

const LIKE_EMOJI = '\u2661';

export function CommentRow({ comment, byId, userRoles, reactions, currentEmail, isInternal, onReply, onLongPress }) {
  const expanded = usePcsStore((s) => s.expandedComments.has(comment.id));
  const toggle = usePcsStore((s) => s.toggleExpanded);
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const currentRole = useAppState((s) => s.user?.role || '');
  const isAdmin = String(currentRole).toLowerCase() === 'admin';
  const lpTimer = useRef(null);
  const lpFired = useRef(false);

  const userRecord = comment.author ? findUserRole(comment.author, userRoles) : null;
  const authorName = comment.author
    ? ((userRecord && (userRecord.display_name || userRecord.name)) || comment.author.split('@')[0] || 'Unknown')
    : 'Unknown';
  const roleKey = comment.author ? roleFromEmail(comment.author, userRoles, comment.author_role || 'creative') : 'unknown';
  const avatarUrl = (userRecord && userRecord.avatar_url) || null;
  const time = timeAgo(comment.created_at);
  const isReply = (comment.depth || 0) > 0;

  const { parent, hasGrandparent } = resolveParent(comment, byId);
  const parentDeleted = !!(comment.reply_to && (!parent || parent.deleted));
  const parentName = parent ? (displayNameFromEmail(parent.author, userRoles) || 'Unknown') : null;

  const imageAtts = getImageAttachments(comment.attachments);
  const flatImageUrls = imageAtts.flatMap((a) => a.urls);
  const taskAtts = getTaskAttachments(comment.attachments);
  const reactionGroups = groupReactions(reactions, comment.id, currentEmail);
  const myLike = reactionGroups.find((g) => g.emoji === LIKE_EMOJI && g.mine);

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
      className={`flex gap-2.5 px-3 py-3 border-b border-divider-soft last:border-b-divider-warm ${isReply ? 'ml-[70px] pl-0' : ''}`}
      onTouchStart={startLP}
      onTouchEnd={cancelLP}
      onTouchMove={cancelLP}
      onMouseDown={startLP}
      onMouseUp={cancelLP}
      onMouseLeave={cancelLP}
      onContextMenu={(e) => { e.preventDefault(); onLongPress && onLongPress(comment, isInternal); }}>
      <Avatar name={authorName === 'Unknown' ? 'U' : authorName} role={roleKey} size="md" avatarUrl={avatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-[3px] flex-wrap">
          <span className={`text-sm font-semibold tracking-tight ${authorName === 'Unknown' ? 'text-text-dim' : 'text-text-loud'}`}>{authorName}</span>
          <span className="text-text-dim text-2xs">{'\u00B7'}</span>
          <span className="font-mono text-sm text-text-dim">{time}</span>
          {comment.edited_at && <span className="font-mono text-2xs text-text-dim">(edited)</span>}
        </div>

        {parentDeleted && (
          <div className="border-l-2 border-text-dim pl-2.5 py-[2px] mb-1 text-sm text-text-dim italic leading-[1.35]">
            <div className="truncate">[deleted]</div>
          </div>
        )}
        {!parentDeleted && parent && (
          <div className="border-l-2 border-terracotta pl-2.5 py-[2px] mb-1 text-sm text-text-soft leading-[1.35]">
            {hasGrandparent && <div className="font-mono text-2xs text-text-dim tracking-wide uppercase mb-[2px]">... earlier in thread</div>}
            <div className="text-terracotta font-semibold text-sm">{parentName}</div>
            <div className="truncate">{parent.message}</div>
          </div>
        )}

        <div className={`font-serif text-lg leading-[1.5] text-text-loud whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>
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
