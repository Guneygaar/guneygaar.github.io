/* ═══════════════════════════════════════════════
   02-session.js — Mutable runtime state
   ═══════════════════════════════════════════════ */

var allPosts    = [];
var cachedPosts = [];
var currentRole = 'Admin';
var _renderTimer = null;
var _retryCount  = 0;
var _retryTimer  = null;

var _unreadCount   = 0;
var _realtimeTimer = null;
var allTasks       = [];
var _modalOpen     = false;   // true while any overlay/PCS is open
var _deferredRender = false;  // true if a render was skipped due to open modal
