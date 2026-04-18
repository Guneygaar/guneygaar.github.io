// Orchestration API exposed on window.SortedReact.flows.createPost.
// CreatePost.jsx renders when useFlowState().isOpen is true.

import { useFlowState } from './flowStore.js';
import { useFormState } from './formStore.js';
import { useAppState } from '../../core/stores/appState.js';

export const createPostFlow = {
  open() {
    // Refresh the Zustand appState from window.AppState BEFORE
    // opening. This catches role/email changes that happened
    // after React mount (e.g. auth completing after bundle
    // load). Without this, submit can fail "Not signed in"
    // even when the user is signed in.
    useAppState.getState().syncFromWindow();
    useFormState.getState().reset();
    useFlowState.getState().open();
  },
  close() {
    useFlowState.getState().close();
  },
  isOpen() {
    return useFlowState.getState().isOpen;
  }
};
