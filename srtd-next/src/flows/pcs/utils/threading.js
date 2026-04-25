// Returns ALL comments grouped into threads.
// Threads are ordered by latest activity (newest reply or root) DESC.
// Within a thread: root first, replies in chronological order beneath.
// Each entry carries a `depth` field (0 for root, 1+ for replies).

export function filterAndIndex(comments) {
  if (!Array.isArray(comments)) return { visible: [], byId: new Map() };
  const all = comments.filter(Boolean).slice();

  const byId = new Map();
  for (const c of all) { if (c && c.id) byId.set(c.id, c); }

  function findRoot(c) {
    let node = c;
    let depth = 0;
    const seen = new Set();
    while (node && node.reply_to && byId.has(node.reply_to) && !seen.has(node.id)) {
      seen.add(node.id);
      node = byId.get(node.reply_to);
      depth++;
    }
    return { root: node, depth };
  }

  const meta = new Map();
  for (const c of all) {
    if (!c || !c.id) continue;
    const { root, depth } = findRoot(c);
    const ts = new Date(c.created_at || 0).getTime() || 0;
    meta.set(c.id, { rootId: (root && root.id) || c.id, depth, ts });
  }

  const threadMap = new Map();
  for (const c of all) {
    if (!c || !c.id) continue;
    const m = meta.get(c.id);
    if (!threadMap.has(m.rootId)) threadMap.set(m.rootId, { latestActivity: 0, members: [] });
    const t = threadMap.get(m.rootId);
    t.members.push({ comment: c, depth: m.depth, ts: m.ts });
    if (m.ts > t.latestActivity) t.latestActivity = m.ts;
  }

  const threads = Array.from(threadMap.values()).sort((a, b) => b.latestActivity - a.latestActivity);

  const visible = [];
  for (const t of threads) {
    t.members.sort((a, b) => {
      if (a.depth === 0 && b.depth !== 0) return -1;
      if (b.depth === 0 && a.depth !== 0) return 1;
      return a.ts - b.ts;
    });
    for (const m of t.members) {
      visible.push({ ...m.comment, depth: m.depth });
    }
  }

  return { visible, byId };
}

export function resolveParent(comment, byId) {
  if (!comment || !comment.reply_to) return { parent: null, hasGrandparent: false };
  const parent = byId.get(comment.reply_to) || null;
  const hasGrandparent = !!(parent && parent.reply_to);
  return { parent, hasGrandparent };
}
