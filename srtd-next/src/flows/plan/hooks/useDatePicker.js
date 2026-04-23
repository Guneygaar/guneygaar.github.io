// Shared hidden <input type="date"> mounted once at Plan root.
// Call triggerPicker(post) from any row/block to open the native
// picker for that post. onChange applies optimistic reschedule +
// toast with undo via the Plan store.

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
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.style.zIndex = '-1';
    input.style.top = '0';
    input.style.left = '0';
    input.setAttribute('aria-hidden', 'true');
    input.addEventListener('change', (e) => {
      if (!pending.current) return;
      const newDate = e.target.value;
      const { postId, oldDate } = pending.current;
      pending.current = null;
      if (!newDate || newDate === oldDate) return;
      reschedule(postId, newDate);
    });
    document.body.appendChild(input);
    inputRef.current = input;
    return () => {
      if (inputRef.current && inputRef.current.parentNode) {
        inputRef.current.parentNode.removeChild(inputRef.current);
      }
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
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.focus();
        input.click();
      }
    } catch (err) {
      // Older WebKit requires a visible element
      input.style.pointerEvents = 'auto';
      input.style.opacity = '0.01';
      input.focus();
      input.click();
      setTimeout(() => {
        input.style.pointerEvents = 'none';
        input.style.opacity = '0';
      }, 100);
    }
  }, [monthStart, monthEnd]);

  return { triggerPicker };
}
