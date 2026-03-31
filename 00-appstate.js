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
    activityFetched: false,
    setAll: function(newPosts) {
      if (window._appStateDevMode) {
        var ids = newPosts.map(function(p) { return p.post_id; });
        var uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
          console.warn('LEGACY STATE WARNING: Duplicate post_ids detected entering AppState.posts.all. Check API polling logic.');
        }
      }
      window.AppState.posts.all = newPosts;
    }
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
