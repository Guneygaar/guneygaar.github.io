import React, { useEffect, useMemo } from 'react';
import { ErrorBoundary } from '../../core/ui/index.js';
import { tokens } from '../../core/tokens.js';
import { useFormState } from './formStore.js';
import { useFlowState } from './flowStore.js';
import { Header } from './components/Header.jsx';
import { TitleField } from './components/TitleField.jsx';
import { SplitRows } from './components/SplitRows.jsx';
import { CaptionField } from './components/CaptionField.jsx';
import { PhotosField } from './components/PhotosField.jsx';
import { DriveLinkField } from './components/DriveLinkField.jsx';
import { NotesField } from './components/NotesField.jsx';
import { Footer } from './components/Footer.jsx';

export function CreatePost() {
  const form = useFormState(s => s.form);
  const importOpen = useFormState(s => s.importOpen);
  const toast = useFormState(s => s.toast);
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

  // Escape key closes modal
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

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

      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
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

          <div style={{
            opacity: importOpen ? 0.35 : 1,
            transition: 'opacity 0.2s',
            pointerEvents: importOpen ? 'none' : 'auto'
          }}>
            <TitleField />
            <SplitRows />
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
          boxShadow: '0 20px 40px #000000CC', zIndex: 1600
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
    </ErrorBoundary>
  );
}
