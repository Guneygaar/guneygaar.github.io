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
  localStorage.setItem('gbl_theme', next);
}
(function applyTheme() {
  const saved = localStorage.getItem('gbl_theme') || 'light';
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
 * Standard navigation handler — sets filter BEFORE tab switch so the
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
      const keyMap = { production:'in production', requests:'request', approval:'approval', ready:'ready', scheduled:'scheduled' };
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

const _TAB_TITLES = {
  tasks: 'My Tasks',
  pipeline: 'Pipeline',
  library: 'Library',
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
  if (titleEl) titleEl.textContent = _TAB_TITLES[tab] || tab;
  // Show pipeline search icon only on Pipeline tab
  const searchBtn = document.getElementById('pipeline-search-btn');
  if (searchBtn) searchBtn.style.display = (tab === 'pipeline') ? 'flex' : 'none';
  // Reset task chip filter when leaving tasks tab
  if (tab !== 'tasks' && typeof _taskFilter !== 'undefined') {
    window._taskFilter = null;
  }
  // Re-render the newly active tab with current data
  safeRender();
  _fabAttachScroll();
}

function openPipelineSearch() {
  const overlay = document.getElementById('pipeline-search-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    const input = document.getElementById('pipeline-search-input');
    if (input) { input.value = ''; input.focus(); }
  }
}

function closePipelineSearch() {
  const overlay = document.getElementById('pipeline-search-overlay');
  if (overlay) overlay.style.display = 'none';
}

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
    const m = action.match(/→\s*(.+)/);
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

// -- Notifications -----------------------------
let _notifCache = [];   // cached fetched notifications

async function fetchUnreadCount() {
  try {
    const data = await apiFetch('/activity_log?select=id&read=eq.false&limit=50');
    _unreadCount = Array.isArray(data) ? data.length : 0;
    renderNotificationBadge();
  } catch {}
}

async function fetchAndRenderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:16px;color:var(--text3);text-align:center">Loading\u2026</div>';
  try {
    const data = await apiFetch('/activity_log?select=*&order=created_at.desc&limit=30');
    if (!Array.isArray(data) || !data.length) {
      list.innerHTML = '<div style="padding:16px;color:var(--text3);text-align:center">No activity yet.</div>';
      _notifCache = [];
      return;
    }
    _notifCache = data;
    // Sort: unread first, then by created_at desc
    const sorted = [...data].sort((a, b) => {
      const au = a.read ? 1 : 0, bu = b.read ? 1 : 0;
      if (au !== bu) return au - bu;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    _renderNotifList(sorted, list);
  } catch {
    list.innerHTML = '<div style="padding:16px;color:var(--c-red);text-align:center">Could not load.</div>';
  }
}

function _renderNotifList(data, list) {
  _unreadCount = data.filter(n => !n.read).length;
  renderNotificationBadge();
  list.innerHTML = data.map(n => {
    const actor  = _notifActor(n.actor);
    const action = _notifAction(n.action);
    const title  = _notifTitle(n.post_id);
    const time   = _notifTime(n.created_at);
    const unread = n.read ? '' : ' unread';
    return `
    <div class="notif-item${unread}" data-post-id="${esc(n.post_id || '')}" data-notif-id="${esc(n.id || '')}">
      <div class="notif-primary">${esc(actor)} ${esc(action)}</div>
      <div class="notif-secondary">${esc(title)}</div>
      <div class="notif-ts">${esc(time)}</div>
    </div>`;
  }).join('');
}

async function markAllNotificationsRead() {
  try {
    await apiFetch('/activity_log?read=eq.false', {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    });
    _unreadCount = 0;
    _notifCache.forEach(n => n.read = true);
    renderNotificationBadge();
    const list = document.getElementById('notif-list');
    if (list && _notifCache.length) _renderNotifList(_notifCache, list);
  } catch {}
}

function renderNotificationBadge() {
  const b = document.getElementById('notif-badge');
  if (!b) return;
  if (_unreadCount > 0) {
    b.style.display = '';
    b.textContent = _unreadCount > 9 ? '9+' : _unreadCount;
  } else {
    b.style.display = 'none';
    b.textContent = '';
  }
}

function toggleNotifPanel(e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const open = panel.classList.toggle('open');
  if (open) fetchAndRenderNotifications();
}

// Unified notification listener: click-to-open post + outside-click-close
document.addEventListener('click', function (e) {
  const panel = document.getElementById('notif-panel');
  const btn = document.getElementById('notif-wrap');

  // 1. Notification item click (priority)
  const notifItem = e.target.closest('.notif-item');
  if (notifItem) {
    const postId = notifItem.dataset.postId;
    const notifId = notifItem.dataset.notifId;
    if (postId) openPostFromNotification(postId, notifId, notifItem);
    return;
  }

  // 2. Outside click close
  if (!panel || !panel.classList.contains('open')) return;
  const insidePanel = panel.contains(e.target);
  const clickedBtn = btn && btn.contains(e.target);
  if (!insidePanel && !clickedBtn) {
    panel.classList.remove('open');
  }
});

function openPostFromNotification(postId, notifId, el) {
  // Mark this notification read immediately (UI + DB)
  if (el) el.classList.remove('unread');
  if (notifId) {
    const cached = _notifCache.find(n => String(n.id) === String(notifId));
    if (cached) cached.read = true;
    _unreadCount = _notifCache.filter(n => !n.read).length;
    renderNotificationBadge();
    // Fire-and-forget DB update for this single notification
    apiFetch('/activity_log?id=eq.' + notifId, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  }
  // Close panel
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.remove('open');
  // Open post + flash
  const post = getPostById(postId);
  if (post) {
    openPCS(postId);
    setTimeout(() => {
      const card = document.querySelector('.pcs-card');
      if (card) {
        card.classList.add('flash-highlight');
        card.addEventListener('animationend', () => card.classList.remove('flash-highlight'), { once: true });
      }
    }, 80);
  }
}

// -- PCS Activity toggle -----------------------
function togglePCSActivity() {
  const body = document.getElementById('pcs-activity-body');
  const section = document.getElementById('pcs-history-section');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (section) section.classList.toggle('expanded', !isOpen);
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
  list.innerHTML = '<div style="color:var(--text3);padding:12px 0">Loading…</div>';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  try {
    const data = await apiFetch(`/activity_log?post_id=eq.${encodeURIComponent(postId)}&order=created_at.desc&limit=30`);
    if (!Array.isArray(data) || !data.length) {
      list.innerHTML = '<div style="color:var(--text3);padding:12px 0;font-size:13px">No activity recorded yet.</div>';
      return;
    }
    list.innerHTML = data.map(e => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-action">${esc(e.action||'')}</div>
          <div class="timeline-meta" title="${esc(formatIST(e.created_at))}">${esc(e.actor||'Unknown')} · ${timeAgo(e.created_at)}</div>
        </div>
      </div>`).join('');
  } catch {
    list.innerHTML = '<div style="color:var(--c-red);font-size:13px">Could not load history.</div>';
  }
}
function closeTimeline() {
  document.getElementById('timeline-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// -- Approval link -----------------------------
function copyApprovalLink(url) {
  navigator.clipboard.writeText(url).then(
    () => showToast('Approval link copied ✓', 'success'),
    () => showToast('Could not copy — try manually', 'error')
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
  const fab = document.getElementById('fab');
  if (!fab) return;
  fab.classList.add('hidden');
  clearTimeout(_fabScrollTimer);
  _fabScrollTimer = setTimeout(() => fab.classList.remove('hidden'), 350);
}

function toggleFabMenu() {
  const sheet = document.getElementById('fab-menu-sheet');
  const backdrop = document.getElementById('fab-backdrop');
  if (!sheet) return;
  const open = sheet.classList.toggle('open');
  backdrop.classList.toggle('open', open);
  // Show/hide request button based on role
  const reqBtn = document.getElementById('fab-request-btn');
  if (reqBtn) reqBtn.style.display = '';
  // Show "Assign Task" only for Admin — role only, no other conditions
  const assignBtn = document.getElementById('fab-assign-task');
  if (assignBtn) assignBtn.style.display = (window.effectiveRole === 'Admin') ? 'flex' : 'none';
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

  _fabAssignTask(window._pcs.postId, assignee.trim(), text.trim());
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
    await logActivity({ post_id: postId, actor_name: resolveActor(), actor_role: window.effectiveRole || 'Admin', action: 'Assigned task to ' + assignee });
    if (typeof loadTasks === 'function') loadTasks();
  } catch (err) {
    console.error('[AssignTask] FAILED:', err);
    showToast('Failed to assign task', 'error');
  }
}

function closeFabMenu() {
  document.getElementById('fab-menu-sheet')?.classList.remove('open');
  document.getElementById('fab-backdrop')?.classList.remove('open');
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
      stage:       toDbStage('awaiting brand input'),
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
    await logActivity({ post_id: postId, actor_name: actor, actor_role: actor, action: 'New request: ' + brief.substring(0, 60) });
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
  // Set initial header title
  const titleEl = document.getElementById('app-header-title');
  if (titleEl && !titleEl.textContent) titleEl.textContent = 'My Tasks';
});
