import { apiFetch } from './client.js';

export async function listReactionsForComments(commentIds) {
  if (!Array.isArray(commentIds) || commentIds.length === 0) return [];
  const ids = commentIds.map(encodeURIComponent).join(',');
  const rows = await apiFetch(
    `/post_comment_reactions?comment_id=in.(${ids})&select=*`,
    { method: 'GET', headers: { 'Accept': 'application/json' } }
  );
  return Array.isArray(rows) ? rows : [];
}

export async function addReaction({ commentId, postId, emoji, author, authorRole }) {
  return apiFetch('/post_comment_reactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({
      comment_id: commentId,
      post_id: postId,
      author,
      author_role: authorRole,
      emoji
    })
  });
}

export async function removeReaction({ commentId, emoji, author }) {
  const c = encodeURIComponent(commentId);
  const e = encodeURIComponent(emoji);
  const a = encodeURIComponent(author);
  return apiFetch(`/post_comment_reactions?comment_id=eq.${c}&emoji=eq.${e}&author=eq.${a}`, { method: 'DELETE' });
}
