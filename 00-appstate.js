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
    activeMenu: null,
    openedFrom: null
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
    dashDatetime: null,
    renderTimer: null
  },

  // Workspace-level feature flags + metadata loaded once on login via
  // loadWorkspaceSettings() (05-api.js). Initialised to an empty object
  // so AI feature gates can safely read `AppState.workspace.ai_writer`
  // even before the post-login fetch resolves.
  workspace: {}

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
  var _url = 'https://vxokfscjzytpgdrmertk.supabase.co/rest/v1/error_log';
  var _key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4b2tmc2Nqenl0cGdkcm1lcnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzE2NzAsImV4cCI6MjA4ODkwNzY3MH0.j1LKb2FOarLIi5DDChiWF_DTihKdLCEQMKdy9M5JQkw';
  fetch(_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': _key,
      'Authorization': 'Bearer ' + _key,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(_payload)
  }).catch(function(){});
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

// Click-analytics session id (click_log telemetry, Apr 5 2026)
window._sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);

// Per-action in-flight guard (CTO-approved pattern Apr 5 2026)
// Prevents duplicate async calls from rapid taps or double-clicks.
// Usage: guardAction('unique-key', () => myAsyncFunction())
const _inFlight = new Set();
window.guardAction = function(key, fn) {
  if (_inFlight.has(key)) return;
  _inFlight.add(key);
  Promise.resolve(fn())
    .catch(function(err) {
      console.error('[guardAction] Error:', key, err);
      if (typeof window.logError === 'function') {
        window.logError('[guardAction] ' + key, err);
      }
      if (typeof window.showToast === 'function') {
        window.showToast('Something went wrong', 'error');
      }
      if (window._clickBuffer) {
        window._clickBuffer.push({
          action:     key,
          success:    false,
          error:      err.message || String(err),
          created_at: new Date().toISOString()
        });
      }
    })
    .finally(function() {
      _inFlight.delete(key);
    });
};
