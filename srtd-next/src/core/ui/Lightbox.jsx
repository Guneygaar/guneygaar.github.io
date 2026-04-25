import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Shared lightbox primitive.
 *
 * Props:
 *   urls        : string[]         required
 *   startIndex  : number           default 0
 *   onClose     : () => void       required
 *   topRightSlot: ReactNode|null   optional - e.g. a kebab menu
 *   onIndexChange: (idx) => void   optional - parent sync
 */
export function Lightbox({
  urls,
  startIndex = 0,
  onClose,
  topRightSlot = null,
  onIndexChange,
  imageOverlay = null,
}) {
  if (urls && !Array.isArray(urls)) {
    if (typeof window !== 'undefined' && typeof window.logError === 'function') {
      window.logError('Lightbox non-array urls', { urls });
    }
  }
  const safe = Array.isArray(urls) ? urls.filter(Boolean) : [];
  const [idx, setIdx] = useState(
    Math.max(0, Math.min(startIndex, safe.length - 1))
  );
  const touchStart = useRef({ x: null, y: null });

  useEffect(() => {
    if (onIndexChange) onIndexChange(idx);
  }, [idx, onIndexChange]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft') {
        setIdx((i) => (i > 0 ? i - 1 : safe.length - 1));
        return;
      }
      if (e.key === 'ArrowRight') {
        setIdx((i) => (i < safe.length - 1 ? i + 1 : 0));
        return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [safe.length, onClose]);

  function onTouchStart(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e) {
    const start = touchStart.current;
    if (start.x == null) return;
    const t = e.changedTouches && e.changedTouches[0];
    touchStart.current = { x: null, y: null };
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Vertical-down to close
    if (absY > 80 && absY > absX * 1.2 && dy > 0) {
      onClose();
      return;
    }
    // Horizontal swipe to nav (only when > 1 image)
    if (absX > 50 && absX > absY && safe.length > 1) {
      if (dx < 0) setIdx((i) => (i < safe.length - 1 ? i + 1 : 0));
      else setIdx((i) => (i > 0 ? i - 1 : safe.length - 1));
    }
  }

  if (!safe.length) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 2700, background: 'rgba(0,0,0,0.95)' }}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center
                   justify-between px-3"
        style={{
          height: 44,
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 inline-flex items-center justify-center
                     rounded-sm2 text-text-loud active:scale-[0.96]"
          style={{
            background: 'rgba(0,0,0,0.5)',
            color: '#F4F3EE',
            transition: 'transform 0.08s ease',
          }}
          aria-label="Close"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
        <div
          className="flex items-center gap-2"
          style={{ color: '#F4F3EE' }}
        >
          {safe.length > 1 ? (
            <div
              className="font-mono text-xs tracking-widest uppercase
                         px-2.5 py-1 rounded-pill"
              style={{
                background: 'rgba(0,0,0,0.55)',
                fontFeatureSettings: "'tnum' 1",
              }}
            >
              {idx + 1} / {safe.length}
            </div>
          ) : null}
          {topRightSlot}
        </div>
      </div>

      {/* Image (wrapped so anchor overlay can absolute-position over it) */}
      <div
        className="relative inline-flex items-center justify-center max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={safe[idx]}
          alt=""
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          className="max-w-full max-h-full block"
          style={{
            objectFit: 'contain',
            pointerEvents: 'none',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            WebkitUserDrag: 'none',
          }}
        />
        {imageOverlay ? imageOverlay(idx) : null}
      </div>

      {/* Prev / Next */}
      {safe.length > 1 ? (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i > 0 ? i - 1 : safe.length - 1));
            }}
            className="absolute left-3 top-1/2 w-11 h-11 rounded-pill
                       inline-flex items-center justify-center"
            style={{
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.55)',
              color: '#F4F3EE',
            }}
            aria-label="Previous photo"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i < safe.length - 1 ? i + 1 : 0));
            }}
            className="absolute right-3 top-1/2 w-11 h-11 rounded-pill
                       inline-flex items-center justify-center"
            style={{
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.55)',
              color: '#F4F3EE',
            }}
            aria-label="Next photo"
          >
            <ChevronRight size={22} />
          </button>
        </>
      ) : null}

      {/* Pager dots */}
      {safe.length > 1 ? (
        <div
          className="absolute left-1/2 flex gap-2"
          style={{
            bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
            transform: 'translateX(-50%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {safe.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className="w-2 h-2 rounded-pill"
              style={{
                background:
                  i === idx ? '#F4F3EE' : 'rgba(244,243,238,0.35)',
                transition: 'background 0.15s ease',
              }}
              aria-label={`Go to photo ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
