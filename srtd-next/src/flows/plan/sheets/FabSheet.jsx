// Create options bottom sheet. Hidden for client role. All 3 options
// are stubs in PR 1 - they toast "Create flow opens in real PCS".

import React from 'react';
import { FilePlus, FileText, HelpCircle, X } from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';

function Option({ Icon, label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '14px 16px',
        background: 'var(--c-bg-2)',
        border: '1px solid var(--c-divider-soft)',
        borderRadius: '10px',
        cursor: 'pointer',
        textAlign: 'left'
      }}>
      <span style={{
        width: '36px', height: '36px',
        borderRadius: '10px',
        background: 'var(--c-bg-3)',
        color: 'var(--c-terracotta-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 600,
          fontSize: '14px',
          color: 'var(--c-text-loud)'
        }}>{label}</div>
        <div style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '9px',
          letterSpacing: '.08em',
          color: 'var(--c-text-dim)',
          marginTop: '2px',
          textTransform: 'uppercase'
        }}>{sub}</div>
      </div>
    </button>
  );
}

export function FabSheet() {
  const role = usePlanStore((s) => s.role);
  const closeFab = usePlanStore((s) => s.closeFab);
  const showToast = usePlanStore((s) => s.showToast);

  if (role === 'client') return null;

  const stub = () => {
    closeFab();
    showToast({ msg: 'Create flow opens in real PCS', duration: 2500 });
  };

  return (
    <>
      <div
        onClick={closeFab}
        style={{
          position: 'fixed', inset: 0,
          background: 'var(--backdrop-tint, rgba(0,0,0,.3))',
          zIndex: 2300
        }} />
      <div
        className="plan-card-sheet-enter"
        style={{
          position: 'fixed',
          left: 0, right: 0, bottom: 0,
          maxHeight: '60vh',
          background: 'var(--c-bg)',
          zIndex: 2350,
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '480px',
          margin: '0 auto',
          boxShadow: '0 -30px 80px -20px rgba(0,0,0,.5)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 12px 10px',
          borderBottom: '1px solid var(--c-divider-soft)',
          gap: '8px'
        }}>
          <div style={{
            flex: 1,
            fontFamily: 'Fraunces, serif',
            fontSize: '18px',
            fontWeight: 500,
            letterSpacing: '-.01em',
            color: 'var(--c-text-loud)',
            paddingLeft: '6px'
          }}>Create</div>
          <button type="button" aria-label="Done" onClick={closeFab}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px 10px',
              cursor: 'pointer',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '10px',
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--c-terracotta-1)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
            <X size={13} />
            Done
          </button>
        </header>
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Option Icon={FilePlus}  label="New post"    sub="Start a post draft"    onClick={stub} />
          <Option Icon={FileText}  label="New brief"   sub="Kick off brief to team" onClick={stub} />
          <Option Icon={HelpCircle} label="New request" sub="Ask the agency"         onClick={stub} />
        </div>
      </div>
    </>
  );
}
