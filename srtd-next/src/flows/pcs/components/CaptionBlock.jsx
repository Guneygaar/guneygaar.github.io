import React from 'react';
import { Pencil, Sparkles } from 'lucide-react';
import { renderRichText, wordCount } from '../utils/mentions.jsx';

export function CaptionBlock({ post, canEdit, userRoles }) {
  const caption = post?.caption || '';
  const wc = wordCount(caption);
  const over = wc > 125;

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
        <div className="flex items-center justify-between px-3 pb-2.5 font-mono text-sm text-text-dim tracking-wide">
          <span className="inline-flex items-center gap-1">{caption && !over ? <><Sparkles size={11} className="text-amber" /><span>within target length</span></> : ''}</span>
          <span className="font-sans text-sm text-text-mid inline-flex items-center gap-1.5 opacity-40 cursor-not-allowed" title="Edit ships PR 2">
            <Pencil size={12} />
            <span>Edit</span>
            <span className="font-mono text-2xs text-text-dim px-1 py-px border border-border-neutral rounded-sm2 bg-bg">E</span>
          </span>
        </div>
      )}
    </div>
  );
}
