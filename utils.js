/* ===============================================
   utils.js — Shared pure utility functions
   Loaded after 02-session.js, before everything else.
=============================================== */

function getTitle(post) { return post.title || post.post_id || 'Untitled'; }
function getPostId(post) { return post.post_id || post.id || ''; }
function getPostById(postId) { return allPosts.find(p => getPostId(p) === postId) || null; }

function parseDate(raw) {
  if (!raw) return null;
  const parts = String(raw).split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(raw) {
  const d = parseDate(raw);
  if (!d) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayDate(raw) {
  return formatDate(raw) || '—';
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}
