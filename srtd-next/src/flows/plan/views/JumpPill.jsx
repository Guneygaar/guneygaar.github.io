// Floating pill that jumps the List view back to the current week.
// Mounts only while the List view is active. Tracks the current-week
// header via IntersectionObserver and shows when that header is
// off-screen or when the current week is collapsed. Tap expands the
// current week in the parent Set and smooth-scrolls the header into
// view.

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export function JumpPill({ targetRef, isExpanded, isPresent, onJump }) {
  const [visibility, setVisibility] = useState({ intersecting: true, above: false });
  const observerRef = useRef(null);

  useEffect(() => {
    const el = targetRef && targetRef.current;
    if (!el || typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
      return undefined;
    }
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    const io = new window.IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.boundingClientRect;
      setVisibility({
        intersecting: entry.isIntersecting,
        above: rect.bottom < 0
      });
    }, { root: null, threshold: 0 });
    io.observe(el);
    observerRef.current = io;
    return () => { io.disconnect(); };
  }, [targetRef, isPresent]);

  if (!isPresent) return null;
  const hidden = visibility.intersecting && isExpanded;
  if (hidden) return null;

  const Arrow = visibility.above ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={onJump}
      style={{
        position: 'fixed',
        bottom: '92px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 11,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderRadius: '20px',
        border: 'none',
        background: 'var(--c-terracotta-1)',
        color: '#FFFFFF',
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '9.5px',
        fontWeight: 600,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
      <Arrow size={13} style={{ flexShrink: 0 }} />
      Jump to this week
    </button>
  );
}
