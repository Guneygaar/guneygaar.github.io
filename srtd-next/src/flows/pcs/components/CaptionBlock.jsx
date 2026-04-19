import React, { useState } from 'react';
import { Pencil, Sparkles, ShieldCheck } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
  const showSeeMore = !expanded && caption.length > 100;
  const collapsed = !expanded && caption.length > 100;

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

  function onClaude() {
    if ((comments || []).length > 0) openRewrite();
    else openWrite('write');
  }

  return (
    <div className="border-b border-divider-warm">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 font-mono text-sm text-text-dim tracking-widest uppercase">
        <span>Caption</span>
        {caption && <span><span className={over ? 'text-amber' : 'text-green'}>{wc}</span> / 125 words</span>}
      </div>
      <div className={`px-3 pb-1 font-serif text-lg leading-[1.55] text-text-loud whitespace-pre-wrap ${collapsed ? 'line-clamp-2 overflow-hidden' : ''}`}>
        {caption ? renderRichText(caption, userRoles) : <span className="text-text-soft italic">No copy yet</span>}
      </div>
      {showSeeMore && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setExpanded(true)}
            className="font-mono text-xs text-terracotta tracking-widest uppercase font-semibold mt-1 bg-transparent border-0 cursor-pointer p-0"
          >
            See more
          </button>
        </div>
      )}
      {!collapsed && caption && <div className="pb-2" />}
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
              <button onClick={onClaude} className="font-sans text-sm text-amber inline-flex items-center gap-1.5 hover:text-text-loud">
                <Sparkles size={12} />
                <span>Claude</span>
              </button>
              <span className="text-text-dim">{'\u00B7'}</span>
              <button onClick={openQc} className="font-sans text-sm text-amber inline-flex items-center gap-1.5 hover:text-text-loud">
                <ShieldCheck size={12} />
                <span>QC</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
