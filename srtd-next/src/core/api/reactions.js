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

export async function addReaction(commentId, emoji, createdBy) {
  return apiFetch('/post_comment_reactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ comment_id: commentId, emoji, created_by: createdBy })
  });
}

export async function removeReaction(commentId, emoji, createdBy) {
  const c = encodeURIComponent(commentId);
  const e = encodeURIComponent(emoji);
  const u = encodeURIComponent(createdBy);
  return apiFetch(`/post_comment_reactions?comment_id=eq.${c}&emoji=eq.${e}&created_by=eq.${u}`, { method: 'DELETE' });
}
