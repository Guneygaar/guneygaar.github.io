import React, { useEffect, useMemo, useState } from 'react';
import { useAppState, useUser } from './core/stores/appState';
import { useFlowState } from './flows/create-post/flowStore.js';
import { usePcsFlowState } from './flows/pcs/flowStore.js';
import { CreatePost } from './flows/create-post/CreatePost.jsx';
import { PCS } from './flows/pcs/PCS.jsx';
import { CaptionWorkspace } from './shared/caption-workspace/CaptionWorkspace.jsx';
import { Toast } from './core/ui/Toast.jsx';
import Plan from './flows/plan/Plan.jsx';
import { isAuthed } from './lib/auth';

// useUser is exported for components that need a fresh role/email post-login.
// App.jsx itself keeps the token-based authed snapshot to preserve E2E mount
// timing — useUser added consumers must opt in explicitly. App-level gate stays
// on isAuthed() + sorted:signin/sorted:signout listeners (PR #1101 contract).
export default function App() {
  const syncFromWindow = useAppState(s => s.syncFromWindow);
  const createPostOpen = useFlowState(s => s.isOpen);
  const pcsOpen = usePcsFlowState(s => s.isOpen);
  // Subscribe but ignore — keeps the bundle reference live so tree-shaking
  // does not drop useUser. Real consumers in PCS / CreatePost own their own
  // hook calls.
  useUser();

  const planEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('plan_react') !== '0';
    } catch (e) {
      return false;
    }
  }, []);

  const [authed, setAuthed] = useState(isAuthed());

  useEffect(() => {
    const refresh = () => setAuthed(isAuthed());
    window.addEventListener('sorted:signin', refresh);
    window.addEventListener('sorted:signout', refresh);
    return () => {
      window.removeEventListener('sorted:signin', refresh);
      window.removeEventListener('sorted:signout', refresh);
    };
  }, []);

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
