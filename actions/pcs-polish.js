/* ═══════════════════════════════════════════════════════════════
   pcs-polish.js — legacy polish-modal shim (20260417o)
   The Polish Reply half-modal has been replaced by the inline
   Claude composer flow. The sparkle on the composer now calls
   `window._claudePolish(text)` directly and mounts a polish-preview
   card above the composer. This file is kept as a no-op shim so
   any stale HTML attribute or third-party reference to
   `openPolishModal` / `closePolishModal` / `sendPolished` etc. does
   not throw. The legacy `.pcs-ibar-polish` click handler is also
   a no-op — those DOM nodes were removed from index.html in the
   same deploy.
   ═══════════════════════════════════════════════════════════════ */
console.log('LOADED:', 'pcs-polish.js');

window._polishState = {
  isOpen: false,
  rawText: '',
  polishedText: '',
  zone: null,
  replyTo: null,
  postId: null
};

window.openPolishModal = function() { /* no-op — inline flow now owns polish */ };
window.closePolishModal = function() { /* no-op */ };
window.undoPolish = function() { /* no-op */ };
window.sendPolished = function() { /* no-op */ };
