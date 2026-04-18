import React from 'react';
import { X, Copy, Reply, Trash2 } from 'lucide-react';
import { copyToClipboard } from '../../../core/bridges/clipboard.js';
import { toast } from '../../../core/bridges/toast.js';
import { softDeleteComment, softDeleteInternalNote } from '../../../core/api/comments.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { pcsFlow } from '../index.js';

export function CommentActionSheet({ comment, isInternal, canDelete, currentEmail, onReply, onClose }) {
  async function onCopy() {
    const ok = await copyToClipboard(comment.message || '');
    toast(ok ? 'Copied' : 'Copy failed', ok ? 'success' : 'error');
    onClose();
  }

  function doReply() {
    onReply(comment);
    onClose();
  }

  async function doDelete() {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm('Delete this comment?')) return;
    }
    try {
      if (isInternal) {
        await softDeleteInternalNote(comment.id);
      } else {
        await softDeleteComment(comment.id);
      }
      logClick('pcs_react_comment_delete', { commentId: comment.id, isInternal });
      toast('Deleted', 'success');
      if (isInternal) await pcsFlow.retryInternalNotes();
      else await pcsFlow.retryComments();
    } catch (err) {
      logError(err, { context: 'pcs_react_comment_delete' });
      toast('Delete failed', 'error');
    }
    onClose();
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/80" style={{ zIndex: 2500 }} />
      <div className="fixed inset-x-0 bottom-0 bg-bg border-t border-divider-warm rounded-t-card animate-slide-up max-w-[430px] mx-auto" style={{ zIndex: 2501 }}>
        <div className="flex items-center justify-between px-3 py-3 border-b border-divider-soft">
          <div className="font-mono text-sm text-text-dim tracking-widest uppercase">Comment</div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-text-soft" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-2 pb-safe-b">
          <button onClick={onCopy} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm2 hover:bg-bg-2 text-left">
            <Copy size={14} className="text-text-mid" />
            <span className="text-sm text-text-loud">Copy text</span>
          </button>
          <button onClick={doReply} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm2 hover:bg-bg-2 text-left">
            <Reply size={14} className="text-text-mid" />
            <span className="text-sm text-text-loud">Reply</span>
          </button>
          {canDelete && (
            <button onClick={doDelete} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm2 hover:bg-bg-2 text-left">
              <Trash2 size={14} className="text-red" />
              <span className="text-sm text-red">Delete</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
