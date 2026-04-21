import { apiFetch } from './client.js';

// Live audit_log schema: id(uuid PK), post_id(text), action(text),
// old_value(text), new_value(text), changed_by(text),
// changed_at(timestamptz). Callers still speak the caller-side
// vocabulary (field / actor); we translate at the network boundary
// on both write and read so internal consumers keep their shape.

export async function writeAudit({ postId, field, oldValue, newValue, actor }) {
  return apiFetch('/audit_log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      post_id: postId,
      action: field,
      old_value: oldValue == null ? null : String(oldValue),
      new_value: newValue == null ? null : String(newValue),
      changed_by: actor,
      changed_at: new Date().toISOString()
    })
  });
}

export async function listAuditForPost(postId, { limit = 200 } = {}) {
  if (!postId) return [];
  const encoded = encodeURIComponent(postId);
  try {
    const rows = await apiFetch(
      `/audit_log?post_id=eq.${encoded}` +
      `&order=changed_at.desc` +
      `&limit=${limit}` +
      `&select=id,post_id,action,old_value,new_value,changed_by,changed_at`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      ...r,
      field: r.action,
      actor: r.changed_by,
      created_at: r.changed_at,
    }));
  } catch (err) {
    // Non-fatal: activity is secondary UI, fall back to empty
    try { if (typeof console !== 'undefined') console.warn('listAuditForPost failed', err); } catch (e) {}
    return [];
  }
}
