// Gmail brief import bridge. Wraps the srtd-ai Worker endpoints
// /gmail/list and /gmail/brief (see srtd-ai-worker/src/index.js:
// 426-499 and 501-651 respectively). Vanilla caller pattern lives
// in 06-post-create.js:204-381.
//
// Auth: workspace-level shared X-AI-Secret header (from
// window.AI_CONFIG.secret). The Worker holds its own Gmail OAuth
// refresh-token env, so end-users never see a Google consent flow.
//
// Workspace gate: handleGmailBrief checks
// workspaces.ai_email_briefs === true and returns HTTP 403
// with { success:false, error:"..." } if the flag is off. We surface
// the error message to the caller via a thrown Error.

import { getAIConfig } from './config.js';

function _resolveWorkspaceId(explicit) {
  if (explicit) return explicit;
  if (typeof window !== 'undefined' &&
      window.AppState && window.AppState.workspace && window.AppState.workspace.id) {
    return window.AppState.workspace.id;
  }
  return null;
}

async function postJSON(path, body) {
  const cfg = getAIConfig();
  if (!cfg.workerUrl || !cfg.secret) {
    throw new Error('AI not configured (window.AI_CONFIG missing)');
  }
  const res = await fetch(cfg.workerUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AI-Secret': cfg.secret
    },
    body: JSON.stringify(body || {})
  });
  // 403 → workspace feature flag off (or some other gate). The
  // Worker returns JSON with { success:false, error }.
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON body */ }
  if (!res.ok || (data && data.success === false)) {
    const msg = (data && data.error) || (`Gmail request failed (${res.status})`);
    throw new Error(msg);
  }
  return data || {};
}

/**
 * List recent client emails.
 * Worker returns the last 7 days of threads from whitelisted senders,
 * capped at 10 rows, each keyed by thread.id.
 *
 * Return shape: { success:true, emails:[{ id(thread_id), thread_id,
 *   subject, snippet, sender, date, message_count }, …] }
 */
export async function listEmails(opts = {}) {
  const workspace_id = _resolveWorkspaceId(opts.workspace_id);
  const data = await postJSON('/gmail/list', { workspace_id });
  return Array.isArray(data.emails) ? data.emails : [];
}

/**
 * Pull a full thread, have Claude extract a structured brief,
 * and return prefill fields for the Create Post form.
 *
 * Return shape: { title, total_posts, copy_option_1, copy_option_2,
 *   copy_option_3, internal_notes, visual_direction }
 */
export async function fetchBrief(opts = {}) {
  const thread_id = opts.thread_id;
  if (!thread_id) throw new Error('thread_id required');
  const workspace_id = _resolveWorkspaceId(opts.workspace_id);
  const created_by = opts.created_by || '';
  return postJSON('/gmail/brief', { thread_id, workspace_id, created_by });
}
