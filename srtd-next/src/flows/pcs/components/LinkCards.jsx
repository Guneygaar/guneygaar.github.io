import React, { useState } from 'react';
import { FolderOpen, Palette, ArrowUpRight, X } from 'lucide-react';
import { patchPost } from '../../../core/api/posts.js';
import { useAppState } from '../../../core/stores/appState.js';
import { usePcsStore } from '../pcsStore.js';
import { toast } from '../../../core/bridges/toast.js';
import { logClick, logError } from '../../../core/bridges/logging.js';

function LinkCard({ label, url, Icon, onRemove }) {
  return (
    <div className="flex-1 min-w-0 relative">
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 px-3 py-2.5 pr-8 border border-border-neutral rounded-sm2 bg-bg-2 hover:bg-bg-3 text-text-loud no-underline">
        <Icon size={18} className="text-text-mid flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-2xs text-text-dim tracking-widest uppercase">{label}</div>
          <div className="text-sm text-text-soft truncate">{url}</div>
        </div>
        <ArrowUpRight size={14} className="text-text-dim flex-shrink-0" />
      </a>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-sm2 bg-bg-3 text-text-soft hover:text-text-loud"
          aria-label={`Remove ${label} link`}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export function LinkCards({ post, linkedinLink }) {
  const actor = useAppState((s) => s.user?.email || '');
  const [busy, setBusy] = useState(false);
  if (linkedinLink && String(linkedinLink).trim()) return null;
  const hasDrive = !!(post?.drive_link && post.drive_link.trim());
  const hasCanva = !!(post?.canva_link && post.canva_link.trim());
  if (!hasDrive && !hasCanva) return null;

  async function removeLink(field) {
    if (busy || !post?.post_id) return;
    setBusy(true);
    try {
      const updated = await patchPost(post.post_id, { [field]: null, updated_by: actor });
      if (updated) usePcsStore.setState({ post: updated });
      logClick('pcs_react_link_remove', { field });
      toast(`${field === 'canva_link' ? 'Canva' : 'Drive'} link removed`, 'success');
    } catch (err) {
      logError(err, { context: 'pcs_react_link_remove', field });
      toast('Remove failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2 px-3 py-2.5 border-b border-divider-warm flex-wrap">
      {hasDrive && <LinkCard label="Drive" url={post.drive_link} Icon={FolderOpen} onRemove={() => removeLink('drive_link')} />}
      {hasCanva && <LinkCard label="Canva" url={post.canva_link} Icon={Palette} onRemove={() => removeLink('canva_link')} />}
    </div>
  );
}
