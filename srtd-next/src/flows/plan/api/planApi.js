// All Plan Supabase queries. Thin wrappers over window.apiFetch via
// core/api/client.js. Every query below matches the exact spec in
// the PR 1 build prompt. No DDL, no schema assumptions.

import { apiFetch } from '../../../core/api/client.js';
import { STAGES_FOR_PLAN } from '../../../shared/constants.js';

function encodeList(arr) {
  // PostgREST in.(...) accepts a quoted, comma-separated list.
  return '(' + arr.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(',') + ')';
}

const PLAN_STAGE_IN_CSV = encodeURIComponent('(' + STAGES_FOR_PLAN.join(',') + ')');

/**
 * Query 1 - fetchPlanPosts(monthStart, monthEnd)
 * Dates are ISO YYYY-MM-DD strings.
 * Stage filter (STAGES_FOR_PLAN) hides published + rejected; cascades
 * to every consumer of usePosts/useAllPosts/useCalendarPosts so the
 * grid, board, list, day sheet, and calendar all stay clean. Insights'
 * rejection metric uses fetchRejectedForInsights to keep that signal.
 */
export async function fetchPlanPosts(monthStart, monthEnd) {
  const select = 'id,post_id,title,stage,owner,content_pillar,target_date,format,images,linkedin_link,status_changed_at,updated_at,created_at';
  const path = `/posts?select=${select}`
    + `&target_date=gte.${encodeURIComponent(monthStart)}`
    + `&target_date=lte.${encodeURIComponent(monthEnd)}`
    + `&stage=in.${PLAN_STAGE_IN_CSV}`
    + `&or=(is_draft.is.null,is_draft.eq.false)`
    + `&order=target_date.asc,status_changed_at.asc`;
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 30000) : null;
  try {
    const rows = await apiFetch(
      path,
      { method: 'GET', headers: { 'Accept': 'application/json' }, signal: ctrl ? ctrl.signal : undefined },
      { allowLogout: false }
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    if (ctrl && ctrl.signal && ctrl.signal.aborted) {
      const e = new Error('Request timed out after 30s');
      e.name = 'TimeoutError';
      throw e;
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * fetchPlanBriefs()
 * Synthesises brief-stage rows from /requests so the React data path
 * owns briefs (vanilla bridge no longer writes planStore.posts —
 * Phase 0). Shape mirrors vanilla 07-post-load.js:215-233 so
 * downstream consumers (BriefSheet, openInPcs router, card renderers)
 * see identical objects regardless of source.
 */
export async function fetchPlanBriefs() {
  const path = '/requests?status=in.(pending,assigned)&order=created_at.desc';
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 30000) : null;
  try {
    const rows = await apiFetch(
      path,
      { method: 'GET', headers: { 'Accept': 'application/json' }, signal: ctrl ? ctrl.signal : undefined },
      { allowLogout: false }
    );
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      id: r.id,
      post_id: r.id,
      title: r.title || ('Brief - ' + (r.created_at || '').slice(0, 10)),
      stage: 'brief',
      owner: r.assigned_to ? 'Creative' : 'Servicing',
      owner_profile_id: r.assigned_to || null,
      content_pillar: r.content_type || null,
      target_date: r.target_date || null,
      format: null,
      images: r.images || [],
      linkedin_link: null,
      status_changed_at: r.created_at || null,
      updated_at: r.created_at || null,
      created_at: r.created_at || null,
      description: r.description || '',
      drive_link: r.drive_link || null,
      created_by: r.created_by || null,
      assigned_to: r.assigned_to || null,
      total_posts: r.total_posts || 1,
      completed_posts: r.completed_posts || 0,
      _isRequest: true,
      _requestStatus: r.status || 'pending'
    }));
  } catch (err) {
    if (ctrl && ctrl.signal && ctrl.signal.aborted) {
      const e = new Error('Brief request timed out after 30s');
      e.name = 'TimeoutError';
      throw e;
    }
    console.warn('[planApi] fetchPlanBriefs failed:', err && err.message);
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * fetchRejectedForInsights(monthStart, monthEnd)
 * Pulls just the rejected posts in the bounds window so Insights can
 * keep computing rejection % after fetchPlanPosts started filtering
 * rejected out. Same date semantics as fetchPlanPosts (target_date
 * range). No stage chip filter beyond rejected.
 */
export async function fetchRejectedForInsights(monthStart, monthEnd) {
  if (!monthStart || !monthEnd) return [];
  const select = 'id,post_id,title,stage,owner,content_pillar,target_date,format,status_changed_at,updated_at,created_at';
  const path = `/posts?select=${select}`
    + `&target_date=gte.${encodeURIComponent(monthStart)}`
    + `&target_date=lte.${encodeURIComponent(monthEnd)}`
    + `&stage=eq.rejected`
    + `&or=(is_draft.is.null,is_draft.eq.false)`
    + `&order=target_date.asc`;
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
 * fetchPlanRequests()
 * Fetches every row in `requests` ordered by created_at desc. No
 * client-side scoping by created_by: matches the vanilla pattern in
 * 07-post-load.js (`/requests?status=in.(pending,assigned)&order=created_at.desc`)
 * which is unscoped and relies on RLS / single-tenant data. For the
 * Briefs section we want ALL statuses (pending, assigned, closed) so
 * we omit the status filter and let the UI bucket rows.
 */
export async function fetchPlanRequests() {
  const select = 'id,title,description,created_by,created_at,status,content_type,target_date,images,drive_link,assigned_to,total_posts,completed_posts,first_post_created_at,last_post_published_at';
  const path = `/requests?select=${select}&order=created_at.desc`;
  const rows = await apiFetch(path, { method: 'GET', headers: { 'Accept': 'application/json' } }, { allowLogout: false });
  return Array.isArray(rows) ? rows : [];
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

