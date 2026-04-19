import React, { useState } from 'react';
import { ArrowLeft, Link2, Trash2 } from 'lucide-react';
import { WhatsAppIcon } from '../../../core/ui/index.js';
import { pcsFlow } from '../index.js';
import { copyToClipboard } from '../../../core/bridges/clipboard.js';
import { openWhatsAppShare, buildShortUrl } from '../../../core/bridges/whatsapp.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';
import { STAGE_LABELS, STAGE_TOKEN } from '../utils/stage.js';
import { deletePost } from '../../../core/api/posts.js';

export function Topbar({ post, isAdmin, canMove, onMoveStage }) {
  const hasCaption = !!(post?.caption && post.caption.trim().length > 0);
  const [busy, setBusy] = useState(false);
  const stage = post?.stage || 'in_production';
  const stageLabel = STAGE_LABELS[stage] || stage;
  const stageToken = STAGE_TOKEN[stage] || 'text-soft';
  const stageColor = `var(--c-${stageToken})`;

  const onWa = () => {
    if (!post?.post_id) return;
    if (!hasCaption) { toast('Add a caption before sharing', 'warning'); return; }
    logClick('pcs_react_wa_share', { postId: post.post_id });
    openWhatsAppShare(post.title, post.post_id);
  };

  const onCopy = async () => {
    if (!post?.post_id) return;
    const text = (post.title || 'Post') + '\n' + buildShortUrl(post.post_id);
    const ok = await copyToClipboard(text);
    logClick('pcs_react_copy_link', { postId: post.post_id, ok });
    toast(ok ? 'Link copied' : 'Copy failed', ok ? 'success' : 'error');
  };

  async function onDelete() {
    if (busy || !post?.post_id) return;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm(`Delete this post permanently?\n\n${post.title || post.post_id}`)) return;
    }
    setBusy(true);
    try {
      await deletePost(post.post_id);
      logClick('pcs_react_post_delete', { postId: post.post_id });
      toast('Post deleted', 'success');
      pcsFlow.close();
    } catch (err) {
      logError(err, { context: 'pcs_react_post_delete' });
      toast('Delete failed', 'error');
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-1.5 h-11 px-2.5 border-b border-divider-warm bg-bg">
      <button onClick={() => pcsFlow.close()} className="w-8 h-8 flex items-center justify-center text-text-soft hover:bg-bg-2 hover:text-text-mid rounded-sm2" aria-label="Close">
        <ArrowLeft size={16} />
      </button>
      <button
        onClick={canMove ? onMoveStage : undefined}
        disabled={!canMove}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill font-mono text-xs tracking-widest uppercase font-medium border bg-transparent disabled:cursor-default"
        style={{ color: stageColor, borderColor: stageColor }}
        aria-label="Move stage"
      >
        <span className="w-1.5 h-1.5 rounded-pill" style={{ backgroundColor: stageColor }} />
        <span>{stageLabel}</span>
      </button>
      <span className="flex-1" />
      <button onClick={onCopy} className="w-8 h-8 flex items-center justify-center rounded-sm2 text-text-soft hover:bg-bg-2 hover:text-text-mid" aria-label="Copy link">
        <Link2 size={16} />
      </button>
      <button onClick={onWa} className={`w-8 h-8 flex items-center justify-center rounded-sm2 ${hasCaption ? 'text-text-soft hover:bg-bg-2 hover:text-green' : 'text-text-dim cursor-not-allowed'}`} aria-label="Share on WhatsApp" title={hasCaption ? 'Share on WhatsApp' : 'Add a caption before sharing'}>
        <WhatsAppIcon size={16} />
      </button>
      {isAdmin && (
        <button onClick={onDelete} disabled={busy} className="w-8 h-8 flex items-center justify-center rounded-sm2 text-red hover:bg-bg-2 disabled:opacity-50" aria-label="Delete post" title="Delete post">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
