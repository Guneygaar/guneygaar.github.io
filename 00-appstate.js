window.AppState = window.AppState || {

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

// -- Global error logging to Supabase error_log table --
window.logError = function(message, stack, action) {
  var _s = document.querySelector('script[src*="?v="]');
  var _version = _s ? _s.src.split('?v=')[1] : 'unknown';
  var _payload = {
    error_message: String(message || 'Unknown error').slice(0, 500),
    error_stack:   String(stack || '').slice(0, 2000),
    user_email:    (window.AppState && window.AppState.user.email) || 'unknown',
    user_role:     (window.AppState && window.AppState.user.effectiveRole) || 'unknown',
    page:          window.location.pathname || '/',
    action:        String(action || 'uncaught'),
    app_version:   _version
  };
  setTimeout(function() {
    if (window.apiFetch) {
      window.apiFetch('/error_log', {
        method: 'POST',
        body: JSON.stringify(_payload)
      }).catch(function(){});
    }
  }, 0);
  window._showErrorToast && window._showErrorToast();
};

window.onerror = function(message, source, lineno, colno, error) {
  var _stack = error ? (error.stack || '') : (source + ':' + lineno);
  window.logError(message, _stack, 'window.onerror');
  return false;
};

window.onunhandledrejection = function(event) {
  var _msg = event.reason ?
    (event.reason.message || String(event.reason))
    : 'Unhandled promise rejection';
  var _stack = event.reason ? (event.reason.stack || '') : '';
  window.logError(_msg, _stack, 'unhandledrejection');
};
