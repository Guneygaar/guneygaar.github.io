import { apiFetch } from './client.js';

export async function listComments(postId) {
  if (!postId) return [];
  const encoded = encodeURIComponent(postId);
  const rows = await apiFetch(
    `/post_comments?post_id=eq.${encoded}&deleted=not.eq.true&visibility=eq.all&order=created_at.asc&select=*`,
    { method: 'GET', headers: { 'Accept': 'application/json' } }
  );
  return Array.isArray(rows) ? rows : [];
}

export async function listInternalNotes(postId) {
  if (!postId) return [];
  const encoded = encodeURIComponent(postId);
  const rows = await apiFetch(
    `/internal_notes?post_id=eq.${encoded}&deleted=not.eq.true&order=created_at.asc&select=*`,
    { method: 'GET', headers: { 'Accept': 'application/json' } }
  );
  return Array.isArray(rows) ? rows : [];
}
