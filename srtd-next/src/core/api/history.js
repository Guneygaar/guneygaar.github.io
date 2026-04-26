// PR-3.17 — History tab merges caption edits (post_versions, schema applied
// 2026-04-26) with stage moves (activity_log) into one reverse-chrono feed.
//
// Schema notes:
//   post_versions.post_id  uuid (FK posts.id)
//   activity_log.post_id   text (stores POST-* strings, mirrors posts.post_id)
// The caller passes a single postId; type mismatch between the two columns is
// flagged separately and intentionally NOT addressed here.

import { apiFetch } from './client.js';
import { ownerToRole } from '../../flows/pcs/utils/stage.js';

const STAGE_RE = /stage|approved|moved/i;
const CAPTION_RE = /caption/i;

function safeIso(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function lookupRoleByEmail(email, userRolesCache) {
  if (!email || !Array.isArray(userRolesCache)) return 'unknown';
  const row = userRolesCache.find((u) => u && u.email === email);
  if (!row || !row.role) return 'unknown';
  return ownerToRole(row.role);
}

export async function listHistoryForPost(postId, userRolesCache) {
  if (!postId) return [];
  const encoded = encodeURIComponent(postId);

  const versionsP = apiFetch(
    `/post_versions?post_id=eq.${encoded}` +
    `&order=edited_at.desc` +
    `&select=id,post_id,caption,edited_by,edited_by_role,edited_at`,
    { method: 'GET', headers: { 'Accept': 'application/json' } }
  ).catch(() => []);

  const activityP = apiFetch(
    `/activity_log?post_id=eq.${encoded}` +
    `&order=created_at.desc` +
    `&select=id,post_id,actor,action,old_stage,new_stage,created_at,updated_by`,
    { method: 'GET', headers: { 'Accept': 'application/json' } }
  ).catch(() => []);

  const [versions, activity] = await Promise.all([versionsP, activityP]);

  const rows = [];

  if (Array.isArray(versions)) {
    for (const v of versions) {
      rows.push({
        id: `pv:${v.id}`,
        type: 'caption',
        actor: v.edited_by || null,
        actorRole: v.edited_by_role
          ? ownerToRole(v.edited_by_role)
          : lookupRoleByEmail(v.edited_by, userRolesCache),
        at: v.edited_at,
        caption: v.caption || '',
      });
    }
  }

  if (Array.isArray(activity)) {
    for (const a of activity) {
      const isStage =
        a.new_stage != null ||
        (a.action && STAGE_RE.test(String(a.action)));
      const type = isStage ? 'stage' : 'system';
      rows.push({
        id: `al:${a.id}`,
        type,
        actor: a.actor || a.updated_by || null,
        actorRole: lookupRoleByEmail(a.actor || a.updated_by, userRolesCache),
        at: a.created_at,
        oldStage: a.old_stage || null,
        newStage: a.new_stage || null,
        action: a.action || null,
      });
    }
  }

  rows.sort((x, y) => safeIso(y.at) - safeIso(x.at));
  return rows;
}
