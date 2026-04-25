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
  // Comment ids currently expanded via Read more. Hoisted out of
  // CommentRow local state so realtime echoes that remount the row
  // do not collapse the expansion.
  expandedComments: new Set(),
  toggleExpanded: (id) => set((s) => {
    const next = new Set(s.expandedComments);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { expandedComments: next };
  }),
  // Monotonic counter; CaptionBlock subscribes and enters inline edit
  // mode whenever the value increments past the last seen tick.
  captionEditRequested: 0,
  requestCaptionEdit: () => set((s) => ({ captionEditRequested: s.captionEditRequested + 1 })),
  // Anchor request channel: Composer reads pendingAnchor whenever
  // anchorRequested ticks past the last seen value, then renders the
  // chip ("Replying to caption/photo"). Mirrors captionEditRequested.
  // pendingAnchor shape:
  //   caption: { type:'caption', text, char_start, char_end }
  //   photo:   { type:'photo',   image_index, x_pct, y_pct }
  anchorRequested: 0,
  pendingAnchor: null,
  requestAnchor: (payload) => set((s) => ({
    anchorRequested: s.anchorRequested + 1,
    pendingAnchor: payload || null,
  })),
  clearAnchor: () => set({ pendingAnchor: null }),
  // Comment id to flash (highlight pulse) — used when a caption mark
  // or photo dot is tapped to draw the eye to the matching thread row.
  flashCommentId: null,
  flashComment: (id) => set({ flashCommentId: id || null }),
  // Carousel scroll request: PhotoStrip subscribes and scrolls to the
  // requested image_index whenever the counter ticks. Used when an
  // anchor badge in a comment row is tapped.
  carouselScrollRequested: 0,
  carouselScrollTarget: 0,
  requestCarouselScroll: (idx) => set((s) => ({
    carouselScrollRequested: s.carouselScrollRequested + 1,
    carouselScrollTarget: typeof idx === 'number' ? idx : 0,
  })),
  // CaptionBlock subscribes; on tick, flips showFull=true so a
  // clamped caption unfurls before the anchor mark scrolls into view.
  captionExpandRequested: 0,
  requestCaptionExpand: () => set((s) => ({
    captionExpandRequested: s.captionExpandRequested + 1,
  })),
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
    optimisticFields: new Set(),
    expandedComments: new Set(),
    captionEditRequested: 0,
    anchorRequested: 0,
    pendingAnchor: null,
    flashCommentId: null,
    carouselScrollRequested: 0,
    carouselScrollTarget: 0,
    captionExpandRequested: 0,
  })
}));
