import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

const OPTIONS = [
  { key: 'week',    label: 'Last 7 days'  },
  { key: 'month',   label: 'Last 30 days' },
  { key: 'quarter', label: 'Last 90 days' }
];

export function PeriodSheet({ current, onPick, onClose }) {
  const [selected, setSelected] = useState(current || 'month');

  function commit() {
    onPick(selected);
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.35)',
          zIndex: 2700
        }} />
      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2800,
        background: 'var(--c-bg)',
        borderTop: '1px solid var(--c-divider-soft)',
        borderTopLeftRadius: '14px',
        borderTopRightRadius: '14px',
        maxWidth: '480px',
        margin: '0 auto',
        padding: '10px 0 calc(16px + env(safe-area-inset-bottom, 0px))'
      }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px 12px',
          borderBottom: '1px solid var(--c-divider-soft)'
        }}>
          <button type="button" aria-label="Close" onClick={onClose}
            style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--c-text-mid)' }}>
            <X size={18} />
          </button>
          <span style={{
            flex: 1,
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '10px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--c-text-mid)'
          }}>Period</span>
        </header>
        <div style={{ padding: '6px 0' }}>
          {OPTIONS.map((o) => {
            const active = selected === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setSelected(o.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '14px 18px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--c-divider-subtle)',
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '14px',
                  color: 'var(--c-text-loud)',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}>
                <span style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '18px',
                  border: '1.5px solid ' + (active ? 'var(--c-terracotta-1)' : 'var(--c-divider-soft)'),
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {active ? <Check size={12} color="var(--c-terracotta-1)" /> : null}
                </span>
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: '14px 16px 0' }}>
          <button
            type="button"
            onClick={commit}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--c-text-loud)',
              color: 'var(--c-bg)',
              border: 'none',
              borderRadius: '10px',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '11px',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              fontWeight: 600,
              cursor: 'pointer'
            }}>Done</button>
        </div>
      </div>
    </>
  );
}
