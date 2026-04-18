import React from 'react';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';
import { useFlowState } from '../flowStore.js';

export function Footer() {
  const form = useFormState(s => s.form);
  const submitting = useFormState(s => s.submitting);
  const setToast = useFormState(s => s.setToast);
  const close = useFlowState(s => s.close);

  const canSubmit = form.title.trim() && form.caption.trim() && !submitting;

  const handleCancel = () => {
    setToast({ msg: 'Cancelled', sub: 'Form data discarded' });
    setTimeout(() => useFormState.getState().clearToast(), 1200);
    close();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setToast({ msg: 'Post payload ready', sub: 'B3 will wire live Supabase submit' });
    setTimeout(() => useFormState.getState().clearToast(), 2400);
    console.log('[create-post] submit payload preview:', form);
  };

  return (
    <div style={{
      display: 'flex', gap: 0, padding: 0,
      position: 'sticky', bottom: 0,
      background: tokens.ink1, borderTop: `1px solid ${tokens.line}`
    }}>
      <button
        onClick={handleCancel}
        style={{
          flex: 1, padding: '16px 20px',
          background: 'transparent', border: 'none',
          fontFamily: tokens.mono, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: tokens.textSoft, cursor: 'pointer', transition: 'color 0.15s'
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
