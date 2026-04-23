// Sticky filter indicator. Renders when currentFilter.stage !== 'all'.
// Shows "{STAGE} filter active" + Clear button.

import React from 'react';
import { X } from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';
import { STAGE_LABELS, STAGE_COLOR_VAR } from './constants.js';

export function FilterBanner() {
  const filter = usePlanStore((s) => s.currentFilter);
  const clearFilter = usePlanStore((s) => s.clearFilter);
  if (!filter || !filter.stage || filter.stage === 'all') return null;
  const label = STAGE_LABELS[filter.stage] || filter.stage;
  const colorVar = STAGE_COLOR_VAR[filter.stage];
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: 'var(--c-bg-2)',
      borderBottom: '1px solid var(--c-divider-soft)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '6px',
        background: colorVar ? `var(${colorVar})` : 'var(--c-text-dim)',
        flexShrink: 0
      }} />
      <span style={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '9.5px',
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'var(--c-text-mid)',
        flex: 1
      }}>{label} filter</span>
      <button
        type="button"
        onClick={clearFilter}
        style={{
          background: 'transparent',
          border: '1px solid var(--c-divider-soft)',
          padding: '4px 10px',
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '9px',
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--c-text-mid)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          cursor: 'pointer'
        }}>
        <X size={11} />
        Clear
      </button>
    </div>
  );
}
