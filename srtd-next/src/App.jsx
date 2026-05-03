import React, { useEffect, useMemo } from 'react';
import { useAppState, useUser } from './core/stores/appState';
import { useFlowState } from './flows/create-post/flowStore.js';
import { usePcsFlowState } from './flows/pcs/flowStore.js';
import { CreatePost } from './flows/create-post/CreatePost.jsx';
import { PCS } from './flows/pcs/PCS.jsx';
import { CaptionWorkspace } from './shared/caption-workspace/CaptionWorkspace.jsx';
import { Toast } from './core/ui/Toast.jsx';
import Plan from './flows/plan/Plan.jsx';
import { isAuthed } from './lib/auth';

export default function App() {
  const syncFromWindow = useAppState(s => s.syncFromWindow);
  const createPostOpen = useFlowState(s => s.isOpen);
  const pcsOpen = usePcsFlowState(s => s.isOpen);

  const planEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('plan_react') !== '0';
    } catch (e) {
      return false;
    }
  }, []);

  // Dual-path auth gate. isAuthed() snapshots tokens at first render so the
  // app boots immediately when localStorage carries valid creds (covers E2E
  // mocks + session resume). useUser() subscribes to the Zustand store —
  // when sorted:role-ready fires post-activateRole, the listener in
  // appState.ts pulls fresh user into the store, forcing this re-render so
  // role-aware components see truthy user?.role without any App-level
  // event listener of its own. signout clears localStorage AND the store
  // user (via sorted:signout listener), so both terms collapse to false
  // simultaneously.
  const user = useUser();
  const authed = !!user?.role || isAuthed();

  useEffect(() => {
    syncFromWindow();
  }, [syncFromWindow]);

  useEffect(() => {
    if (!planEnabled) return;
    const panel = document.getElementById('panel-pipeline');
    if (panel) panel.style.display = 'flex';
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('plan-active');
    }
  }, [planEnabled]);

  return (
    <>
      {createPostOpen && authed && <CreatePost />}
      {pcsOpen && authed && <PCS />}
      <CaptionWorkspace />
      <Toast />
      {planEnabled && authed && <Plan />}
    </>
  );
}
