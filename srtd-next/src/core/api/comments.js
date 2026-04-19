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

export async function createComment(payload) {
  return apiFetch('/post_comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(payload)
  });
}

export async function patchComment(commentId, patch) {
  const encoded = encodeURIComponent(commentId);
  return apiFetch(`/post_comments?id=eq.${encoded}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(patch)
  });
}

export async function softDeleteComment(commentId) {
  return patchComment(commentId, { deleted: true });
}

export async function resolveComment(commentId, actor) {
  return patchComment(commentId, { resolved: true, resolved_by: actor, resolved_at: new Date().toISOString() });
}

export async function unresolveComment(commentId) {
  return patchComment(commentId, { resolved: false, resolved_by: null, resolved_at: null });
}

export async function createInternalNote(payload) {
  return apiFetch('/internal_notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(payload)
  });
}

export async function patchInternalNote(noteId, patch) {
  const encoded = encodeURIComponent(noteId);
  return apiFetch(`/internal_notes?id=eq.${encoded}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(patch)
  });
}

export async function softDeleteInternalNote(noteId) {
  return patchInternalNote(noteId, { deleted: true });
}
