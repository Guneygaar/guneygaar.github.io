import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from './icons.js';
import { useCaptionWorkspaceStore } from '../store.js';

// Bottom composer: textarea + Send. Enter sends, Shift+Enter
// newlines. Auto-grows up to 5 lines. Disabled while isSending.

export function Composer() {
  const sendUserMessage = useCaptionWorkspaceStore((s) => s.sendUserMessage);
  const isSending = useCaptionWorkspaceStore((s) => s.isSending);
  const [text, setText] = useState('');
  const taRef = useRef(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 5 * 20; // ~5 lines at 13px line-height
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || isSending) return;
    sendUserMessage(t);
    setText('');
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = !!text.trim() && !isSending;

  return (
    <div className="border-t border-divider-soft bg-bg px-3 py-2.5">
      <div className="flex items-end gap-2 rounded-block border border-divider-soft bg-bg-2 px-3 py-2 focus-within:border-border-warm">
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask Claude, memorize: …, or paste a brief"
          className="flex-1 bg-transparent resize-none outline-none font-sans text-[13px] text-text-loud placeholder:text-text-dim leading-snug max-h-[100px]"
        />
        <button
          onClick={submit}
          disabled={!canSend}
          aria-label="Send"
          className={
            'shrink-0 w-8 h-8 rounded-chip flex items-center justify-center transition-opacity ' +
            (canSend
              ? 'bg-terracotta-grad text-text-loud'
              : 'bg-bg-3 text-text-dim cursor-not-allowed')
          }>
          <ArrowUp size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
