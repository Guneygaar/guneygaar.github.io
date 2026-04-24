// Unified tile-tap handler for every Plan view. Opens PCS through the
// window.SortedReact.flows.pcs bridge (same bridge that the Create Post
// and notification deep-link paths use), passing the currently-filtered
// post list as the prev/next navigation context.

export function openInPcs(post, contextPosts) {
  if (!post) return;
  const postId = post.post_id;
  if (!postId) return;
  const bridge = typeof window !== 'undefined'
    && window.SortedReact
    && window.SortedReact.flows
    && window.SortedReact.flows.pcs;
  const list = Array.isArray(contextPosts)
    ? contextPosts.map((p) => (p && p.post_id) || null).filter(Boolean)
    : [];
  if (bridge && typeof bridge.open === 'function') {
    bridge.open(postId, { contextList: list });
    return;
  }
  // Fallback: URL deep-link path read by index.html on mount. No
  // context list survives this route; prev/next will be hidden.
  console.error('[plan/open-in-pcs] PCS bridge missing; falling back to URL deep link');
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('pcs_post', String(postId));
    window.location.assign(url.toString());
  } catch (e) {
    window.location.search = '?pcs_post=' + encodeURIComponent(String(postId));
  }
}
