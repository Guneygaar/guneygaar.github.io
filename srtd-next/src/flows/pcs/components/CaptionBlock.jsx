import React, { useState } from 'react';
import { Pencil, Sparkles, Wand2, ShieldCheck, MessageSquareQuote } from 'lucide-react';
import { renderRichText, wordCount } from '../utils/mentions.jsx';
import { openCaptionWorkspace } from '../../../core/bridges/captionWorkspace.js';
import { patchPost } from '../../../core/api/posts.js';
import { writeAudit } from '../../../core/api/audit.js';
import { useAppState } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { reseedOgPreview } from '../../../core/bridges/ogPreview.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';

export function CaptionBlock({ post, canEdit, userRoles, onEdit }) {
  const caption = post?.caption || '';
  const wc = wordCount(caption);
  const over = wc > 125;
  const actor = useAppState((s) => s.user?.email || '');
  const userRole = useAppState((s) => s.user?.role || '');
  const isAdmin = String(userRole).toLowerCase() === 'admin';
  const comments = usePcsStore((s) => s.comments);
  const [showWriteMenu, setShowWriteMenu] = useState(false);

  async function applyAiCaption(newText) {
    if (!newText || !post?.post_id) return;
    try {
      const updated = await patchPost(post.post_id, { caption: newText, updated_by: actor });
      writeAudit({ postId: post.post_id, field: 'caption', oldValue: post.caption, newValue: newText, actor }).catch(() => {});
      if (updated) usePcsStore.setState({ post: updated });
      reseedOgPreview(post.post_id);
      logClick('pcs_react_caption_ai_apply', { postId: post.post_id });
    } catch (err) {
      logError(err, { context: 'pcs_react_caption_ai_apply' });
      toast('Save failed', 'error');
    }
  }

  function openWrite(mode) {
    setShowWriteMenu(false);
    openCaptionWorkspace(mode, {
      postId: post.post_id,
      initialCaption: post.caption,
      syntheticContext: {
        caption: post.caption,
        title: post.title,
        pillar: post.content_pillar,
        location: post.location,
        format: post.format,
        source: 'pcs'
      },
      onUse: applyAiCaption
    });
  }

  function openQc() {
    openCaptionWorkspace('qc', {
      postId: post.post_id,
      initialCaption: post.caption,
      syntheticContext: { caption: post.caption, title: post.title, pillar: post.content_pillar, location: post.location, format: post.format, source: 'pcs' },
      onUse: applyAiCaption
    });
  }

  function openRewrite() {
    openCaptionWorkspace('rewrite', {
      postId: post.post_id,
      caption: post.caption,
      comments: (comments || []).map((c) => ({ author: c.author, message: c.message })),
      onUse: applyAiCaption
    });
  }

  return (
    <div className="border-b border-divider-warm">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 font-mono text-sm text-text-dim tracking-widest uppercase">
        <span>Caption</span>
        {caption && <span><span className={over ? 'text-amber' : 'text-green'}>{wc}</span> / 125 words</span>}
      </div>
      <div className="px-3 pb-3 font-serif text-lg leading-[1.55] text-text-loud whitespace-pre-wrap">
        {caption ? renderRichText(caption, userRoles) : <span className="text-text-soft italic">No copy yet</span>}
      </div>
      {canEdit && (
        <div className="flex items-center gap-2 px-3 pb-2.5 font-mono text-sm text-text-dim tracking-wide flex-wrap">
          <button onClick={onEdit} className="font-sans text-sm text-text-mid inline-flex items-center gap-1.5 hover:text-text-loud">
            <Pencil size={12} />
            <span>Edit</span>
            <span className="font-mono text-2xs text-text-dim px-1 py-px border border-border-neutral rounded-sm2 bg-bg">E</span>
          </button>
          {isAdmin && (
            <>
              <span className="text-text-dim">{'\u00B7'}</span>
              <div className="relative">
                <button onClick={() => setShowWriteMenu((v) => !v)} className="font-sans text-sm text-amber inline-flex items-center gap-1.5 hover:text-text-loud">
                  <Wand2 size={12} />
                  <span>Write</span>
                </button>
                {showWriteMenu && (
                  <div className="absolute bottom-full left-0 mb-1 bg-bg border border-divider-warm rounded-card shadow-overlay min-w-[180px]" style={{ zIndex: 50 }}>
                    <button onClick={() => openWrite('write')} className="w-full text-left px-3 py-2 text-sm text-text-loud hover:bg-bg-2">Angles + drafts</button>
                    <button onClick={() => openWrite('write-options')} className="w-full text-left px-3 py-2 text-sm text-text-loud hover:bg-bg-2">3 options</button>
                  </div>
                )}
              </div>
              <span className="text-text-dim">{'\u00B7'}</span>
              <button onClick={openQc} className="font-sans text-sm text-amber inline-flex items-center gap-1.5 hover:text-text-loud">
                <ShieldCheck size={12} />
                <span>QC</span>
              </button>
              {(comments || []).length > 0 && (
                <>
                  <span className="text-text-dim">{'\u00B7'}</span>
                  <button onClick={openRewrite} className="font-sans text-sm text-amber inline-flex items-center gap-1.5 hover:text-text-loud">
                    <MessageSquareQuote size={12} />
                    <span>Rewrite</span>
                  </button>
                </>
              )}
            </>
          )}
          {caption && !over && (
            <span className="ml-auto inline-flex items-center gap-1 text-text-dim">
              <Sparkles size={11} className="text-amber" />
              <span>within target length</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
