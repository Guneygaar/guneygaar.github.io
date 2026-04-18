import React from 'react';
import { Linkedin, ExternalLink } from 'lucide-react';

export function LinkedInIndicator({ post }) {
  const url = post?.linkedin_link;
  if (!url || !url.trim()) return null;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-divider-warm">
      <Linkedin size={14} className="text-green" />
      <span className="font-mono text-sm text-green tracking-widest uppercase font-semibold">Live on LinkedIn</span>
      <a href={url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm text-terracotta underline max-w-[180px]">
        <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
        <ExternalLink size={11} className="flex-shrink-0" />
      </a>
    </div>
  );
}
