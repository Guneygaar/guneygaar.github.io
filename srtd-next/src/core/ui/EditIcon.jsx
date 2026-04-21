import React from 'react';

/**
 * EditIcon - traced from Claude's native Edit glyph.
 * Single-stroke pencil, tilted, nib pointing down-right
 * (touches the right edge of the icon bounds).
 * Inherits color via currentColor.
 */
export function EditIcon({ size = 16, className = '', strokeWidth = 1.5, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Pencil body: tilted parallelogram, eraser end at top-left, nib at bottom-right */}
      <path d="M3 8.5 L8.5 3 L21 15.5 L20.5 19.5 L16.5 20 L4 7.5 Z" />
      {/* Ferrule: line separating body from nib */}
      <path d="M6 5.5 L11 10.5" />
    </svg>
  );
}
