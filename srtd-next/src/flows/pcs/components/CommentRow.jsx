import React, { useState } from 'react';
import { Heart, Reply, Check, CircleDot } from 'lucide-react';
import { Avatar } from '../../../core/ui/index.js';
import { formatCommentTime } from '../utils/time.js';
import { renderRichText } from '../utils/mentions.jsx';
import { displayNameFromEmail, roleFromEmail } from '../utils/users.js';
import { getImageAttachments, getTaskAttachments } from '../utils/attachments.js';
import { groupReactions } from '../utils/reactions.js';
import { resolveParent } from '../utils/threading.js';

export function CommentRow({ comment, byId, userRoles, reactions, currentEmail }) {
  const [expanded, setExpanded] = useState(false);

  const authorName = comment.author ? (displayNameFromEmail(comment.author, userRoles) || 'Unknown') : 'Unknown';
  const roleKey = comment.author ? roleFromEmail(comment.author, userRoles, comment.author_role || 'creative') : 'unknown';
  const time = formatCommentTime(comment.created_at);

  const { parent, hasGrandparent } = resolveParent(comment, byId);
  const parentDeleted = !!(comment.reply_to && (!parent || parent.deleted));
  const parentName = parent ? (displayNameFromEmail(parent.author, userRoles) || 'Unknown') : null;

  const imageAtts = getImageAttachments(comment.attachments);
  const taskAtts = getTaskAttachments(comment.attachments);
  const reactionGroups = groupReactions(reactions, comment.id, currentEmail);

  return (
    <div className="flex gap-2.5 px-3 py-3 border-b border-divider-soft last:border-b-divider-warm">
      <Avatar name={authorName === 'Unknown' ? 'U' : authorName} role={roleKey} size="md" />
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
        {!expanded && comment.message && comment.message.length > 180 && (
          <button onClick={() => setExpanded(true)} className="font-mono text-sm text-terracotta tracking-wide uppercase mt-1 font-semibold bg-transparent border-0 cursor-pointer p-0">
            Read more
          </button>
        )}

        {imageAtts.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {imageAtts.flatMap(a => a.urls).slice(0, 6).map((src, i) => (
              <div key={i} className="w-16 h-16 rounded-sm2 bg-bg-2 bg-cover bg-center border border-divider-soft" style={{ backgroundImage: `url(${src})` }} />
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
            {reactionGroups.map(g => (
              <span key={g.emoji} className={`inline-flex items-center gap-1 px-1.5 py-[2px] rounded-sm2 bg-bg-2 border ${g.mine ? 'border-terracotta text-terracotta' : 'border-divider-soft text-text-mid'} text-sm`}>
                <Heart size={10} className={g.mine ? 'text-terracotta' : ''} />
                <span className="font-mono text-2xs text-text-dim">{g.count}</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 mt-2">
          <span className="inline-flex items-center gap-1 text-sm text-text-soft font-medium opacity-30 cursor-not-allowed" title="Ships PR 2">
            <Heart size={12} /><span>Like</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-text-soft font-medium opacity-30 cursor-not-allowed" title="Ships PR 2">
            <Reply size={12} /><span>Reply</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-text-soft font-medium opacity-30 cursor-not-allowed" title="Ships PR 2">
            <Check size={12} /><span>{comment.resolved ? 'Unresolve' : 'Resolve'}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
