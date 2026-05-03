import { describe, it, expect, beforeEach } from 'vitest';
import { useAppState } from '../srtd-next/src/core/stores/appState.ts';

// Runtime guard for the syncFromWindow spread fix (#1108).
//
// Vanilla activateRole() in 03-auth.js mutates window.AppState.user in
// place (e.g. user.role = 'Admin'). Before the fix, syncFromWindow
// passed that same object reference to Zustand's set(), so Object.is
// equality short-circuited the update and React subscribers (App.jsx
// useUser()) never re-rendered after sorted:role-ready — Plan stayed
// unmounted on fresh OTP sign-in. The fix spreads user/workspace so
// every sync produces a new reference and Zustand fires.

describe('appState.syncFromWindow', () => {
  beforeEach(() => {
    window.AppState = { user: null, workspace: null };
    useAppState.setState({ user: null, workspace: null, hydrated: false });
  });

  it('produces a NEW user object reference after each sync', () => {
    window.AppState.user = { name: 'X', email: 'x@y.z', role: 'Admin', effectiveRole: 'Admin' };
    useAppState.getState().syncFromWindow();
    const first = useAppState.getState().user;
    expect(first).not.toBe(window.AppState.user);
    expect(first.role).toBe('Admin');

    // In-place mutation (mirrors activateRole behaviour) followed by
    // re-sync must surface a fresh reference so Zustand fires set().
    window.AppState.user.role = 'Servicing';
    window.AppState.user.effectiveRole = 'Servicing';
    useAppState.getState().syncFromWindow();
    const second = useAppState.getState().user;
    expect(second).not.toBe(first);
    expect(second.role).toBe('Servicing');
    expect(second.effectiveRole).toBe('Servicing');
  });

  it('produces a NEW workspace object reference after each sync', () => {
    window.AppState.workspace = { id: 'ws-1', slug: 'default' };
    useAppState.getState().syncFromWindow();
    const first = useAppState.getState().workspace;
    expect(first).not.toBe(window.AppState.workspace);
    expect(first.slug).toBe('default');

    window.AppState.workspace.slug = 'other';
    useAppState.getState().syncFromWindow();
    const second = useAppState.getState().workspace;
    expect(second).not.toBe(first);
    expect(second.slug).toBe('other');
  });

  it('Zustand subscribe fires after an in-place mutation + sync', () => {
    window.AppState.user = { name: 'X', email: 'x@y.z', role: 'Client', effectiveRole: 'Client' };
    useAppState.getState().syncFromWindow();

    let callCount = 0;
    const unsub = useAppState.subscribe(() => { callCount++; });
    window.AppState.user.role = 'Admin';
    window.AppState.user.effectiveRole = 'Admin';
    useAppState.getState().syncFromWindow();
    unsub();
    // Without the spread fix, set() would receive the same user reference
    // and Object.is short-circuit would prevent the listener firing.
    expect(callCount).toBeGreaterThanOrEqual(1);
  });

  it('hydrated flips true on first sync and stays true', () => {
    window.AppState.user = { name: 'X', email: 'x@y.z', role: 'Admin' };
    expect(useAppState.getState().hydrated).toBe(false);
    useAppState.getState().syncFromWindow();
    expect(useAppState.getState().hydrated).toBe(true);
  });

  it('returns null when window.AppState.user is missing', () => {
    window.AppState = {};
    useAppState.getState().syncFromWindow();
    expect(useAppState.getState().user).toBeNull();
    expect(useAppState.getState().workspace).toBeNull();
  });
});
