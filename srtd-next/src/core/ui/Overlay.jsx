import React, { useEffect } from 'react';

export function Overlay({ onClose, children, zIndex = 1501 }) {
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
      <div onClick={onClose} className="fixed inset-0 bg-black/80" style={{ zIndex: zIndex - 1 }} />
      <div className="fixed inset-0 bg-bg flex flex-col animate-slide-up overflow-y-auto scrollbar-none" style={{ zIndex, WebkitOverflowScrolling: 'touch' }}>
        {children}
      </div>
    </>
  );
}
