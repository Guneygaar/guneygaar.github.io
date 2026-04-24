// Rejection / park reason strip. Rendered above caption on Card
// Sheet for stage in ['rejected', 'parked']. Pure ASCII.

import React from 'react';
import { XCircle, Pause } from 'lucide-react';
import { STAGE_COLOR_VAR } from './constants.js';

function cap(s) {
  if (!s || typeof s !== 'string') return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function ReasonBlock({ stage, reason }) {
  const rejected = stage === 'rejected';
  const Icon = rejected ? XCircle : Pause;
  const color = rejected
    ? `var(${STAGE_COLOR_VAR.rejected})`
    : `var(${STAGE_COLOR_VAR.parked})`;
  const bg = rejected
    ? 'color-mix(in srgb, var(--c-red) 10%, transparent)'
    : 'color-mix(in srgb, var(--c-text-dim) 10%, transparent)';

  const style = {
    background: bg,
    borderLeft: `3px solid ${color}`,
    padding: '10px 12px',
    margin: '12px 18px 0',
    borderRadius: '0 8px 8px 0',
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start'
  };

  if (!reason) {
    return (
      <div style={style}>
        <Icon size={16} style={{ color, flexShrink: 0 }} />
        <div style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '12px', fontStyle: 'italic', color: 'var(--c-text-dim)' }}>
          No reason provided.
        </div>
      </div>
    );
  }

  const role = cap(reason.author_role || '');
  return (
    <div style={style}>
      <Icon size={16} style={{ color, flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '8.5px',
          color: 'var(--c-text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
          marginBottom: '4px'
        }}>{rejected ? 'Rejected' : 'Parked'}</div>
        <div style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--c-text-mid)', lineHeight: 1.45 }}>
          {role ? `${role}: ` : ''}{reason.message || ''}
        </div>
      </div>
    </div>
  );
}
