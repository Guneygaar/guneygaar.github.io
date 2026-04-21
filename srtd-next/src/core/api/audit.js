import { apiFetch } from './client.js';

export async function writeAudit({ postId, field, oldValue, newValue, actor }) {
  return apiFetch('/audit_log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      post_id: postId,
      field,
      old_value: oldValue == null ? null : String(oldValue),
      new_value: newValue == null ? null : String(newValue),
      actor,
      created_at: new Date().toISOString()
    })
  });
}

export async function listAuditForPost(postId, { limit = 200 } = {}) {
  if (!postId) return [];
  const encoded = encodeURIComponent(postId);
  try {
    const rows = await apiFetch(
      `/audit_log?post_id=eq.${encoded}` +
      `&order=created_at.desc` +
      `&limit=${limit}` +
      `&select=id,post_id,field,old_value,new_value,actor,created_at`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    // Non-fatal: activity is secondary UI, fall back to empty
    try { if (typeof console !== 'undefined') console.warn('listAuditForPost failed', err); } catch (e) {}
    return [];
  }
}
