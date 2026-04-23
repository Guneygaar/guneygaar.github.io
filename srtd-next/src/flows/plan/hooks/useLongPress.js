// Long-press gesture hook. 500 ms threshold by default. Returns a
// set of pointer event handlers ready to spread onto any element.
//
// Behaviour:
// - On pointerdown, starts a timer and sets data-pressing="true" on
//   the target element so CSS can render a press-state tint.
// - When the timer reaches threshold, fires onLongPress, vibrates
//   10 ms (when supported) and stamps window.__planLastLongPressAt
//   so ancestor click handlers can short-circuit the synthetic click
//   that follows pointerup.
// - The returned onClick suppresses the click that would otherwise
//   fire after a successful long-press. Short taps bubble up
//   normally so row-level tap handlers stay intact.
// - When `enabled` is false (for example role === 'client'), returns
//   an empty object so the consumer adds zero listeners.

import { useCallback, useRef } from 'react';

export function useLongPress({ onLongPress, enabled = true, threshold = 500 } = {}) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const elRef = useRef(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (elRef.current && typeof elRef.current.removeAttribute === 'function') {
      elRef.current.removeAttribute('data-pressing');
    }
  }, []);

  const onPointerDown = useCallback((e) => {
    firedRef.current = false;
    elRef.current = e.currentTarget;
    if (elRef.current && typeof elRef.current.setAttribute === 'function') {
      elRef.current.setAttribute('data-pressing', 'true');
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      if (elRef.current && typeof elRef.current.removeAttribute === 'function') {
        elRef.current.removeAttribute('data-pressing');
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(10); } catch (err) { /* noop */ }
      }
      window.__planLastLongPressAt = Date.now();
      try {
        if (typeof onLongPress === 'function') onLongPress(e);
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[useLongPress] handler threw', err);
        }
      }
    }, threshold);
  }, [onLongPress, threshold]);

  const onClick = useCallback((e) => {
    if (firedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      firedRef.current = false;
    }
  }, []);

  if (!enabled) return {};

  return {
    onPointerDown,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick
  };
}
