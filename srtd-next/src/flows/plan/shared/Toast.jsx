// Plan-local toast with optional Undo button. Separate from the
// global core/ui/Toast.jsx so reschedule undo wiring stays inside
// the Plan store.

import React, { useEffect, useState } from 'react';
import { usePlanStore } from '../store/planStore.js';

export function Toast() {
  const toast = usePlanStore((s) => s.toast);
  const dismiss = usePlanStore((s) => s.dismissToast);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!toast.visible) { setMounted(false); return; }
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [toast.visible, toast.msg]);

  if (!toast.visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '96px',
        transform: mounted
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(12px)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 200ms ease, transform 200ms ease',
        zIndex: 9850,
        background: 'var(--c-bg-2)',
        border: '1px solid var(--c-border-neutral)',
        padding: '10px 16px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        borderRadius: '100px',
        boxShadow: '0 30px 80px -20px rgba(0,0,0,.5)',
        maxWidth: '92vw'
      }}>
      <span style={{
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '13px',
        color: 'var(--c-text-loud)'
      }}>{toast.msg}</span>
      {toast.undoAction ? (
        <button
          type="button"
          onClick={() => {
            try { toast.undoAction(); } catch (e) {}
            dismiss();
          }}
          style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '10px',
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--c-terracotta-1)',
            borderLeft: '1px solid var(--c-border-neutral)',
            paddingLeft: '10px',
            background: 'transparent',
            border: 'none',
            borderLeftWidth: '1px',
            borderLeftStyle: 'solid',
            borderLeftColor: 'var(--c-border-neutral)',
            cursor: 'pointer'
          }}>
          Undo
        </button>
      ) : null}
    </div>
  );
}
