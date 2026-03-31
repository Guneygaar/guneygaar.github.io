(function() {
  // AppState compat layer
  // Aliases for effectiveRole and currentRole
  // will be added here in PR 2 after direct migration.
  // TODO: Remove srtd.io from IS_DEV after AppState Phase C.
  var IS_DEV = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'srtd.io';
  window._appStateDevMode = IS_DEV;

  if (IS_DEV) {
    try {
      delete window.effectiveRole;
      Object.defineProperty(window, 'effectiveRole', {
        get: function() {
          console.error('ILLEGAL READ: effectiveRole — use window.AppState.user.effectiveRole');
          console.trace();
          return undefined;
        },
        set: function(v) {
          console.error('ILLEGAL WRITE: effectiveRole — use window.AppState.user.effectiveRole');
          console.trace();
        },
        configurable: true
      });
    } catch(e) {}

    try {
      delete window.currentRole;
      Object.defineProperty(window, 'currentRole', {
        get: function() {
          console.error('ILLEGAL READ: currentRole — use window.AppState.user.role');
          console.trace();
          return undefined;
        },
        set: function(v) {
          console.error('ILLEGAL WRITE: currentRole — use window.AppState.user.role');
          console.trace();
        },
        configurable: true
      });
    } catch(e) {}
  }

  if (window._appStateDevMode) {
    try {
      Object.defineProperty(window, 'allPosts', {
        get: function() {
          console.error('ILLEGAL READ: allPosts');
          console.trace();
          if (typeof showToast === 'function') {
            showToast('ILLEGAL READ: allPosts', 'error');
          }
          return undefined;
        },
        set: function() {
          console.error('ILLEGAL WRITE: allPosts');
          console.trace();
        },
        configurable: true
      });
    } catch(e) {}

    try {
      Object.defineProperty(window, 'cachedPosts', {
        get: function() {
          console.error('ILLEGAL READ: cachedPosts');
          console.trace();
          if (typeof showToast === 'function') {
            showToast('ILLEGAL READ: cachedPosts', 'error');
          }
          return undefined;
        },
        set: function() {
          console.error('ILLEGAL WRITE: cachedPosts');
          console.trace();
        },
        configurable: true
      });
    } catch(e) {}
  }
})();
