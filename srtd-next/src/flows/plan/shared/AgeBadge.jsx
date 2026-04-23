// Stage age pill. Computed from status_changed_at.
// Thresholds (spec Phase 6):
//   days < 2: hidden
//   2-4:   gray  (--c-text-dim on --c-bg-2)
//   5-6:   amber
//   >= 7:  red

import React from 'react';
import { daysSince } from './dateUtils.js';

export function AgeBadge({ statusChangedAt, dark = false }) {
  const days = daysSince(statusChangedAt);
  if (days < 2) return null;
  let color = 'var(--c-text-dim)';
  let bg = 'var(--c-bg-2)';
  if (days >= 5 && days <= 6) {
    color = 'var(--c-amber)';
    bg = 'color-mix(in srgb, var(--c-amber) 14%, transparent)';
  } else if (days >= 7) {
    color = 'var(--c-red)';
    bg = 'color-mix(in srgb, var(--c-red) 14%, transparent)';
  }
  const style = {
    color,
    background: dark ? 'rgba(0,0,0,.55)' : bg,
    backdropFilter: dark ? 'blur(8px)' : undefined,
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '8.5px',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    padding: '2px 6px',
    borderRadius: '2px',
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap'
  };
  return <span style={style}>{days}d</span>;
}
