/* ===============================================
   10-ui.js - Toast, tabs, timeline, zen & utils
   =============================================== */
console.log("LOADED:", "10-ui.js");

// -- Error banner ------------------------------
function showErrorBanner(msg, sub) {
  const b = document.getElementById('error-banner');
  if (!b) return;
  const m = b.querySelector('.error-banner-msg');
  if (m) m.textContent = msg;
  const s = b.querySelector('.error-banner-sub');
  if (s) s.textContent = sub || '';
  b.classList.remove('hidden');
}
function hideErrorBanner() {
  document.getElementById('error-banner')?.classList.add('hidden');
}

// -- Click-log telemetry buffer ----------------
window._clickBuffer = [];

function _flushClickBuffer() {
  if (!window._clickBuffer.length) return;
  if (!localStorage.getItem('sb_access_token')) return;
  var batch = window._clickBuffer.splice(0);
  var user = AppState.user || {};
  var payload = batch.map(function(entry) {
    return {
      session_id:    window._sessionId || 'unknown',
      action:        entry.action,
      data:          entry.data || null,
      user_email:    user.email || null,
      user_role:     user.effectiveRole || null,
      post_id:       entry.post_id || null,
      success:       entry.success !== false,
      error_message: entry.error || null,
      duration_ms:   entry.duration_ms || null,
      page:          window.location.pathname || '/',
      device_type:   window.innerWidth <= 768 ? 'mobile' : 'desktop',
      app_version:   (document.querySelector('script[src*="?v="]') || {}).src
                     ? document.querySelector('script[src*="?v="]').src.split('?v=')[1] : null,
      created_at:    entry.created_at
    };
  });
  if (typeof apiFetch === 'function') {
    apiFetch('/click_log', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify(payload)
    }, { allowLogout: false }).catch(function(err){
      console.warn('[click_log] insert failed:', err && err.message);
    });
  }
}

setInterval(_flushClickBuffer, 5000);

window.addEventListener('beforeunload', function() {
  if (!window._clickBuffer.length) return;
  var user = AppState.user || {};
  var payload = window._clickBuffer.map(function(entry) {
    return {
      session_id:    window._sessionId || 'unknown',
      action:        entry.action,
      data:          entry.data || null,
      user_email:    user.email || null,
      user_role:     user.effectiveRole || null,
      post_id:       entry.post_id || null,
      success:       entry.success !== false,
      error_message: entry.error || null,
      duration_ms:   entry.duration_ms || null,
      page:          window.location.pathname || '/',
      device_type:   window.innerWidth <= 768 ? 'mobile' : 'desktop',
      app_version:   null,
      created_at:    entry.created_at
    };
  });
  fetch(SUPABASE_URL + '/rest/v1/click_log', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(payload)
  }).catch(function(){});
});

window._showErrorToast = function() {
  if (document.getElementById('sorted-error-toast')) return;
  var _t = document.createElement('div');
  _t.id = 'sorted-error-toast';
  _t.style.cssText = [
    'position:fixed', 'bottom:80px', 'left:50%',
    'transform:translateX(-50%)',
    'background:#1a0a0a', 'border:1px solid #FF4B4B',
    'color:#E8E8E8', 'font-family:DM Sans,sans-serif',
    'font-size:13px', 'padding:10px 16px', 'z-index:99999',
    'max-width:320px', 'width:90%', 'text-align:center',
    'border-radius:0'
  ].join(';');
  _t.textContent = 'Something went wrong — our team has been notified.';
  document.body.appendChild(_t);
  setTimeout(function() {
    _t.style.transition = 'opacity 0.4s';
    _t.style.opacity = '0';
    setTimeout(function() {
      _t.parentNode && _t.parentNode.removeChild(_t);
    }, 400);
  }, 4000);
};

// -- Safe render --------------------------------
function safeRender() {
  try { renderAll(); } catch (err) { console.error('renderAll error:', err); }
}

function scheduleRender() {
  if (window.AppState.ui.modalOpen) { window._deferredRender = true; return; }
  clearTimeout(window.AppState.timers.renderTimer);
  window.AppState.timers.renderTimer = setTimeout(safeRender, 60);
}

function _drainDeferredRender() {
  if (window._deferredRender) {
    window._deferredRender = false;
    clearTimeout(window.AppState.timers.renderTimer);
    window.AppState.timers.renderTimer = setTimeout(safeRender, 60);
  }
  // Also drain any poll data that was stashed while a modal was open.
  // _drainPollStash is a no-op when there is nothing stashed, so this is
  // safe to call from every modal-close site.
  if (typeof window._drainPollStash === 'function') window._drainPollStash();
}

// -- Undo toast --------------------------------
let _undoFn   = null;
let _undoTimer = null;

function showUndoToast(msg, undoFn) {
  clearTimeout(_undoTimer);
  _undoFn = undoFn;
  const t = document.getElementById('undo-toast');
  if (!t) return;
  const um = t.querySelector('.undo-toast-msg');
  if (um) um.textContent = msg;
  t.classList.add('active');
  _undoTimer = setTimeout(() => t.classList.remove('active'), 5000);
}

function triggerUndo() {
  clearTimeout(_undoTimer);
  document.getElementById('undo-toast')?.classList.remove('active');
  if (_undoFn) { _undoFn(); _undoFn = null; }
}

// -- Toast -------------------------------------
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent  = msg;
  t.className    = `toast toast-${type} active`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('active'), 3200);
}

// -- Theme -------------------------------------
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('hinglish_theme', next);
}
(function applyTheme() {
  const saved = localStorage.getItem('hinglish_theme') || 'light';
  document.documentElement.dataset.theme = saved;
})();

// -- User menu ---------------------------------
function toggleUserMenu() {
  var m = document.getElementById('user-menu');
  if (!m) return;
  if (typeof _buildUserMenu === 'function') _buildUserMenu();
  var isOpen = m.style.display === 'block';
  if (isOpen) {
    m.style.display = 'none';
    return;
  }
  m.style.display = 'block';
  setTimeout(function() {
    document.addEventListener('click', function _close(e) {
      var trigger = document.getElementById('prof-trigger');
      if (!m.contains(e.target) && !(trigger && trigger.contains(e.target))) {
        m.style.display = 'none';
        document.removeEventListener('click', _close);
      }
    });
  }, 0);
}
function closeUserMenu() {
  var m = document.getElementById('user-menu');
  if (m) m.style.display = 'none';
}


// -- Global Admin Menu -------------------------
function gamSwitchRole(role) {
  role = typeof normalizeRole === 'function' ? (normalizeRole(role) || role) : role;
  if (role === 'Admin') {
    localStorage.removeItem('pcs_role_preview');
  } else {
    localStorage.setItem('pcs_role_preview', role);
  }
  location.reload();
}
window.gamSwitchRole = gamSwitchRole;


// -- Tabs --------------------------------------
function goToTab(tabName) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) switchTab(btn);
}

function navigateWithFilter(tab, filter) {
  if (tab === 'pipeline' || tab === 'upcoming') {
    window.pcsPipelineFilter = (tab === 'upcoming') ? ['scheduled'] : filter;
    tab = 'pipeline';
  }
  goToTab(tab);
}


const _TAB_TITLES = {
  tasks: null,
  pipeline: 'Pipeline',
  library: 'Library',
  updates: 'Updates',
};

var _isFetchingPosts = false;

function switchTab(btn) {
  if (typeof btn === 'string') {
    btn = document.querySelector('.tab-btn[data-tab="' + btn + '"]');
    if (!btn) return;
  }
  var role = (window.AppState.user.effectiveRole || '').toLowerCase();
  if (role === 'client') {
    var targetTab = typeof btn === 'string' ? btn :
      (btn && btn.dataset ? btn.dataset.tab : '');
    if (targetTab === 'pipeline') {
      // allow pipeline to render for client
      // but hide agency-only header elements first
    } else if (targetTab === 'library') {
      // allow library through
    } else {
      // all other tabs (tasks, insights etc) -> client dashboard
      document.getElementById('dashboard-view')?.classList.remove('active');
      document.getElementById('client-view')?.classList.add('active');
      if (typeof renderClientView === 'function') renderClientView();
      return;
    }
  }
  const dv = document.getElementById('dashboard-view');
  if (dv && !dv.classList.contains('active')) {
    dv.classList.add('active');
    document.getElementById('client-view')?.classList.remove('active');
    document.getElementById('insights-view')?.classList.remove('active');
    document.getElementById('library-view')?.classList.remove('active');
  }
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  const panel = document.getElementById('panel-' + tab);
  if (panel) panel.classList.add('active');
  const titleEl = document.getElementById('app-header-title');
  var greetHdr = document.getElementById('dash-greeting-hdr');
  if (tab === 'pipeline') {
    if (titleEl) titleEl.style.display = 'none';
    if (greetHdr) greetHdr.style.display = 'none';
    var appHdr = document.querySelector('.app-header');
    if (appHdr) appHdr.style.display = 'none';
    // Fetch fresh data so pipeline never shows stale stages
    if (!_isFetchingPosts && typeof loadPosts === 'function') {
      _isFetchingPosts = true;
      loadPosts().then(function() { _isFetchingPosts = false; }).catch(function() { _isFetchingPosts = false; });
    }
  } else if (tab === 'tasks') {
    if (titleEl) titleEl.style.display = 'none';
    if (greetHdr) greetHdr.style.display = '';
    var appHdr = document.querySelector('.app-header');
    if (appHdr) appHdr.style.display = 'flex';
    if (typeof loadPosts === 'function') loadPosts();
  } else {
    if (titleEl) { titleEl.style.display = ''; titleEl.textContent = _TAB_TITLES[tab] || tab; }
    if (greetHdr) greetHdr.style.display = 'none';
    var appHdr = document.querySelector('.app-header');
    if (appHdr) appHdr.style.display = 'none';
  }
  if (tab !== 'pipeline' && typeof closePipelineSearch === 'function') closePipelineSearch();
  if (tab !== 'tasks' && typeof _taskFilter !== 'undefined') {
    window._taskFilter = null;
  }
  if (tab === 'updates') { loadNotifications(); }
  safeRender();
  _fabAttachScroll();
}

// -- Notifications (Updates Tab) ---------------
var _notifChipFilter = 'all';
var _notifData = [];

// Relative time formatter for notification timestamps
function _notifRelTime(iso) {
  if (!iso) return '';
  var then;
  try { then = new Date(iso).getTime(); } catch(e) { return ''; }
  if (!then || isNaN(then)) return '';
  var now = Date.now();
  var diff = Math.floor((now - then) / 1000);
  if (diff < 0) diff = 0;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
  var d = new Date(iso);
  var todayD = new Date(); todayD.setHours(0,0,0,0);
  var yestD = new Date(todayD); yestD.setDate(yestD.getDate()-1);
  var thenD = new Date(d); thenD.setHours(0,0,0,0);
  var h = d.getHours();
  var m = d.getMinutes();
  var ampm = h >= 12 ? 'pm' : 'am';
  var h12 = h % 12 || 12;
  var timeStr = h12 + ':' + (m < 10 ? '0'+m : m) + ampm;
  if (thenD.getTime() === todayD.getTime()) return 'Today ' + timeStr;
  if (thenD.getTime() === yestD.getTime()) return 'Yesterday ' + timeStr;
  var months = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + timeStr;
}

var _NOTIF_MOVES_TYPES = ['stage_change','ready','in_production','scheduled','brief','brief_done'];

// Human-readable stage labels substituted into action text
var _NOTIF_STAGE_LABELS = {
  'brief':                'Brief',
  'brief_done':           'Brief Done',
  'in_production':        'In Production',
  'awaiting_approval':    'Awaiting Approval',
  'awaiting_brand_input': 'Needs Input',
  'ready':                'Ready',
  'scheduled':            'Scheduled',
  'published':            'Published'
};

function _notifActionText(n) {
  var actor = n.actor || '';
  var msg = n.message || '';
  var actionText = msg;
  if (actor && msg.toLowerCase().indexOf(actor.toLowerCase()) === 0) {
    actionText = msg.slice(actor.length).trim();
  }
  Object.keys(_NOTIF_STAGE_LABELS).forEach(function(key) {
    actionText = actionText.replace(new RegExp('\\b' + key + '\\b', 'gi'), _NOTIF_STAGE_LABELS[key]);
  });
  return actionText;
}

function _notifTypeClass(n, isMention) {
  if (isMention) return 'ntype-mention';
  if (n.type === 'comment') return 'ntype-comment';
  if (n.type === 'awaiting_approval' || n.type === 'awaiting_brand_input') return 'ntype-approval';
  if (n.type === 'published') return 'ntype-live';
  return 'ntype-stage';
}

function _notifActorClass(actor) {
  if (!actor) return 'nav-system';
  var role = (typeof getRoleFor === 'function') ? getRoleFor(actor) : '';
  if (!role) {
    var a = (actor || '').toLowerCase();
    if (a === 'manisha' || a === 'shivangini' || a === 'client') role = 'client';
    else if (a === 'chitra' || a === 'servicing') role = 'servicing';
    else if (a === 'pranav' || a === 'creative') role = 'creative';
    else if (a === 'shubham' || a === 'admin') role = 'admin';
  }
  if (role === 'client')    return 'nav-client';
  if (role === 'servicing') return 'nav-chitra';
  if (role === 'creative')  return 'nav-pranav';
  if (role === 'admin')     return 'nav-shubham';
  return 'nav-system';
}

