import React from 'react';
import { tokens } from '../tokens.js';

// Small dropdown anchored below its trigger. Options can be
// either strings or {label, color} objects. Colors render as
// a 7x7 swatch next to the label.

export function Dropdown({ options, current, onPick, onClose }) {
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 8px)',
      left: 0,
      minWidth: 200,
      background: tokens.ink3,
      border: `1px solid ${tokens.lineStrong}`,
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 12px 28px #0000008C',
      zIndex: 20
    }}>
      {options.map((opt, i) => {
        const isObj = typeof opt === 'object' && opt !== null;
        const label = isObj ? opt.label : opt;
        const color = isObj ? opt.color : null;
        const selected = current === label;
        return (
          <button
            key={label}
            onClick={() => { onPick && onPick(label); onClose && onClose(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '10px 14px',
              background: selected ? tokens.claudeSoft : 'transparent',
              border: 'none',
              borderBottom: i < options.length - 1 ? `1px solid ${tokens.lineSoft}` : 'none',
              color: selected ? tokens.textLoud : tokens.text,
              fontFamily: tokens.sans,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s'
            }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#FFFFFF05'; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}>
            {color && <span style={{ width: 7, height: 7, background: color, flexShrink: 0 }} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
