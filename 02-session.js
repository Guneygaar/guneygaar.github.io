/* ═══════════════════════════════════════════════
   02-session.js — Mutable runtime state
═══════════════════════════════════════════════ */

let allPosts    = [];
let cachedPosts = [];
let currentRole = 'Admin';
let _renderTimer = null;
let _retryCount  = 0;
let _retryTimer  = null;

let _unreadCount   = 0;
let _realtimeTimer = null;
let allTasks       = [];