function _notifChipMatch(filter, n, mentionSet) {
  if (filter === 'all') return true;
  if (filter === 'mentions') {
    return n.type === 'comment' && n.post_id && mentionSet && mentionSet.has(n.post_id);
  }
  if (filter === 'comments') return n.type === 'comment';
  if (filter === 'live')     return n.type === 'published';
  if (filter === 'moves')    return _NOTIF_MOVES_TYPES.indexOf(n.type) !== -1;
  return true;
}

var roleDisplayMap = {
  'Admin':      { name: 'Shubham', label: 'Admin - Sorted' },
  'admin':      { name: 'Shubham', label: 'Admin - Sorted' },
  'shubham':    { name: 'Shubham', label: 'Admin - Sorted' },
  'Servicing':  { name: 'Chitra',  label: 'Servicing - Dispatch' },
  'servicing':  { name: 'Chitra',  label: 'Servicing - Dispatch' },
  'chitra':     { name: 'Chitra',  label: 'Servicing - Dispatch' },
  'Creative':   { name: 'Pranav',  label: 'Creative - Production' },
  'creative':   { name: 'Pranav',  label: 'Creative - Production' },
  'pranav':     { name: 'Pranav',  label: 'Creative - Production' },
  'Client':     { name: '',        label: 'Client - Sorted' },
  'client':     { name: '',        label: 'Client - Sorted' }
};

async function loadNotifications() {
  if (!localStorage.getItem('sb_access_token')) return;
  // Reset the per-post thread cache on every panel load so the next expand
  // picks up fresh server state (new comments, resolved flag flips, etc).
  window._notifThreadCache = {};
  try {
    var _notifRole = window.AppState.user.effectiveRole || window.AppState.user.role || 'Admin';
    _notifRole = _notifRole.charAt(0).toUpperCase() + _notifRole.slice(1).toLowerCase();
    var currentName = resolveActor() || 'there';
    var _loadActor = window.AppState.user.name || window.currentUserName || '';
    var _loadUrl = '/notifications?select=id,type,message,read,created_at,post_id,user_role,actor&user_role=eq.' + encodeURIComponent(_notifRole) + '&order=created_at.desc&limit=50';
    if (_loadActor) _loadUrl += '&actor=neq.' + encodeURIComponent(_loadActor);
    var data = await apiFetch(_loadUrl);
    if (!Array.isArray(data)) { console.error('Notifications load error:', data); return; }
    _notifData = data;

    // Batch-fetch post_comments for every post that has a comment notification.
    // SELECT now pulls the extra fields the expand-in-place thread view needs:
    // author_role (for the mini role tag), post_title (fallback for reply payload),
    // resolved + resolved_at (to hide resolved comments from the thread),
    // visibility (so client threads never surface agency-only rows).
    var commentPostIds = [];
    var seen = {};
    data.forEach(function(n) {
      if (n.type === 'comment' && n.post_id && !seen[n.post_id]) {
        seen[n.post_id] = 1;
        commentPostIds.push(n.post_id);
      }
    });
    window._notifComments = [];
    if (commentPostIds.length > 0) {
      try {
        var idList = commentPostIds.join(',');
        var commentUrl = '/post_comments?post_id=in.(' + idList + ')&order=created_at.desc&select=id,post_id,author,author_role,message,created_at,mentioned_users,resolved,resolved_at,visibility,post_title';
        var comments = await apiFetch(commentUrl);
        if (Array.isArray(comments)) window._notifComments = comments;
      } catch (ce) {
        window.logError && window.logError(ce && ce.message, ce && ce.stack, 'load-notif-comments');
      }
    }

    renderNotifications(currentName, _notifRole);
    updateNotifBadge();
  } catch(e) {
    console.error('loadNotifications error:', e);
    window.logError && window.logError(e && e.message, e && e.stack, 'load-notifications');
  }
}

// v6 design — visual-only rewrite. Data fetch, click routing, mark-read,
// and delete paths are untouched. Structural class names + source
// patterns preserved for unit tests (notif-item, notif-live-card,
// nchip-count-*, grouped-comment keys, response-time snippet).
function renderNotifications(name, role) {
  var notifs = _notifData;
  // Expand-in-place state — persisted across innerHTML rebuilds.
  if (!window._notifExpandedSet) window._notifExpandedSet = new Set();
  var _expandedSet = window._notifExpandedSet;
  var effectiveR = window.AppState.user.effectiveRole || window.AppState.user.role || role || 'Admin';
  var titleRole = effectiveR.charAt(0).toUpperCase() + effectiveR.slice(1).toLowerCase();
  var roleLabelEl = document.getElementById('notif-role-label');
  if (roleLabelEl) roleLabelEl.textContent = titleRole.toUpperCase() + ' \xB7 SORTED';
  // Greeting name comes ONLY from AppState.user.name — no hardcoded fallbacks.
  var displayName = (window.AppState.user && window.AppState.user.name) || name || 'there';
  var nameEl = document.getElementById('notif-name');
  if (nameEl) nameEl.textContent = displayName;

  var posts = (window.AppState.posts && window.AppState.posts.all) || [];
  function postFor(pid) {
    if (!pid) return null;
    for (var i = 0; i < posts.length; i++) { if (posts[i].post_id === pid) return posts[i]; }
    return null;
  }

  // Mentions detection from batch-fetched comments
  var currentUserName = (window.AppState.user && (window.AppState.user.name || window.AppState.user.email)) || window.currentUserName || '';
  var mentionPostIds = new Set();
  var commentsArr = window._notifComments || [];
  if (currentUserName) {
    commentsArr.forEach(function(c) {
      if (Array.isArray(c.mentioned_users)) {
        c.mentioned_users.forEach(function(u) {
          if (u && u.toLowerCase() === currentUserName.toLowerCase()) mentionPostIds.add(c.post_id);
        });
      }
    });
  }

  // Pre-compute a map of post_id → non-resolved comment count. Used by
  // `_buildItem` to drive the expand chip (visibility + label).
  // Decoupled from the notification-grouping bucket count so any post
  // with 2+ visible comments gets a chip regardless of how the
  // notifications happen to be split across (post, actor, day) keys.
  var _threadCountMap = {};
  commentsArr.forEach(function(c) {
    if (!c || c.resolved === true || !c.post_id) return;
    _threadCountMap[c.post_id] = (_threadCountMap[c.post_id] || 0) + 1;
  });

  // Tab counts
  var allCount     = notifs.length;
  var mentionCount = 0;
  notifs.forEach(function(n) {
    if (n.type === 'comment' && n.post_id && mentionPostIds.has(n.post_id)) mentionCount++;
  });
  var commentCount = notifs.filter(function(n){ return n.type === 'comment'; }).length;
  var movesCount   = notifs.filter(function(n){ return _NOTIF_MOVES_TYPES.indexOf(n.type) !== -1; }).length;
  function _setChipCount(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = value > 0 ? String(value) : '';
    el.style.display = '';
  }
  _setChipCount('nchip-count-all', allCount);
  _setChipCount('nchip-count-mentions', mentionCount);
  _setChipCount('nchip-count-comments', commentCount);
  _setChipCount('nchip-count-moves', movesCount);

  // Reflect active tab state on the text-tab row (v6 has no chip dots)
  var filter = _notifChipFilter || 'all';
  var _tabsEl = document.getElementById('notif-chips');
  if (_tabsEl) {
    var _tabs = _tabsEl.querySelectorAll('.notif-chip');
    for (var _ti = 0; _ti < _tabs.length; _ti++) {
      var _tb = _tabs[_ti];
      if ((_tb.dataset.filter || 'all') === filter) _tb.classList.add('active');
      else _tb.classList.remove('active');
    }
  }

  var filtered = notifs.filter(function(n) { return _notifChipMatch(filter, n, mentionPostIds); });
  // Filter out System actor (noise)
  filtered = filtered.filter(function(n) {
    return !n.actor || n.actor.toLowerCase() !== 'system';
  });

  var scroll = document.getElementById('notif-list-scroll');
  if (!scroll) return;

  if (filtered.length === 0) {
    scroll.innerHTML =
      '<div class="notif-empty-state">' +
        '<div class="notif-empty-icon">\u2713</div>' +
        '<div class="notif-empty-title">All sorted</div>' +
        '<div class="notif-empty-sub">NOTHING TO SHOW</div>' +
      '</div>';
    return;
  }

  // Group comment + mention notifications by (post_id + actor + day).
  // Mentions are included so @-mention rows also participate in the
  // expand-in-place thread view — they point to the same comment data
  // and should behave identically to plain comments.
  var commentGroupMap = {};
  var nonCommentList = [];
  filtered.forEach(function(n) {
    if (n.type !== 'comment' && n.type !== 'mention') { nonCommentList.push(n); return; }
    var dayKey = n.created_at ? new Date(n.created_at).toDateString() : '';
    var key = (n.post_id||'') + '|' + (n.actor||'') + '|' + dayKey;
    if (!commentGroupMap[key]) commentGroupMap[key] = [];
    commentGroupMap[key].push(n);
  });
  var groupedList = nonCommentList.slice();
  Object.keys(commentGroupMap).forEach(function(k) {
    var arr = commentGroupMap[k];
    arr[0]._groupCount = arr.length;
    groupedList.push(arr[0]);
  });
  groupedList.sort(function(a, b) {
    var ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    var tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  // Day grouping
  var todayStr     = new Date().toDateString();
  var yesterdayStr = new Date(Date.now() - 86400000).toDateString();
  var groups = { today: [], yesterday: [], earlier: [] };
  groupedList.forEach(function(n) {
    var d = n.created_at ? new Date(n.created_at).toDateString() : '';
    if (d === todayStr) groups.today.push(n);
    else if (d === yesterdayStr) groups.yesterday.push(n);
    else groups.earlier.push(n);
  });

  // Meta-row SVG icons (inline so color can differ per unread/read via CSS)
  var WA_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="currentColor"/>' +
    '<path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.108-1.14l-.288-.173-2.98.78.795-2.903-.19-.3A7.96 7.96 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" fill="currentColor"/>' +
    '</svg>';
  var TRASH_ICON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
    '</svg>';

  function _buildItem(n) {
    var post = postFor(n.post_id);
    var postHasImage = !!(post && Array.isArray(post.images) && post.images[0]);
    var postThumb = postHasImage ? post.images[0] : '';
    var postTitle = '';
    if (post && post.title) {
      postTitle = post.title;
    } else if (n.message) {
      var msgLower = (n.message || '').toLowerCase();
      var pubIdx = msgLower.indexOf('published ');
      if (pubIdx !== -1) {
        postTitle = n.message.slice(pubIdx + 10).trim();
      } else {
        var liveIdx = msgLower.indexOf(' is now live');
        if (liveIdx !== -1) {
          postTitle = n.message.slice(0, liveIdx).trim();
        } else {
          postTitle = n.message;
        }
      }
    }
    var actor = n.actor || '';
    var avClass = _notifActorClass(actor);
    var initial = actor ? actor.charAt(0).toUpperCase() : '?';
    var ts = _notifRelTime(n.created_at);

    // Response time for approval-resolved notifications
    var respTimeHtml = '';
    if (n.post_id && n.type === 'scheduled') {
      var sentRow = _notifData.find(function(x) {
        return x.post_id === n.post_id && x.type === 'awaiting_approval';
      });
      if (sentRow && sentRow.created_at && n.created_at) {
        var diffMs = new Date(n.created_at) - new Date(sentRow.created_at);
        if (diffMs > 0) {
          var diffMin = Math.floor(diffMs / 60000);
          if (diffMin < 60) {
            respTimeHtml = '<span class="notif-resp-time"> \xB7 replied in ' + diffMin + ' min</span>';
          } else {
            respTimeHtml = '<span class="notif-resp-time"> \xB7 replied in ' + Math.floor(diffMin / 60) + ' hr</span>';
          }
        }
      }
    }

    var isMention = n.type === 'comment' && n.post_id && mentionPostIds.has(n.post_id);
    var tClass = _notifTypeClass(n, isMention);
    var isPublished = n.type === 'published';
    var groupCount = n._groupCount || 1;

    // Action text (published has its own label above the main line)
    var actionText;
    if (isPublished) {
      actionText = 'published ' + (postTitle || 'post');
    } else if (groupCount > 1) {
      actionText = 'left ' + groupCount + ' comments on ' + (postTitle || 'post');
    } else {
      actionText = _notifActionText(n);
    }

    // Comment preview — no quotes, no italics, ellipsized in CSS
    var previewHtml = '';
    if (n.type === 'comment') {
      var latest = null;
      var list = window._notifComments || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].post_id === n.post_id) { latest = list[i]; break; }
      }
      if (latest && latest.message) {
        var msgPrev = latest.message.length > 80
          ? latest.message.slice(0, 80) + '...'
          : latest.message;
        previewHtml = '<div class="notif-preview">' + esc(msgPrev) +
          (groupCount > 1 ? '<span class="notif-more">+' + (groupCount - 1) + ' more</span>' : '') +
          '</div>';
      }
    }

    // Expand chip — only for grouped comment notifications (>1 comment).
    // Expand chip — gated on `_threadCountMap[post_id]` so any comment
    // or mention notif whose post has 2+ non-resolved comments gets a
    // chip regardless of how the notifications were grouped. Label
    // shows the full thread count, not the grouping bucket count.
    var postThreadCount = (n.post_id && _threadCountMap[n.post_id]) || 0;
    var isExpandable = (n.type === 'comment' || n.type === 'mention') && postThreadCount > 1;
    var isExpanded = isExpandable && _expandedSet.has(n.id);
    var expandChipHtml = '';
    if (isExpandable) {
      expandChipHtml =
        '<button class="expand-chip" data-action="notif-expand"' +
          ' data-notif-id="' + esc(n.id || '') + '" aria-label="Expand thread">' +
          '<svg class="expand-chip-arrow" width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">' +
            '<path d="M2 1l4 3-4 3z" fill="currentColor"/>' +
          '</svg>' +
          '<span class="expand-chip-count">' + postThreadCount + '</span>' +
        '</button>';
    }

    // Meta row — time [chip] [auto-push] <meta-actions>WA trash</meta-actions> [LinkedIn]
    // The `.meta-actions` wrapper groups the icon buttons tight
    // together (2px internal gap) and gets `margin-left: auto` via
    // CSS so it always sits on the right edge of the row. The flex
    // `gap: 10px` on `.notif-meta` handles the spacing between the
    // timestamp, optional expand chip, and the meta-actions unit.
    // No dot separators anywhere.
    var linkedinHtml = '';
    if (isPublished && post && post.linkedin_link) {
      linkedinHtml =
        '<a class="notif-li-link" href="' + esc(post.linkedin_link) + '" target="_blank" rel="noopener"' +
        ' onclick="event.stopPropagation();">LINKEDIN \u2192</a>';
    }
    var waBtn = n.post_id
      ? '<button class="notif-mi-btn" data-action="notif-wa" data-post-id="' + esc(n.post_id) + '" aria-label="Share on WhatsApp">' + WA_ICON + '</button>'
      : '';
    var delBtn = '<button class="notif-mi-btn" data-action="notif-delete" data-notif-id="' + esc(n.id || '') + '" aria-label="Delete">' + TRASH_ICON + '</button>';

    var metaRow = '<div class="notif-meta">' +
      '<span class="notif-time">' + esc(ts) + '</span>' +
      linkedinHtml +
      (isExpandable ? expandChipHtml : '') +
      '<div class="meta-actions">' + waBtn + delBtn + '</div>' +
      '</div>';

    var pubLabel = isPublished
      ? '<div class="notif-pub-label">\u2713 PUBLISHED</div>'
      : '';

    var unreadDot = n.read ? '' : '<span class="nnew-dot" aria-hidden="true"></span>';

    var thumbHtml = postHasImage
      ? '<div class="notif-thumb-wrap"><img class="notif-thumb" src="' + esc(postThumb) + '" onerror="this.style.display=\'none\'"></div>'
      : '';

    var isBriefAttr = n.type === 'new_request' ? ' data-is-brief="1"' : '';
    // notif-live-card retained as a marker class on published rows so the
    // tap delegate still finds them via closest('.notif-item, .notif-live-card').
    var liveMarker = isPublished ? ' notif-live-card' : '';
    var expandableAttr = isExpandable ? ' data-expandable="1"' : '';
    var expandedClass = isExpanded ? ' expanded' : '';

    // Thread drawer — always emitted as a collapsed `<div class="thread-drawer">`
    // for expandable rows, pre-populated with the current thread HTML if the
    // notification is currently in _notifExpandedSet. CSS max-height:0 keeps
    // it hidden until .notif-item.expanded flips it open.
    var threadDrawerHtml = '';
    if (isExpandable) {
      var innerHtml = isExpanded ? _notifBuildThreadHtml(n, post, postTitle) : '';
      threadDrawerHtml = '<div class="thread-drawer">' + innerHtml + '</div>';
    }

    return '<div class="notif-item ' + tClass + liveMarker + (n.read ? ' read' : '') + expandedClass + '"' +
      ' data-notif-id="' + esc(n.id || '') + '"' +
      ' data-post-id="' + esc(n.post_id || '') + '"' +
      ' data-notif-type="' + esc(n.type || '') + '"' +
      expandableAttr +
      isBriefAttr + '>' +
      '<div class="notif-item-row">' +
        (typeof renderAvatar === 'function' ? renderAvatar(actor, getRoleFor(actor), 32, { classes: 'notif-av' }) : '<div class="notif-av ' + avClass + '">' + esc(initial) + '</div>') +
        '<div class="notif-body">' +
          pubLabel +
          '<div class="notif-text">' +
            unreadDot +
            '<strong>' + esc(actor) + '</strong> ' + esc(actionText) +
            respTimeHtml +
          '</div>' +
          previewHtml +
          metaRow +
        '</div>' +
        thumbHtml +
      '</div>' +
      threadDrawerHtml +
    '</div>';
  }

  var html = '';
  if (groups.today.length > 0) {
    html += '<div class="notif-day-label ndl-first">Today</div>';
    groups.today.forEach(function(n) { html += _buildItem(n); });
  }
  if (groups.yesterday.length > 0) {
    html += '<div class="notif-day-label">Yesterday</div>';
    groups.yesterday.forEach(function(n) { html += _buildItem(n); });
  }
  if (groups.earlier.length > 0) {
    html += '<div class="notif-day-label">Earlier</div>';
    groups.earlier.forEach(function(n) { html += _buildItem(n); });
  }
  html += '<div class="notif-foot">That\u2019s everything</div>';
  scroll.innerHTML = html;
}

