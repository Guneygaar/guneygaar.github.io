import React, { useEffect } from 'react';
import { useAppState } from './core/stores/appState.js';
import { useFlowState } from './flows/create-post/flowStore.js';
import { usePcsFlowState } from './flows/pcs/flowStore.js';
import { CreatePost } from './flows/create-post/CreatePost.jsx';
import { PCS } from './flows/pcs/PCS.jsx';
import { CaptionWorkspace } from './shared/caption-workspace/CaptionWorkspace.jsx';

export default function App() {
  const syncFromWindow = useAppState(s => s.syncFromWindow);
  const createPostOpen = useFlowState(s => s.isOpen);
  const pcsOpen = usePcsFlowState(s => s.isOpen);

  useEffect(() => {
    syncFromWindow();
  }, [syncFromWindow]);

  return (
    <>
      {createPostOpen && <CreatePost />}
      {pcsOpen && <PCS />}
      <CaptionWorkspace />
    </>
  );
}
