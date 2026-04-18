// Filters out comments whose author is not in user_roles AND is not null.
// Null-author comments render as Unknown. Ex-employee comments are hidden.
// Builds a lookup for reply_to parent/grandparent collapse.

import { findUserRole } from './users.js';

export function filterAndIndex(comments, userRoles) {
  if (!Array.isArray(comments)) return { visible: [], byId: new Map() };
  const visible = comments.filter(c => {
    if (!c) return false;
    if (!c.author) return true;
    return !!findUserRole(c.author, userRoles);
  });
  const byId = new Map();
  for (const c of comments) { if (c && c.id) byId.set(c.id, c); }
  return { visible, byId };
}

export function resolveParent(comment, byId) {
  if (!comment || !comment.reply_to) return { parent: null, hasGrandparent: false };
  const parent = byId.get(comment.reply_to) || null;
  const hasGrandparent = !!(parent && parent.reply_to);
  return { parent, hasGrandparent };
}
