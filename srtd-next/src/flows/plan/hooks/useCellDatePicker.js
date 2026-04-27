// Cell date picker handler. The visible <input type="date"> lives in
// DayCard rendered absolute over the day rail with opacity:0 +
// appearance:none, mirroring PropertySheet.jsx's anchor pattern. The
// native picker anchors to the visible input on desktop; iOS Safari
// opens its sheet directly because the input is in the live DOM tree.
//
// This hook now only exposes the change handler — it owns the
// optimistic patch through planStore.updatePlanCell. No portal mount,
// no showPicker(), no [data-plan-root] DOM querying.

import { useCallback } from 'react';
import { usePlanStore } from '../store/planStore.js';

export function useCellDatePicker() {
  const update = usePlanStore((s) => s.updatePlanCell);

  const triggerCellPicker = useCallback((cell, newDate) => {
    if (!cell || !cell.id) return;
    if (!newDate) return;
    const oldDate = (cell.cell_date || '').slice(0, 10);
    if (newDate === oldDate) return;
    update(cell.id, { cell_date: newDate });
  }, [update]);

  return { triggerCellPicker };
}
