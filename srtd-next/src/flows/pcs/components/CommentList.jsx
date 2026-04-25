import React from 'react';
import { CommentRow } from './CommentRow.jsx';
import { filterAndIndex } from '../utils/threading.js';

export function CommentList({ comments, reactions, userRoles, currentEmail, isInternal, truncateAt = 4, onReply, onLongPress, emptyLabel = 'No comments yet' }) {
  const { visible } = filterAndIndex(comments);
  if (visible.length === 0) {
    return <div className="px-3 py-10 font-mono text-sm text-text-dim tracking-widest uppercase text-center">{emptyLabel}</div>;
  }
  const rendered = (typeof truncateAt === 'number' && visible.length > truncateAt)
    ? visible.slice(0, truncateAt)
    : visible;
  return (
    <div>
      {rendered.map((c) => (
        <CommentRow
          key={c.id}
          comment={c}
          userRoles={userRoles}
          reactions={reactions}
          currentEmail={currentEmail}
          isInternal={isInternal}
          onReply={onReply}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );
}
