import React from 'react';
import { tokens } from '../tokens.js';

// Numbered field label + body. Label is mono uppercase tracked,
// body is caller-provided children (an input, a chip, a
// textarea). Matches the Create Post mockup spec exactly.

export function Field({ num, name, required, optional, children }) {
  return (
    <div style={{
      padding: '18px 22px',
      borderTop: `1px solid ${tokens.lineSoft}`,
      transition: 'background 0.15s'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 8,
        fontFamily: tokens.mono,
        fontSize: 9.5,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: tokens.textWhisper
      }}>
        {num && <span style={{ color: tokens.claude, fontWeight: 500 }}>{num}</span>}
        <span style={{ color: tokens.textSoft }}>{name}</span>
        {required && <span style={{ color: tokens.red }}>*</span>}
        {optional && (
          <span style={{
            color: tokens.textGhost,
            marginLeft: 'auto',
            fontWeight: 400,
            letterSpacing: '0.14em'
          }}>
            {optional}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
