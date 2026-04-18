import React from 'react';
import { tokens } from '../tokens.js';

// Mono-cased chip with color swatch + chevron. Tap opens a
// dropdown (caller wires the dropdown). Matches spec exactly.

export function Chip({ label, color, open, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: tokens.mono,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: tokens.text,
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer'
      }}>
      <span style={{
        width: 8,
        height: 8,
        background: color || tokens.claude,
        flexShrink: 0
      }} />
      {label}
      <span style={{
        fontSize: 8,
        color: tokens.textWhisper,
        marginLeft: 2,
        display: 'inline-block',
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.15s'
      }}>
        ▾
      </span>
    </button>
  );
}
