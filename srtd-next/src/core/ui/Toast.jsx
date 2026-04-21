import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useToastStore } from '../stores/toastStore.js';
import { formatINR } from '../../shared/caption-workspace/utils.js';

// Anthropic/Linear-style toast. Dark pill at bottom-center, slides
// up + fades in on mount. Success variant can carry a session-cost
// pill on the right; error variant never does. Optional action
// button (UNDO / RETRY) when current.action is set.

export function Toast() {
  const current = useToastStore(s => s.current);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!current) { setVisible(false); return; }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [current && current.id]);

  if (!current) return null;

  const isError = current.type === 'error';
  const Icon = isError ? XCircle : CheckCircle2;
  const iconClass = isError ? 'text-red' : 'text-green';
  const msg = isError
    ? (current.msg.length > 60 ? current.msg.slice(0, 60) + '…' : current.msg)
    : current.msg;
  const hasCost = !isError && typeof current.cost === 'number' && current.cost > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 bg-bg-2 border border-border-neutral rounded-pill inline-flex items-center gap-2.5 font-sans text-text-loud shadow-overlay"
      style={{
        bottom: 80,
        transform: visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(12px)',
        opacity: visible ? 1 : 0,
        transition: visible
          ? 'opacity 200ms ease, transform 200ms ease'
          : 'opacity 150ms ease, transform 150ms ease',
        padding: '10px 16px',
        zIndex: 9800,
        maxWidth: '92vw'
      }}>
      <Icon size={14} strokeWidth={2} className={iconClass} />
      <span className="text-base leading-snug">{msg}</span>
      {current.action ? (
        <button
          type="button"
          onClick={() => {
            try { current.action.onClick(); } catch (e) {}
            useToastStore.getState().dismiss();
          }}
          className="font-mono text-xs tracking-widest uppercase text-terracotta-1 hover:opacity-80 border-l border-border-neutral pl-2.5 ml-0.5"
        >
          {current.action.label}
        </button>
      ) : null}
      {hasCost && (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-amber border-l border-border-neutral pl-2.5 ml-0.5">
          <span className="w-[5px] h-[5px] rounded-pill bg-amber" />
          {formatINR(current.cost)}
        </span>
      )}
    </div>
  );
}
