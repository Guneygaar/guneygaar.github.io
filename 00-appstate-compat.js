(function() {
  // TODO: Remove srtd.io after AppState Phase C is complete
  var IS_DEV = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'srtd.io';

  try {
    delete window.currentRole;
    Object.defineProperty(window, 'currentRole', {
      get: function() { return window.AppState.user.role; },
      set: function(v) { window.AppState.user.role = v; },
      configurable: true
    });
  } catch(e) {
    if (IS_DEV) console.error('Could not alias currentRole. Check for var currentRole at global scope.');
  }

  try {
    delete window.effectiveRole;
    Object.defineProperty(window, 'effectiveRole', {
      get: function() { return window.AppState.user.effectiveRole; },
      set: function(v) { window.AppState.user.effectiveRole = v; },
      configurable: true
    });
  } catch(e) {
    if (IS_DEV) console.error('Could not alias effectiveRole. Check for var effectiveRole at global scope.');
  }

})();
