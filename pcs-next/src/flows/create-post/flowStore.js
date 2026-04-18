// Tracks whether the Create Post modal is currently open. Tiny
// store on purpose — separate from form state so opening doesn't
// trigger form-state re-renders and vice versa.

import { create } from 'zustand';

export const useFlowState = create((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false })
}));
