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
