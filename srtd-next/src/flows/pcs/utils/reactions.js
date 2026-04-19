export function groupReactions(reactions, commentId, currentIdentity) {
  if (!Array.isArray(reactions) || !commentId) return [];
  const forThis = reactions.filter(r => r.comment_id === commentId);
  const map = new Map();
  for (const r of forThis) {
    const emoji = r.emoji || '\u2764\uFE0F';
    if (!map.has(emoji)) map.set(emoji, []);
    map.get(emoji).push(r);
  }
  const ident = currentIdentity ? String(currentIdentity).toLowerCase() : '';
  return Array.from(map.entries()).map(([emoji, items]) => ({
    emoji,
    count: items.length,
    mine: ident
      ? items.some(i => (i.author && String(i.author).toLowerCase() === ident) || (i.created_by && String(i.created_by).toLowerCase() === ident))
      : false
  }));
}
