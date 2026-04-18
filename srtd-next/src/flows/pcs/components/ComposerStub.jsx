import React from 'react';
import { Plus, Sparkles, Send } from 'lucide-react';

export function ComposerStub({ activeTab }) {
  const placeholder = activeTab === 'internal' ? 'Write an internal note...' : 'Write a comment...';
  const left = activeTab === 'internal' ? 'agency only' : 'client + agency';
  const right = activeTab === 'internal' ? 'private' : 'visible to all';
  return (
    <div className="sticky bottom-0 bg-bg border-t border-divider-warm pb-safe-b opacity-45" title="Composer ships PR 2">
      <div className="flex items-end gap-2 px-3 py-2.5 cursor-not-allowed">
        <div className="w-8 h-8 flex items-center justify-center text-text-soft"><Plus size={18} /></div>
        <div className="flex-1 text-lg text-text-dim font-sans py-1.5 px-1">{placeholder}</div>
        <div className="w-8 h-8 flex items-center justify-center rounded-sm2 tint-amber border text-amber"><Sparkles size={14} /></div>
        <div className="px-3 py-1.5 rounded-sm2 bg-text-loud text-bg text-sm font-semibold tracking-tight inline-flex items-center gap-1.5">
          <span>Send</span>
          <Send size={13} />
        </div>
      </div>
      <div className="flex gap-1.5 px-3 pb-2.5 font-mono text-2xs text-text-dim tracking-wide">
        <span>{left}</span><span className="w-[2px] h-[2px] bg-text-dim rounded-pill self-center" /><span>{right}</span>
      </div>
    </div>
  );
}
