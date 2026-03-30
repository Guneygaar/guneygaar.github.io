(function() {
  var IS_DEV = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  try {
    delete window.currentRole;
    Object.defineProperty(window, 'currentRole', {
      get: function() { return window.AppState.user.role; },
      set: function(v) { window.AppState.user.role = v; },
      configurable: true
    });
  } catch(e) {
    if (IS_DEV) console.error('Could not alias currentRole.');
  }

  try {
    delete window.effectiveRole;
    Object.defineProperty(window, 'effectiveRole', {
      get: function() { return window.AppState.user.effectiveRole; },
      set: function(v) { window.AppState.user.effectiveRole = v; },
      configurable: true
    });
  } catch(e) {
    if (IS_DEV) console.error('Could not alias effectiveRole.');
  }

})();
