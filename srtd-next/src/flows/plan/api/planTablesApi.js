// Plan feature tables API. Wrappers over window.apiFetch for the
// PR-1 schema (plans, plan_cells, plan_versions, plan_comments,
// workspace_channels). Read paths are background-tolerant
// (allowLogout:false). All writes return the inserted/updated row
// via Prefer: return=representation.

import { apiFetch } from '../../../core/api/client.js';

const READ_META = { allowLogout: false };
const READ_HEADERS = { 'Accept': 'application/json' };
const WRITE_HEADERS = {
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

function enc(v) { return encodeURIComponent(String(v)); }

export async function fetchPlanByWorkspace(workspaceId) {
  if (!workspaceId) return null;
  const select = 'id,workspace_id,title,period_start,period_end,plan_status,share_token,current_version,aligned_version,aligned_at,aligned_by,created_by,created_at,updated_at';
  const path = `/plans?select=${select}&workspace_id=eq.${enc(workspaceId)}&order=period_start.desc&limit=1`;
  const rows = await apiFetch(path, { method: 'GET', headers: READ_HEADERS }, READ_META);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function fetchAnyPlan() {
  const select = 'id,workspace_id,title,period_start,period_end,plan_status,share_token,current_version,aligned_version,aligned_at,aligned_by,created_by,created_at,updated_at';
  const path = `/plans?select=${select}&order=period_start.desc&limit=1`;
  const rows = await apiFetch(path, { method: 'GET', headers: READ_HEADERS }, READ_META);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function fetchPlanById(planId) {
  if (!planId) return null;
  const select = 'id,workspace_id,title,period_start,period_end,plan_status,share_token,current_version,aligned_version,aligned_at,aligned_by,created_by,created_at,updated_at';
  const path = `/plans?select=${select}&id=eq.${enc(planId)}&limit=1`;
  const rows = await apiFetch(path, { method: 'GET', headers: READ_HEADERS }, READ_META);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function fetchPlansForWorkspace(workspaceId) {
  if (!workspaceId) return [];
  const select = 'id,title,period_start,period_end,plan_status';
  const path = `/plans?select=${select}&workspace_id=eq.${enc(workspaceId)}&order=period_start.asc`;
  const rows = await apiFetch(path, { method: 'GET', headers: READ_HEADERS }, READ_META);
  return Array.isArray(rows) ? rows : [];
}

export async function fetchPlanCells(planId) {
  if (!planId) return [];
  const select = 'id,plan_id,workspace_id,cell_date,channel,concept,reference_image_url,cell_status,position,created_at,updated_at';
  const path = `/plan_cells?select=${select}&plan_id=eq.${enc(planId)}&order=cell_date.asc,channel.asc,position.asc`;
  const rows = await apiFetch(path, { method: 'GET', headers: READ_HEADERS }, READ_META);
  return Array.isArray(rows) ? rows : [];
}

export async function fetchPlanVersions(planId) {
  if (!planId) return [];
  const select = 'id,plan_id,version_number,trigger_event,triggered_by,triggered_by_name,triggered_by_role,notes,snapshot_jsonb,created_at';
  const path = `/plan_versions?select=${select}&plan_id=eq.${enc(planId)}&order=version_number.desc`;
  const rows = await apiFetch(path, { method: 'GET', headers: READ_HEADERS }, READ_META);
  return Array.isArray(rows) ? rows : [];
}

export async function fetchPlanComments(planId) {
  if (!planId) return [];
  const select = 'id,plan_id,plan_cell_id,version_number,author,author_role,author_email,author_user_id,is_external,message,resolved,resolved_by,resolved_at,reply_to,created_at';
  const path = `/plan_comments?select=${select}&plan_id=eq.${enc(planId)}&order=created_at.asc`;
  const rows = await apiFetch(path, { method: 'GET', headers: READ_HEADERS }, READ_META);
  return Array.isArray(rows) ? rows : [];
}

export async function fetchWorkspaceChannels(workspaceId) {
  if (!workspaceId) return [];
  // Defensive: if the workspace_channels table doesn't exist or 404s,
  // we return [] and the caller falls back to a default channel set.
  try {
    const select = 'channel,is_active,display_order';
    const path = `/workspace_channels?select=${select}&workspace_id=eq.${enc(workspaceId)}&is_active=eq.true&order=display_order.asc`;
    const rows = await apiFetch(path, { method: 'GET', headers: READ_HEADERS }, READ_META);
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    return [];
  }
}

export async function insertPlanCell(payload) {
  if (!payload) throw new Error('insertPlanCell: payload required');
  const rows = await apiFetch('/plan_cells', {
    method: 'POST',
    headers: WRITE_HEADERS,
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : rows;
}

export async function patchPlanCell(cellId, patch) {
  if (!cellId) throw new Error('patchPlanCell: cellId required');
  const rows = await apiFetch(`/plan_cells?id=eq.${enc(cellId)}`, {
    method: 'PATCH',
    headers: WRITE_HEADERS,
    body: JSON.stringify(patch || {})
  });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : rows;
}

export async function patchPlan(planId, patch) {
  if (!planId) throw new Error('patchPlan: planId required');
  const rows = await apiFetch(`/plans?id=eq.${enc(planId)}`, {
    method: 'PATCH',
    headers: WRITE_HEADERS,
    body: JSON.stringify(patch || {})
  });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : rows;
}

export async function insertPlanVersion(payload) {
  const rows = await apiFetch('/plan_versions', {
    method: 'POST',
    headers: WRITE_HEADERS,
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : rows;
}

export async function insertPlanComment(payload) {
  const rows = await apiFetch('/plan_comments', {
    method: 'POST',
    headers: WRITE_HEADERS,
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : rows;
}

export async function insertNotification(payload) {
  // Single-row insert. RLS off on notifications table.
  try {
    await apiFetch('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // Non-blocking; log via window.logError if present.
    if (typeof window !== 'undefined' && typeof window.logError === 'function') {
      window.logError('[planTablesApi] notification insert failed', e);
    }
  }
}
