// Stamp post_id onto ai_usage rows created during a detached
// Caption Workspace session. Matches the vanilla PR 905 pattern.

import { apiFetch } from './client.js';

/**
 * After creating a post, link any ai_usage rows created by this
 * user during the session window back to the new post_id.
 */
export async function stampPostId({ postId, createdBy, sessionStart }) {
  if (!postId || !createdBy || !sessionStart) return;
  const params = new URLSearchParams({
    post_id: 'is.null',
    created_by: `eq.${createdBy}`,
    created_at: `gte.${sessionStart}`
  }).toString();

  try {
    await apiFetch(`/ai_usage?${params}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ post_id: postId })
    });
  } catch (err) {
    console.warn('[sorted-react/aiUsage] stamp failed (non-fatal):', err);
  }
}
