/* ===============================================
   02-session.js  -  Mutable runtime state
   =============================================== */
console.log("LOADED:", "02-session.js");

window.window.AppState.posts.all        = [];
window.window.AppState.posts.cached     = [];
window.AppState.user.role     = 'Admin';
// Admin-only role preview  -  overrides UI visibility without touching auth
window.AppState.user.effectiveRole   = localStorage.getItem('pcs_role_preview') || '';
window.AppState.timers.renderTimer    = null;
window._retryCount     = 0;
window._retryTimer     = null;

window.AppState.ui.unreadCount    = 0;
window.AppState.timers.realtimeTimer  = null;
window.allTasks        = [];
window.AppState.ui.modalOpen      = false;   // true while any overlay/PCS is open
window._deferredRender = false;   // true if a render was skipped due to open modal
