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

// -- Safe render --------------------------------
function safeRender() {
  try { renderAll(); } catch (err) { console.error('renderAll error:', err); }
}

function scheduleRender() {
  // Defer background renders while user is interacting with a modal/PCS
  if (window._modalOpen) { window._deferredRender = true; return; }
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(safeRender, 60);
}

function _drainDeferredRender() {
  if (window._deferredRender) {
    window._deferredRender = false;
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(safeRender, 60);
  }
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
  const m = document.getElementById('user-menu');
  if (!m) return;
  const open = m.classList.toggle('open');
  if (open) setTimeout(() => document.addEventListener('click', closeUserMenu, { once: true }), 0);
}
function closeUserMenu() { document.getElementById('user-menu')?.classList.remove('open'); }

// -- Client menu -------------------------------
function toggleClientMenu() {
  const m = document.getElementById('client-menu');
  if (!m) return;
  const open = m.classList.toggle('open');
  if (open) setTimeout(() => document.addEventListener('click', closeClientMenu, { once: true }), 0);
}
function closeClientMenu() { document.getElementById('client-menu')?.classList.remove('open'); }

// -- Global Admin Menu -------------------------
function gamSwitchRole(role) {
  localStorage.setItem('pcs_role_preview', role);
  location.reload();
}

// -- Tabs --------------------------------------
function goToTab(tabName) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) switchTab(btn);
}

/**
 * Standard navigation handler  -  sets filter BEFORE tab switch so the
 * target render function consumes it on the same frame.
 *   tab:    'pipeline'
 *   filter: string[] of stages
 */
function navigateWithFilter(tab, filter) {
  if (tab === 'pipeline' || tab === 'upcoming') {
    // 'upcoming' redirects to pipeline filtered to scheduled
    window.pcsPipelineFilter = (tab === 'upcoming') ? ['scheduled'] : filter;
    tab = 'pipeline';
  }
  goToTab(tab);
}

function goToLibraryFiltered(stage) {
  goToTab('library');
  const sel = document.getElementById('filter-stage');
  if (sel) { sel.value = stage; filterLibrary(); }
}

function goToPipelineStage(stage) { goToTab('pipeline'); }

function scrollToBucket(bucketKey) {
  // Give the tab render a tick to finish, then scroll
  setTimeout(() => {
    const grid = document.getElementById('tasks-container');
    if (!grid) return;
    const buckets = grid.querySelectorAll('.bucket-card');
    // Find the bucket whose header text matches the key loosely
    for (const card of buckets) {
      const name = card.querySelector('.bucket-name')?.textContent?.toLowerCase() || '';
      const keyMap = { production:'in_production', requests:'request', approval:'approval', ready:'ready', scheduled:'scheduled' };
      const match = keyMap[bucketKey] || bucketKey;
      if (name.includes(match)) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Brief highlight flash
        card.style.outline = '2px solid var(--accent)';
        card.style.outlineOffset = '2px';
        setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 1200);
        break;
      }
    }
  }, 80);
}

