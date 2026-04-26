import React from 'react';
import { Trash2 } from 'lucide-react';
import { tokens } from '../../../core/tokens.js';
import { useFormState, clearDraft } from '../formStore.js';
import { useFlowState } from '../flowStore.js';
import { useAppState } from '../../../core/stores/appState.js';
import { buildPostPayload, createPost } from '../../../core/api/posts.js';
import { createInternalNote } from '../../../core/api/comments.js';
import { stampPostId } from '../../../core/api/aiUsage.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';

// Consider the form dirty when any user-writable field has content.
// `owner`, `stage`, `format`, `targetDate` all have non-empty defaults;
// treat those as clean unless they've been explicitly changed in a
// follow-up PR (today they arrive populated from initialForm).
function _isDirty(form) {
  if (!form) return false;
  if ((form.title || '').trim()) return true;
  if ((form.caption || '').trim()) return true;
  if ((form.internalNotes || '').trim()) return true;
  if ((form.driveLink || '').trim()) return true;
  if ((form.pillar || '').trim()) return true;
  if ((form.location || '').trim()) return true;
  if (Array.isArray(form.photos) && form.photos.length > 0) return true;
  return false;
}

export function Footer() {
  const form = useFormState(s => s.form);
  const submitting = useFormState(s => s.submitting);
  const sessionStart = useFormState(s => s.sessionStart);
  const sessionCalls = useFormState(s => s.sessionCalls);
  const setUI = useFormState(s => s.setUI);
  const resetForm = useFormState(s => s.reset);
  const close = useFlowState(s => s.close);
  const user = useAppState(s => s.user);

  const canSubmit = form.title.trim() && form.caption.trim() && !submitting;
  const canClear = _isDirty(form) && !submitting;

  const handleCancel = () => {
    close();
  };

  const handleClear = () => {
    if (!canClear) return;
    if (!window.confirm('Clear all fields? This cannot be undone.')) return;
    resetForm();
    clearDraft();
    logClick('create_post_clear_form');
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (!user || !user.email) {
      toast('Not signed in - cannot create post', 'error');
      return;
    }

    // 1. Build payload synchronously. This is the only step that
    //    can surface a user-fixable error (unknown stage label) so
    //    we keep it gated on a try/catch and abort close if it
    //    throws.
    let payload;
    try {
      payload = buildPostPayload(form, user.email, {
        aiOrigin: sessionCalls > 0
      });
    } catch (err) {
      console.error('[create-post] payload build failed:', err);
      toast(`Post creation failed: ${err.message || 'unknown error'}`, 'error');
      logClick('create_post_submit_react', {}, false, { error: err && err.message });
      logError(err, { action: 'create-post-submit-react' });
      return;
    }

    // 2. Optimistic close — the form feels instant. Realtime (or
    //    the next /posts poll) will surface the row for every
    //    other viewer; the admin sees the toast and trusts.
    const finalCost = useFormState.getState().sessionCost || 0;
    clearDraft();
    toast('Post created', 'success', { cost: finalCost });
    logClick('create_post_submit_react', { post_id: payload.post_id }, true, { post_id: payload.post_id });
    resetForm();
    close();

    // 3. Background write. Do NOT await.
    const briefText = (form.internalNotes || '').trim();
    createPost(payload).then((created) => {
      const postId = Array.isArray(created) && created.length > 0
        ? created[0].post_id
        : (created && created.post_id) || payload.post_id;
      if (postId && sessionCalls > 0) {
        stampPostId({ postId, createdBy: user.email, sessionStart })
          .catch(() => { /* non-critical */ });
      }
      // PR-3.15: brief field is no longer a posts column. After the
      // post row is inserted, fan the brief out as an auto-pinned
      // depth-0 row in internal_notes. Skip empty briefs.
      if (postId && briefText) {
        const role = (user.effectiveRole || user.role || 'Admin');
        const titleCased = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
        const nowIso = new Date().toISOString();
        createInternalNote({
          post_id: postId,
          author: user.email,
          author_role: titleCased,
          message: briefText,
          post_title: payload.title || '',
          visibility: 'internal',
          deleted: false,
          pinned: true,
          pinned_at: nowIso,
          pinned_by: user.email,
          created_at: nowIso
        }).catch((noteErr) => {
          console.warn('[create-post] brief -> internal_notes insert failed', noteErr);
          toast('Brief saved as note failed - add manually in Internal notes', 'error');
          logError(noteErr, { action: 'create-post-brief-note-react' });
        });
      }
    }).catch((err) => {
      console.error('[create-post] background insert failed:', err);
      toast('Post may not have saved — please check pipeline', 'error');
      logClick('create_post_submit_react_bg', {}, false, { error: err && err.message });
      logError(err, { action: 'create-post-submit-react-bg' });
    });
  };

  return (
    <div style={{
      display: 'flex', gap: 0, padding: 0,
      position: 'sticky', bottom: 0,
      background: tokens.ink1, borderTop: `1px solid ${tokens.line}`
    }}>
      <button
        onClick={handleCancel}
        disabled={submitting}
        style={{
          padding: '16px 18px',
          background: 'transparent', border: 'none',
          fontFamily: tokens.mono, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: tokens.textSoft,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.5 : 1,
          transition: 'color 0.15s'
        }}>
        Cancel
      </button>
      <button
        aria-label="Clear form"
        onClick={handleClear}
        disabled={!canClear}
        style={{
          padding: '16px 14px',
          background: 'transparent', border: 'none', borderLeft: `1px solid ${tokens.lineSoft}`,
          fontFamily: tokens.mono, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: canClear ? tokens.textSoft : tokens.textGhost,
          cursor: canClear ? 'pointer' : 'not-allowed',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: submitting ? 0.5 : 1,
          transition: 'all 0.15s'
        }}>
        <Trash2 size={12} strokeWidth={1.7} />
        Clear
      </button>
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          flex: 1, padding: '16px 20px',
          background: 'transparent', border: 'none', borderLeft: `1px solid ${tokens.line}`,
          fontFamily: tokens.mono, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: canSubmit ? tokens.claude : tokens.textGhost,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'all 0.15s',
          opacity: submitting ? 0.6 : 1
        }}>
        <span style={{ fontFamily: tokens.serif, fontSize: 13, display: 'inline-block' }}>→</span>
        {submitting ? 'Creating...' : 'Create Post'}
      </button>
    </div>
  );
}
