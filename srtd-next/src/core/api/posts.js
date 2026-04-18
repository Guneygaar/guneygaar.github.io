// Typed helpers for /posts CRUD. Build payload strictly against
// the verified schema. See audit: posts table has 26 columns,
// check constraints on stage + owner.

import { apiFetch } from './client.js';
import { STAGE_UI_TO_DB, PILLAR_UI_TO_DB, isCanvaUrl } from '../mappings.js';

// Supabase posts_owner_check allows exactly these title-cased roles.
// Map defensively in case the form sends lowercase / mixed case.
const OWNER_MAP = { creative: 'Creative', servicing: 'Servicing', client: 'Client', admin: 'Admin' };

/**
 * Build a /posts INSERT payload from form state.
 * Returns a plain object ready to JSON.stringify into the body.
 *
 * Caller must provide:
 *   form.title, form.owner, form.stage (UI label), form.caption,
 *   and optional fields. createdBy must be the auth email.
 */
export function buildPostPayload(form, createdBy, options = {}) {
  const stageDB = STAGE_UI_TO_DB[form.stage];
  if (!stageDB) {
    throw new Error(`[sorted-react/posts] unknown stage label: ${form.stage}`);
  }

  const isCanva = isCanvaUrl(form.driveLink);
  const rawOwner = form.owner || '';
  const ownerDB = OWNER_MAP[rawOwner.toLowerCase()] || rawOwner;

  return {
    post_id:        options.postId || `POST-${Date.now()}`,
    title:          (form.title || '').trim(),
    stage:          stageDB,
    owner:          ownerDB,
    content_pillar: form.pillar ? (PILLAR_UI_TO_DB[form.pillar] || form.pillar.toLowerCase()) : null,
    location:       form.location || null,
    target_date:    form.targetDate || null,
    format:         form.format || null,
    caption:        (form.caption || '').trim() || null,
    internal_notes: (form.internalNotes || '').trim() || null,
    drive_link:     isCanva ? null : (form.driveLink || null),
    canva_link:     isCanva ? form.driveLink : null,
    images:         (form.photos && form.photos.length > 0)
                      ? form.photos.map(p => p.url)
                      : [],
    is_draft:       options.isDraft === true,
    ai_origin:      options.aiOrigin === true,
    brief_id:       options.briefId || null,
    created_by:     createdBy
  };
}

export async function createPost(payload) {
  return apiFetch('/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });
}
