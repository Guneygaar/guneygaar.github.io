// Orchestration API exposed on window.SortedReact.flows.createPost.
// CreatePost.jsx renders when useFlowState().isOpen is true.

import { useFlowState } from './flowStore.js';
import { useFormState, loadDraft } from './formStore.js';
import { useAppState } from '../../core/stores/appState.js';
import { logClick } from '../../core/bridges/logging.js';

function _hasMeaningfulDraft(d) {
  if (!d || typeof d !== 'object') return false;
  const fields = ['title', 'pillar', 'location', 'caption', 'driveLink', 'internalNotes'];
  for (const k of fields) {
    const v = d[k];
    if (typeof v === 'string' && v.trim()) return true;
  }
  if (Array.isArray(d.photos) && d.photos.length > 0) return true;
  return false;
}

export const createPostFlow = {
  open() {
    // Refresh the Zustand appState from window.AppState BEFORE
    // opening. This catches role/email changes that happened
    // after React mount (e.g. auth completing after bundle
    // load). Without this, submit can fail "Not signed in"
    // even when the user is signed in.
    useAppState.getState().syncFromWindow();

    // B5.5a.1: reset the form first, then stash any saved draft
    // into `pendingDraft`. CreatePost.jsx renders a banner letting
    // the user Restore / Start fresh. This avoids the surprise of
    // re-opening the modal and seeing stale data without warning.
    const draft = loadDraft();
    const hasDraft = _hasMeaningfulDraft(draft);
    useFormState.getState().reset();
    if (hasDraft) {
      useFormState.setState({ pendingDraft: draft });
    }

    logClick('fab_tap_react', { hadDraft: hasDraft });

    useFlowState.getState().open();
  },
  close() {
    useFlowState.getState().close();
  },
  isOpen() {
    return useFlowState.getState().isOpen;
  }
};