// ===================================================================
// EXPAND-IN-PLACE THREAD VIEW
// ===================================================================
// Helpers used by renderNotifications + the panel click delegate.
// window._notifExpandedSet — Set of expanded data-notif-id values,
//   persisted across innerHTML rebuilds.
// window._notifThreadCache — { [post_id]: htmlString } cache reset by
//   loadNotifications() so repeat expands skip the filter+sort work.
// ===================================================================

// Inline send-arrow SVG used by the thread drawer reply input.
var _NOTIF_SEND_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"' +
  ' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
  ' stroke-linejoin="round" aria-hidden="true">' +
    '<line x1="22" y1="2" x2="11" y2="13"/>' +
    '<polygon points="22 2 15 22 11 13 2 9 22 2"/>' +
  '</svg>';

// Map an author name OR author_role to a mini-avatar colour class that
// mirrors .notif-av. Kept local to the thread view so the agency-wide
// _notifActorClass stays untouched.
function _notifThreadAvClass(author, authorRole) {
  var role = '';
  if (typeof getRoleFor === 'function') {
    role = getRoleFor(authorRole) || getRoleFor(author);
  }
  if (!role) {
    var a = (author || '').toLowerCase();
    var r = (authorRole || '').toLowerCase();
    if (a === 'manisha' || a === 'shivangini' || r === 'client') role = 'client';
    else if (a === 'chitra' || r === 'servicing') role = 'servicing';
    else if (a === 'pranav' || r === 'creative') role = 'creative';
    else if (a === 'shubham' || r === 'admin') role = 'admin';
  }
  if (role === 'client')    return 'nav-client';
  if (role === 'servicing') return 'nav-chitra';
  if (role === 'creative')  return 'nav-pranav';
  if (role === 'admin')     return 'nav-shubham';
  return 'nav-system';
}

// Render the scrollable list of thread messages for a given notification.
// Shows up to the LATEST 5 non-resolved comments on that post (from any
// author), displayed in chronological order within those 5. If more than
// 5 exist, a "View all N comments" link sits at the top of the drawer
// and opens the full post in PCS / client overlay.
// Relies on window._notifComments populated by loadNotifications.
function _notifBuildThreadHtml(n, post, postTitle) {
  var postId = n && n.post_id;
  if (!postId) return '';
  if (!window._notifThreadCache) window._notifThreadCache = {};
  // Cached HTML uses the latest post_comments + optimistic appends.
  // Cache is keyed per-post so two notifications on the same post share
  // the same rendered thread and stay in sync.
  if (window._notifThreadCache[postId]) return window._notifThreadCache[postId];

  // Filter + sort DESC so `.slice(0,5)` keeps the NEWEST five, then
  // reverse so the oldest of the 5 appears first in display order
  // (chronological within the truncated window).
  var all = (window._notifComments || [])
    .filter(function(c) { return c.post_id === postId && c.resolved !== true; })
    .slice()
    .sort(function(a, b) {
      var ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      var tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  var totalCount = all.length;
  var list = all.slice(0, 5).reverse();

  // Overflow link — only when there are more comments than we display.
  var overflowHtml = '';
  if (totalCount > 5) {
    overflowHtml =
      '<div class="thread-overflow" data-action="notif-open-post"' +
      ' data-post-id="' + esc(postId) + '"' +
      ' data-notif-id="' + esc(n.id || '') + '">' +
      'View all ' + totalCount + ' comments' +
      '</div>';
  }

  var msgsHtml = '';
  if (list.length === 0) {
    msgsHtml = '<div class="thread-empty">No comments yet.</div>';
  } else {
    list.forEach(function(c) {
      msgsHtml += _notifThreadMsgHtml(c);
    });
  }

  // Reply input row + "Open full post" footer link.
  var replyPlaceholder = 'Reply to ' + (postTitle || 'post') + '\u2026';
  var replyHtml =
    '<div class="thread-reply">' +
      '<div class="reply-row">' +
        '<textarea class="reply-input" rows="1"' +
          ' data-post-id="' + esc(postId) + '"' +
          ' placeholder="' + esc(replyPlaceholder) + '"></textarea>' +
        '<button class="reply-send" data-action="notif-reply-send"' +
          ' data-post-id="' + esc(postId) + '"' +
          ' data-notif-id="' + esc(n.id || '') + '" aria-label="Send reply">' +
          _NOTIF_SEND_SVG +
        '</button>' +
      '</div>' +
      '<div class="reply-label">Posts as comment \xB7 visible to all</div>' +
    '</div>' +
    '<div class="thread-footer">' +
      '<a class="thread-open-post" data-action="notif-open-post"' +
        ' data-post-id="' + esc(postId) + '"' +
        ' data-notif-id="' + esc(n.id || '') + '" href="#">Open full post \u2192</a>' +
    '</div>';

  var html =
    '<div class="thread-area">' +
      overflowHtml +
      '<div class="thread-msgs">' + msgsHtml + '</div>' +
      replyHtml +
    '</div>';

  window._notifThreadCache[postId] = html;
  return html;
}

// Render a single thread message (mini avatar + header + body).
function _notifThreadMsgHtml(c) {
  var author = c.author || '';
  var authorRole = c.author_role || '';
  var avClass = _notifThreadAvClass(author, authorRole);
  var _authorDisplay = (typeof getDisplayName === 'function') ? getDisplayName(author) : author;
  var initial = _authorDisplay ? _authorDisplay.charAt(0).toUpperCase() : '?';
  var ts = _notifRelTime(c.created_at);
  var roleTag = authorRole
    ? '<span class="thread-role">' + esc(authorRole) + '</span>'
    : '';
  return '<div class="thread-msg">' +
      (typeof renderAvatar === 'function' ? renderAvatar(author, getRoleFor(authorRole || author), 18, { classes: 'thread-av', fontSize: '7px' }) : '<div class="thread-av ' + avClass + '">' + esc(initial) + '</div>') +
      '<div class="thread-content">' +
        '<div class="thread-header">' +
          '<span class="thread-author">' + esc(_authorDisplay) + '</span>' +
          roleTag +
          '<span class="thread-time">' + esc(ts) + '</span>' +
        '</div>' +
        '<div class="thread-message">' + esc(c.message || '') + '</div>' +
      '</div>' +
    '</div>';
}

// Toggle expand state for a comment notification card. Anchors scroll so
// the tapped card's top edge stays at the same viewport position after
// the thread drawer mounts, then updates _notifExpandedSet so the state
// survives the next renderNotifications rebuild.
function _notifToggleExpand(item) {
  if (!item) return;
  var notifId = item.getAttribute('data-notif-id');
  if (!notifId) return;
  if (!window._notifExpandedSet) window._notifExpandedSet = new Set();
  var set = window._notifExpandedSet;
  var scroll = document.getElementById('notif-list-scroll');
  var preRect = item.getBoundingClientRect();
  var preScrollTop = scroll ? scroll.scrollTop : 0;

  if (set.has(notifId)) {
    // Collapse — just strip the class; keep the drawer HTML in place so
    // re-expand is instant. The drawer is display:none via max-height:0.
    set.delete(notifId);
    item.classList.remove('expanded');
    return;
  }

  // Expand — mount the thread drawer content if it hasn't been built yet.
  set.add(notifId);
  var drawer = item.querySelector(':scope > .thread-drawer');
  if (drawer && !drawer.innerHTML) {
    var pid = item.getAttribute('data-post-id') || '';
    var n = (window._notifData || _notifData || []).find(function(x) { return x.id === notifId; });
    var posts = (window.AppState.posts && window.AppState.posts.all) || [];
    var post = null;
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].post_id === pid) { post = posts[i]; break; }
    }
    var postTitle = post && post.title ? post.title : (n && n.message ? n.message : pid);
    drawer.innerHTML = _notifBuildThreadHtml(n || { id: notifId, post_id: pid }, post, postTitle);
  }
  item.classList.add('expanded');

  // Scroll anchoring — after layout flushes, shift scrollTop so the card's
  // top edge is back where it was pre-expand.
  if (scroll) {
    requestAnimationFrame(function() {
      var postRect = item.getBoundingClientRect();
      var delta = postRect.top - preRect.top;
      if (delta !== 0) scroll.scrollTop = preScrollTop + delta;
    });
  }

  // Auto-resize wiring for the reply textarea.
  var ta = item.querySelector('.reply-input');
  if (ta) {
    ta.addEventListener('input', _notifReplyInputResize);
  }
}

// Grow the reply textarea up to its CSS max-height as the user types,
// and flip .active on the sibling send button once there is any text.
function _notifReplyInputResize(e) {
  var ta = e.currentTarget || e.target;
  if (!ta) return;
  ta.style.height = 'auto';
  var next = Math.min(ta.scrollHeight, 80);
  ta.style.height = next + 'px';
  var row = ta.parentNode;
  if (!row) return;
  var btn = row.querySelector('.reply-send');
  if (!btn) return;
  if (ta.value && ta.value.trim().length > 0) btn.classList.add('active');
  else btn.classList.remove('active');
}

