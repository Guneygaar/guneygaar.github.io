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

function navigateWithFilter(tab, filter) {
  if (tab === 'pipeline' || tab === 'upcoming') {
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

function scrollToBucket(bucketKey) {
  setTimeout(() => {
    const grid = document.getElementById('tasks-container');
    if (!grid) return;
    const buckets = grid.querySelectorAll('.bucket-card');
    for (const card of buckets) {
      const name = card.querySelector('.bucket-name')?.textContent?.toLowerCase() || '';
      const keyMap = { production:'in_production', requests:'request', approval:'approval', ready:'ready', scheduled:'scheduled' };
      const match = keyMap[bucketKey] || bucketKey;
      if (name.includes(match)) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.style.outline = '2px solid var(--accent)';
        card.style.outlineOffset = '2px';
        setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 1200);
        break;
      }
    }
  }, 80);
}

const _TAB_TITLES = {
  tasks: null,
  pipeline: 'Pipeline',
  library: 'Library',
  updates: 'Updates',
};

function switchTab(btn) {
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
  } else if (tab === 'tasks') {
    if (titleEl) titleEl.style.display = 'none';
    if (greetHdr) greetHdr.style.display = '';
  } else {
    if (titleEl) { titleEl.style.display = ''; titleEl.textContent = _TAB_TITLES[tab] || tab; }
    if (greetHdr) greetHdr.style.display = 'none';
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
var _notifFilter = 'all';
var _notifData = [];
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
  var effectiveR = window.effectiveRole || window.currentRole || role || 'Admin';
  var display = roleDisplayMap[effectiveR] || roleDisplayMap[role] || { name: name, label: role };
  var displayName = display.name;
  var displayLabel = display.label;
  var nameEl = document.getElementById('notif-name');
  var roleEl = document.getElementById('notif-role');
  var heyEl = nameEl ? nameEl.parentElement : null;
  if (nameEl) {
    if (displayName) {
      nameEl.textContent = displayName;
      if (heyEl) heyEl.style.display = '';
    } else {
      nameEl.textContent = '';
      if (heyEl) heyEl.style.display = 'none';
    }
  }
  if (roleEl) roleEl.textContent = displayLabel;
  var unread = notifs.filter(function(n) { return !n.read; });
  var urgent = notifs.filter(function(n) { return !n.read && ['awaiting_approval','awaiting_brand_input'].includes(n.type); });
  var newItems = notifs.filter(function(n) { return !n.read && n.type === 'ready'; });
  var infoItems = notifs.filter(function(n) { return !n.read && ['scheduled','published','in_production'].includes(n.type); });
  var total = unread.length;
  var attEl = document.getElementById('notif-attention');
  if (attEl) {
    if (total === 0) {
      attEl.innerHTML = 'All sorted';
    } else {
      attEl.innerHTML = '<strong>' + total + '</strong> ' + (total === 1 ? 'thing needs' : 'things need') + ' your attention';
    }
  }
  var bdEl = document.getElementById('notif-breakdown');
  if (bdEl) {
    if (total === 0) {
      bdEl.innerHTML = '<span class="bk-allclear">All sorted</span>';
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
  var typeClass = {
    'awaiting_approval':    'ntype-awaiting_approval',
    'awaiting_brand_input': 'ntype-awaiting_brand_input',
    'ready':                'ntype-ready',
    'scheduled':            'ntype-scheduled',
    'published':            'ntype-published',
    'stage_change':         'ntype-info',
    'in_production':        'ntype-in_production',
  };
  var stagePills = {
    'awaiting_approval':    { label: 'Approval', cls: 'pill-approval' },
    'awaiting_brand_input': { label: 'Brand Input', cls: 'pill-input' },
    'ready':                { label: 'Ready', cls: 'pill-ready' },
    'scheduled':            { label: 'Scheduled', cls: 'pill-scheduled' },
    'published':            { label: 'Published', cls: 'pill-published' },
    'in_production':        { label: 'Production', cls: 'pill-production' },
  };
  function parseActor(msg) {
    if (!msg) return { name: 'System', initials: 'S', cls: 'av-system' };
    var first = msg.split(/\s/)[0].toLowerCase();
    if (first.includes('pranav'))  return { name: 'Pranav',  initials: 'P',  cls: 'av-pranav' };
    if (first.includes('chitra'))  return { name: 'Chitra',  initials: 'Ch', cls: 'av-chitra' };
    if (first.includes('shubham')) return { name: 'Shubham', initials: 'S',  cls: 'av-shubham' };
    if (first.includes('client'))  return { name: 'Client',  initials: 'Cl', cls: 'av-client' };
    return { name: first.charAt(0).toUpperCase() + first.slice(1), initials: first.charAt(0).toUpperCase(), cls: 'av-system' };
  }
  function getActions(n) {
    if (n.type === 'awaiting_approval') return [
      { label: 'Chase Client', cls: 'danger', action: 'chase' },
      { label: 'View', cls: '', action: 'view' }
    ];
    if (n.type === 'ready') return [
      { label: 'Send for Approval', cls: 'success', action: 'approve' },
      { label: 'View', cls: '', action: 'view' }
    ];
    if (n.type === 'awaiting_brand_input') return [
      { label: 'Chase Input', cls: 'danger', action: 'chase' },
      { label: 'View', cls: '', action: 'view' }
    ];
    if (n.type === 'scheduled' || n.type === 'published' || n.type === 'stage_change') return [
      { label: 'View', cls: '', action: 'view' }
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
      var tc = typeClass[n.type] || 'ntype-info';
      var actor = parseActor(n.message);
      var actions = getActions(n);
      var pill = stagePills[n.type];
      var msgText = (n.message || '').replace(/^\S+\s*/, '');
      var actHtml = actions.map(function(a) {
        return '<button class="notif-action-link ' + a.cls + '" onclick="handleNotifAction(\'' + a.action + '\',\'' + (n.post_id||'') + '\',' + n.id + ',event)">' + a.label + '</button>';
      }).join('');
      html += '<div class="notif-item ' + tc + ' ' + (n.read ? '' : 'unread') + '" onclick="openNotifItem(' + n.id + ',\'' + (n.post_id||'') + '\')">';
      html += '<div class="notif-avatar ' + actor.cls + '">' + actor.initials + '</div>';
      html += '<div class="notif-body">';
      html += '<div class="notif-msg"><span class="actor">' + actor.name + '</span> ' + msgText + '</div>';
      html += '<div class="notif-meta">';
      if (pill) html += '<span class="notif-stage-pill ' + pill.cls + '">' + pill.label + '</span> ';
      html += '<span class="notif-time">' + formatTime(n.created_at) + '</span>';
      html += '</div>';
      if (actHtml) html += '<div class="notif-actions-inline">' + actHtml + '</div>';
      html += '</div>';
      html += '<div class="notif-right">';
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
    showChaseToast('Copied to clipboard');
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
  var bellBadge = document.getElementById('notif-bell-badge');
  if (bellBadge) {
    bellBadge.textContent = unread;
    bellBadge.style.display = unread > 0 ? '' : 'none';
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
function closeSnooze() {
  document.getElementById('snooze-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
  _snoozePostId = null;
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
  imp:{color:'var(--cyan)',hex:'#22D3EE',rgba:'rgba(34,211,238,',label:'Impressions',delta:'Growing',sub:'posts in range'},
  eng:{color:'var(--gold)',hex:'#C8A84B',rgba:'rgba(200,168,75,',label:'Avg Engagement',delta:'Above 2% avg',sub:'LinkedIn avg is 2%'},
  fol:{color:'var(--green)',hex:'#3ECF8E',rgba:'rgba(62,207,142,',label:'New Followers',delta:'All organic',sub:'no sponsored'},
  com:{color:'var(--purple)',hex:'#9b87f5',rgba:'rgba(155,135,245,',label:'Total Comments',delta:'High resonance',sub:'public responses'}
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
function insGetRgba(){return INS_METRICS[INS.metric].rgba}

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
  var rgba=insGetRgba();
  var aD='M '+pts[0][0]+' '+H;
  pts.forEach(function(p){aD+=' L '+p[0]+' '+p[1]});
  aD+=' L '+pts[pts.length-1][0]+' '+H+' Z';
  var area=document.createElementNS('http://www.w3.org/2000/svg','path');
  area.setAttribute('d',aD);area.setAttribute('fill',rgba+'0.12)');
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
    bar.style.background=avgs[i]===0?'var(--muted2)':ib?insGetColor():insGetRgba()+'0.3)';
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
    note.style.borderColor=insGetRgba()+'0.3)';
    note.style.background=insGetRgba()+'0.05)';
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
    bar.style.background=d==='03/16'?'var(--green)':'rgba(62,207,142,0.3)';
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
  if(btn){btn.textContent='Saved';btn.style.color='var(--green)';btn.style.borderColor='rgba(62,207,142,0.35)';btn.disabled=true;}
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
      owner:         document.getElementById('nrs-assign').value || 'Pranav',
      content_pillar: document.getElementById('nrs-pillar').value || null,
      format:        document.getElementById('nrs-format').value || null,
      target_date:   document.getElementById('nrs-date').value || null,
      comments:      brief,
      created_by:    actor,
      updated_by:    actor,
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

// -- Notification Bell Sheet -------------------
function openNotifications() {
  var panel = document.getElementById('panel-updates');
  if (!panel) return;
  var overlay = document.getElementById('notif-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'notif-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center;';
    overlay.onclick = function(e) { if (e.target === overlay) closeNotifications(); };
    document.body.appendChild(overlay);
    overlay.appendChild(panel);
  }
  overlay.style.display = 'flex';
  panel.style.cssText = 'width:100%;max-width:480px;max-height:92vh;overflow-y:auto;background:#0e0e0e;display:block;';
  document.body.style.overflow = 'hidden';
  window._modalOpen = true;
  loadNotifications();
}

function closeNotifications() {
  var overlay = document.getElementById('notif-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  window._modalOpen = false;
}

async function loadNotifBadge() {
  try {
    var role = window._userRole || 'admin';
    var data = await apiFetch('/notifications?user_role=eq.' + role + '&read=eq.false&select=id');
    updateNotifBadge(data ? data.length : 0);
  } catch(e) {}
}

window.openNotifications = openNotifications;
window.closeNotifications = closeNotifications;
window.loadNotifBadge = loadNotifBadge;

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

// -- Pipeline icon stubs ---------------------------
function togglePipelineSearch() {
  if (typeof openPipelineSearch === 'function') {
    openPipelineSearch();
  } else {
    var bar = document.getElementById('pipeline-search-bar');
    if (bar) bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
  }
}

function showPipelineMenu() {
  var menu = document.getElementById('pipeline-menu');
  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

window.togglePipelineSearch = togglePipelineSearch;
window.showPipelineMenu = showPipelineMenu;

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
  window._modalOpen = true;
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
      (active ? 'rgba(200,168,75,0.6);color:#C8A84B;' :
      'rgba(255,255,255,0.1);color:#555;')+
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
  window._modalOpen = false;
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
  if (typeof loadNotifBadge === 'function') loadNotifBadge();
});
