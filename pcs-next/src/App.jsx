import React, { useEffect } from 'react';
import { useAppState } from './core/stores/appState.js';

// Still an empty-renderer placeholder for the React tree — real
// UI arrives in PR B1. This version wires the AppState sync so
// the store is hydrated the moment React mounts.

export default function App() {
  const syncFromWindow = useAppState(s => s.syncFromWindow);

  useEffect(() => {
    syncFromWindow();
  }, [syncFromWindow]);

  return null;
}
