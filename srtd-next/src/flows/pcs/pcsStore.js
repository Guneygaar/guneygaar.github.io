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
  // List of post_id strings PCS can navigate through via prev/next.
  // Populated when PCS is opened from Plan with the current filtered
  // list. Empty when opened from outside Plan (deep link, notification)
  // so the navigation chevrons stay hidden.
  contextList: [],
  // Field names currently mid-flight via useOptimisticPatch. Future
  // post-row realtime refresh paths should check this set and skip
  // any field name in it to avoid clobbering an optimistic edit.
  optimisticFields: new Set(),
  setContextList: (list) => set({ contextList: Array.isArray(list) ? list : [] }),
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
    contextList: [],
    optimisticFields: new Set()
  })
}));
