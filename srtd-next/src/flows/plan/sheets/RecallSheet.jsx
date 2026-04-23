// Minimal bottom-sheet picker for the kebab "Recall" action. Lists
// the earlier stages (the pipeline stages that sit before the
// current one in the canonical order) and calls onPick(stage) when
// the user chooses. Tapping the backdrop dismisses.

import React, { useEffect } from 'react';
import { STAGE_LABELS } from '../shared/constants.js';

const STAGE_ORDER = [
  'brief_done',
  'in_production',
  'awaiting_brand_input',
  'awaiting_approval',
  'scheduled',
  'published'
];

function earlierStages(currentStage) {
  const idx = STAGE_ORDER.indexOf(currentStage);
  if (idx <= 0) return [];
  return STAGE_ORDER.slice(0, idx);
}

export function RecallSheet({ currentStage, onPick, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const options = earlierStages(currentStage);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.45)',
          zIndex: 2700
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: '480px',
          margin: '0 auto',
          background: 'var(--c-bg)',
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          boxShadow: '0 -12px 40px -12px rgba(0,0,0,.5)',
          zIndex: 2800,
          padding: '10px 14px calc(14px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <div style={{
          width: '36px',
          height: '4px',
          background: 'var(--c-divider-soft)',
          borderRadius: '4px',
          margin: '0 auto 10px'
        }} />
        <div style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '10px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--c-text-dim)',
          padding: '4px 4px 8px'
        }}>
          Recall to
        </div>
        {options.length === 0 ? (
          <div style={{
            padding: '18px 4px',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '13px',
            color: 'var(--c-text-dim)',
            fontStyle: 'italic'
          }}>
            No earlier stage to recall to.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {options.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onPick(s)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 12px',
                  background: 'var(--c-bg-2)',
                  color: 'var(--c-text-loud)',
                  border: '1px solid var(--c-divider-soft)',
                  borderRadius: '8px',
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {STAGE_LABELS[s] || s}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
