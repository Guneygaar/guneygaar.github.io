// Zustand store mirroring window.AppState.user and .workspace.
// React components subscribe to this instead of reading the
// window global directly, so role/workspace changes trigger
// re-renders.
//
// Vanilla code that mutates window.AppState can call
// window.__syncAppStateToReact() to notify subscribers.
// Auth-state events (sorted:role-ready dispatched by activateRole
// in 03-auth.js, sorted:signout dispatched by logout) auto-resync
// without component intervention.

import { create } from 'zustand';
import type { AppUser, AppWorkspace } from '../../lib/types';

interface AppStateStore {
  user: AppUser | null;
  workspace: AppWorkspace | null;
  hydrated: boolean;
  syncFromWindow: () => void;
}

export const useAppState = create<AppStateStore>((set) => ({
  user: null,
  workspace: null,
  hydrated: false,

  syncFromWindow: () => {
    if (typeof window === 'undefined') return;
    const src = (window as unknown as { AppState?: { user?: AppUser; workspace?: AppWorkspace } }).AppState;
    if (!src) return;
    // Spread to force new object identity. Vanilla activateRole() mutates
    // window.AppState.user in place (e.g. user.role = role), so the same
    // reference reaches Zustand's set() — Object.is equality short-circuits
    // the update and useUser subscribers (App.jsx) never re-render after
    // sorted:role-ready, leaving Plan unmounted on fresh OTP sign-in.
    set({
      user: src.user ? { ...src.user } : null,
      workspace: src.workspace ? { ...src.workspace } : null,
      hydrated: true
    });
  }
}));

export function useUser(): AppUser | null {
  return useAppState(s => s.user);
}

// Admin predicate hook. AI affordances (Caption Workspace ⤢,
// cost chip, Import brief) are Admin-only; manual fields work
// for every role. Returns true when effectiveRole (or role, if
// effectiveRole is not yet hydrated) is 'admin' (case-insensitive).
export function useIsAdmin(): boolean {
  return useAppState(s =>
    (s.user?.effectiveRole || s.user?.role || '').toLowerCase() === 'admin'
  );
}

export const useIsClient = (): boolean =>
  useAppState((s) =>
    ((s.user?.effectiveRole || s.user?.role || '') + '')
      .toLowerCase() === 'client');

// Install window bridge so vanilla code can notify React.
if (typeof window !== 'undefined') {
  (window as unknown as { __syncAppStateToReact: () => void }).__syncAppStateToReact = () => {
    useAppState.getState().syncFromWindow();
  };
  window.addEventListener('sorted:role-ready', () => {
    useAppState.getState().syncFromWindow();
  });
  window.addEventListener('sorted:signout', () => {
    useAppState.getState().syncFromWindow();
  });
}
