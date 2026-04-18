import React from 'react';
import { ArrowLeft, Link2, Trash2 } from 'lucide-react';
import { WhatsAppIcon } from '../../../core/ui/index.js';
import { pcsFlow } from '../index.js';
import { copyToClipboard } from '../../../core/bridges/clipboard.js';
import { openWhatsAppShare, buildShortUrl } from '../../../core/bridges/whatsapp.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick } from '../../../core/bridges/logging.js';
import { truncate } from '../utils/stage.js';

export function Topbar({ post, isAdmin }) {
  const hasCaption = !!(post?.caption && post.caption.trim().length > 0);
  const title = truncate(post?.title || 'Untitled', 80);

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

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1.5 h-11 px-2.5 border-b border-divider-warm bg-bg/90 backdrop-blur-md">
      <button onClick={() => pcsFlow.close()} className="w-8 h-8 flex items-center justify-center text-text-soft hover:bg-bg-2 hover:text-text-mid rounded-sm2" aria-label="Close">
        <ArrowLeft size={18} />
      </button>
      <div className="flex-1 min-w-0 text-[15px] font-medium text-text-loud tracking-tight truncate px-1">{title}</div>
      <button onClick={onCopy} className="w-8 h-8 flex items-center justify-center rounded-sm2 text-text-soft hover:bg-bg-2 hover:text-text-mid" aria-label="Copy link">
        <Link2 size={18} />
      </button>
      <button onClick={onWa} className={`w-8 h-8 flex items-center justify-center rounded-sm2 ${hasCaption ? 'text-text-soft hover:bg-bg-2 hover:text-green' : 'text-text-dim cursor-not-allowed'}`} aria-label="Share on WhatsApp" title={hasCaption ? 'Share on WhatsApp' : 'Add a caption before sharing'}>
        <WhatsAppIcon size={18} />
      </button>
      {isAdmin && (
        <button className="w-8 h-8 flex items-center justify-center rounded-sm2 text-red/60 opacity-50 cursor-not-allowed" aria-label="Delete (ships PR 2)" title="Delete ships PR 2">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
