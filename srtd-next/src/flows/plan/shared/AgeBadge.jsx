// Stage age pill. Computed from status_changed_at.
// Thresholds (spec Phase 6):
//   days < 2: hidden
//   2-4:   gray  (--c-text-dim on --c-bg-2)
//   5-6:   amber
//   >= 7:  red
//
// `dark` prop signals the badge is overlaid on a thumb image (Board card).
// In dark mode the overlay is the legacy rgba(0,0,0,.55) blur so the pill
// reads on bright imagery. In light mode the overlay would clash with cream
// cards, so we fall through to the native tinted bg + saturated text colour.
// Detection happens at render via window.matchMedia so PR-C1 light parity
// applies everywhere AgeBadge is used.

import React from 'react';
import { daysSince } from './dateUtils.js';

function prefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    return true;
  }
}

export function AgeBadge({ statusChangedAt, dark = false }) {
  const days = daysSince(statusChangedAt);
  if (days < 2) return null;
  let color = 'var(--c-text-dim)';
  let bg = 'var(--c-bg-2)';
  if (days >= 5 && days <= 6) {
    color = 'var(--c-amber)';
    bg = 'color-mix(in srgb, var(--c-amber) 18%, transparent)';
  } else if (days >= 7) {
    color = 'var(--c-red)';
    bg = 'color-mix(in srgb, var(--c-red) 18%, transparent)';
  }
  const useDarkOverlay = dark && prefersDark();
  const style = {
    color: useDarkOverlay ? color : color,
    background: useDarkOverlay ? 'rgba(0,0,0,.55)' : bg,
    backdropFilter: useDarkOverlay ? 'blur(8px)' : undefined,
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
