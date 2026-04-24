// All Plan Supabase queries. Thin wrappers over window.apiFetch via
// core/api/client.js. Every query below matches the exact spec in
// the PR 1 build prompt. No DDL, no schema assumptions.

import { apiFetch } from '../../../core/api/client.js';

function encodeList(arr) {
  // PostgREST in.(...) accepts a quoted, comma-separated list.
  return '(' + arr.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(',') + ')';
}

/**
 * Query 1 - fetchPlanPosts(monthStart, monthEnd)
 * Dates are ISO YYYY-MM-DD strings.
 */
export async function fetchPlanPosts(monthStart, monthEnd) {
  const select = 'id,post_id,title,stage,owner,content_pillar,target_date,format,images,linkedin_link,status_changed_at,updated_at,created_at';
  const path = `/posts?select=${select}`
    + `&target_date=gte.${encodeURIComponent(monthStart)}`
    + `&target_date=lte.${encodeURIComponent(monthEnd)}`
    + `&or=(is_draft.is.null,is_draft.eq.false)`
    + `&order=target_date.asc,status_changed_at.asc`;
  const rows = await apiFetch(path, { method: 'GET', headers: { 'Accept': 'application/json' } }, { allowLogout: false });
  return Array.isArray(rows) ? rows : [];
}

/**
 * Query 2 - fetchPostMetrics()
 * Returns freshest snapshot per post_id (uuid join to posts.id).
 * PostgREST does not support DISTINCT ON natively; we pull all rows
 * ordered by imported_at desc and dedupe client-side by post_id.
 */
export async function fetchPostMetrics() {
  const select = 'post_id,impressions,clicks,ctr,likes,comments,reposts,follows,engagement_rate,imported_at';
  const path = `/linkedin_posts?select=${select}&post_id=not.is.null&order=imported_at.desc`;
  const rows = await apiFetch(path, { method: 'GET', headers: { 'Accept': 'application/json' } }, { allowLogout: false });
  if (!Array.isArray(rows)) return {};
  const byId = {};
  for (const r of rows) {
    const key = r.post_id;
    if (!key) continue;
    if (!byId[key]) byId[key] = r;
  }
  return byId;
}

/**
 * Query 3 - fetchReasonComments(postIdsText)
 * One latest comment per post_id (text). postIdsText is the text
 * post_id slug (e.g. "POST-1776081904804").
 */
export async function fetchReasonComments(postIdsText) {
  if (!Array.isArray(postIdsText) || postIdsText.length === 0) return {};
  const select = 'post_id,author,author_role,message,created_at';
  const inList = encodeList(postIdsText);
  const path = `/post_comments?select=${select}`
    + `&post_id=in.${encodeURIComponent(inList)}`
    + `&or=(deleted.is.null,deleted.eq.false)`
    + `&order=post_id.asc,created_at.desc`;
  const rows = await apiFetch(path, { method: 'GET', headers: { 'Accept': 'application/json' } }, { allowLogout: false });
  if (!Array.isArray(rows)) return {};
  const byId = {};
  for (const r of rows) {
    const key = r.post_id;
    if (!key) continue;
    if (!byId[key]) byId[key] = r;
  }
  return byId;
}

/**
 * Query 4 - fetchCommentsForMiniCard(postIdText, role)
 * role: 'admin' | 'agency' | 'client'
 */
export async function fetchCommentsForMiniCard(postIdText, role) {
  if (!postIdText) return [];
  const select = 'id,author,author_role,message,created_at,visibility';
  let visFilter = '';
  if (role === 'client') {
    visFilter = '&visibility=eq.all';
  } else if (role === 'agency') {
    visFilter = `&visibility=in.${encodeURIComponent('(all,servicing)')}`;
  }
  const path = `/post_comments?select=${select}`
    + `&post_id=eq.${encodeURIComponent(postIdText)}`
    + `&or=(deleted.is.null,deleted.eq.false)`
    + visFilter
    + `&order=created_at.desc`;
  const rows = await apiFetch(path, { method: 'GET', headers: { 'Accept': 'application/json' } }, { allowLogout: false });
  return Array.isArray(rows) ? rows : [];
}

/**
 * Query 5 - fetchActivityForMiniCard(postIdText)
 * Hidden for client role - callers must skip this when role === 'client'.
 */
export async function fetchActivityForMiniCard(postIdText) {
  if (!postIdText) return [];
  const select = 'id,actor,action,old_stage,new_stage,created_at';
  const path = `/activity_log?select=${select}`
    + `&post_id=eq.${encodeURIComponent(postIdText)}`
    + `&order=created_at.desc&limit=50`;
  const rows = await apiFetch(path, { method: 'GET', headers: { 'Accept': 'application/json' } }, { allowLogout: false });
  return Array.isArray(rows) ? rows : [];
}

/**
 * Query 6 - fetchCaptionAndImages(postIdUuid)
 * id is the uuid PK, not the post_id text slug.
 */
export async function fetchCaptionAndImages(postIdUuid) {
  if (!postIdUuid) return null;
  const path = `/posts?select=caption,images&id=eq.${encodeURIComponent(postIdUuid)}&limit=1`;
  const rows = await apiFetch(path, { method: 'GET', headers: { 'Accept': 'application/json' } }, { allowLogout: false });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * Query 7 - rescheduleTarget(postIdUuid, newDateISO)
 * CRITICAL: target_date only. Never write status_changed_at.
 * newDateISO format: YYYY-MM-DD.
 */
export async function rescheduleTarget(postIdUuid, newDateISO) {
  if (!postIdUuid) throw new Error('rescheduleTarget: postIdUuid required');
  if (!newDateISO) throw new Error('rescheduleTarget: newDateISO required');
  const path = `/posts?id=eq.${encodeURIComponent(postIdUuid)}`;
  return apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ target_date: newDateISO })
  });
}

/**
 * Query 8 - patchPostTitle(postIdUuid, newTitle)
 * Mirrors rescheduleTarget shape. title only. Never writes
 * status_changed_at. updated_at is left to the server trigger so
 * status_changed_at is not co-bumped.
 */
export async function patchPostTitle(postIdUuid, newTitle) {
  if (!postIdUuid) throw new Error('patchPostTitle: postIdUuid required');
  if (typeof newTitle !== 'string') throw new Error('patchPostTitle: newTitle required');
  const path = `/posts?id=eq.${encodeURIComponent(postIdUuid)}`;
  return apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ title: newTitle })
  });
}

/**
 * Query 9 - patchStage(postIdUuid, newStage)
 * Mirrors rescheduleTarget shape. stage only. The notify-stage edge
 * function fires the fan-out; status_changed_at is a server trigger
 * column and is never written from the client.
 */
export async function patchStage(postIdUuid, newStage) {
  if (!postIdUuid) throw new Error('patchStage: postIdUuid required');
  if (typeof newStage !== 'string' || !newStage) {
    throw new Error('patchStage: newStage required');
  }
  const path = `/posts?id=eq.${encodeURIComponent(postIdUuid)}`;
  return apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ stage: newStage })
  });
}
