import React from 'react';
import { FolderOpen, Palette, ArrowUpRight } from 'lucide-react';

function LinkCard({ label, url, Icon }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2.5 border border-border-neutral rounded-sm2 bg-bg-2 hover:bg-bg-3 text-text-loud no-underline">
      <Icon size={18} className="text-text-mid flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-2xs text-text-dim tracking-widest uppercase">{label}</div>
        <div className="text-sm text-text-soft truncate">{url}</div>
      </div>
      <ArrowUpRight size={14} className="text-text-dim flex-shrink-0" />
    </a>
  );
}

export function LinkCards({ post }) {
  const hasDrive = !!(post?.drive_link && post.drive_link.trim());
  const hasCanva = !!(post?.canva_link && post.canva_link.trim());
  if (!hasDrive && !hasCanva) return null;
  return (
    <div className="flex gap-2 px-3 py-2.5 border-b border-divider-warm flex-wrap">
      {hasDrive && <LinkCard label="Drive" url={post.drive_link} Icon={FolderOpen} />}
      {hasCanva && <LinkCard label="Canva" url={post.canva_link} Icon={Palette} />}
    </div>
  );
}
