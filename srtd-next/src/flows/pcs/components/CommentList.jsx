import React from 'react';
import { CommentRow } from './CommentRow.jsx';
import { filterAndIndex } from '../utils/threading.js';

export function CommentList({ comments, reactions, userRoles, currentEmail, isInternal, onReply, onLongPress, emptyLabel = 'No comments yet' }) {
  const { visible, byId } = filterAndIndex(comments, userRoles);
  if (visible.length === 0) {
    return <div className="px-3 py-10 font-mono text-sm text-text-dim tracking-widest uppercase text-center">{emptyLabel}</div>;
  }
  return (
    <div>
      {visible.map((c) => (
        <CommentRow
          key={c.id}
          comment={c}
          byId={byId}
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
