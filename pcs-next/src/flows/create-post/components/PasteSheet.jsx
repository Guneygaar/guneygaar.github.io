import React, { useEffect, useRef, useState } from 'react';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';

// Full-screen paste sheet. Stacks above the Create Post modal at
// z-index 1700 (scrim 1700, panel 1701) so it clears the modal's
// 1501. Closes via ✕ or Cancel; commits via "Use this" which
// appends the pasted text to form.internalNotes (never overwrites
// silently — existing notes survive with a "\n\n---\n\n" separator).

export function PasteSheet() {
  const setUI = useFormState(s => s.setUI);
  const update = useFormState(s => s.update);
  const currentNotes = useFormState(s => s.form.internalNotes);
  const setToast = useFormState(s => s.setToast);

  const [text, setText] = useState('');
  const taRef = useRef(null);

  useEffect(() => {
    // Auto-focus the textarea after the sheet mounts.
    const id = setTimeout(() => { if (taRef.current) taRef.current.focus(); }, 60);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    // Esc closes the sheet (but not the modal underneath).
    const onKey = (e) => { if (e.key === 'Escape') setUI({ pasteSheetOpen: false }); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setUI]);

  const close = () => setUI({ pasteSheetOpen: false });

  const handleUse = () => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const existing = (currentNotes || '').trim();
    const combined = existing
      ? existing + '\n\n---\n\n' + trimmed
      : trimmed;
    update('internalNotes', combined);
    setToast({ msg: 'Pasted into Internal Notes', sub: existing ? 'Appended with separator' : null });
    setTimeout(() => useFormState.getState().clearToast(), 1800);
    close();
  };

  const canUse = (text || '').trim().length > 0;

  return (
    <>
      {/* Scrim */}
      <div
        onClick={close}
        style={{ position: 'fixed', inset: 0, background: '#000000E0', zIndex: 1700 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 420,
        height: '100vh', height: '100dvh',
        background: tokens.ink1,
        borderLeft: `1px solid ${tokens.lineSoft}`,
        borderRight: `1px solid ${tokens.lineSoft}`,
        boxShadow: '0 30px 80px #000000CC',
        zIndex: 1701,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: tokens.sans, color: tokens.text
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 22px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `1px solid ${tokens.lineSoft}`
        }}>
          <div>
            <div style={{
              fontFamily: tokens.mono, fontSize: 9, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: tokens.textWhisper, marginBottom: 3
            }}>
              ✦ Import brief
            </div>
            <div style={{
              fontFamily: tokens.serif, fontSize: 22, fontWeight: 500,
              letterSpacing: '-0.015em', color: tokens.textLoud
            }}>
              Paste link or text
            </div>
          </div>
          <button
            aria-label="Close paste sheet"
            onClick={close}
            style={{
              fontSize: 20, color: tokens.textSoft,
              fontFamily: tokens.serif, fontWeight: 300,
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', lineHeight: 1, transition: 'color 0.15s'
            }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          <textarea
            ref={taRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste your brief, article text, or URL here..."
            style={{
              width: '100%',
              minHeight: '100%',
              background: 'transparent',
              border: 'none', outline: 'none', resize: 'none',
              fontFamily: tokens.serif, fontSize: 15, lineHeight: 1.6,
              color: tokens.textLoud
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 0, padding: 0,
          position: 'sticky', bottom: 0,
          background: tokens.ink1, borderTop: `1px solid ${tokens.line}`
        }}>
          <button
            onClick={close}
            style={{
              flex: 1, padding: '16px 20px',
              background: 'transparent', border: 'none',
              fontFamily: tokens.mono, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: tokens.textSoft, cursor: 'pointer', transition: 'color 0.15s'
            }}>
            Cancel
          </button>
          <button
            onClick={handleUse}
            disabled={!canUse}
            style={{
              flex: 1, padding: '16px 20px',
              background: 'transparent', border: 'none', borderLeft: `1px solid ${tokens.line}`,
              fontFamily: tokens.mono, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: canUse ? tokens.claude : tokens.textGhost,
              cursor: canUse ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s'
            }}>
            <span style={{ fontFamily: tokens.serif, fontSize: 13, display: 'inline-block' }}>→</span>
            Use this
          </button>
        </div>
      </div>
    </>
  );
}
