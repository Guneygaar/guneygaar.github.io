// Shared hidden <input type="date"> mounted once under [data-plan-root].
// Call triggerPicker(post) from any row/block to open the native
// picker for that post. onChange applies optimistic reschedule +
// toast with undo via the Plan store.
//
// iOS Safari gotcha: showPicker() silently no-ops when the input is
// display:none / opacity:0 / pointer-events:none. Before firing we
// briefly reveal the input (opacity: 0.01, pointer-events: auto) so
// iOS accepts the call, then re-hide on change + blur.

import { useCallback, useEffect, useRef } from 'react';
import { usePlanStore } from '../store/planStore.js';

function formatYYYYMMDD(v) {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch (e) {
    return '';
  }
}

function hide(input) {
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
}

function reveal(input) {
  // Enough to satisfy iOS Safari's "visible element" check without
  // letting the user actually see or tap the bare input.
  input.style.opacity = '0.01';
  input.style.pointerEvents = 'auto';
}

export function useDatePicker() {
  const inputRef = useRef(null);
  const pending = useRef(null);
  const monthStart = usePlanStore((s) => s.monthStart);
  const monthEnd = usePlanStore((s) => s.monthEnd);
  const reschedule = usePlanStore((s) => s.rescheduleTarget);

  useEffect(() => {
    if (inputRef.current) return;
    const input = document.createElement('input');
    input.type = 'date';
    input.style.position = 'absolute';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.top = '0';
    input.style.left = '0';
    input.style.zIndex = '-1';
    input.setAttribute('aria-hidden', 'true');
    hide(input);

    const onChange = (e) => {
      hide(input);
      if (!pending.current) return;
      const newDate = e.target.value;
      const { postId, oldDate } = pending.current;
      pending.current = null;
      if (!newDate || newDate === oldDate) return;
      reschedule(postId, newDate);
    };
    const onBlur = () => {
      hide(input);
      pending.current = null;
    };
    input.addEventListener('change', onChange);
    input.addEventListener('blur', onBlur);

    // Mount inside [data-plan-root] so the input shares the Plan
    // overlay's stacking context; fall back to body only if the root
    // isn't attached yet.
    const root = document.querySelector('[data-plan-root]') || document.body;
    root.appendChild(input);
    inputRef.current = input;

    return () => {
      input.removeEventListener('change', onChange);
      input.removeEventListener('blur', onBlur);
      if (input.parentNode) input.parentNode.removeChild(input);
      inputRef.current = null;
    };
  }, [reschedule]);

  const triggerPicker = useCallback((post) => {
    const input = inputRef.current;
    if (!input || !post) return;
    pending.current = { postId: post.id, oldDate: post.target_date };
    const dStr = formatYYYYMMDD(post.target_date);
    input.value = dStr;
    if (monthStart) input.min = monthStart;
    if (monthEnd) input.max = monthEnd;

    // Reveal BEFORE showPicker so iOS Safari accepts the call.
    reveal(input);
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.focus();
        input.click();
      }
    } catch (err) {
      input.focus();
      input.click();
    }
  }, [monthStart, monthEnd]);

  return { triggerPicker };
}
