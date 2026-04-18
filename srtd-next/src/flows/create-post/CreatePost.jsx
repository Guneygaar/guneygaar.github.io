import React, { useEffect, useMemo } from 'react';
import { ErrorBoundary } from '../../core/ui/index.js';
import { tokens } from '../../core/tokens.js';
import { useFormState } from './formStore.js';
import { useFlowState } from './flowStore.js';
import { Header } from './components/Header.jsx';
import { TitleField } from './components/TitleField.jsx';
import { SplitRows } from './components/SplitRows.jsx';
import { BriefField } from './components/BriefField.jsx';
import { CaptionField } from './components/CaptionField.jsx';
import { PhotosField } from './components/PhotosField.jsx';
import { DriveLinkField } from './components/DriveLinkField.jsx';
import { NotesField } from './components/NotesField.jsx';
import { Footer } from './components/Footer.jsx';
import { PasteSheet } from './components/PasteSheet.jsx';
import { GmailSheet } from './components/GmailSheet.jsx';
import { logClick } from '../../core/bridges/logging.js';

export function CreatePost() {
  const form = useFormState(s => s.form);
  const importOpen = useFormState(s => s.importOpen);
  const pasteSheetOpen = useFormState(s => s.pasteSheetOpen);
  const gmailSheetOpen = useFormState(s => s.gmailSheetOpen);
  const toast = useFormState(s => s.toast);
  const pendingDraft = useFormState(s => s.pendingDraft);
  const acceptDraft = useFormState(s => s.acceptDraft);
  const dismissDraft = useFormState(s => s.dismissDraft);
  const closeAllDropdowns = useFormState(s => s.closeAllDropdowns);
  const close = useFlowState(s => s.close);

  // Click outside any dropdown → close all
  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest('[data-dropdown]')) closeAllDropdowns();
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [closeAllDropdowns]);

  // Escape key closes modal — but if a child sheet (Paste / Gmail)
  // is open, let the sheet swallow Esc first (it will toggle its own
  // state and we stay open).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (pasteSheetOpen || gmailSheetOpen) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, pasteSheetOpen, gmailSheetOpen]);

  // Progress hairline calculation
  const progress = useMemo(() => {
    let f = 0;
    if (form.title.trim()) f++;
    if (form.owner) f++;
    if (form.caption.trim()) f++;
    if (form.targetDate) f++;
    return (f / 4) * 100;
  }, [form]);

  return (
    <ErrorBoundary>
      {/* Scrim backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0,
          background: '#000000CC',
          zIndex: 1500
        }}
      />

      {/* Modal. NO onClick stopPropagation: the backdrop is a
          sibling (not parent) so modal clicks don't hit it, and
          letting clicks bubble to `document` is required for the
          outside-click handler at :23-29 to close any open
          dropdown. Fixed in B5 — was the 6-dropdown stale-open bug. */}
      <div
        style={{
          position: 'fixed',
          top: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: '100%', maxWidth: 420,
          height: '100vh', height: '100dvh',
          background: tokens.ink1,
          borderLeft: `1px solid ${tokens.lineSoft}`,
          borderRight: `1px solid ${tokens.lineSoft}`,
          boxShadow: '0 30px 80px #000000CC',
          zIndex: 1501,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: tokens.sans, color: tokens.text
        }}>

        {/* Progress hairline */}
        <div style={{ height: 2, background: tokens.lineWhisper, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{
            position: 'absolute', inset: 0, width: `${progress}%`,
            background: tokens.claude, transition: 'width 0.3s'
          }} />
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Header />

          {/* B5.5a.1 draft restore banner — appears when open()
              detected a non-empty localStorage draft. User picks
              Restore / Start fresh / ✕ (same as Start fresh). */}
          {pendingDraft && (
            <div style={{
              margin: '0 22px 6px',
              padding: '12px 14px',
              background: tokens.claudeSoft,
              border: `1px solid ${tokens.claudeBorder}`,
              borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: tokens.mono, fontSize: 9, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: tokens.claude, marginBottom: 3
                }}>
                  ✦ Draft saved earlier
                </div>
                <div style={{
                  fontFamily: tokens.serif, fontSize: 13.5, color: tokens.textLoud
                }}>
                  You have a saved draft from earlier
                </div>
              </div>
              <button
                onClick={() => {
                  logClick('draft_banner_action', { choice: 'restore' });
                  acceptDraft();
                }}
                style={{
                  fontFamily: tokens.mono, fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: tokens.claude, background: 'transparent',
                  border: `1px solid ${tokens.claudeBorder}`,
                  padding: '7px 11px', cursor: 'pointer', flexShrink: 0
                }}>
                Restore
              </button>
              <button
                onClick={() => {
                  logClick('draft_banner_action', { choice: 'fresh' });
                  dismissDraft();
                }}
                style={{
                  fontFamily: tokens.mono, fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: tokens.textSoft, background: 'transparent',
                  border: 'none', padding: '7px 6px', cursor: 'pointer', flexShrink: 0
                }}>
                Start fresh
              </button>
              <button
                aria-label="Dismiss draft banner"
                onClick={() => {
                  logClick('draft_banner_action', { choice: 'fresh' });
                  dismissDraft();
                }}
                style={{
                  fontSize: 16, color: tokens.textWhisper,
                  fontFamily: tokens.serif, fontWeight: 300,
                  background: 'transparent', border: 'none', padding: 0,
                  cursor: 'pointer', lineHeight: 1, flexShrink: 0
                }}>
                ✕
              </button>
            </div>
          )}

          <div style={{
            opacity: importOpen ? 0.35 : 1,
            transition: 'opacity 0.2s',
            pointerEvents: importOpen ? 'none' : 'auto'
          }}>
            <TitleField />
            <SplitRows />
            <BriefField />
            <CaptionField />
            <PhotosField />
            <DriveLinkField />
            <NotesField />
          </div>
        </div>

        <Footer />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 30, left: '50%',
          transform: 'translateX(-50%)',
          background: tokens.ink2, border: `1px solid ${tokens.claudeBorder}`,
          padding: '12px 18px', maxWidth: 380,
          boxShadow: '0 20px 40px #000000CC', zIndex: 1800
        }}>
          <div style={{ fontFamily: tokens.serif, fontSize: 14, color: tokens.textLoud, fontWeight: 500 }}>
            {toast.msg}
          </div>
          {toast.sub && (
            <div style={{ fontFamily: tokens.mono, fontSize: 10, color: tokens.textWhisper, marginTop: 4, letterSpacing: '0.08em' }}>
              {toast.sub}
            </div>
          )}
        </div>
      )}

      {/* Import brief sheets — render above the modal at z-index 1700/1701. */}
      {pasteSheetOpen && <PasteSheet />}
      {gmailSheetOpen && <GmailSheet />}
    </ErrorBoundary>
  );
}
