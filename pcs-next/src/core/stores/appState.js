// Zustand store mirroring window.AppState.user and .workspace.
// React components subscribe to this instead of reading the
// window global directly, so role/workspace changes trigger
// re-renders.
//
// Vanilla code that mutates window.AppState can call
// window.__syncAppStateToReact() to notify subscribers.

import { create } from 'zustand';

export const useAppState = create((set) => ({
  user: null,
  workspace: null,
  hydrated: false,

  syncFromWindow: () => {
    if (typeof window === 'undefined') return;
    const src = window.AppState;
    if (!src) return;
    set({
      user: src.user || null,
      workspace: src.workspace || null,
      hydrated: true
    });
  }
}));

// Install window bridge so vanilla code can notify React.
if (typeof window !== 'undefined') {
  window.__syncAppStateToReact = () => {
    useAppState.getState().syncFromWindow();
  };
}
