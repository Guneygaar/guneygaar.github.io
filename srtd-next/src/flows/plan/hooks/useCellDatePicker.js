// Shared hidden <input type="date"> for plan_cells. Mirror of
// useDatePicker but bound to a plan_cell (cell_date) instead of a
// post (target_date). Triggers planStore.updatePlanCell({cell_date})
// which is the optimistic-patch path used elsewhere in the store.
//
// iOS Safari gotcha (same as useDatePicker): showPicker() silently
// no-ops when the input is hidden — briefly reveal before firing.

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
  input.style.opacity = '0.01';
  input.style.pointerEvents = 'auto';
}

export function useCellDatePicker() {
  const inputRef = useRef(null);
  const pending = useRef(null);
  const update = usePlanStore((s) => s.updatePlanCell);

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
      const { cellId, oldDate } = pending.current;
      pending.current = null;
      if (!newDate || newDate === oldDate || !cellId) return;
      update(cellId, { cell_date: newDate });
    };
    const onBlur = () => {
      hide(input);
      pending.current = null;
    };
    input.addEventListener('change', onChange);
    input.addEventListener('blur', onBlur);

    const root = document.querySelector('[data-plan-root]') || document.body;
    root.appendChild(input);
    inputRef.current = input;

    return () => {
      input.removeEventListener('change', onChange);
      input.removeEventListener('blur', onBlur);
      if (input.parentNode) input.parentNode.removeChild(input);
      inputRef.current = null;
    };
  }, [update]);

  const triggerCellPicker = useCallback((cell) => {
    const input = inputRef.current;
    if (!input || !cell || !cell.id) return;
    const oldDate = (cell.cell_date || '').slice(0, 10);
    pending.current = { cellId: cell.id, oldDate };
    input.value = formatYYYYMMDD(cell.cell_date);
    input.removeAttribute('min');
    input.removeAttribute('max');

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
  }, []);

  return { triggerCellPicker };
}