function _getHeaderDate() {
  var d = new Date();
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

const _TAB_TITLES = {
  tasks: null,
  pipeline: 'Pipeline',
  library: 'Library',
  updates: 'Updates',
};

function switchTab(btn) {
  // Ensure dashboard-view is visible (tab panels live there)
  const dv = document.getElementById('dashboard-view');
  if (dv && !dv.classList.contains('active')) {
    dv.classList.add('active');
    document.getElementById('client-view')?.classList.remove('active');
  }
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  const panel = document.getElementById('panel-' + tab);
  if (panel) panel.classList.add('active');
  // Update header title
  const titleEl = document.getElementById('app-header-title');
  if (titleEl) titleEl.textContent = (tab === 'tasks') ? _getHeaderDate() : (_TAB_TITLES[tab] || tab);
  // Show/hide pipeline search trigger based on active tab
  var searchTrigger = document.getElementById('pipeline-search-trigger');
  if (searchTrigger) searchTrigger.style.display = (tab === 'pipeline') ? '' : 'none';
  // Close pipeline search when leaving pipeline tab
  if (tab !== 'pipeline' && typeof closePipelineSearch === 'function') closePipelineSearch();
  // Reset task chip filter when leaving tasks tab
  if (tab !== 'tasks' && typeof _taskFilter !== 'undefined') {
    window._taskFilter = null;
  }
  // Load notifications when switching to updates tab
  if (tab === 'updates') { loadNotifications(); }
  // Re-render the newly active tab with current data
  safeRender();
  _fabAttachScroll();
}

/* openPipelineSearch / closePipelineSearch / handlePipelineSearch moved to 07-post-load.js */

function switchClientTab(tab) {
  document.querySelectorAll('.client-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.client-tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.client-tab-btn[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById('client-panel-' + tab)?.classList.add('active');
}

// -- Notification formatting helpers -----------
function _notifActor(actor) {
  if (!actor) return 'System';
  const a = actor.toLowerCase();
  if (a.includes('pranav')) return 'Pranav';
  if (a.includes('chitra')) return 'Chitra';
  if (a.includes('client')) return 'Client';
  if (a.includes('admin'))  return 'Admin';
  return 'System';
}

function _notifAction(action) {
  if (!action) return 'updated';
  const a = action.toLowerCase();
  if (a.includes('stage') || a.includes('moved')) {
    const m = action.match(/->\s*(.+)/);
    if (m) return 'moved to ' + m[1].trim();
    return 'changed stage';
  }
  if (a.includes('approved') || a.includes('approve')) return 'approved';
  if (a.includes('rejected') || a.includes('reject')) return 'rejected';
  if (a.includes('created') || a.includes('create') || a.includes('new request')) return 'created';
  if (a.includes('edit') || a.includes('saved'))   return 'updated';
  if (a.includes('comment') || a.includes('change')) return 'requested changes';
  if (a.includes('upload'))  return 'uploaded asset';
  if (a.includes('flag'))    return 'flagged an issue';
  if (a.includes('nudge'))   return 'nudged client';
  if (a.includes('delete'))  return 'deleted';
  if (a.includes('acknowledge')) return 'acknowledged';
  return 'updated';
}

function _notifTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'Today, ' + time;
  const y = new Date(); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday, ' + time;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + time;
}

function _notifTitle(postId) {
  const post = getPostById(postId);
  return post?.title || 'Untitled Post';
}

// -- Notifications (Updates Tab) ---------------
var _notifFilter = 'all';
var _notifData = [];

async function loadNotifications() {
  try {
    var currentRole = window.effectiveRole || window.currentRole || 'Admin';
    var currentName = resolveActor() || 'there';

    var data = await apiFetch('/notifications?select=id,type,message,read,created_at,post_id,user_role&user_role=eq.' + encodeURIComponent(currentRole) + '&order=created_at.desc&limit=50');

    if (!Array.isArray(data)) { console.error('Notifications load error:', data); return; }

    _notifData = data;
    renderNotifications(currentName, currentRole);
    updateNotifBadge();
  } catch(e) {
    console.error('loadNotifications error:', e);
  }
}

function renderNotifications(name, role) {
  var notifs = _notifData;

  var nameEl = document.getElementById('notif-name');
  var roleEl = document.getElementById('notif-role');
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = role;

  var unread = notifs.filter(function(n) { return !n.read; });
  var urgent = notifs.filter(function(n) { return !n.read && ['awaiting_approval','awaiting_brand_input'].includes(n.type); });
  var newItems = notifs.filter(function(n) { return !n.read && n.type === 'ready'; });
  var infoItems = notifs.filter(function(n) { return !n.read && ['scheduled','published','in_production'].includes(n.type); });
  var total = unread.length;

  var attEl = document.getElementById('notif-attention');
  if (attEl) {
    if (total === 0) {
      attEl.innerHTML = 'Everything is up to date';
    } else {
      attEl.innerHTML = '<strong>' + total + '</strong> ' + (total === 1 ? 'thing needs' : 'things need') + ' your attention';
    }
  }

  var bdEl = document.getElementById('notif-breakdown');
  if (bdEl) {
    if (total === 0) {
      bdEl.innerHTML = '<span class="bk-allclear">All clear</span>';
    } else {
      var parts = [];
      if (urgent.length > 0)
        parts.push('<span class="bk-item bk-urgent" onclick="setNotifFilter(\'action\', document.querySelectorAll(\'.nftab\')[1])">'
          + urgent.length + ' urgent</span>');
      if (newItems.length > 0)
        parts.push('<span class="bk-item bk-new" onclick="setNotifFilter(\'unread\', document.querySelectorAll(\'.nftab\')[2])">'
          + newItems.length + ' new</span>');
      if (infoItems.length > 0)
        parts.push('<span class="bk-item bk-info" onclick="setNotifFilter(\'info\', document.querySelectorAll(\'.nftab\')[3])">'
          + infoItems.length + ' ' + (infoItems.length === 1 ? 'update' : 'updates') + '</span>');
      if (unread.length > 0)
        parts.push('<span class="bk-item bk-unread">'
          + unread.length + ' unread</span>');
      bdEl.innerHTML = parts.join('<span class="bk-sep">&#183;</span>');
    }
  }

  var badgeAll = document.getElementById('nftab-badge-all');
  var badgeUnread = document.getElementById('nftab-badge-unread');
  if (badgeAll) { badgeAll.textContent = notifs.length; badgeAll.style.display = notifs.length ? '' : 'none'; }
  if (badgeUnread) { badgeUnread.textContent = unread.length; badgeUnread.style.display = unread.length ? '' : 'none'; }

  var filtered = notifs;
  if (_notifFilter === 'action') filtered = notifs.filter(function(n) { return ['awaiting_approval','awaiting_brand_input'].includes(n.type); });
  if (_notifFilter === 'unread') filtered = notifs.filter(function(n) { return !n.read; });
  if (_notifFilter === 'info') filtered = notifs.filter(function(n) { return ['scheduled','published','in_production','stage_change'].includes(n.type); });

  var scroll = document.getElementById('notif-list-scroll');
  var empty = document.getElementById('notif-empty');
  if (!scroll) return;

  if (filtered.length === 0) {
    scroll.innerHTML = '';
    if (empty) empty.classList.add('visible');
    return;
  }
  if (empty) empty.classList.remove('visible');

  var today = new Date().toDateString();
  var yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  var yesterdayStr = yesterday.toDateString();

  var groups = { Today: [], Yesterday: [], Earlier: [] };
  filtered.forEach(function(n) {
    var d = new Date(n.created_at).toDateString();
    if (d === today) groups.Today.push(n);
    else if (d === yesterdayStr) groups.Yesterday.push(n);
    else groups.Earlier.push(n);
  });

  var typeIcon = {
    'awaiting_approval':    { icon: '!',  cls: 'nic-red' },
    'awaiting_brand_input': { icon: '?',  cls: 'nic-amber' },
    'ready':                { icon: 'R',  cls: 'nic-green' },
    'in_production':        { icon: 'P',  cls: 'nic-amber' },
    'scheduled':            { icon: 'S',  cls: 'nic-cyan' },
    'published':            { icon: 'ok', cls: 'nic-green' },
    'rejected':             { icon: 'X',  cls: 'nic-red' },
    'parked':               { icon: '--',  cls: 'nic-muted' },
    'stage_change':         { icon: '->', cls: 'nic-gold' },
  };

  var typeBorder = {
    'awaiting_approval':    'ntype-chase',
    'awaiting_brand_input': 'ntype-deficit',
    'ready':                'ntype-ready',
    'scheduled':            'ntype-scheduled',
    'published':            'ntype-published',
    'stage_change':         'ntype-info',
    'in_production':        'ntype-info',
  };

  function getContext(n) {
    var d = new Date(n.created_at);
    var timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (n.type === 'awaiting_approval') return { text: 'Awaiting client approval - ' + timeStr, urgent: true };
    if (n.type === 'awaiting_brand_input') return { text: 'Waiting for brand input - ' + timeStr, urgent: true };
    if (n.type === 'ready') return { text: 'Ready to dispatch - ' + timeStr, urgent: false };
    if (n.type === 'published') return { text: 'Published - ' + timeStr, urgent: false };
    if (n.type === 'scheduled') return { text: 'Scheduled - ' + timeStr, urgent: false };
    if (n.type === 'in_production') return { text: 'In production - ' + timeStr, urgent: false };
    return { text: timeStr, urgent: false };
  }

  function getActions(n) {
    if (n.type === 'awaiting_approval') return [
      { label: 'Chase Client', cls: 'nab-red', action: 'chase', id: n.id },
      { label: 'View', cls: 'nab-muted', action: 'view', id: n.id }
    ];
    if (n.type === 'ready') return [
      { label: 'Send for Approval', cls: 'nab-green', action: 'approve', id: n.id },
      { label: 'View', cls: 'nab-muted', action: 'view', id: n.id }
    ];
    if (n.type === 'awaiting_brand_input') return [
      { label: 'Chase Input', cls: 'nab-amber', action: 'chase', id: n.id },
      { label: 'View', cls: 'nab-muted', action: 'view', id: n.id }
    ];
    if (n.type === 'scheduled' || n.type === 'published' || n.type === 'stage_change') return [
      { label: 'View', cls: 'nab-muted', action: 'view', id: n.id }
    ];
    return [];
  }

  function formatTime(created_at) {
    var d = new Date(created_at);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  var html = '';
  ['Today','Yesterday','Earlier'].forEach(function(day) {
    if (!groups[day] || groups[day].length === 0) return;
    html += '<div class="notif-day-label">' + day + '</div>';
    groups[day].forEach(function(n) {
      var ic = typeIcon[n.type] || { icon: '', cls: 'nic-muted' };
      var bc = typeBorder[n.type] || 'ntype-info';
      var ctx = getContext(n);
      var actions = getActions(n);
      var actHtml = actions.map(function(a) {
        return '<button class="notif-action-btn ' + a.cls + '" onclick="handleNotifAction(\'' + a.action + '\',\'' + (n.post_id||'') + '\',' + n.id + ',event)">' + a.label + '</button>';
      }).join('');

      html += '<div class="notif-item ' + bc + ' ' + (n.read ? '' : 'unread') + '" onclick="openNotifItem(' + n.id + ',\'' + (n.post_id||'') + '\')">';
      html += '<div class="notif-icon-circle ' + ic.cls + '">' + ic.icon + '</div>';
      html += '<div class="notif-body">';
      html += '<div class="notif-msg">' + (n.message || '') + '</div>';
      html += '<div class="notif-ctx ' + (ctx.urgent ? 'ctx-urgent' : '') + '">' + ctx.text + '</div>';
      if (actHtml) html += '<div class="notif-action-row">' + actHtml + '</div>';
      html += '</div>';
      html += '<div class="notif-right">';
      html += '<div class="notif-time">' + formatTime(n.created_at) + '</div>';
      if (!n.read) html += '<div class="notif-unread-dot"></div>';
      html += '</div>';
      html += '</div>';
    });
  });

  scroll.innerHTML = html;
}

function setNotifFilter(filter, btn) {
  _notifFilter = filter;
  document.querySelectorAll('.nftab').forEach(function(t) { t.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  var currentRole = window.effectiveRole || window.currentRole || 'Admin';
  var currentName = resolveActor() || 'there';
  renderNotifications(currentName, currentRole);
}

async function openNotifItem(id, postId) {
  await markNotifRead(id);
  if (postId) openPCS(postId);
}

async function handleNotifAction(action, postId, notifId, event) {
  event.stopPropagation();
  await markNotifRead(notifId);
  if (action === 'view' && postId) { openPCS(postId); return; }
  if (action === 'chase' && postId) {
    var post = (window.allPosts || []).find(function(p) { return p.post_id === postId || p.id === postId; });
    var title = post ? post.title : 'this post';
    var msg = 'Hi! Following up on ' + title + ' sent for approval. Please review when you get a chance.';
    if (navigator.clipboard) { navigator.clipboard.writeText(msg); }
    showChaseToast('-> Copied to clipboard');
    return;
  }
  if (action === 'approve' && postId) { openPCS(postId); return; }
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

async function markAllNotificationsRead() {
  try {
    _notifData = _notifData.map(function(n) { return Object.assign({}, n, { read: true }); });
    var currentRole = window.effectiveRole || window.currentRole || 'Admin';
    var currentName = resolveActor() || 'there';
    renderNotifications(currentName, currentRole);
    updateNotifBadge();
    await apiFetch('/notifications?read=eq.false', {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    });
  } catch(e) { console.error('markAllRead error:', e); }
}

function updateNotifBadge() {
  var unread = _notifData.filter(function(n) { return !n.read; }).length;
  var badge = document.getElementById('notif-nav-badge');
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? '' : 'none';
  }
}

// -- PCS Activity toggle -----------------------
function togglePCSActivity() {
  var body = document.getElementById('pcs-activity-body');
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  var trigger = document.getElementById('pc-activity-trigger');
  if (trigger) trigger.classList.toggle('expanded', !isOpen);
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
let _snoozePostId = null;
function openSnooze(postId) {
  _snoozePostId = postId;
  document.getElementById('snooze-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSnooze() {
  document.getElementById('snooze-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
  _snoozePostId = null;
}
function confirmSnooze() {
  const days = parseInt(document.getElementById('snooze-days')?.value) || 1;
  if (!_snoozePostId) return;
  const until = Date.now() + days * 86400000;
  const key = `snooze_${_snoozePostId}`;
  localStorage.setItem(key, until);
  closeSnooze();
  scheduleRender();
  showToast(`Snoozed for ${days} day${days>1?'s':''}`, 'success');
}
function isSnoozed(postId) {
  const key = `snooze_${postId}`;
  const val = localStorage.getItem(key);
  if (!val) return false;
  if (Date.now() > parseInt(val)) { localStorage.removeItem(key); return false; }
  return true;
}

// -- Timeline ----------------------------------
async function openTimeline(postId, title) {
  const overlay = document.getElementById('timeline-overlay');
  if (!overlay) return;
  const _tt = document.getElementById('timeline-title');
  if (_tt) _tt.textContent = title || postId;
  const list = document.getElementById('timeline-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text3);padding:12px 0">Loading...</div>';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  // READ from activity_log removed - activity_log contains system noise.
  // Use notifications table for user-facing messages instead.
  list.innerHTML = '<div style="color:var(--text3);padding:12px 0;font-size:13px">No activity recorded yet.</div>';
}
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

// -- Admin Insights Popup (fix 19) -------------
function openInsights() {
  document.getElementById('insights-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeInsights() {
  document.getElementById('insights-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// -- FAB ---------------------------------------
let _fabScrollEl = null;
let _fabScrollTimer = null;

function _fabAttachScroll() {
  if (_fabScrollEl) _fabScrollEl.removeEventListener('scroll', _fabOnScroll);
  // With height:100vh layout, the .dash-body inside active panel is the scroll container
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
  assignBtn.style.display = (effectiveRole === 'Admin') ? 'flex' : 'none';
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

  // GUARD  -  must have open post
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
    await logActivity({ post_id: postId, actor: resolveActor(), actor_role: window.effectiveRole || 'Admin', action: 'Assigned task to ' + assignee });
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

// -- FAB menu wiring (runs once on DOMContentLoaded) --
document.addEventListener('DOMContentLoaded', function() {
  var backdrop = document.getElementById('fab-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeFabMenu);

  var createPost = document.getElementById('fab-create-post');
  if (createPost) createPost.addEventListener('click', function() {
    closeFabMenu();
    if (typeof openNewPostModal === 'function') openNewPostModal();
    else console.log('[FAB] Create Post clicked');
  });

  var createReq = document.getElementById('fab-create-request');
  if (createReq) createReq.addEventListener('click', function() {
    closeFabMenu();
    if (typeof openRequestSheet === 'function') openRequestSheet();
    else console.log('[FAB] Create Request clicked');
  });

  var assignTask = document.getElementById('fab-assign-task');
  if (assignTask) assignTask.addEventListener('click', function() {
    closeFabMenu();
    console.log('[FAB] Assign Task clicked');
  });
});

// -- Task Detail Modal --------------------------
function openTaskModal(taskId) {
  var task = (window.allTasks || []).find(function(t) { return String(t.id) === String(taskId); });
  if (!task) {
    showToast('Task not found');
    return;
  }

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
        '<button class="btn-modal-primary" onclick="markTaskDone(' + task.id + '); closeTaskModal();">ok Mark as Done</button>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
}

function closeTaskModal() {
  var overlay = document.getElementById('task-detail-overlay');
  if (overlay) overlay.classList.remove('open');
}

// -- Request Sheet ------------------------------
function openRequestSheet() {
  const brief   = document.getElementById('req-sheet-brief');
  const date    = document.getElementById('req-sheet-date');
  const owner   = document.getElementById('req-sheet-owner');
  const overlay = document.getElementById('request-sheet-overlay');
  if (brief)   brief.value   = '';
  if (date)    date.value    = '';
  if (owner)   owner.value   = '';
  if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeRequestSheet() {
  document.getElementById('request-sheet-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function submitRequestSheet() {
  console.log('[REQUEST] Sheet submit clicked');
  const brief = document.getElementById('req-sheet-brief')?.value.trim();
  if (!brief) {
    console.warn('[REQUEST] BLOCKED: missing brief');
    showToast('Please describe the request', 'error');
    return;
  }
  const date  = document.getElementById('req-sheet-date')?.value  || null;
  const owner = document.getElementById('req-sheet-owner')?.value || null;
  const btn   = document.getElementById('req-sheet-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending\u2026'; }
  try {
    const postId = 'REQ-' + Date.now();
    const actor  = resolveActor();
    const payload = {
      post_id:     postId,
      title:       brief.substring(0, 80),
      stage:       'awaiting_brand_input',
      owner:       owner || null,
      comments:    brief,
      target_date: date || null,
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    };
    console.log('[REQUEST] PAYLOAD:', payload);
    await apiFetch('/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log('[REQUEST] API SUCCESS');
    await logActivity({ post_id: postId, actor: actor, actor_role: actor, action: 'New request: ' + brief.substring(0, 60) });
    closeRequestSheet();
    showToast('Request created \u2713', 'success');
    await loadPosts();
  } catch (err) {
    console.error('[REQUEST] API FAILED:', err);
    showToast('Failed \u2014 try again', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Request'; }
  }
}

// Attach FAB scroll on initial load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_fabAttachScroll, 500);
  // Set initial header title to date
  const titleEl = document.getElementById('app-header-title');
  if (titleEl && !titleEl.textContent) titleEl.textContent = _getHeaderDate();
});
