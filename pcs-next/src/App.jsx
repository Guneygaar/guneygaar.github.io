import React, { useEffect } from 'react';
import { useAppState } from './core/stores/appState.js';
import { useFlowState } from './flows/create-post/flowStore.js';
import { CreatePost } from './flows/create-post/CreatePost.jsx';

// Root React tree. Hydrates AppState on mount, then conditionally
// renders active flows based on each flow's isOpen state. Only
// one flow renders at a time today — future flows will follow
// the same pattern.

export default function App() {
  const syncFromWindow = useAppState(s => s.syncFromWindow);
  const createPostOpen = useFlowState(s => s.isOpen);

  useEffect(() => {
    syncFromWindow();
  }, [syncFromWindow]);

  return (
    <>
      {createPostOpen && <CreatePost />}
    </>
  );
}
