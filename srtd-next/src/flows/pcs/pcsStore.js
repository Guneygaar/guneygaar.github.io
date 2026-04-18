import { create } from 'zustand';
export const usePcsStore = create((set) => ({
  post: null,
  comments: [],
  internalNotes: [],
  reactions: [],
  userRoles: [],
  loading: false,
  error: null,
  commentsError: null,
  notesError: null,
  reset: () => set({ post: null, comments: [], internalNotes: [], reactions: [], userRoles: [], loading: false, error: null, commentsError: null, notesError: null })
}));
