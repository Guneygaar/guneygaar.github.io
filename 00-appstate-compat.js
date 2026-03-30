(function() {
  // AppState compat layer
  // Aliases for effectiveRole and currentRole
  // will be added here in PR 2 after direct migration.
  // TODO: Remove srtd.io from IS_DEV after AppState Phase C.
  var IS_DEV = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'srtd.io';
  window._appStateDevMode = IS_DEV;
})();