// Submit a reply from the thread drawer. Posts to /post_comments with
// the payload shape documented in CLAUDE.md §2 (post_comments schema).
// We DO NOT fire the notify-comment fan-out POST from JS — the Supabase
// edge function handles it (see CLAUDE.md §6), which avoids the existing
// dual-writer duplicate-row problem.
async function _notifSubmitReply(sendBtn) {
  if (!sendBtn || sendBtn.dataset.submitting === '1') return;
  var postId = sendBtn.getAttribute('data-post-id');
  var notifId = sendBtn.getAttribute('data-notif-id');
  var item = document.querySelector(
    '.notif-item[data-notif-id="' + (notifId || '').replace(/"/g, '\\"') + '"]'
  );
  if (!item) return;
  var ta = item.querySelector('.reply-input');
  if (!ta) return;
  var msg = (ta.value || '').trim();
  if (!msg) return;

  sendBtn.dataset.submitting = '1';
  sendBtn.disabled = true;
  ta.disabled = true;

  var posts = (window.AppState.posts && window.AppState.posts.all) || [];
  var post = null;
  for (var i = 0; i < posts.length; i++) {
    if (posts[i].post_id === postId) { post = posts[i]; break; }
  }
  // Fallback for post_title: look up the matching notification's message,
  // which usually embeds the post title (e.g. "Chitra commented on <title>").
  var notifMatch = _notifData.find(function(x) { return x.id === notifId; });
  var postTitle = (post && post.title) || (notifMatch && notifMatch.message) || postId;

  var authorName = (window.AppState.user && window.AppState.user.email) || (window.AppState.user && window.AppState.user.name) || 'Unknown';
  var effRole = (window.AppState.user && window.AppState.user.effectiveRole) ||
                (window.AppState.user && window.AppState.user.role) || 'Admin';
  var authorRole = effRole.charAt(0).toUpperCase() + effRole.slice(1).toLowerCase();

  // Parse any @mentions (very loose — matches the client/pcs parsers)
  var mentioned = [];
  var mRe = /@([A-Za-z][A-Za-z0-9_\-\s]*)/g;
  var m;
  while ((m = mRe.exec(msg)) !== null) {
    var raw = (m[1] || '').trim();
    if (raw) mentioned.push(raw);
  }

  var payload = {
    post_id:         postId,
    post_title:      postTitle,
    author:          authorName,
    author_role:     authorRole,
    message:         msg,
    visibility:      'all',
    mentioned_users: mentioned,
    reply_to:        null,
    resolved:        false,
    resolved_by:     null,
    attachments:     '[]'
  };

  try {
    var resp = await apiFetch('/post_comments', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(payload)
    });
    var created = Array.isArray(resp) && resp[0] ? resp[0] : null;
    var row = created || Object.assign({}, payload, {
      id: 'tmp-' + Date.now(),
      created_at: new Date().toISOString()
    });
    // Append to the in-memory comment cache so subsequent expands see it.
    if (!Array.isArray(window._notifComments)) window._notifComments = [];
    window._notifComments.push(row);
    // Bust the cache entry for this post so the next render is fresh,
    // then append the new message directly to the open drawer.
    if (window._notifThreadCache) delete window._notifThreadCache[postId];
    var msgsBox = item.querySelector('.thread-msgs');
    if (msgsBox) {
      var empty = msgsBox.querySelector('.thread-empty');
      if (empty && empty.parentNode) empty.parentNode.removeChild(empty);
      msgsBox.insertAdjacentHTML('beforeend', _notifThreadMsgHtml(row));
    }
    ta.value = '';
    ta.style.height = 'auto';
    sendBtn.classList.remove('active');
  } catch (err) {
    console.error('[notif-reply] POST failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'notif-reply');
    if (typeof showToast === 'function') showToast('Reply failed', 'error');
  } finally {
    delete sendBtn.dataset.submitting;
    sendBtn.disabled = false;
    ta.disabled = false;
    ta.focus();
  }
}

async function markNotifRead(id) {
  try {
    _notifData = _notifData.map(function(n) { return n.id === id ? Object.assign({}, n, { read: true }) : n; });
    updateNotifBadge();
    await apiFetch('/notifications?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    });
  } catch(e) { console.error('markNotifRead error:', e); }
}

async function deleteNotification(id) {
  try {
    _notifData = _notifData.filter(function(n) { return n.id !== id; });
    var el = document.querySelector(
      '[data-notif-id="' + id + '"].notif-item,' +
      '[data-notif-id="' + id + '"].notif-live-card'
    );
    if (el) {
      el.style.transition = 'opacity .25s, max-height .3s, padding .3s';
      el.style.opacity = '0';
      el.style.maxHeight = '0';
      el.style.overflow = 'hidden';
      el.style.padding = '0';
      el.style.borderBottom = 'none';
      setTimeout(function() {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 320);
    }
    updateNotifBadge();
    await apiFetch('/notifications?id=eq.' + encodeURIComponent(id), {
      method: 'DELETE'
    });
  } catch(e) {
    console.error('deleteNotification error:', e);
    window.logError && window.logError(e && e.message, e && e.stack, 'delete-notification');
    if (typeof showToast === 'function') showToast('Could not delete notification', 'error');
  }
}

async function markAllNotificationsRead() {
  try {
    _notifData = _notifData.map(function(n) { return Object.assign({}, n, { read: true }); });
    var _notifRole = window.AppState.user.effectiveRole || window.AppState.user.role || 'Admin';
    _notifRole = _notifRole.charAt(0).toUpperCase() + _notifRole.slice(1).toLowerCase();
    var currentName = resolveActor() || 'there';
    renderNotifications(currentName, _notifRole);
    updateNotifBadge();
    var readEls = document.querySelectorAll(
      '#panel-updates .notif-item:not(.read)');
    readEls.forEach(function(el) {
      el.classList.add('read');
      var dot = el.querySelector('.notif-unread-dot');
      if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
    });
    var liveEls = document.querySelectorAll(
      '#panel-updates .notif-live-card');
    liveEls.forEach(function(el) {
      var dot = el.querySelector('.notif-unread-dot');
      if (dot) dot.style.display = 'none';
    });
    ['notif-bell-badge','notif-pipeline-badge',
     'notif-lib-badge','notif-ins-badge'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    // Chip counts are rebuilt by renderNotifications above;
    // belt-and-braces hide every count span in case render was skipped.
    ['nchip-count-all','nchip-count-mentions','nchip-count-comments','nchip-count-moves'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    });
    await apiFetch('/notifications?read=eq.false&user_role=eq.' + encodeURIComponent(_notifRole), {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    });
    if (typeof showToast === 'function') showToast('All notifications marked as read', 'success');
  } catch(e) {
    console.error('markAllRead error:', e);
    window.logError && window.logError(e && e.message, e && e.stack, 'mark-all-notifications-read');
  }
}

function updateNotifBadge() {
  if (!localStorage.getItem('sb_access_token')) return;
  var role = (window.AppState.user.effectiveRole || 'Admin');
  var _badgeRole = role.charAt(0).toUpperCase() +
    role.slice(1).toLowerCase();
  var _badgeActor = window.AppState.user.name || window.currentUserName || '';
  var _badgeUrl = '/notifications?read=eq.false&user_role=eq.' +
    encodeURIComponent(_badgeRole) + '&select=id';
  if (_badgeActor) _badgeUrl += '&actor=neq.' + encodeURIComponent(_badgeActor);

  apiFetch(_badgeUrl, {}, { allowLogout: false })
  .then(function(rows) {
    var count = Array.isArray(rows) ? rows.length : 0;
    var show = count > 0;
    var countStr = count > 9 ? '9+' : String(count);

    [
      'notif-bell-badge',
      'notif-pipeline-badge',
      'notif-lib-badge',
      'notif-ins-badge'
    ].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = countStr;
      el.style.display = show ? 'flex' : 'none';
    });
  }).catch(function(err){ console.error('[10-ui] updateNotifBadge', err); window.logError && window.logError(err&&err.message, err&&err.stack, 'update-notif-badge'); });
}

// -- Zen mode ----------------------------------
function openZen(title, comments) {
  const overlay = document.getElementById('zen-overlay');
  if (!overlay) return;
  const zt = document.getElementById('zen-title');
  const zc = document.getElementById('zen-comments');
  if (zt) zt.textContent = title || '';
  if (zc) zc.textContent = comments || '';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeZen() {
  document.getElementById('zen-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// -- Snooze ------------------------------------
function closeSnooze() {
  document.getElementById('snooze-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}
function isSnoozed(postId) {
  const key = `snooze_${postId}`;
  const val = localStorage.getItem(key);
  if (!val) return false;
  if (Date.now() > parseInt(val)) { localStorage.removeItem(key); return false; }
  return true;
}

// -- Timeline ----------------------------------
function closeTimeline() {
  document.getElementById('timeline-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// -- Approval link -----------------------------
function copyApprovalLink(url) {
  navigator.clipboard.writeText(url).then(
    () => showToast('Approval link copied ok', 'success'),
    () => showToast('Could not copy  -  try manually', 'error')
  );
}

// -- Insights Tab ------------------------------
function showInsights() {
  var appHdr = document.querySelector('.app-header');
  if (appHdr) appHdr.style.display = 'none';
  document.getElementById('library-view')?.classList.remove('active');
  var dv = document.getElementById('dashboard-view');
  var cv = document.getElementById('client-view');
  var iv = document.getElementById('insights-view');
  if (dv) dv.classList.remove('active');
  if (cv) cv.classList.remove('active');
  if (iv) iv.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  var insBtn = document.querySelector('.tab-btn[data-tab="insights"]');
  if (insBtn) insBtn.classList.add('active');
  var titleEl = document.getElementById('app-header-title');
  if (titleEl) titleEl.style.display = 'none';
  var greetHdr = document.getElementById('dash-greeting-hdr');
  if (greetHdr) greetHdr.style.display = 'none';
  insUpdateOverview();
  insRenderPosts();
  insRenderMissingUrls();
  insInitFolBars();
}

function closeInsights() {
  var iv = document.getElementById('insights-view');
  if (iv) iv.classList.remove('active');
  var dv = document.getElementById('dashboard-view');
  if (dv) dv.classList.add('active');
  goToTab('tasks');
}

// -- Insights Data -----------------------------
var INS_METRICS = {
  imp:{color:'var(--cyan)',hex:'#22D3EE',label:'Impressions',delta:'Growing',sub:'posts in range'},
  eng:{color:'var(--gold)',hex:'#C8A84B',label:'Avg Engagement',delta:'Above 2% avg',sub:'LinkedIn avg is 2%'},
  fol:{color:'var(--green)',hex:'#3ECF8E',label:'New Followers',delta:'All organic',sub:'no sponsored'},
  com:{color:'var(--purple)',hex:'#9b87f5',label:'Total Comments',delta:'High resonance',sub:'public responses'}
};

var INS_POSTS = [
  {id:'dr-suhas',title:'Dr. Suhas - Lab Coat to Board',month:'feb',date:'Feb 9',imp:26622,likes:612,comments:202,reposts:3,clicks:1647,ctr:0.062,eng:0.093,follows:68,pillar:'Leadership',badge:'All-time best'},
  {id:'kitab-khana',title:'Kitab Khana - 15 Years of Learning',month:'mar',date:'Mar 16',imp:17811,likes:483,comments:34,reposts:4,clicks:12120,ctr:0.680,eng:0.710,follows:57,pillar:'Leadership',badge:'Best March post'},
  {id:'cricket',title:'Karan at Wankhede - Cricket',month:'mar',date:'Mar 5',imp:17463,likes:117,comments:4,reposts:0,clicks:1262,ctr:0.072,eng:0.079,follows:25,pillar:'Inclusivity',badge:''},
  {id:'dr-sangeeta-w',title:'Dr. Sangeeta - Women in Science',month:'feb',date:'Feb 11',imp:6345,likes:171,comments:40,reposts:8,clicks:1164,ctr:0.183,eng:0.218,follows:27,pillar:'Leadership',badge:''},
  {id:'telescope',title:'Telescope at Sakarwadi School',month:'feb',date:'Feb 5',imp:5760,likes:155,comments:24,reposts:3,clicks:255,ctr:0.044,eng:0.076,follows:22,pillar:'Innovation',badge:''},
  {id:'womens-day',title:'Womens Day - Together',month:'mar',date:'Mar 13',imp:5307,likes:167,comments:2,reposts:2,clicks:5871,ctr:1.106,eng:1.138,follows:12,pillar:'Inclusivity',badge:'Highest engagement'},
  {id:'synthomer',title:'Synthomer Collaboration',month:'feb',date:'Feb 13',imp:4971,likes:129,comments:32,reposts:6,clicks:1197,ctr:0.241,eng:0.274,follows:18,pillar:'Announcements',badge:''},
  {id:'chemistry-joke',title:'Chemistry Joke - HeHe',month:'feb',date:'Feb 3',imp:4542,likes:19,comments:9,reposts:1,clicks:143,ctr:0.031,eng:0.038,follows:16,pillar:'Announcements',badge:''},
  {id:'vishnu-gate',title:'Vishnu Gate - A Story of Kindness',month:'mar',date:'Mar 5',imp:4818,likes:132,comments:4,reposts:4,clicks:1165,ctr:0.242,eng:0.271,follows:25,pillar:'Leadership',badge:''},
  {id:'co2-dme',title:'CO2 to DME - World First',month:'mar',date:'Mar 12',imp:4711,likes:46,comments:1,reposts:3,clicks:3158,ctr:0.670,eng:0.681,follows:25,pillar:'Innovation',badge:''},
  {id:'sports',title:'GBL Indoor Sports Carnival',month:'feb',date:'Feb 25',imp:4228,likes:124,comments:6,reposts:8,clicks:3519,ctr:0.832,eng:0.865,follows:27,pillar:'Inclusivity',badge:''},
  {id:'ethanol',title:'Ethanol Blending - Samir Somaiya',month:'feb',date:'Feb 2',imp:4140,likes:106,comments:10,reposts:0,clicks:176,ctr:0.043,eng:0.071,follows:17,pillar:'Innovation',badge:''},
  {id:'somaiya-school',title:'Somaiya School - Born from Industry',month:'mar',date:'Mar 2',imp:3427,likes:100,comments:12,reposts:1,clicks:628,ctr:0.183,eng:0.216,follows:33,pillar:'Leadership',badge:''},
  {id:'gopiraj',title:'Gopiraj - 30 Years at Godavari',month:'feb',date:'Feb 17',imp:3794,likes:141,comments:49,reposts:3,clicks:65,ctr:0.017,eng:0.068,follows:26,pillar:'Leadership',badge:'Most discussed Feb'},
  {id:'award',title:'Plinio Nastari ISO Sugar Award',month:'mar',date:'Mar 18',imp:3355,likes:151,comments:11,reposts:0,clicks:2033,ctr:0.606,eng:0.654,follows:9,pillar:'Announcements',badge:''},
  {id:'q3',title:'Q3 FY26 - Strong Performance',month:'feb',date:'Feb 24',imp:2990,likes:76,comments:12,reposts:2,clicks:1889,ctr:0.632,eng:0.662,follows:18,pillar:'Announcements',badge:''},
  {id:'dr-sangeeta-apac',title:'Dr. Sangeeta - Bio APAC Singapore',month:'mar',date:'Mar 9',imp:2830,likes:118,comments:4,reposts:1,clicks:731,ctr:0.258,eng:0.302,follows:22,pillar:'Announcements',badge:''},
  {id:'dr-shantilal',title:'Dr. Shantilal Legacy - 1996',month:'mar',date:'Mar 17',imp:2711,likes:124,comments:2,reposts:1,clicks:936,ctr:0.345,eng:0.392,follows:26,pillar:'Leadership',badge:''},
  {id:'national-sci',title:'National Science Day',month:'feb',date:'Feb 28',imp:2022,likes:13,comments:0,reposts:1,clicks:42,ctr:0.021,eng:0.028,follows:58,pillar:'Innovation',badge:''},
  {id:'safety',title:'Safety by Design - PPE Matrix',month:'feb',date:'Feb 10',imp:2931,likes:69,comments:8,reposts:0,clicks:146,ctr:0.050,eng:0.076,follows:17,pillar:'Sustainability',badge:''},
  {id:'co2-pilot',title:'CO2 DME Pilot Plant',month:'mar',date:'Mar 3',imp:2068,likes:56,comments:1,reposts:0,clicks:88,ctr:0.043,eng:0.070,follows:11,pillar:'Innovation',badge:''},
  {id:'birds',title:'Silence Once Lived Here - Sakarwadi',month:'mar',date:'Mar 11',imp:1938,likes:80,comments:3,reposts:4,clicks:155,ctr:0.080,eng:0.125,follows:13,pillar:'Sustainability',badge:''},
  {id:'farmers',title:'Empowering the Hand that Feeds Us',month:'mar',date:'Mar 7',imp:1877,likes:64,comments:0,reposts:0,clicks:57,ctr:0.030,eng:0.064,follows:25,pillar:'Leadership',badge:''},
  {id:'sathgen',title:'Sathgen Therapeutics - TNBC',month:'mar',date:'Mar 9',imp:1268,likes:31,comments:0,reposts:2,clicks:75,ctr:0.059,eng:0.085,follows:22,pillar:'Innovation',badge:''},
  {id:'gudi',title:'Gudi Padwa - Renewal of Purpose',month:'mar',date:'Mar 19',imp:977,likes:64,comments:0,reposts:2,clicks:13,ctr:0.013,eng:0.081,follows:21,pillar:'Leadership',badge:'Lowest March'}
];

var INS_FOL_DAILY = {
  '03/01':13,'03/02':33,'03/03':11,'03/04':13,'03/05':25,
  '03/06':43,'03/07':25,'03/08':11,'03/09':22,'03/10':12,
  '03/11':13,'03/12':25,'03/13':12,'03/14':13,'03/15':6,
  '03/16':57,'03/17':26,'03/18':9,'03/19':21
};

var INS_DATE_ORDER = {
  'Feb 2':1,'Feb 3':2,'Feb 5':3,'Feb 9':4,'Feb 10':5,
  'Feb 11':6,'Feb 13':7,'Feb 14':8,'Feb 17':9,'Feb 19':10,
  'Feb 21':11,'Feb 24':12,'Feb 25':13,'Feb 27':14,'Feb 28':15,
  'Mar 2':16,'Mar 3':17,'Mar 5':18,'Mar 7':19,'Mar 9':20,
  'Mar 11':21,'Mar 12':22,'Mar 13':23,'Mar 16':24,'Mar 17':25,
  'Mar 18':26,'Mar 19':27
};

var INS = {
  view:'agency',tab:'overview',range:'30d',
  pillar:'all',metric:'imp',
  postsLens:'reach',postsPeriod:'all'
};

function insFmt(v){return v>=1000?(v/1000).toFixed(1)+'k':String(v)}
function insGetMetricVal(p,m){
  if(m==='imp')return p.imp;
  if(m==='eng')return p.eng*100;
  if(m==='fol')return p.follows;
  return p.comments;
}
function insGetColor(){return INS_METRICS[INS.metric].color}
function insGetHex(){return INS_METRICS[INS.metric].hex}
function _hexAlpha(hex,a){return hex+Math.round(a*255).toString(16).toUpperCase().padStart(2,'0')}
function insGetHexA(a){return _hexAlpha(insGetHex(),a)}

function insGetFiltered(){
  return INS_POSTS.filter(function(p){
    if(INS.pillar!=='all'&&p.pillar!==INS.pillar)return false;
    if(INS.range==='7d'){
      var r=['kitab-khana','award','dr-shantilal','gudi','dr-sangeeta-apac','dr-suhas'];
      return r.indexOf(p.id)>-1;
    }
    return true;
  });
}

function insSetView(v,btn){
  INS.view=v;
  document.querySelectorAll('.ins-vt').forEach(function(b){b.classList.remove('active')});
  if(btn)btn.classList.add('active');
  var ab=document.getElementById('ins-agency-block');
  if(ab)ab.style.display=v==='agency'?'block':'none';
  var dt=document.getElementById('ins-ds-tab');
  if(dt)dt.style.display=v==='agency'?'block':'none';
  if(INS.tab==='sources'&&v==='client'){
    insSetMainTab('overview',document.querySelector('.ins-main-tab'));
  }
}

function insSetMainTab(tab,btn){
  INS.tab=tab;
  document.querySelectorAll('.ins-main-tab').forEach(function(b){b.classList.remove('active')});
  if(btn)btn.classList.add('active');
  ['overview','posts','sources'].forEach(function(t){
    var el=document.getElementById('ins-tab-'+t);
    if(el)el.classList.toggle('ins-hidden',t!==tab);
  });
  var ctrl=document.getElementById('ins-controls');
  if(ctrl)ctrl.style.display=tab==='overview'?'block':'none';
  if(tab==='posts')insRenderPosts();
  if(tab==='sources')insRenderMissingUrls();
}

function insSetRange(r,btn){
  INS.range=r;
  document.querySelectorAll('#ins-controls .ins-chip').forEach(function(b){b.classList.remove('active')});
  if(btn)btn.classList.add('active');
  var cr=document.getElementById('ins-custom-row');
  if(cr)cr.classList.toggle('open',r==='custom');
  if(r!=='custom')insUpdateOverview();
}

function insSetPillar(p,btn){
  INS.pillar=p;
  document.querySelectorAll('.ins-pchip').forEach(function(b){b.classList.remove('active')});
  if(btn)btn.classList.add('active');
  insUpdateOverview();
}

function insSetMetric(m,btn){
  INS.metric=m;
  document.querySelectorAll('.ins-mt').forEach(function(b){
    b.classList.remove('active');
    b.style.color='';
    b.style.borderBottomColor='';
  });
  if(btn){
    btn.classList.add('active');
    btn.style.color=insGetColor();
    btn.style.borderBottomColor=insGetColor();
  }
  insUpdateOverview();
}

function insUpdateOverview(){
  var posts=insGetFiltered();
  var mc=INS_METRICS[INS.metric];
  var rl=INS.range==='7d'?'Last 7 days':INS.range==='30d'?'Last 30 days':'Custom range';
  var pl=INS.pillar==='all'?'All pillars':INS.pillar;
  var ctx=document.getElementById('ins-hero-ctx');
  if(ctx)ctx.textContent=rl+' - '+pl;
  var lbl=document.getElementById('ins-hero-lbl');
  if(lbl)lbl.textContent=mc.label;
  var hv=document.getElementById('ins-hero-val');
  if(hv){
    var v;
    if(INS.metric==='imp'){
      v=posts.reduce(function(s,p){return s+p.imp},0);
      hv.textContent=insFmt(v);
    }else if(INS.metric==='eng'){
      v=posts.length?posts.reduce(function(s,p){return s+p.eng},0)/posts.length:0;
      hv.textContent=(v*100).toFixed(1)+'%';
    }else if(INS.metric==='fol'){
      v=posts.reduce(function(s,p){return s+p.follows},0);
      hv.textContent='+'+v;
    }else{
      v=posts.reduce(function(s,p){return s+p.comments},0);
      hv.textContent=v;
    }
    hv.style.color=insGetColor();
  }
  var de=document.getElementById('ins-hero-delta');
  if(de)de.innerHTML='<span style="color:'+insGetColor()+'">'+mc.delta+'</span><span style="color:var(--text3)"> - '+mc.sub+'</span>';
  var tc=document.getElementById('ins-top-ctx');
  if(tc)tc.textContent='- '+rl;
  insRenderLineChart(posts);
  insRenderDowChart(posts);
  insRenderTopPosts(posts);
  insUpdateMetricBtns();
  // Update insights number header
  var totalImp = INS_POSTS.reduce(function(s,p){return s+p.imp},0);
  var ihImp = document.getElementById('ih-imp');
  if (ihImp) ihImp.textContent = insFmt(totalImp);
  var ihPosts = document.getElementById('ih-posts');
  if (ihPosts) ihPosts.textContent = INS_POSTS.length;
}

function insUpdateMetricBtns(){
  ['imp','eng','fol','com'].forEach(function(k){
    var b=document.getElementById('ins-mt-'+k);
    if(!b)return;
    if(k===INS.metric){
      b.style.color=insGetColor();
      b.style.borderBottomColor=insGetColor();
    }else{
      b.style.color='';
      b.style.borderBottomColor='';
    }
  });
}

function insRenderLineChart(posts){
  var svg=document.getElementById('ins-line-svg');
  var xl=document.getElementById('ins-chart-xlabels');
  if(!svg||!xl)return;
  svg.innerHTML='';xl.innerHTML='';
  var sorted=posts.slice().sort(function(a,b){
    return(INS_DATE_ORDER[a.date]||99)-(INS_DATE_ORDER[b.date]||99);
  });
  if(sorted.length<2)return;
  var vals=sorted.map(function(p){return insGetMetricVal(p,INS.metric)});
  var maxV=Math.max.apply(null,vals);
  var W=354,H=95,pad=6;
  var pts=vals.map(function(v,i){
    return[pad+(i/(vals.length-1))*(W-pad*2),H-pad-((v/(maxV||1))*(H-pad*2))];
  });
  var aD='M '+pts[0][0]+' '+H;
  pts.forEach(function(p){aD+=' L '+p[0]+' '+p[1]});
  aD+=' L '+pts[pts.length-1][0]+' '+H+' Z';
  var area=document.createElementNS('http://www.w3.org/2000/svg','path');
  area.setAttribute('d',aD);area.setAttribute('fill',insGetHexA(0.12));
  svg.appendChild(area);
  var lD='M '+pts.map(function(p){return p[0]+' '+p[1]}).join(' L ');
  var line=document.createElementNS('http://www.w3.org/2000/svg','path');
  line.setAttribute('d',lD);line.setAttribute('fill','none');
  line.setAttribute('stroke',insGetColor());line.setAttribute('stroke-width','2');
  line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');
  svg.appendChild(line);
  var mi=vals.indexOf(maxV);
  var dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
  dot.setAttribute('cx',pts[mi][0]);dot.setAttribute('cy',pts[mi][1]);
  dot.setAttribute('r','4');dot.setAttribute('fill',insGetHex());
  svg.appendChild(dot);
  var lt=document.createElementNS('http://www.w3.org/2000/svg','text');
  lt.setAttribute('x',pts[mi][0]);lt.setAttribute('y',pts[mi][1]-8);
  lt.setAttribute('text-anchor','middle');lt.setAttribute('font-size','8');
  lt.setAttribute('font-family','IBM Plex Mono');lt.setAttribute('fill',insGetHex());
  lt.textContent=INS.metric==='eng'?maxV.toFixed(1)+'%':insFmt(maxV);
  svg.appendChild(lt);
  [0,Math.floor(sorted.length/2),sorted.length-1].forEach(function(i){
    var s=document.createElement('span');
    s.className='ins-chart-xlabel';
    s.textContent=sorted[i].date;
    xl.appendChild(s);
  });
}

function insRenderDowChart(posts){
  var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var tot=[0,0,0,0,0,0,0],cnt=[0,0,0,0,0,0,0];
  var mm={'Feb':1,'Mar':2};
  posts.forEach(function(p){
    var pts=p.date.split(' ');
    var d=new Date(2026,mm[pts[0]]-1,parseInt(pts[1])).getDay();
    tot[d]+=insGetMetricVal(p,INS.metric);cnt[d]++;
  });
  var avgs=tot.map(function(t,i){return cnt[i]>0?Math.round(t/cnt[i]):0});
  var maxA=Math.max.apply(null,avgs);
  var best=avgs.indexOf(maxA);
  var vr=document.getElementById('ins-dow-vals');
  var cr=document.getElementById('ins-dow-chart');
  var lr=document.getElementById('ins-dow-labels');
  var note=document.getElementById('ins-dow-note');
  if(!vr||!cr||!lr||!note)return;
  vr.innerHTML='';cr.innerHTML='';lr.innerHTML='';
  days.forEach(function(d,i){
    var ib=i===best&&avgs[i]>0;
    var dv=document.createElement('div');
    dv.className='ins-dow-val';
    dv.textContent=avgs[i]>0?(INS.metric==='eng'?avgs[i].toFixed(0)+'%':insFmt(avgs[i])):'-';
    if(ib)dv.style.color=insGetColor();
    vr.appendChild(dv);
    var h=maxA>0?Math.max(4,Math.round((avgs[i]/maxA)*100)):4;
    var bar=document.createElement('div');
    bar.className='ins-dow-bar';bar.style.flex='1';bar.style.height=h+'%';
    bar.style.background=avgs[i]===0?'var(--muted2)':ib?insGetColor():insGetHexA(0.3);
    cr.appendChild(bar);
    var ll=document.createElement('div');
    ll.className='ins-dow-day-lbl';
    ll.textContent=ib?d+' *':d;
    if(ib)ll.style.color=insGetColor();
    lr.appendChild(ll);
  });
  if(best>=0&&avgs[best]>0){
    var oth=avgs.filter(function(v,i){return i!==best&&v>0});
    var sec=oth.length?Math.max.apply(null,oth):1;
    var mult=sec>0?Math.round(avgs[best]/sec):1;
    var vs=INS.metric==='eng'?avgs[best].toFixed(0)+'%':insFmt(avgs[best]);
    note.textContent=days[best]+' averages '+vs+(mult>1?' - '+mult+'x more than any other day.':' - your best publishing day.');
    note.style.color=insGetColor();
    note.style.borderColor=insGetHexA(0.3);
    note.style.background=insGetHexA(0.05);
  }
}

function insRenderTopPosts(posts){
  var list=document.getElementById('ins-top-list');
  if(!list)return;
  list.innerHTML='';
  var sorted=posts.slice().sort(function(a,b){
    return insGetMetricVal(b,INS.metric)-insGetMetricVal(a,INS.metric);
  }).slice(0,3);
  sorted.forEach(function(p,i){
    var val=insGetMetricVal(p,INS.metric);
    var vd=INS.metric==='eng'?val.toFixed(1)+'%':INS.metric==='fol'?'+'+val:insFmt(val);
    var row=document.createElement('div');
    row.className='ins-tp-row';
    row.innerHTML='<div class="ins-tp-rank '+(i===0?'r1':i===1?'r2':'r3')+'">#'+(i+1)+'</div>'+
      '<div class="ins-tp-body"><div class="ins-tp-title">'+p.title+'</div>'+
      '<div class="ins-tp-meta">'+p.pillar+' - '+p.date+'</div></div>'+
      '<div class="ins-tp-val" style="color:'+insGetColor()+'">'+vd+'</div>';
    row.onclick=function(){insOpenCard(p)};
    list.appendChild(row);
  });
}

function insInitFolBars(){
  var wrap=document.getElementById('ins-fol-bars');
  if(!wrap||wrap.children.length>0)return;
  var vals=Object.values(INS_FOL_DAILY);
  var max=Math.max.apply(null,vals);
  Object.entries(INS_FOL_DAILY).forEach(function(e){
    var d=e[0],v=e[1];
    var col=document.createElement('div');col.className='ins-fol-bar-col';
    var bar=document.createElement('div');bar.className='ins-fol-bar-item';
    bar.title=d+': '+v+' followers';
    bar.style.height=Math.max(4,Math.round((v/max)*100))+'%';
    bar.style.background=d==='03/16'?'var(--green)':'#3ECF8E4D';
    col.appendChild(bar);wrap.appendChild(col);
  });
}

function insSetLens(l,btn){
  INS.postsLens=l;
  document.querySelectorAll('.ins-lens-btn').forEach(function(b){b.className='ins-lens-btn'});
  if(btn){
    var cls=l==='reach'?'ins-lens-reach':l==='resonance'?'ins-lens-resonance':'ins-lens-growth';
    btn.classList.add(cls);
  }
  insRenderPosts();
}

function insSetPostsPeriod(p,btn){
  INS.postsPeriod=p;
  document.querySelectorAll('#ins-tab-posts .ins-chip').forEach(function(b){b.classList.remove('active')});
  if(btn)btn.classList.add('active');
  insRenderPosts();
}

function insRenderPosts(){
  var list=document.getElementById('ins-posts-list');
  if(!list)return;
  list.innerHTML='';
  var filtered=INS_POSTS.filter(function(p){
    if(INS.postsPeriod==='mar')return p.month==='mar';
    if(INS.postsPeriod==='feb')return p.month==='feb';
    return true;
  });
  var sorted=filtered.slice().sort(function(a,b){
    if(INS.postsLens==='reach')return b.imp-a.imp;
    if(INS.postsLens==='resonance')return b.comments-a.comments;
    return b.follows-a.follows;
  });
  var max=sorted[0]?(INS.postsLens==='reach'?sorted[0].imp:INS.postsLens==='resonance'?sorted[0].comments:sorted[0].follows):1;
  var lc=INS.postsLens==='reach'?'var(--cyan)':INS.postsLens==='resonance'?'var(--purple)':'var(--green)';
  var lastM=null;
  sorted.forEach(function(p,i){
    if(INS.postsPeriod==='all'&&p.month!==lastM){
      lastM=p.month;
      var sep=document.createElement('div');sep.className='ins-month-sep';
      sep.innerHTML='<div class="ins-month-sep-lbl">'+(p.month==='mar'?'March 2026':'February 2026')+'</div>';
      list.appendChild(sep);
    }
    var val=INS.postsLens==='reach'?p.imp:INS.postsLens==='resonance'?p.comments:p.follows;
    var vd=INS.postsLens==='reach'?insFmt(p.imp):val;
    var sd=INS.postsLens==='reach'?(p.eng*100).toFixed(1)+'% eng':INS.postsLens==='resonance'?insFmt(p.imp)+' imp':'followers';
    var bp=Math.max(3,Math.round((val/max)*100));
    var rc=i===0?'r1':i===1?'r2':i===2?'r3':'';
    var el=document.createElement('div');el.className='ins-post-item '+p.month;
    el.innerHTML='<div class="ins-pi-rank '+rc+'">#'+(i+1)+'</div>'+
      '<div class="ins-pi-body"><div class="ins-pi-title">'+p.title+'</div>'+
      '<div class="ins-pi-meta">'+p.pillar+' - '+p.date+'</div>'+
      '<div class="ins-pi-bar"><div class="ins-pi-bar-fill" style="width:'+bp+'%;background:'+lc+'"></div></div></div>'+
      '<div class="ins-pi-right"><div class="ins-pi-val" style="color:'+lc+'">'+vd+'</div>'+
      '<div class="ins-pi-sub">'+sd+'</div></div>';
    el.onclick=function(){insOpenCard(p)};
    list.appendChild(el);
  });
}

function insRenderMissingUrls(){
  var list=document.getElementById('ins-missing-list');
  var ctEl=document.getElementById('ins-missing-count-text');
  if(!list)return;
  list.innerHTML='';
  var missing=INS_POSTS.filter(function(p){return!p.linkedinUrl});
  if(ctEl)ctEl.textContent=missing.length+' posts';
  missing.slice(0,10).forEach(function(p){
    var item=document.createElement('div');item.className='ins-missing-item';
    item.innerHTML='<div class="ins-missing-top">'+
      '<div><div class="ins-mi-date">'+p.date+' - '+p.pillar+'</div>'+
      '<div class="ins-mi-title">'+p.title+'</div></div>'+
      '<button class="ins-mi-add-btn" id="ins-mi-btn-'+p.id+'"'+
      ' onclick="insToggleUrlInput(\''+p.id+'\')">+ Add URL</button></div>'+
      '<div class="ins-mi-input-row" id="ins-mi-row-'+p.id+'">'+
      '<input class="ins-mi-url-input" id="ins-mi-url-'+p.id+'"'+
      ' placeholder="https://linkedin.com/feed/update/...">'+
      '<button class="ins-mi-save-btn" onclick="insSaveUrl(\''+p.id+'\')">Save</button></div>';
    list.appendChild(item);
  });
}

function insToggleUrlInput(id){
  var row=document.getElementById('ins-mi-row-'+id);
  if(!row)return;
  var isOpen=row.classList.contains('open');
  row.classList.toggle('open',!isOpen);
  if(!isOpen){var inp=document.getElementById('ins-mi-url-'+id);if(inp)inp.focus();}
}

function insSaveUrl(id){
  var inp=document.getElementById('ins-mi-url-'+id);
  if(!inp||!inp.value.trim())return;
  var post=INS_POSTS.find(function(p){return p.id===id});
  if(post)post.linkedinUrl=inp.value.trim();
  var row=document.getElementById('ins-mi-row-'+id);
  if(row)row.classList.remove('open');
  var btn=document.getElementById('ins-mi-btn-'+id);
  if(btn){btn.textContent='Saved';btn.style.color='var(--green)';btn.style.borderColor='#3ECF8E59';btn.disabled=true;}
}

function insSimulateUpload(btn,type){
  btn.textContent='Uploading...';btn.disabled=true;
  setTimeout(function(){
    btn.textContent='Uploaded';btn.classList.add('ins-csv-uploaded');btn.disabled=false;
    var item=btn.closest('.ins-csv-item');
    if(item){
      item.classList.add('ins-csv-done');
      var icon=item.querySelector('.ins-csv-icon');
      if(icon){icon.classList.remove('pending');icon.classList.add('done');}
      var date=item.querySelector('.ins-csv-date');
      if(date)date.textContent='Last uploaded - Mar 21, 2026';
    }
  },1200);
}

function insOpenCard(p){
  var ov=document.getElementById('ins-card-overlay');
  if(!ov)return;
  var set=function(id,val){var el=document.getElementById(id);if(el)el.textContent=val};
  set('ins-pc-date',p.date+' 2026 - '+p.pillar);
  set('ins-pc-title',p.title);
  set('ins-pc-imp',insFmt(p.imp));
  set('ins-pc-eng-sub',(p.eng*100).toFixed(1)+'% engagement rate');
  set('ins-pc-likes',p.likes);
  set('ins-pc-comments',p.comments);
  set('ins-pc-reposts',p.reposts);
  set('ins-pc-clicks',insFmt(p.clicks));
  set('ins-pc-ctr',(p.ctr*100).toFixed(1)+'%');
  set('ins-pc-eng',(p.eng*100).toFixed(1)+'%');
  var bw=document.getElementById('ins-pc-badge-wrap');
  if(bw){
    if(p.badge){
      var bc=p.badge.indexOf('Lowest')>-1?'low':(p.badge.indexOf('best')>-1||p.badge.indexOf('Best')>-1||p.badge.indexOf('All-time')>-1||p.badge.indexOf('Highest')>-1)?'top':'high';
      bw.innerHTML='<span class="ins-pcard-badge '+bc+'">'+p.badge+'</span>';
    }else{bw.innerHTML='';}
  }
  var pa=0.348;
  var pct=Math.min(100,Math.round((p.eng/(pa*2))*100));
  var bar=document.getElementById('ins-pc-eng-bar');
  if(bar){
    bar.style.width=pct+'%';
    bar.style.background=p.eng>pa?'var(--green)':p.eng<pa*0.5?'var(--red)':'var(--amber)';
  }
  var cmp=document.getElementById('ins-pc-eng-cmp');
  if(cmp){
    var vs=p.eng>pa?'Above':p.eng<pa?'Below':'At';
    cmp.innerHTML='<span>'+vs+' page average</span> - Page avg '+(pa*100).toFixed(1)+'%';
  }
  set('ins-pc-fol',p.follows);
  var fp=document.getElementById('ins-pc-fol-pct');
  if(fp)fp.textContent=Math.round((p.follows/390)*100)+'%';
  ov.classList.add('open');
}

function insCloseCard(){
  var ov=document.getElementById('ins-card-overlay');
  if(ov)ov.classList.remove('open');
}

function insHandleOverlay(e){
  var ov=document.getElementById('ins-card-overlay');
  if(e.target===ov)insCloseCard();
}

// -- FAB ---------------------------------------
let _fabScrollEl = null;
let _fabScrollTimer = null;

function _fabAttachScroll() {
  if (_fabScrollEl) _fabScrollEl.removeEventListener('scroll', _fabOnScroll);
  const activePanel = document.querySelector('.tab-panel.active');
  _fabScrollEl = activePanel?.querySelector('.dash-body') || document.querySelector('.dash-body');
  if (_fabScrollEl) {
    _fabScrollEl.addEventListener('scroll', _fabOnScroll, { passive: true });
  }
}

function _fabOnScroll() {
  const fab = document.getElementById('main-fab-btn');
  if (!fab) return;
  fab.classList.add('hidden');
  clearTimeout(_fabScrollTimer);
  _fabScrollTimer = setTimeout(() => fab.classList.remove('hidden'), 350);
}

function updateFabVisibility() {
  var assignBtn = document.getElementById('fab-assign-task');
  if (!assignBtn) return;
  assignBtn.style.display = (window.AppState.user.effectiveRole === 'Admin') ? 'flex' : 'none';
}

function toggleFabMenu() {
  var fab = document.getElementById('fab');
  var menu = document.getElementById('fab-menu');
  var backdrop = document.getElementById('fab-backdrop');
  if (!menu) return;
  var isOpen = menu.classList.toggle('open');
  if (fab) fab.classList.toggle('open', isOpen);
  if (backdrop) backdrop.classList.toggle('open', isOpen);
}

function openAssignTaskFromFab() {
  console.log('[FAB] Assign click', window._pcs?.postId);
  if (!window._pcs?.postId) {
    showToast('Open a post first');
    return;
  }
  const assignee = prompt('Assign to (Pranav / Chitra)');
  if (!assignee) return;
  const text = prompt('Task description');
  if (!text) return;
  try {
    _fabAssignTask(window._pcs.postId, assignee.trim(), text.trim());
  } catch (err) {
    console.error('[FAB] Assign failed', err);
    showToast('Failed to assign task');
  }
}

async function _fabAssignTask(postId, assignee, message) {
  try {
    await apiFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        assigned_to: assignee,
        message: message,
        post_id: postId,
      }),
    });
    showToast('Task assigned OK', 'success');
    await logActivity({ post_id: postId, actor: window.AppState.user.email || resolveActor(), actor_role: window.AppState.user.effectiveRole || 'Admin', action: 'Assigned task to ' + assignee });
    if (typeof loadTasks === 'function') loadTasks();
  } catch (err) {
    console.error('[AssignTask] FAILED:', err);
    showToast('Failed to assign task', 'error');
  }
}

function closeFabMenu() {
  var fab = document.getElementById('fab');
  var menu = document.getElementById('fab-menu');
  var backdrop = document.getElementById('fab-backdrop');
  if (fab) fab.classList.remove('open');
  if (menu) menu.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

// -- New Request Sheet (NRS) --------------------
function nrsSetUrg(el, val) {
  document.querySelectorAll('.nrs-urg-opt')
    .forEach(function(o) { o.className = 'nrs-urg-opt'; });
  el.classList.add('urg-' + val);
  window._nrsUrgency = val;
}

function openRequestSheet() {
  var overlay = document.getElementById('request-sheet-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  var today = new Date().toISOString().split('T')[0];
  var d = document.getElementById('nrs-date');
  if (d) d.value = today;
  var brief = document.getElementById('nrs-brief');
  if (brief) {
    brief.value = '';
    brief.oninput = function() {
      var btn = document.getElementById('nrs-send-btn');
      if (btn) btn.disabled = !brief.value.trim();
    };
  }
  document.querySelectorAll('.nrs-urg-opt')
    .forEach(function(o) { o.className = 'nrs-urg-opt'; });
  var normal = document.querySelector('.nrs-urg-opt:nth-child(2)');
  if (normal) normal.classList.add('urg-normal');
  window._nrsUrgency = 'normal';
  var btn = document.getElementById('nrs-send-btn');
  if (btn) {
    btn.disabled = true;
    btn.onclick = _nrsSubmit;
  }
  var closeReq = function() { overlay.style.display = 'none'; };
  var cb = document.getElementById('nrs-close-btn');
  var ca = document.getElementById('nrs-cancel-btn');
  if (cb) cb.onclick = closeReq;
  if (ca) ca.onclick = closeReq;
  overlay.onclick = function(e) {
    if (e.target === overlay) overlay.style.display = 'none';
  };
}

async function _nrsSubmit() {
  var brief = (document.getElementById('nrs-brief').value || '').trim();
  if (!brief) return;
  var btn = document.getElementById('nrs-send-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  try {
    var postId = 'POST-' + Date.now();
    var actor = resolveActor() || 'Shubham';
    var body = {
      post_id:       postId,
      title:         brief.substring(0, 80),
      stage:         'in_production',
      owner:         document.getElementById('nrs-assign').value || 'Creative',
      content_pillar: document.getElementById('nrs-pillar').value || null,
      format:        document.getElementById('nrs-format').value || null,
      target_date:   document.getElementById('nrs-date').value || null,
      client_feedback: brief,
      updated_at:    new Date().toISOString()
    };
    await apiFetch('/posts', { method: 'POST', body: JSON.stringify(body) });
    document.getElementById('request-sheet-overlay').style.display = 'none';
    showToast('Request sent to production', 'success');
    if (typeof loadPosts === 'function') loadPosts();
  } catch(e) {
    console.error('Request submit failed:', e);
    showToast('Failed to send request', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Send to Production'; }
  }
}

// -- Notification Panel (full-page overlay) -------------------
function openNotifications() {
  var panel = document.getElementById('panel-updates');
  if (!panel) return;
  if (!panel._notifTapWired) {
    panel._notifTapWired = true;
    panel.addEventListener('click', function(e) {
      // Skip elements that handle their own clicks.
      if (e.target.closest('.notif-chips')) return;
      if (e.target.closest('.mark-all-btn')) return;
      if (e.target.closest('.notif-close-btn')) return;
      if (e.target.closest('.notif-action-btn')) return;
      if (e.target.closest('.notif-mi-btn')) return;
      if (e.target.closest('.notif-topbar-btn')) return;
      if (e.target.closest('.notif-li-link')) return;
      // `.meta-actions` is the WA+trash wrapper — its child buttons
      // have their own `.notif-mi-btn` skip, but bare clicks on the
      // wrapper itself (between the buttons) should also be ignored
      // so they don't bubble up to the card tap.
      if (e.target.closest('.meta-actions')) return;

      // Thumbnail click ALWAYS navigates to PCS / the client overlay,
      // never expands the thread drawer. This gives users a reliable
      // way to open the full post even from comment/mention cards that
      // would otherwise expand on body tap.
      if (e.target.closest('.notif-thumb-wrap')) {
        e.stopPropagation();
        var thumbItem = e.target.closest('.notif-item, .notif-live-card');
        if (!thumbItem) return;
        var _tPid = thumbItem.getAttribute('data-post-id');
        var _tNotifId = thumbItem.getAttribute('data-notif-id');
        if (_tNotifId) markNotifRead(_tNotifId);
        thumbItem.classList.add('read');
        var _tDot = thumbItem.querySelector('.nnew-dot');
        if (_tDot) _tDot.style.display = 'none';
        if (!_tPid) return;
        var _tIsBrief = thumbItem.getAttribute('data-is-brief') === '1' ||
          thumbItem.getAttribute('data-notif-type') === 'new_request';
        window._notifOpenedPCS = true;
        closeNotifications();
        setTimeout(function() {
          var _tRole = (window.AppState && window.AppState.user &&
            window.AppState.user.effectiveRole || '').toLowerCase();
          var _tIsClient = _tRole === 'client';
          if (_tIsBrief) {
            if (typeof _openBriefSheet === 'function') _openBriefSheet(_tPid);
          } else if (_tIsClient) {
            if (typeof window._openClientPostOverlay === 'function')
              window._openClientPostOverlay(_tPid);
          } else {
            openPCS(_tPid, '');
          }
        }, 150);
        return;
      }

      // Expand-in-place thread view — the expand chip, the reply input,
      // the send button, individual thread messages, and the "Open full
      // post" link all live inside a .notif-item and would otherwise be
      // swallowed by the item delegate below.
      var expandBtn = e.target.closest('.expand-chip');
      var replyInput = e.target.closest('.reply-input');
      var replySend = e.target.closest('.reply-send');
      // Both the footer "Open full post ->" link and the top-of-drawer
      // "View all N comments" overflow link route through the same
      // open-post handler below.
      var threadOpen = e.target.closest('.thread-open-post, .thread-overflow');
      var threadMsg = e.target.closest('.thread-msg');
      var threadArea = e.target.closest('.thread-area, .thread-reply, .thread-footer, .reply-label');

      if (replyInput) return;                // let the textarea focus/type
      if (replySend) {                       // submit the reply
        e.stopPropagation();
        _notifSubmitReply(replySend);
        return;
      }
      if (threadOpen) {                      // "Open full post ->" link
        e.preventDefault();
        e.stopPropagation();
        var _openItem = threadOpen.closest('.notif-item, .notif-live-card');
        var _openPid = threadOpen.getAttribute('data-post-id') ||
          (_openItem && _openItem.getAttribute('data-post-id'));
        var _openNotifId = threadOpen.getAttribute('data-notif-id') ||
          (_openItem && _openItem.getAttribute('data-notif-id'));
        if (_openNotifId) markNotifRead(_openNotifId);
        window._notifOpenedPCS = true;
        closeNotifications();
        setTimeout(function() {
          var _role = (window.AppState.user.effectiveRole || '').toLowerCase();
          if (_role === 'client') {
            if (typeof window._openClientPostOverlay === 'function')
              window._openClientPostOverlay(_openPid);
          } else {
            openPCS(_openPid, '');
            setTimeout(function() {
              if (typeof window._pcsTabSwitch === 'function')
                window._pcsTabSwitch('client');
            }, 300);
          }
        }, 150);
        return;
      }
      if (expandBtn) {
        e.stopPropagation();
        var _chipItem = expandBtn.closest('.notif-item');
        if (!_chipItem) return;
        // Mark-read on first expand, mirrors the card-tap semantic.
        if (!_chipItem.classList.contains('expanded')) {
          var _nid = _chipItem.getAttribute('data-notif-id');
          if (_nid) markNotifRead(_nid);
          _chipItem.classList.add('read');
          var _cDot = _chipItem.querySelector('.nnew-dot');
          if (_cDot) _cDot.style.display = 'none';
        }
        _notifToggleExpand(_chipItem);
        return;
      }
      if (threadMsg || threadArea) {
        // Any click inside an already-expanded drawer that isn't on a
        // tracked control should be ignored (don't open PCS, don't
        // re-fire markNotifRead).
        e.stopPropagation();
        return;
      }

      var item = e.target.closest('.notif-item, .notif-live-card');
      if (!item) return;
      e.stopPropagation();
      var pid = item.getAttribute('data-post-id');
      var isBrief = item.getAttribute('data-is-brief') === '1' ||
        item.getAttribute('data-notif-type') === 'new_request';
      var notifId = item.getAttribute('data-notif-id');
      var notifType = item.getAttribute('data-notif-type') || '';
      var isExpandable = item.getAttribute('data-expandable') === '1';

      // Comment AND mention notifications with 2+ comments on the post
      // expand in place on body tap instead of routing into PCS/client
      // overlay. Non-expandable rows continue through to the open-post
      // path below.
      if (isExpandable && (notifType === 'comment' || notifType === 'mention') && !isBrief) {
        if (!item.classList.contains('expanded')) {
          if (notifId) markNotifRead(notifId);
          item.classList.add('read');
          var _bDot = item.querySelector('.nnew-dot');
          if (_bDot) _bDot.style.display = 'none';
        }
        _notifToggleExpand(item);
        return;
      }

      if (notifId) markNotifRead(notifId);
      // Instant visual mark-as-read
      item.classList.add('read');
      var _tapDot = item.querySelector('.notif-unread-dot');
      if (_tapDot) _tapDot.style.display = 'none';
      if (!pid) return;
      window._notifOpenedPCS = true;
      closeNotifications();
      setTimeout(function() {
        var _role = (window.AppState.user.effectiveRole || '').toLowerCase();
        var _isClient = _role === 'client';
        if (isBrief) {
          if (typeof _openBriefSheet === 'function')
            _openBriefSheet(pid);
        } else if (_isClient) {
          if (typeof window._openClientPostOverlay === 'function')
            window._openClientPostOverlay(pid);
        } else {
          openPCS(pid, '');
          if (notifType === 'comment') {
            setTimeout(function() {
              if (typeof window._pcsTabSwitch === 'function')
                window._pcsTabSwitch('client');
            }, 300);
          }
        }
      }, 150);
    });
  }
  if (!panel._chipsWired) {
    panel._chipsWired = true;
    var chipsEl = document.getElementById('notif-chips');
    if (chipsEl) {
      chipsEl.addEventListener('click', function(e) {
        var chip = e.target.closest('.notif-chip');
        if (!chip) return;
        document.querySelectorAll('#notif-chips .notif-chip').forEach(function(c) { c.classList.remove('active'); });
        chip.classList.add('active');
        _notifChipFilter = chip.dataset.filter || 'all';
        var role = window.AppState.user.effectiveRole || window.AppState.user.role || 'Admin';
        role = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
        var currentName = (typeof resolveActor === 'function' && resolveActor()) || 'there';
        renderNotifications(currentName, role);
      });
    }
  }
  var overlay = document.getElementById('notif-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'notif-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1300;background:#0a0a0f;display:flex;align-items:stretch;justify-content:center;';
    overlay.onclick = function(e) { if (e.target === overlay) closeNotifications(); };
    document.body.appendChild(overlay);
    overlay.appendChild(panel);
  }
  overlay.style.display = 'flex';
  panel.style.cssText = 'width:100%;max-width:480px;height:100%;overflow:hidden;background:#0e0e16;display:flex;flex-direction:column;';
  document.body.style.overflow = 'hidden';
  window.AppState.ui.modalOpen = true;
  loadNotifications();
}

function closeNotifications() {
  var overlay = document.getElementById('notif-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  window.AppState.ui.modalOpen = false;
  _drainDeferredRender();
}

window.openNotifications = openNotifications;
window.closeNotifications = closeNotifications;

// -- FAB menu wiring --
document.addEventListener('DOMContentLoaded', function() {
  var backdrop = document.getElementById('fab-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeFabMenu);

  var createPost = document.getElementById('fab-create-post');
  if (createPost) createPost.addEventListener('click', function() {
    closeFabMenu();
    if (typeof openNewPostModal === 'function') openNewPostModal();
  });

  var createReq = document.getElementById('fab-create-request');
  if (createReq) createReq.addEventListener('click', function() {
    closeFabMenu();
    if (typeof openRequestSheet === 'function') openRequestSheet();
  });

  var assignTask = document.getElementById('fab-assign-task');
  if (assignTask) assignTask.addEventListener('click', function() {
    closeFabMenu();
    if (typeof openAssignTaskFromFab === 'function') openAssignTaskFromFab();
  });

  // Init insights
  insInitFolBars();
  var dsTab = document.getElementById('ins-ds-tab');
  if (dsTab) dsTab.style.display = 'block';
  var ab = document.getElementById('ins-agency-block');
  if (ab) ab.style.display = 'block';
});

// -- Task Detail Modal --------------------------
function openTaskModal(taskId) {
  var task = (window.allTasks || []).find(function(t) { return String(t.id) === String(taskId); });
  if (!task) { showToast('Task not found'); return; }
  var overlay = document.getElementById('task-detail-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'task-detail-overlay';
    overlay.className = 'modal-overlay';
    overlay.onclick = function(ev) { if (ev.target === overlay) closeTaskModal(); };
    document.body.appendChild(overlay);
  }
  var created = task.created_at ? formatDate(task.created_at) : ' - ';
  var due = task.due_date ? formatDateShort(task.due_date) : '';
  overlay.innerHTML =
    '<div class="modal-card task-detail-card">' +
      '<div class="task-detail-header">' +
        '<span class="task-detail-title">Task Details</span>' +
        '<button class="btn-close-modal" onclick="closeTaskModal()">&times;</button>' +
      '</div>' +
      '<div class="task-detail-body">' +
        '<div class="task-detail-msg">' + esc(task.message) + '</div>' +
        '<div class="task-detail-meta">Assigned to: ' + esc(task.assigned_to || ' - ') + '</div>' +
        '<div class="task-detail-meta">Created: ' + created + '</div>' +
        (due ? '<div class="task-detail-meta">Due: ' + due + '</div>' : '') +
      '</div>' +
      '<div class="task-detail-actions">' +
        '<button class="btn-modal-primary" onclick="markTaskDone(' + task.id + '); closeTaskModal();">Mark as Done</button>' +
      '</div>' +
    '</div>';
  overlay.classList.add('open');
}

function closeTaskModal() {
  var overlay = document.getElementById('task-detail-overlay');
  if (overlay) overlay.classList.remove('open');
}



// -- Pipeline filter sheet functions ---------------
var _PF = { stage: 'all', owner: 'all', urgency: 'all' };

function openPipelineFilter() {
  var overlay = document.getElementById('pipeline-filter-overlay');
  if (!overlay) return;
  _buildPFChips('pf-stage-chips', 'stage', [
    {val:'all',label:'All'}, {val:'awaiting_approval',label:'Approval'},
    {val:'awaiting_brand_input',label:'Input'},
    {val:'scheduled',label:'Scheduled'}, {val:'ready',label:'Ready'},
    {val:'in_production',label:'Production'}
  ]);
  _buildPFChips('pf-owner-chips', 'owner', [
    {val:'all',label:'All'}, {val:'chitra',label:'Chitra'},
    {val:'pranav',label:'Pranav'}, {val:'client',label:'Client'}
  ]);
  _buildPFChips('pf-urgency-chips', 'urgency', [
    {val:'all',label:'All'}, {val:'overdue',label:'Overdue'},
    {val:'week',label:'Due this week'}
  ]);
  overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';
  window.AppState.ui.modalOpen = true;
}

function _buildPFChips(containerId, key, options) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = options.map(function(o) {
    var active = _PF[key] === o.val;
    return '<button onclick="_pfChip(\''+key+'\',\''+o.val+'\')"'+
      ' style="font-family:var(--mono);font-size:8px;'+
      'letter-spacing:0.1em;text-transform:uppercase;'+
      'padding:5px 12px;border:1px solid '+
      (active ? '#C8A84B99;color:#C8A84B;' :
      '#FFFFFF1A;color:#555;')+
      'background:transparent;cursor:pointer;">'+o.label+'</button>';
  }).join('');
}

function _pfChip(key, val) {
  _PF[key] = val;
  if (key === 'stage') _buildPFChips('pf-stage-chips', 'stage',
    [{val:'all',label:'All'},{val:'awaiting_approval',label:'Approval'},
     {val:'awaiting_brand_input',label:'Input'},
     {val:'scheduled',label:'Scheduled'},{val:'ready',label:'Ready'},
     {val:'in_production',label:'Production'}]);
  if (key === 'owner') _buildPFChips('pf-owner-chips', 'owner',
    [{val:'all',label:'All'},{val:'chitra',label:'Chitra'},
     {val:'pranav',label:'Pranav'},{val:'client',label:'Client'}]);
  if (key === 'urgency') _buildPFChips('pf-urgency-chips', 'urgency',
    [{val:'all',label:'All'},{val:'overdue',label:'Overdue'},
     {val:'week',label:'Due this week'}]);
}

function applyPipelineFilter() {
  closePipelineFilter();
  var filterIcon = document.querySelector(
    '#pipeline-hdr-row button[onclick*="openPipelineFilter"]');
  if (filterIcon) {
    var hasFilter = _PF.stage!=='all'||_PF.owner!=='all'||
                    _PF.urgency!=='all';
    var badge = filterIcon.querySelector('.filter-active-dot');
    if (!badge && hasFilter) {
      badge = document.createElement('span');
      badge.className = 'filter-active-dot';
      badge.style.cssText = 'position:absolute;top:10px;right:4px;'+
        'width:6px;height:6px;border-radius:50%;background:#C8A84B;'+
        'border:1px solid #080808;';
      filterIcon.appendChild(badge);
    } else if (badge && !hasFilter) {
      badge.remove();
    }
  }
  if (typeof renderPipeline === 'function') renderPipeline();
}

function closePipelineFilter() {
  var overlay = document.getElementById('pipeline-filter-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  window.AppState.ui.modalOpen = false;
  _drainDeferredRender();
}

window.openPipelineFilter = openPipelineFilter;
window.closePipelineFilter = closePipelineFilter;
window.applyPipelineFilter = applyPipelineFilter;
window._pfChip = _pfChip;
window._PF = _PF;

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_fabAttachScroll, 500);
  const titleEl = document.getElementById('app-header-title');
  if (titleEl) titleEl.style.display = 'none';
  var greetHdr = document.getElementById('dash-greeting-hdr');
  if (greetHdr) greetHdr.style.display = '';
  if (typeof updateDashGreeting === 'function') updateDashGreeting();
});

// Agency-only badge refresh. Client users receive notification updates
// via the Supabase Realtime subscription wired in 07-post-load.js
// (_onClientNotificationInsert), so this interval skips them to avoid
// the extra REST round-trip + token race on iPhone Safari.
window.AppState.timers.notifBadgeTimer = setInterval(function() {
  if (document.hidden) return;
  if (!localStorage.getItem('sb_access_token') && !localStorage.getItem('sb_refresh_token')) return;
  var _er = (window.AppState.user && window.AppState.user.effectiveRole) || '';
  if (_er === 'Client') return;
  if (typeof updateNotifBadge === 'function') updateNotifBadge();
}, 20000);

// ===============================================
// GLOBAL ACTION ROUTER (Phase 4 — event delegation)
// Resolves [data-action] targets to their handler.
// Skips interactive elements so inputs/buttons still
// receive native taps; PCS overlay is excluded because
// it owns its own delegate.
// ===============================================
if (!window._routerBound) {
  window._routerBound = true;
  document.addEventListener('click', function handleGlobalClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    // Skip if the click landed on an interactive element nested INSIDE
    // the action container (e.g., an <input> inside a card with
    // data-action). The action element itself may be a <button> — don't
    // block that case.
    const interactive = e.target.closest('input, textarea, [contenteditable="true"], a');
    if (interactive && interactive !== actionEl && actionEl.contains(interactive)) return;
    const type = actionEl.dataset.action;
    const tab = actionEl.dataset.tab;
    window._clickBuffer.push({
      action:     type,
      data:       Object.assign({}, actionEl.dataset),
      post_id:    actionEl.dataset.postId || (actionEl.closest('[data-post-id]')
                  ? actionEl.closest('[data-post-id]').dataset.postId : null),
      success:    true,
      created_at: new Date().toISOString()
    });
    try {
      switch (type) {
        case 'nav-tab':      return guardAction('nav-tab-' + tab, () => switchTab(actionEl));
        case 'nav-library':  return guardAction('nav-library', () => showLibrary());
        case 'nav-insights': return guardAction('nav-insights', () => showInsights());
        case 'pcs-tab':      return guardAction('pcs-tab-' + tab, () => window._pcsTabSwitch(tab));
        case 'pcs-vis':      return guardAction('pcs-vis-' + actionEl.dataset.vis, () => window.setPcsVisibility && window.setPcsVisibility(actionEl, actionEl.dataset.vis));
        case 'ins-metric':   return guardAction('ins-metric-' + actionEl.dataset.metric, () => insSetMetric(actionEl.dataset.metric, actionEl));
        case 'ins-range':    return guardAction('ins-range-' + actionEl.dataset.range, () => insSetRange(actionEl.dataset.range, actionEl));
        case 'ins-period':   return guardAction('ins-period-' + actionEl.dataset.period, () => insSetPostsPeriod(actionEl.dataset.period, actionEl));
        case 'ins-lens':     return guardAction('ins-lens-' + actionEl.dataset.lens, () => insSetLens(actionEl.dataset.lens, actionEl));
        case 'lib-view':     return guardAction('lib-view-' + actionEl.dataset.view, () => libSetView(actionEl.dataset.view, actionEl));
        case 'nrs-urg':      return guardAction('nrs-urg-' + actionEl.dataset.urgency, () => nrsSetUrg(actionEl, actionEl.dataset.urgency));
        case 'ins-main-tab': return guardAction('ins-main-tab-' + actionEl.dataset.tab, () => insSetMainTab(actionEl.dataset.tab, actionEl));
        case 'close-notifications': return guardAction('close-notifications', () => closeNotifications());
        case 'mark-all-read':       return guardAction('mark-all-read', () => markAllNotificationsRead());
        case 'notif-wa':
          return guardAction('notif-wa-' + (actionEl.dataset.postId || ''), function() {
            var pid = actionEl.dataset.postId;
            if (!pid) return;
            if (typeof window._sharePostOnWhatsApp === 'function') {
              window._sharePostOnWhatsApp(pid);
            } else if (typeof showToast === 'function') {
              showToast('WhatsApp share not available', 'error');
            }
          });
        case 'notif-delete':
          return guardAction('notif-delete-' + (actionEl.dataset.notifId || ''), function() {
            var nid = actionEl.dataset.notifId;
            if (nid) deleteNotification(nid);
          });
        case 'overlay-close':
          if (e.target !== actionEl) return;
          return guardAction('overlay-close-' + actionEl.dataset.close, () => {
            var fn = window[actionEl.dataset.close];
            if (typeof fn === 'function') fn();
            else console.warn('[ActionRouter] Unknown close fn:', actionEl.dataset.close);
          });
        case 'pcs-edit-drive-link': {
          var _dlPostId = actionEl.dataset.id;
          var _dlCurrent = window.AppState && window.AppState.pcs && window.AppState.pcs.post
            ? (window.AppState.pcs.post.drive_link || window.AppState.pcs.post.driveLink || '')
            : '';
          var _dlNew = prompt('Drive link:', _dlCurrent);
          if (_dlNew === null) break;
          _dlNew = _dlNew.trim();
          apiFetch('/posts?post_id=eq.' + encodeURIComponent(_dlPostId), {
            method: 'PATCH',
            body: JSON.stringify({ drive_link: _dlNew || null })
          }).then(function() {
            if (window.AppState && window.AppState.pcs && window.AppState.pcs.post) {
              window.AppState.pcs.post.drive_link = _dlNew || null;
            }
            openPCS(_dlPostId, '');
          }).catch(function(err) { console.error('drive link update failed', err); });
          break;
        }
        case 'pcs-clear-drive-link': {
          var _clPostId = actionEl.dataset.id;
          apiFetch('/posts?post_id=eq.' + encodeURIComponent(_clPostId), {
            method: 'PATCH',
            body: JSON.stringify({ drive_link: null })
          }).then(function() {
            if (window.AppState && window.AppState.pcs && window.AppState.pcs.post) {
              window.AppState.pcs.post.drive_link = null;
            }
            openPCS(_clPostId, '');
          }).catch(function(err) { console.error('drive link clear failed', err); });
          break;
        }
        default:
          if (window._appStateDevMode) console.warn('[ActionRouter] Unknown action:', type);
          return;
      }
    } catch(err) {
      console.error('[ActionRouter] Routing Error:', type, err);
      window.logError('[ActionRouter] routing ' + type, err);
      if (typeof window.showToast === 'function') window.showToast('Something went wrong', 'error');
    }
  });
}
