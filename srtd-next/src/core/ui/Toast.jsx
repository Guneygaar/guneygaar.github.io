import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useToastStore } from '../stores/toastStore.js';
import { formatINR } from '../../shared/caption-workspace/utils.js';

// Anthropic/Linear-style toast. Dark pill at bottom-center, slides
// up + fades in on mount. Success variant can carry a session-cost
// pill on the right; error variant never does.

export function Toast() {
  const current = useToastStore(s => s.current);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!current) { setVisible(false); return; }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [current && current.id]);

  if (!current) return null;

  const isError = current.type === 'error';
  const Icon = isError ? XCircle : CheckCircle2;
  const iconColor = isError ? '#FF4B4B' : '#3ECF8E';
  const msg = isError
    ? (current.msg.length > 60 ? current.msg.slice(0, 60) + '…' : current.msg)
    : current.msg;
  const hasCost = !isError && typeof current.cost === 'number' && current.cost > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 80,
        transform: visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(12px)',
        opacity: visible ? 1 : 0,
        transition: visible
          ? 'opacity 200ms ease, transform 200ms ease'
          : 'opacity 150ms ease, transform 150ms ease',
        background: '#1A1816',
        border: '1px solid #3A3632',
        borderRadius: 9999,
        padding: '10px 16px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        zIndex: 9800,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        fontFamily: '"DM Sans", sans-serif',
        color: '#F4F3EE',
        maxWidth: '92vw'
      }}>
      <Icon size={14} color={iconColor} strokeWidth={2} />
      <span style={{ fontSize: 13, lineHeight: 1.3 }}>{msg}</span>
      {hasCost && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 11,
          color: '#F6A623',
          borderLeft: '1px solid #3A3632',
          paddingLeft: 10,
          marginLeft: 2
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: '#F6A623'
          }} />
          {formatINR(current.cost)}
        </span>
      )}
    </div>
  );
}
