window.AppState = {

  user: {
    name: null,
    email: null,
    role: null,
    effectiveRole: null,
    previewRole: null
  },

  posts: {
    all: [],
    cached: [],
    loaded: false,
    source: null,
    parked: [],
    activityLogs: [],
    activityFetched: false
  },

  pcs: {
    open: false,
    postId: null,
    post: null,
    editingTarget: null,
    closeTimer: null,
    pendingComment: null,
    lightbox: {
      images: [],
      index: 0
    },
    activeMenu: null
  },

  ui: {
    modalOpen: false,
    deferredRender: false,
    activeTab: null,
    taskFilter: null,
    pipelineFilter: [],
    nrsUrgency: 'normal',
    retryCount: 0,
    retryTimer: null,
    realtimeTimer: null,
    unreadCount: 0
  },

  timers: {
    tokenRefresh: null,
    dashDatetime: null,
    renderTimer: null
  }

};
