import React, { useEffect, useMemo } from 'react';
import { useAppState, useUser } from './core/stores/appState';
import { useFlowState } from './flows/create-post/flowStore.js';
import { usePcsFlowState } from './flows/pcs/flowStore.js';
import { CreatePost } from './flows/create-post/CreatePost.jsx';
import { PCS } from './flows/pcs/PCS.jsx';
import { CaptionWorkspace } from './shared/caption-workspace/CaptionWorkspace.jsx';
import { Toast } from './core/ui/Toast.jsx';
import Plan from './flows/plan/Plan.jsx';

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

  const user = useUser();
  const authed = !!user?.role;

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
