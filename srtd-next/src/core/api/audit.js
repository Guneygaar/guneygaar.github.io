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
