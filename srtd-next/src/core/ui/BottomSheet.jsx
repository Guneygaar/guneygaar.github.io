import React, { useEffect, useRef } from 'react';

export function BottomSheet({
  open,
  onClose,
  children,
  zIndex = 2700,
  title = null,
}) {
  const handleWrapRef = useRef(null);
  const bodyRef = useRef(null);
  const sheetRef = useRef(null);
  const dragStateRef = useRef({ startY: 0, dragging: false });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop > 4) el.classList.add('scrolled');
      else el.classList.remove('scrolled');
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [open]);

  function onTouchStart(e) {
    const t = e.touches?.[0];
    if (!t) return;
    dragStateRef.current = { startY: t.clientY, dragging: true };
  }

  function onTouchMove(e) {
    const state = dragStateRef.current;
    if (!state.dragging) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dy = Math.max(0, t.clientY - state.startY);
    const sheet = sheetRef.current;
    if (sheet) sheet.style.transform = `translateY(${dy}px)`;
  }

  function onTouchEnd(e) {
    const state = dragStateRef.current;
    if (!state.dragging) return;
    const t = e.changedTouches?.[0];
    const dy = t ? Math.max(0, t.clientY - state.startY) : 0;
    const sheet = sheetRef.current;
    if (sheet) sheet.style.transform = '';
    dragStateRef.current = { startY: 0, dragging: false };
    if (dy > 70) onClose?.();
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50"
        style={{
          zIndex: zIndex - 1,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.26s ease',
        }}
      />
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 max-w-[430px] mx-auto bg-bg rounded-t-[14px] flex flex-col"
        style={{
          zIndex,
          maxHeight: '88vh',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.08), 0 -1px 0 var(--c-divider-subtle)',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          ref={handleWrapRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="py-2 flex justify-center flex-shrink-0 cursor-grab"
          style={{ touchAction: 'none' }}
        >
          <div className="w-9 h-[5px] rounded-pill bg-border-neutral" />
        </div>
        {title ? (
          <div className="px-4 pb-2 font-mono text-xs tracking-widest uppercase text-text-dim">{title}</div>
        ) : null}
        <div
          ref={bodyRef}
          className="sheet-body flex-1 overflow-y-auto"
          style={{
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
