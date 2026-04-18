// Orchestration API exposed on window.SortedReact.flows.createPost.
// CreatePost.jsx is rendered by App.jsx when useFlowState().isOpen
// is true — this module just exposes the state-setters.

import { useFlowState } from './flowStore.js';
import { useFormState } from './formStore.js';

export const createPostFlow = {
  open() {
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
