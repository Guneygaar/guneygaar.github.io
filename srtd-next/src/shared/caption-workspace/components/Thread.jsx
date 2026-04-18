import React, { useEffect, useRef } from 'react';
import { useCaptionWorkspaceStore } from '../store.js';
import { AnglesCard } from './AnglesCard.jsx';
import { DraftCard } from './DraftCard.jsx';
import { ReviewBlock } from './ReviewBlock.jsx';
import { Sparkles } from './icons.js';

// Message thread. Auto-scrolls to bottom on new message. Handles
// three assistant-message types (angles / draft / review) + user
// bubbles + memory-locked rows.

export function Thread() {
  const messages = useCaptionWorkspaceStore((s) => s.messages);
  const isSending = useCaptionWorkspaceStore((s) => s.isSending);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages.length, isSending]);

  return (
    <div
      ref={ref}
      className="flex-1 overflow-y-auto scrollbar-none px-4 py-4 space-y-4">
      {messages.map((m) => {
        if (m.role === 'user') {
          return (
            <div key={m.id} className="flex justify-end">
              <div className="rounded-bubble bg-bg-pill border border-divider-soft px-3 py-2 font-sans text-[13px] text-text-loud max-w-[85%] whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          );
        }
        if (m.role === 'memory') {
          return (
            <div key={m.id} className="flex justify-center">
              <div className="rounded-pill bg-bg-memo border border-border-warm px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-terracotta animate-memorized-pulse">
                {m.content}
              </div>
            </div>
          );
        }
        const type = m.meta && m.meta.type;
        if (type === 'angles')  return <AnglesCard  key={m.id} msg={m} />;
        if (type === 'draft')   return <DraftCard   key={m.id} msg={m} />;
        if (type === 'review')  return <ReviewBlock key={m.id} msg={m} />;
        return null;
      })}

      {isSending && (
        <div className="flex items-center gap-2 text-text-soft font-mono text-[9px] uppercase tracking-widest">
          <Sparkles size={11} strokeWidth={1.7} className="text-terracotta" />
          <span className="flex items-center gap-1">
            Thinking
            <span className="inline-flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current animate-cw-dot-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-current animate-cw-dot-pulse" style={{ animationDelay: '200ms' }} />
              <span className="w-1 h-1 rounded-full bg-current animate-cw-dot-pulse" style={{ animationDelay: '400ms' }} />
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
