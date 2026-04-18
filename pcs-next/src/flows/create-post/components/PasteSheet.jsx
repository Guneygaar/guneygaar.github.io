import React, { useEffect, useRef, useState } from 'react';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';
import { useIsAdmin } from '../../../core/stores/appState.js';
import { openCaptionWorkspace } from '../../../core/bridges/captionWorkspace.js';

// Full-screen paste sheet. Stacks above the Create Post modal at
// z-index 1700 (scrim 1700, panel 1701) so it clears the modal's
// 1501. Closes via ✕ or Cancel.
//
// B5.5a role split:
//   - Non-admin: "Use this" appends pasted text to form.internalNotes
//     with a "\n\n---\n\n" separator (unchanged from B5).
//   - Admin: "Generate caption from brief" closes the paste sheet
//     and opens Caption Workspace in write mode with the pasted
//     text as syntheticContext.brief. Workspace generates 3
//     captions; "Use this" in the Workspace flows back through
//     onUse to update form.caption, with a confirm() prompt if
//     the caption is already non-empty.

export function PasteSheet() {
  const setUI = useFormState(s => s.setUI);
  const update = useFormState(s => s.update);
  const currentNotes = useFormState(s => s.form.internalNotes);
  const setToast = useFormState(s => s.setToast);
  const isAdmin = useIsAdmin();

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

    // Non-admin: append to internal notes (unchanged from B5).
    if (!isAdmin) {
      const existing = (currentNotes || '').trim();
      const combined = existing
        ? existing + '\n\n---\n\n' + trimmed
        : trimmed;
      update('internalNotes', combined);
      setToast({
        msg: 'Pasted into Internal Notes',
        sub: existing ? 'Appended with separator' : null
      });
      setTimeout(() => useFormState.getState().clearToast(), 1800);
      close();
      return;
    }

    // Admin: open Caption Workspace with the pasted text as brief.
    // Vanilla handleCaptionWorkspace's write-mode (B5.5a) reads
    // context.syntheticContext.brief and hands it straight to
    // Claude. Close the paste sheet FIRST so the workspace overlay
    // (z-index 9600) paints on top cleanly.
    const form = useFormState.getState().form;
    close();
    openCaptionWorkspace('write', {
      postId: null,
      initialCaption: '',
      syntheticContext: {
        source: 'create-post-paste',
        brief: trimmed,
        title:    form.title    || null,
        pillar:   form.pillar   || null,
        location: form.location || null,
        format:   form.format   || null
      },
      onUse: (generated) => {
        if (typeof generated !== 'string' || !generated.trim()) return;
        const existingCaption = (useFormState.getState().form.caption || '').trim();
        if (existingCaption && !window.confirm('Replace existing caption with generated version?')) {
          return;
        }
        useFormState.getState().update('caption', generated);
      },
      onClose: () => {
        try {
          var ws = window._captionWS;
          if (ws) {
            useFormState.getState().setUI({
              sessionCost: typeof ws.sessionCost === 'number' ? ws.sessionCost : 0,
              sessionCalls: Array.isArray(ws.messages)
                ? ws.messages.filter(m => m && m.role === 'assistant').length
                : 0
            });
          }
        } catch (e) { /* ignore */ }
      }
    });
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
            {isAdmin ? 'Generate caption from brief' : 'Use this'}
          </button>
        </div>
      </div>
    </>
  );
}
