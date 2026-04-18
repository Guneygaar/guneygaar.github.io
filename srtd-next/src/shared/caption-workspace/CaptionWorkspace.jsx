import React, { useEffect } from 'react';
import { useCaptionWorkspaceStore } from './store.js';
import { Header } from './components/Header.jsx';
import { Thread } from './components/Thread.jsx';
import { Composer } from './components/Composer.jsx';

// Full-screen slide-up overlay mounted at body level alongside
// <CreatePost />. Z-index 9600 sits above every vanilla overlay.
// Max-width 480 px, centered; warm-ink bg. System-colour-scheme
// aware via Tailwind tokens.

export function CaptionWorkspace() {
  const isOpen = useCaptionWorkspaceStore((s) => s.isOpen);
  const close = useCaptionWorkspaceStore((s) => s.close);

  // Lock page scroll while the workspace is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Esc closes.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return (
    <div
      aria-hidden={!isOpen}
      className={
        'fixed inset-0 z-[9600] flex justify-center bg-bg ' +
        'transition-transform duration-[280ms] ease-out ' +
        (isOpen ? 'translate-y-0 pointer-events-auto' : 'translate-y-full pointer-events-none')
      }
      style={{ height: '100dvh' }}>
      <div className="w-full max-w-[480px] h-full flex flex-col bg-bg">
        <Header />
        <Thread />
        <Composer />
      </div>
    </div>
  );
}
