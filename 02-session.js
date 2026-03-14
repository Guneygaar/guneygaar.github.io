/* ═══════════════════════════════════════════════
   02-session.js — Mutable runtime state
   ═══════════════════════════════════════════════ */

window.allPosts        = [];
window.cachedPosts     = [];
window.currentRole     = 'Admin';
window._renderTimer    = null;
window._retryCount     = 0;
window._retryTimer     = null;

window._unreadCount    = 0;
window._realtimeTimer  = null;
window.allTasks        = [];
window._modalOpen      = false;   // true while any overlay/PCS is open
window._deferredRender = false;   // true if a render was skipped due to open modal
