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
  activity: [],
  activityError: null,
  // Field names currently mid-flight via useOptimisticPatch. Future
  // post-row realtime refresh paths should check this set and skip
  // any field name in it to avoid clobbering an optimistic edit.
  optimisticFields: new Set(),
  reset: () => set({
    post: null,
    comments: [],
    internalNotes: [],
    reactions: [],
    userRoles: [],
    loading: false,
    error: null,
    commentsError: null,
    notesError: null,
    activity: [],
    activityError: null,
    optimisticFields: new Set()
  })
}));
