// Typed helpers for /posts CRUD. Build payload strictly against
// the verified schema. See audit: posts table has 26 columns,
// check constraints on stage + owner.

import { apiFetch } from './client.js';
import { STAGE_UI_TO_DB, PILLAR_UI_TO_DB, isCanvaUrl } from '../mappings.js';

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

  return {
    post_id:        options.postId || `POST-${Date.now()}`,
    title:          (form.title || '').trim(),
    stage:          stageDB,
    owner:          form.owner,
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
                      : null,
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
