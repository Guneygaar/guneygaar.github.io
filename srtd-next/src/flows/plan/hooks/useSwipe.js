// Horizontal swipe detection with 60px threshold. Used by Card
// Sheet body for prev/next navigation. Ignores vertical-dominant
// gestures.

import { useRef } from 'react';

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60, vMax = 40 }) {
  const start = useRef(null);

  function onTouchStart(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = (e.changedTouches && e.changedTouches[0]) || null;
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < threshold) return;
    if (Math.abs(dy) > vMax) return;
    if (dx < 0 && typeof onSwipeLeft === 'function') onSwipeLeft();
    else if (dx > 0 && typeof onSwipeRight === 'function') onSwipeRight();
  }

  return {
    onTouchStart,
    onTouchEnd
  };
}
