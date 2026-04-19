// Returns ALL comments sorted by created_at asc as visible.
// Threading/nesting is handled by CommentRow via resolveParent.
// We do NOT suppress replies, ex-employee comments, or any other
// rows from rendering — readers should see the full conversation.

export function filterAndIndex(comments) {
  if (!Array.isArray(comments)) return { visible: [], byId: new Map() };
  const visible = comments
    .filter(Boolean)
    .slice()
    .sort((a, b) => {
      const ta = new Date(a?.created_at || 0).getTime() || 0;
      const tb = new Date(b?.created_at || 0).getTime() || 0;
      return ta - tb;
    });
  const byId = new Map();
  for (const c of visible) { if (c && c.id) byId.set(c.id, c); }
  return { visible, byId };
}

export function resolveParent(comment, byId) {
  if (!comment || !comment.reply_to) return { parent: null, hasGrandparent: false };
  const parent = byId.get(comment.reply_to) || null;
  const hasGrandparent = !!(parent && parent.reply_to);
  return { parent, hasGrandparent };
}
