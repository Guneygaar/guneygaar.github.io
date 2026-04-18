// Mirrors vanilla _sharePostOnWhatsApp at /actions/pcs.js:2619-2639.
// Short link = last 4 numeric digits of post_id.

export function deriveShortId(postId) {
  if (!postId) return '';
  const digits = String(postId).replace(/[^0-9]/g, '');
  if (digits.length >= 4) return digits.slice(-4);
  return String(postId).slice(-4);
}

export function buildShortUrl(postId) {
  return `https://srtd.io/p/${deriveShortId(postId)}`;
}

export function buildWhatsAppShareUrl(title, postId) {
  const url = buildShortUrl(postId);
  const msg = (title || 'Post') + '\n\n' + url;
  return 'https://wa.me/?text=' + encodeURIComponent(msg);
}

export function openWhatsAppShare(title, postId) {
  const href = buildWhatsAppShareUrl(title, postId);
  if (typeof window !== 'undefined') window.location.href = href;
}
