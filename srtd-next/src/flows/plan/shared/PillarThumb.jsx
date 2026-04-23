// Shared thumbnail block for posts. Renders an image when available,
// otherwise a pillar-colored gradient with short pillar label.

import React from 'react';
import { PILLAR_GRAD_CLASS, PILLAR_LABELS } from './constants.js';

function firstImage(images) {
  if (!images) return null;
  try {
    let arr = images;
    if (typeof arr === 'string') arr = JSON.parse(arr);
    if (Array.isArray(arr) && arr.length > 0) return arr[0];
  } catch (e) {}
  return null;
}

export function PillarThumb({ post, size = 44, radius = 4, labelSize = '7px', showLabel = true }) {
  const img = firstImage(post && post.images);
  const grad = PILLAR_GRAD_CLASS[post && post.content_pillar] || 'plan-pillar-grad-default';
  const label = PILLAR_LABELS[post && post.content_pillar] || '';
  const style = {
    width: typeof size === 'number' ? `${size}px` : size,
    height: typeof size === 'number' ? `${size}px` : size,
    borderRadius: `${radius}px`,
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative'
  };
  if (img) {
    return (
      <div style={style}>
        <img src={img} alt="" loading="lazy" decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  return (
    <div className={grad} style={{
      ...style,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {showLabel && label ? (
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: labelSize,
          color: 'var(--c-text-loud)',
          opacity: 0.62,
          textTransform: 'uppercase',
          letterSpacing: '.1em',
          textAlign: 'center',
          padding: '0 2px'
        }}>{label.slice(0, 4)}</span>
      ) : null}
    </div>
  );
}
