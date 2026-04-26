import React, { useEffect } from 'react';

export function PostDeleteConfirm({ open, postTitle, postId, onCancel, onConfirm, busy = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const previewLabel = postTitle && String(postTitle).trim() ? String(postTitle).trim() : (postId || '');

  return (
    <>
      <div
        onClick={busy ? undefined : onCancel}
        data-testid="post-delete-confirm-backdrop"
        className="fixed inset-0 bg-black/70"
        style={{ zIndex: 2799 }}
      />
      <div
        data-testid="post-delete-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-delete-confirm-title"
        className="fixed inset-0 flex items-center justify-center p-5 pointer-events-none"
        style={{ zIndex: 2800 }}
      >
        <div className="w-full max-w-[360px] bg-bg rounded-card border border-divider-subtle pointer-events-auto flex flex-col">
          <div className="px-5 pt-5 pb-1">
            <div
              id="post-delete-confirm-title"
              className="font-sans text-lg font-medium text-text-loud"
            >
              Delete this post?
            </div>
            <div className="mt-1 font-sans text-sm text-text-dim">
              This cannot be undone.
            </div>
          </div>

          {previewLabel ? (
            <div className="mx-5 mt-3 mb-1 px-3 py-2 bg-bg-2 rounded-sm2 border border-divider-subtle">
              <div className="font-mono text-[10px] tracking-widest uppercase text-text-dim mb-0.5">Post</div>
              <div className="font-sans text-sm text-text-loud truncate">{previewLabel}</div>
            </div>
          ) : null}

          <div className="flex gap-2 px-5 pt-4 pb-5">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              data-testid="post-delete-confirm-cancel"
              className="flex-1 py-3 border border-divider-subtle bg-transparent rounded-sm2 font-sans text-base text-text-loud disabled:opacity-50"
              style={{ transition: 'background 0.12s ease' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              data-testid="post-delete-confirm-confirm"
              className="flex-1 py-3 bg-transparent border border-red rounded-sm2 font-sans text-base font-medium text-red disabled:opacity-50"
              style={{ transition: 'background 0.12s ease' }}
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
