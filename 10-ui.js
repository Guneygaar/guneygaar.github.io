/* ═══════════════════════════════════════════════
   10-ui.js — Toast, tabs, timeline, zen & utils
═══════════════════════════════════════════════ */

// ── Error banner ──────────────────────────────
function showErrorBanner(msg, sub) {
  const b = document.getElementById('error-banner');
  if (!b) return;
  b.querySelector('.error-banner-msg').textContent = msg;
  const s = b.querySelector('.error-banner-sub');
  if (s) s.textContent = sub || '';
  b.classList.remove('hidden');
}
function hideErrorBanner() {
  document.getElementById('error-banner')?.classList.add('hidden');
}

// ── Safe render ────────────────────────────────
function safeRender() {
  try { renderAll(); } catch (err) { console.error('renderAll error:', err); }
}

function scheduleRender() {
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(safeRender, 60);
}

// ── Undo toast ────────────────────────────────
let _undoFn   = null;
let _undoTimer = null;

function showUndoToast(msg, undoFn) {
  clearTimeout(_undoTimer);
  _undoFn = undoFn;
  const t = document.getElementById('undo-toast');
  if (!t) return;
  t.querySelector('.undo-toast-msg').textContent = msg;
  t.classList.add('active');
  _undoTimer = setTimeout(() => t.classList.remove('active'), 5000);
}

function triggerUndo() {
  clearTimeout(_undoTimer);
  document.getElementById('undo-toast')?.classList.remove('active');
  if (_undoFn) { _undoFn(); _undoFn = null; }
}

// ── Toast ─────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent  = msg;
  t.className    = `toast toast-${type} active`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('active'), 3200);
}

// ── Theme ─────────────────────────────────────
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('gbl_theme', next);
}
(function applyTheme() {
  const saved = localStorage.getItem('gbl_theme') || 'light';
  document.documentElement.dataset.theme = saved;
})();

// ── User menu ─────────────────────────────────
function toggleUserMenu() {
  const m = document.getElementById('user-menu');
  if (!m) return;
  const open = m.classList.toggle('open');
  if (open) setTimeout(() => document.addEventListener('click', closeUserMenu, { once: true }), 0);
}
function closeUserMenu() { document.getElementById('user-menu')?.classList.remove('open'); }

// ── Client menu ───────────────────────────────
function toggleClientMenu() {
  const m = document.getElementById('client-user-menu');
  if (!m) return;
  const open = m.classList.toggle('open');
  if (open) setTimeout(() => document.addEventListener('click', closeClientMenu, { once: true }), 0);
}
function closeClientMenu() { document.getElementById('client-user-menu')?.classList.remove('open'); }

// ── Tabs ──────────────────────────────────────
function goToTab(tabName) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) switchTab(btn);
}

function goToLibraryFiltered(stage) {
  goToTab('library');
  const sel = document.getElementById('filter-stage');
  if (sel) { sel.value = stage; filterLibrary(); }
}

function goToPipelineStage(stage) { goToTab('pipeline'); }

function switchTab(btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById('panel-' + btn.dataset.tab);
  if (panel) panel.classList.add('active');
}

function switchClientTab(tab) {
  document.querySelectorAll('.client-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.client-tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.client-tab-btn[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById('client-panel-' + tab)?.classList.add('active');
}

// ── Notifications ─────────────────────────────
async function fetchUnreadCount() {
  try {
    const data = await apiFetch('/activity_log?select=id&read=eq.false&limit=20');
    _unreadCount = Array.isArray(data) ? data.length : 0;
    renderNotificationBadge();
  } catch {}
}

async function fetchAndRenderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:16px;color:var(--text3);text-align:center">Loading…</div>';
  try {
    const data = await apiFetch('/activity_log?select=*&order=created_at.desc&limit=30');
    if (!Array.isArray(data) || !data.length) {
      list.innerHTML = '<div style="padding:16px;color:var(--text3);text-align:center">No activity yet.</div>';
      return;
    }
    list.innerHTML = data.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="notif-actor">${esc(n.actor||'System')}</div>
        <div class="notif-msg">${esc(n.action||'')}</div>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>`).join('');
  } catch {
    list.innerHTML = '<div style="padding:16px;color:var(--c-red);text-align:center">Could not load.</div>';
  }
}

async function markAllNotificationsRead() {
  try {
    await apiFetch('/activity_log?read=eq.false', {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    });
    _unreadCount = 0;
    renderNotificationBadge();
    fetchAndRenderNotifications();
  } catch {}
}

function renderNotificationBadge() {
  const b = document.getElementById('notif-badge');
  if (!b) return;
  b.textContent    = _unreadCount > 9 ? '9+' : _unreadCount;
  b.style.display  = _unreadCount > 0 ? '' : 'none';
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const open = panel.classList.toggle('open');
  if (open) { fetchAndRenderNotifications(); markAllNotificationsRead(); }
}

// ── Time ago ──────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// ── Zen mode ──────────────────────────────────
function openZen(title, comments) {
  const overlay = document.getElementById('zen-overlay');
  if (!overlay) return;
  document.getElementById('zen-title').textContent    = title || '';
  document.getElementById('zen-comments').textContent = comments || '';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeZen() {
  document.getElementById('zen-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Snooze ────────────────────────────────────
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

// ── Timeline ──────────────────────────────────
async function openTimeline(postId, title) {
  const overlay = document.getElementById('timeline-overlay');
  if (!overlay) return;
  document.getElementById('timeline-title').textContent = title || postId;
  const list = document.getElementById('timeline-list');
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
          <div class="timeline-meta">${esc(e.actor||'Unknown')} · ${timeAgo(e.created_at)}</div>
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

// ── Approval link ─────────────────────────────
function copyApprovalLink(url) {
  navigator.clipboard.writeText(url).then(
    () => showToast('Approval link copied ✓', 'success'),
    () => showToast('Could not copy — try manually', 'error')
  );
}

// ── Utility helpers ───────────────────────────
function getTitle(post) { return post.title || post.post_id || 'Untitled'; }
function getPostId(post) { return post.post_id || post.id || ''; }

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d) ? null : d;
}

function formatDate(raw) {
  const d = parseDate(raw);
  if (!d) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
