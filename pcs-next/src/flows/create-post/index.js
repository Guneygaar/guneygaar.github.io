// Orchestration API exposed on window.SortedReact.flows.createPost.
// CreatePost.jsx renders when useFlowState().isOpen is true.

import { useFlowState } from './flowStore.js';
import { useFormState, loadDraft } from './formStore.js';
import { useAppState } from '../../core/stores/appState.js';

export const createPostFlow = {
  open() {
    // Refresh the Zustand appState from window.AppState BEFORE
    // opening. This catches role/email changes that happened
    // after React mount (e.g. auth completing after bundle
    // load). Without this, submit can fail "Not signed in"
    // even when the user is signed in.
    useAppState.getState().syncFromWindow();

    // B4: hydrate from draft if present, else reset to initial.
    // Cancel/Esc/backdrop close do NOT clear the draft, so the
    // user's in-flight typing survives accidental dismissal.
    const draft = loadDraft();
    if (draft && typeof draft === 'object') {
      useFormState.setState({
        form: draft,
        importOpen: false, ownerOpen: false, stageOpen: false,
        pillarOpen: false, formatOpen: false, locationOpen: false,
        submitting: false, toast: null,
        sessionStart: new Date().toISOString(),
        sessionCost: 0,
        sessionCalls: 0,
        pasteSheetOpen: false,
        gmailSheetOpen: false
      });
    } else {
      useFormState.getState().reset();
    }

    useFlowState.getState().open();
  },
  close() {
    useFlowState.getState().close();
  },
  isOpen() {
    return useFlowState.getState().isOpen;
  }
};
