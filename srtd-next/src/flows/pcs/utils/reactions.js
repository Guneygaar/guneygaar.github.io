export function groupReactions(reactions, commentId, currentEmail) {
  if (!Array.isArray(reactions) || !commentId) return [];
  const forThis = reactions.filter(r => r.comment_id === commentId);
  const map = new Map();
  for (const r of forThis) {
    const emoji = r.emoji || '\u2661';
    if (!map.has(emoji)) map.set(emoji, []);
    map.get(emoji).push(r);
  }
  return Array.from(map.entries()).map(([emoji, items]) => ({
    emoji,
    count: items.length,
    mine: currentEmail ? items.some(i => i.created_by === currentEmail) : false
  }));
}
