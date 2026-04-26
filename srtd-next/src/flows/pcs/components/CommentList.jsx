import React from 'react';
import { CommentRow } from './CommentRow.jsx';
import { filterAndIndex } from '../utils/threading.js';

// PR-3.14 pin-to-top: re-order threads so any thread whose root is
// pinned floats to the top. Replies stay attached under their parent
// regardless of the parent's pinned state. Within the pinned section
// and within the unpinned section, threads keep their existing
// latest-activity DESC ordering (handled inside filterAndIndex).
function pinSort(visible) {
  if (!Array.isArray(visible) || visible.length === 0) return [];
  const groups = [];
  let current = null;
  for (const c of visible) {
    if ((c.depth || 0) === 0) {
      current = { root: c, replies: [] };
      groups.push(current);
    } else if (current) {
      current.replies.push(c);
    }
  }
  const pinned = [];
  const rest = [];
  for (const g of groups) {
    if (g.root && g.root.pinned === true) pinned.push(g);
    else rest.push(g);
  }
  const out = [];
  for (const g of pinned.concat(rest)) {
    out.push(g.root);
    for (const r of g.replies) out.push(r);
  }
  return out;
}

export function CommentList({ comments, reactions, userRoles, currentEmail, isInternal, truncateAt = 4, onReply, onLongPress, emptyLabel = 'No comments yet' }) {
  const { visible } = filterAndIndex(comments);
  if (visible.length === 0) {
    return <div className="px-3 py-10 font-mono text-sm text-text-dim tracking-widest uppercase text-center">{emptyLabel}</div>;
  }
  const ordered = pinSort(visible);
  const pinnedCount = ordered.reduce((n, c) => n + (((c.depth || 0) === 0 && c.pinned === true) ? 1 : 0), 0);
  const rendered = (typeof truncateAt === 'number' && ordered.length > truncateAt)
    ? ordered.slice(0, truncateAt)
    : ordered;
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
          pinnedCount={pinnedCount}
          onReply={onReply}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );
}
