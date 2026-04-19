// Fire-and-forget KV reseed after caption/images change.
// Mirrors vanilla seed in 06-post-create.js.

const PREVIEW_URL = 'https://srtd.io/generate-preview';
const PREVIEW_SECRET = 'srtd2026xK9mN3pQ';

export function reseedOgPreview(postId) {
  if (!postId) return;
  try {
    fetch(PREVIEW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Preview-Secret': PREVIEW_SECRET },
      body: JSON.stringify({ post_id: postId })
    }).catch(() => {});
  } catch (e) { /* swallow */ }
}
