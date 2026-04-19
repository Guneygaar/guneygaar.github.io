import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function FullScreenEditor({ title, onClose, onSave, showSave = false, busy = false, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/80" style={{ zIndex: 2599 }} />
      <div
        className="fixed inset-0 bg-bg flex flex-col animate-slide-up overflow-y-auto scrollbar-none"
        style={{ zIndex: 2600, WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-[430px] w-full mx-auto flex flex-col flex-1 min-h-full">
          <div className="sticky top-0 z-10 flex items-center gap-1.5 h-11 px-2.5 border-b border-divider-warm bg-bg/90 backdrop-blur-md">
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-text-soft hover:bg-bg-2 hover:text-text-mid rounded-sm2"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="flex-1 min-w-0 font-mono text-sm text-text-mid tracking-widest uppercase truncate px-1">{title}</div>
            {showSave && (
              <button
                onClick={onSave}
                disabled={busy}
                className="h-8 px-3 flex items-center rounded-sm2 bg-terracotta-grad text-text-loud font-mono text-xs tracking-wide uppercase font-semibold disabled:opacity-50"
              >
                Save
              </button>
            )}
          </div>
          <div className="flex-1 pb-safe-b">{children}</div>
        </div>
      </div>
    </>
  );
}
