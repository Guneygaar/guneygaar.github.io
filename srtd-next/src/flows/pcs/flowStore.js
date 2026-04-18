import { create } from 'zustand';
export const usePcsFlowState = create((set) => ({
  isOpen: false,
  postId: null,
  open: (postId) => set({ isOpen: true, postId }),
  close: () => set({ isOpen: false, postId: null })
}));
