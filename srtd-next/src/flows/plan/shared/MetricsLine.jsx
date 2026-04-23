// LinkedIn metrics display. Phase 10 logic:
//   - impressions > 0: "{N} views - {N} likes - {N} comments"
//   - likes/comments > 0 but impressions is 0: "{N} likes - {N} comments"
//   - otherwise: "Published - {publishedAt}"
// Style: IBM Plex Mono 8.5px, color var(--c-text-dim), uppercase letter-spacing .12em.

import React from 'react';

function shortNum(n) {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 10000) return (v / 1000).toFixed(1) + 'K';
  if (v < 1000000) return Math.round(v / 1000) + 'K';
  return (v / 1000000).toFixed(1) + 'M';
}

export function MetricsLine({ metrics, publishedAt }) {
  let label;
  if (metrics && (metrics.impressions || 0) > 0) {
    label = `${shortNum(metrics.impressions)} views - ${metrics.likes || 0} likes - ${metrics.comments || 0} comments`;
  } else if (metrics && ((metrics.likes || 0) > 0 || (metrics.comments || 0) > 0)) {
    label = `${metrics.likes || 0} likes - ${metrics.comments || 0} comments`;
  } else {
    label = `Published - ${publishedAt || ''}`;
  }
  return (
    <span style={{
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '8.5px',
      color: 'var(--c-text-dim)',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      whiteSpace: 'nowrap'
    }}>{label}</span>
  );
}

export { shortNum };
