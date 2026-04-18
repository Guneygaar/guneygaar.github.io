import React, { useEffect } from 'react';
import { useAppState } from './core/stores/appState.js';
import { useFlowState } from './flows/create-post/flowStore.js';
import { CreatePost } from './flows/create-post/CreatePost.jsx';
import { CaptionWorkspace } from './shared/caption-workspace/CaptionWorkspace.jsx';

// Root React tree. Hydrates AppState on mount, then conditionally
// renders active flows based on each flow's isOpen state. Shared
// overlays (CaptionWorkspace) mount unconditionally and gate their
// own visibility from their store — so they can float over any
// flow without the flow component needing to know about them.

export default function App() {
  const syncFromWindow = useAppState(s => s.syncFromWindow);
  const createPostOpen = useFlowState(s => s.isOpen);

  useEffect(() => {
    syncFromWindow();
  }, [syncFromWindow]);

  return (
    <>
      {createPostOpen && <CreatePost />}
      <CaptionWorkspace />
    </>
  );
}
