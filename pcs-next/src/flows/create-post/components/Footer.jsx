import React from 'react';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';
import { useFlowState } from '../flowStore.js';
import { useAppState } from '../../../core/stores/appState.js';
import { buildPostPayload, createPost } from '../../../core/api/posts.js';
import { stampPostId } from '../../../core/api/aiUsage.js';
import { toast } from '../../../core/bridges/toast.js';

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

  const handleCancel = () => {
    close();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!user || !user.email) {
      toast('Not signed in - cannot create post', 'error');
      return;
    }

    setUI({ submitting: true });

    try {
      const payload = buildPostPayload(form, user.email, {
        aiOrigin: sessionCalls > 0
      });

      // Create the post
      const created = await createPost(payload);

      // Extract post_id from response (either single row or array)
      const postId = Array.isArray(created) && created.length > 0
        ? created[0].post_id
        : (created && created.post_id) || payload.post_id;

      // Stamp ai_usage rows from this session with the new post_id
      if (sessionCalls > 0) {
        await stampPostId({
          postId,
          createdBy: user.email,
          sessionStart
        });
      }

      toast('Post created', 'success');
      resetForm();
      close();
    } catch (err) {
      console.error('[create-post] submit failed:', err);
      toast(`Post creation failed: ${err.message || 'unknown error'}`, 'error');
      setUI({ submitting: false });
    }
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
          flex: 1, padding: '16px 20px',
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
