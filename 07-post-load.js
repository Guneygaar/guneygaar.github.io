/* ===============================================
   07-post-load.js - Data loading & all render*
=============================================== */
console.log("LOADED:", "07-post-load.js");

// -- Activity log cache for stage age --
window._activityLogs = [];
async function _fetchActivityLogs() {
  try {
    var data = await apiFetch(
      '/activity_log?select=post_id,new_stage,created_at' +
      '&order=created_at.desc&limit=500'
    );
    window._activityLogs = Array.isArray(data) ? data : [];
  } catch(e) { window._activityLogs = []; }
}

function isPostStale(p) {
  var s = p.stage || p.stageLC || '';
  if (['published','parked','rejected'].includes(s)) return false;
  var logs = window._activityLogs || [];
  var postShortId = p.post_id || getPostId(p);
  var entry = logs.find(function(l) {
    return (l.post_id === postShortId ||
            l.post_id === p.id) &&
           (l.new_stage === s);
  });
  var changed = entry ? entry.created_at :
    (p.status_changed_at || p.statusChangedAt ||
     p.updated_at || p.updatedAt);
  if (!changed) return false;
  return Math.floor((Date.now()-new Date(changed).getTime())/86400000) >= 2;
}

function _ownerColor(owner) {
  var o = (owner || '').toLowerCase();
  if (o === 'chitra' || o === 'servicing') return '#22D3EE';
  if (o === 'pranav' || o === 'creative') return '#9b87f5';
  if (o === 'client') return '#FF4B4B';
  return '#666';
}

function _staleDays(p) {
  var changed = p.status_changed_at || p.statusChangedAt ||
    p.updated_at || p.updatedAt;
  if (!changed) return 0;
  return Math.floor((Date.now() - new Date(changed).getTime()) / 86400000);
}
window.isPostStale = isPostStale;

// -- Pipeline search state --
var _pipelineSearchOpen = false;

function openPipelineSearch() {
  _pipelineSearchOpen = true;
  var hdr = document.querySelector('.app-header');
  var bar = document.getElementById('pipeline-search-bar');
  if (hdr) hdr.classList.add('searching');
  if (bar) bar.classList.add('open');
  setTimeout(function() {
    var input = document.getElementById('pipeline-search-input');
    if (input) input.focus();
  }, 200);
}

function closePipelineSearch() {
  _pipelineSearchOpen = false;
  var hdr = document.querySelector('.app-header');
  var bar = document.getElementById('pipeline-search-bar');
  var results = document.getElementById('pipeline-search-results');
  var empty = document.getElementById('pipeline-search-empty');
  var container = document.getElementById('pipeline-container');
  var input = document.getElementById('pipeline-search-input');
  if (hdr) hdr.classList.remove('searching');
  if (bar) bar.classList.remove('open');
  if (results) { results.classList.remove('visible'); results.innerHTML = ''; }
  if (empty) empty.classList.remove('visible');
  if (container) container.classList.remove('search-dimmed');
  if (input) input.value = '';
}

// -- Pipeline critical header line --
function updatePipelineCritical(posts) {
  var el = document.getElementById('pipeline-critical');
  if (!el) return;
  var _isClientCrit = (effectiveRole || '').toLowerCase() === 'client';
  if (_isClientCrit) { el.textContent = ''; return; }
  var allP = posts || allPosts || [];
  var now = new Date();
  var overdue = allP.filter(function(p) {
    return isPostStale(p);
  }).sort(function(a,b) {
    var ac = a.status_changed_at||a.statusChangedAt||a.updated_at||a.updatedAt||'';
    var bc = b.status_changed_at||b.statusChangedAt||b.updated_at||b.updatedAt||'';
    return new Date(ac) - new Date(bc);
  });
  if (overdue.length) {
    var oldest = overdue[0];
    var changedAt = oldest.status_changed_at||oldest.statusChangedAt||oldest.updated_at||oldest.updatedAt;
    var daysOver = changedAt ? Math.floor((Date.now() - new Date(changedAt).getTime()) / 86400000) : 0;
    el.textContent = (oldest.title||'A post') + ' ' + daysOver + 'd in stage \u00b7 sort now';
    el.style.color = 'var(--c-red)';
    return;
  }
  var approval = allP.filter(function(p) { return (p.stage||p.stageLC||'') === 'awaiting_approval'; });
  if (approval.length >= 5) {
    el.textContent = approval.length + ' posts waiting on approval \u00b7 client needs to sort';
    el.style.color = 'var(--c-amber)';
    return;
  }
  var scheduled = allP.filter(function(p) { return (p.stage||p.stageLC||'') === 'scheduled'; }).sort(function(a,b) { return new Date(a.targetDate||a.target_date) - new Date(b.targetDate||b.target_date); });
  if (scheduled.length) {
    var next = scheduled[0];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var d = new Date(next.targetDate||next.target_date);
    var diff = Math.ceil((d - now) / 86400000);
    var when = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : 'in ' + diff + 'd';
    el.textContent = (next.title||'Next post') + ' goes live ' + when + ' \u00b7 pipeline sorted';
    el.style.color = 'var(--c-green)';
    return;
  }
  el.textContent = 'Pipeline sorted \u00b7 keep going';
  el.style.color = '#555';
}

// -- Pipeline stage bar --
function updatePipelineStageBar(posts) {
  var bar = document.getElementById('pipeline-stage-bar');
  if (!bar) return;
  var allP = posts || allPosts || [];
  var stageDefs = [
    { key: 'awaiting_approval', color: 'var(--c-red)' },
    { key: 'awaiting_brand_input', color: 'var(--c-purple)' },
    { key: 'in_production', color: 'var(--c-amber)' },
    { key: 'scheduled', color: 'var(--c-cyan)' },
    { key: 'ready', color: 'var(--c-green)' }
  ];
  var active = allP.filter(function(p) { return !['published','parked','rejected'].includes(p.stage||p.stageLC||''); });
  var total = active.length || 1;
  var segments = [];
  stageDefs.forEach(function(s) {
    var count = allP.filter(function(p) { return (p.stage||p.stageLC||'') === s.key; }).length;
    if (count) segments.push({ count: count, color: s.color, key: s.key });
  });
  bar.innerHTML = segments.map(function(s) {
    return '<div style="flex:' + s.count + ';background:' + s.color + ';height:3px;cursor:pointer;" onclick="filterPipelineStage(\'' + s.key + '\')"></div>';
  }).join('');
}

window.filterPipelineStage = function(stage) {
  var chip = document.querySelector('[data-stage="' + stage + '"]');
  if (chip) chip.click();
  else { var all = document.querySelector('[data-stage="all"]'); if (all) all.click(); }
};

// -- Pipeline filter apply --
function _applyPFFilter(posts) {
  var pf = window._PF || { stage: 'all', owner: 'all', urgency: 'all' };
  return posts.filter(function(p) {
    var stage = p.stage || p.stageLC || '';
    var owner = (p.owner || '').toLowerCase();
    if (pf.stage !== 'all' && stage !== pf.stage) return false;
    if (pf.owner !== 'all') {
      if (owner !== pf.owner) return false;
    }
    if (pf.urgency === 'overdue' && !isPostStale(p)) return false;
    if (pf.urgency === 'week') {
      var td = new Date(p.targetDate || p.target_date);
      var diff = Math.ceil((td - new Date()) / 86400000);
      if (diff < 0 || diff > 7) return false;
    }
    return true;
  });
}
window._applyPFFilter = _applyPFFilter;

// -- Format pipeline date with color --
function formatPipelineDate(dateStr) {
  if (!dateStr) return { text: '-- --', color: '#555' };
  var d = new Date(dateStr);
  if (isNaN(d)) return { text: dateStr, color: '#555' };
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul',
                'Aug','Sep','Oct','Nov','Dec'];
  var base = days[d.getDay()] + ' \u00b7 ' + d.getDate() +
             ' ' + months[d.getMonth()];
  var now = new Date();
  var diff = Math.ceil((new Date(d.getFullYear(),d.getMonth(),d.getDate()) -
             new Date(now.getFullYear(),now.getMonth(),now.getDate())) / 86400000);
  if (diff < 0) return {
    text: base + ' \u00b7 ' + Math.abs(diff) + 'd overdue',
    color: 'var(--c-red)'
  };
  if (diff === 0) return { text: base + ' \u00b7 today',
    color: 'var(--c-cyan)' };
  if (diff === 1) return { text: base + ' \u00b7 tomorrow',
    color: 'var(--c-cyan)' };
  if (diff <= 3) return { text: base + ' \u00b7 ' + diff + 'd left',
    color: 'var(--c-amber)' };
  return { text: base + ' \u00b7 ' + diff + 'd left', color: '#555' };
}

function openSearchResult(postId) {
  console.log('openSearchResult fired with:', postId);
  closePipelineSearch();
  setTimeout(function() {
    openPCS(postId);
  }, 50);
}

function handlePipelineSearch(query) {
  var results = document.getElementById('pipeline-search-results');
  var empty = document.getElementById('pipeline-search-empty');
  var container = document.getElementById('pipeline-container');
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];

  var pipelineStages = ['awaiting_approval','awaiting_brand_input','scheduled','ready','in_production'];
  var pipelinePosts = posts.filter(function(p) { return pipelineStages.indexOf(p.stage) > -1; });

  if (!query || query.trim() === '') {
    if (results) { results.classList.remove('visible'); results.innerHTML = ''; }
    if (empty) empty.classList.remove('visible');
    if (container) container.classList.remove('search-dimmed');
    return;
  }

  if (container) container.classList.add('search-dimmed');
  var q = query.toLowerCase().trim();

  var stageDisplayMap = {
    'awaiting_approval': 'Approval',
    'awaiting_brand_input': 'Input',
    'scheduled': 'Scheduled',
    'ready': 'Ready',
    'in_production': 'Production'
  };
  var stageColorMap = {
    'awaiting_approval': '#FF4B4B',
    'awaiting_brand_input': '#9b87f5',
    'scheduled': '#22D3EE',
    'ready': '#3ECF8E',
    'in_production': '#F6A623'
  };

  var matches = pipelinePosts.filter(function(p) {
    return (p.title && p.title.toLowerCase().indexOf(q) > -1) ||
           (p.contentPillar && p.contentPillar.toLowerCase().indexOf(q) > -1) ||
           (p.owner && p.owner.toLowerCase().indexOf(q) > -1);
  });

  if (matches.length === 0) {
    if (results) { results.classList.remove('visible'); results.innerHTML = ''; }
    if (empty) empty.classList.add('visible');
    return;
  }

  if (empty) empty.classList.remove('visible');

  var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var html = matches.map(function(p) {
    var highlighted = (p.title || '').replace(
      new RegExp('(' + escaped + ')', 'gi'),
      '<mark>$1</mark>'
    );
    var color = stageColorMap[p.stage] || '#555';
    var badgeLabel = stageDisplayMap[p.stage] || p.stage;
    var badgeClass = 'badge-' + p.stage;
    var pillar = p.contentPillar || '';
    return '<div class="pipeline-search-result-item" onclick="openSearchResult(\'' + (p.post_id || p.id) + '\')">' +
      '<div class="result-stage-dot" style="background:' + color + '"></div>' +
      '<div class="pipeline-result-body">' +
        '<div class="pipeline-result-title">' + highlighted + '</div>' +
        '<div class="pipeline-result-meta">' + pillar + '</div>' +
      '</div>' +
      '<span class="result-stage-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
    '</div>';
  }).join('');

  if (results) { results.innerHTML = html; results.classList.add('visible'); }
}

// -- Batch selection state --
var _batchMode = false;
var _batchSelected = new Set();

// -- Person filter state --
var _activePerson = null;

// -- Group collapse state (persists across re-renders) --
var _collapsedGroups = {};

function togglePipelineGroup(stage) {
  _collapsedGroups[stage] = !_collapsedGroups[stage];
  var section = document.getElementById('group-section-' + stage);
  if (section) {
    section.classList.toggle('collapsed', !!_collapsedGroups[stage]);
  }
}

window._pipelinePubExpanded = false;
function togglePipelinePub() {
  window._pipelinePubExpanded = !window._pipelinePubExpanded;
  var group = document.getElementById('pipeline-pub-group');
  if (group) group.classList.toggle('pipeline-pub-expanded', window._pipelinePubExpanded);
}
window.togglePipelinePub = togglePipelinePub;

// Depends on: 01-config.js (STAGES_DB, STAGE_DISPLAY, PILLARS_DB, PILLAR_DISPLAY)

// -- Unified link helpers  -  SINGLE SOURCE OF TRUTH for link display --
function getPostLink(post) {
  return post.postLink || post.linkedinUrl || '';
}

function getPostLinkType(post) {
  const link = post.postLink || post.linkedinUrl;
  if (!link) return null;
  if (link.includes('linkedin.com')) return 'linkedin';
  if (link.includes('canva.com')) return 'canva';
  return 'other';
}

function getPostLinkLabel(post) {
  const type = getPostLinkType(post);
  if (type === 'canva') return 'Open in Canva';
  if (type === 'linkedin') return 'View on LinkedIn';
  if (type === 'other') return 'Open Link';
  return '';
}

// -- Central merge  -  the ONLY way to update allPosts from server data --
// Skips posts with _isSaving === true (in-flight PATCH).
// Never replaces allPosts blindly  -  always mutates existing objects in-place.
function mergePosts(fresh) {
  // Normalize DB stage values -> UI stage values on ingest
  fresh.forEach(fp => { if (fp.stage) fp.stage = toUiStage(fp.stage); });

  const map = new Map(allPosts.map(p => [getPostId(p), p]));

  fresh.forEach(fp => {
    const id = getPostId(fp);
    const existing = map.get(id);

    if (!existing) {
      map.set(id, fp);
      return;
    }

    // Skip overwrite while a PATCH is in-flight for this post
    if (existing._isSaving) {
      console.log('[PCS] MERGE SKIP (_isSaving):', id, 'local=' + existing.stage, 'server=' + fp.stage);
      return;
    }

    // No in-flight write  -  let server win
    // Log stage change from poll merge BEFORE Object.assign overwrites it
    if (existing.stage !== fp.stage) {
      setStage(existing, fp.stage, 'poll_merge');
    }
    Object.assign(existing, fp);
  });

  // Remove posts deleted on server
  const freshIds = new Set(fresh.map(p => getPostId(p)));
  map.forEach((_, id) => { if (!freshIds.has(id)) map.delete(id); });

  // Mutate in-place  -  preserve the single array reference
  allPosts.length = 0;
  map.forEach(p => allPosts.push(p));
  cachedPosts = allPosts;
}

// -- Versioned load guard  -  prevents stale responses from overriding fresh data --
function _newPostsRequest() {
  window._postsReqId += 1;
  return window._postsReqId;
}

function _commitPostsResult(reqId, source) {
  if (reqId !== window._postsReqId) return false;
  window._postsLoaded = true;
  window._postsSource = source;
  return true;
}

function showLoadingSkeleton(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = [1,2,3].map(() => `<div class="skeleton skeleton-card"></div>`).join('');
}

async function loadPosts() {
  if ((window.effectiveRole || '').toLowerCase() === 'client') {
    if (typeof loadPostsForClient === 'function') loadPostsForClient();
    return;
  }
  showLoadingSkeleton('tasks-container');
  const reqId = _newPostsRequest();
  try {
    const data = await apiFetch('/posts?select=*&order=id.desc');
    if (!_commitPostsResult(reqId, 'network')) return;
    mergePosts(normalise(data));
    hideErrorBanner();
    scheduleRender();
    showToast(`${allPosts.length} posts loaded`, 'success');
  } catch (err) {
    console.error('loadPosts:', err);
    if (cachedPosts.length) {
      if (!_commitPostsResult(reqId, 'cache')) return;
      allPosts.length = 0;
      cachedPosts.forEach(p => allPosts.push(p));
      scheduleRender();
      showErrorBanner('Could not reach server. Showing cached data.',
        `Last updated: ${formatIST(new Date().toISOString())}`);
    } else {
      const tc = document.getElementById('tasks-container');
      if (tc) tc.innerHTML =
        `<div class="empty-state">
          <div class="empty-icon">[!]</div>
          <p><strong>Could not load posts.</strong><br>Check your connection.</p>
          <button onclick="loadPosts()" style="margin-top:12px;padding:8px 18px;
            border-radius:8px;background:var(--accent);color:var(--bg);
            border:none;font-weight:600;cursor:pointer;font-size:13px">Try Again</button>
        </div>`;
      showErrorBanner('Could not reach server.');
    }
    showToast('Failed to load posts', 'error');
  }
}

async function loadPostsForClient() {
  const reqId = _newPostsRequest();
  try {
    const data  = await apiFetch('/posts?select=*&order=created_at.desc');
    if (!_commitPostsResult(reqId, 'network')) return;
    mergePosts(normalise(data));
    hideErrorBanner();
    renderClientView();
  } catch (err) {
    if (cachedPosts.length) {
      if (!_commitPostsResult(reqId, 'cache')) return;
      allPosts.length = 0;
      cachedPosts.forEach(p => allPosts.push(p));
      renderClientView();
      showErrorBanner('Showing cached data - connection issue.');
    } else {
      const catb = document.getElementById('client-approved-tbody');
      if (catb) catb.innerHTML =
        `<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">[!]</div>
        <p>Could not load. Check your connection.</p></div></td></tr>`;
    }
  }
}

// Background token refresh interval handle (separate from data poll)
let _tokenRefreshTimer = null;

// Lightweight fingerprint: count + ids + stages (avoids full JSON.stringify)
function _postsFingerprint(posts) {
  let s = '' + posts.length;
  for (let i = 0; i < posts.length; i++) {
    s += '|' + (posts[i].post_id || posts[i].id || '') + ':' + (posts[i].stage || '');
  }
  return s;
}

function startRealtime() {
  if (_realtimeTimer) return;

  // Data polling  -  every 15 seconds (was 8s; reduces API calls & DOM churn)
  _realtimeTimer = setInterval(async () => {
    if (document.hidden) return;
    // Skip poll while user is in a modal  -  they'll get fresh data on close
    if (window._modalOpen) return;
    try {
      const data  = await apiFetch('/posts?select=*&order=created_at.desc');
      const fresh = normalise(data);
      if (_postsFingerprint(fresh) !== _postsFingerprint(allPosts)) {
        mergePosts(fresh);
        scheduleRender();
        updateNotifBadge();
      }
    } catch (e) {
      console.warn('realtime poll failed:', e.message);
    }
  }, 15000);

  // Proactive token refresh  -  every 50 minutes
  // Keeps sessions alive indefinitely without user action
  if (!_tokenRefreshTimer) {
    _tokenRefreshTimer = setInterval(async () => {
      if (!localStorage.getItem('sb_refresh_token')) return;
      const newToken = await refreshSession();
      if (!newToken) {
        console.warn('Background token refresh failed  -  user may need to re-login');
      }
    }, 50 * 60 * 1000); // 50 minutes
  }
}

function stopRealtime() {
  clearInterval(_realtimeTimer);
  _realtimeTimer = null;
  clearInterval(_tokenRefreshTimer);
  _tokenRefreshTimer = null;
}

async function loadTasks() {
  try {
    const data = await apiFetch('/tasks?order=created_at.desc&limit=50');
    allTasks = Array.isArray(data) ? data : [];
  } catch { allTasks = []; }
  renderTaskBanner();
  renderAdminTaskPanel();
}

async function assignTask() {
  const assignee = document.getElementById('atask-assignee').value.trim();
  const msg      = document.getElementById('atask-msg').value.trim();
  const due      = document.getElementById('atask-due').value || null;
  if (!assignee) { showToast('Select who to assign to', 'error'); return; }
  if (!msg)      { showToast('Enter a task message', 'error'); return; }
  try {
    await apiFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({ assigned_to: assignee, message: msg, due_date: due }),
    });
    document.getElementById('atask-msg').value      = '';
    document.getElementById('atask-due').value      = '';
    document.getElementById('atask-assignee').value = '';
    showToast('Task assigned OK', 'success');
    await loadTasks();
  } catch { showToast('Failed - try again', 'error'); }
}

async function markTaskDone(id) {
  const el = document.getElementById(`task-item-${id}`);
  const btn = el?.querySelector('.btn-task-done');
  const checkbox = el?.querySelector('.task-check');

  // Double-click guard
  if (btn?.disabled) return;
  if (btn) btn.disabled = true;
  if (checkbox) checkbox.disabled = true;

  // Optimistic UI
  if (el) el.classList.add('task-done');

  try {
    await apiFetch(`/tasks?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ done: true }),
    });
    console.log('[Task] Completed:', id);
    showToast('\u2713 Task completed', 'success');
    // UX delay  -  let user see the strike-through, then refresh everything
    setTimeout(async () => {
      try {
        await loadTasks();
        // Refresh posts -> mergePosts -> scheduleRender -> updateStats (scoreboard)
        const data = await apiFetch('/posts?select=*&order=id.desc');
        mergePosts(normalise(data));
        scheduleRender();
        flashScoreboard();
        console.log('[Task\u2192Scoreboard] Synced');
      } catch (err) {
        console.error('[Task\u2192Scoreboard] Sync failed:', err);
      }
    }, 600);
  } catch (err) {
    console.error('[Task] Failed:', err);
    showToast('Failed - try again', 'error');
    // Rollback
    if (el) el.classList.remove('task-done');
    if (btn) btn.disabled = false;
    if (checkbox) { checkbox.disabled = false; checkbox.checked = false; }
  }
}

if (!window._taskClickBound) {
  window._taskClickBound = true;

  document.body.addEventListener('click', function(e) {
    var task = e.target.closest('.task-banner-item');
    if (!task) return;

    // STRONG checkbox + label + button protection
    if (
      e.target.closest('.task-check') ||
      e.target.closest('.btn-task-done') ||
      e.target.type === 'checkbox' ||
      e.target.tagName === 'LABEL'
    ) return;

    var taskId = task.dataset.taskId;
    var postId = task.dataset.postId;

    // GUARD  -  invalid task
    if (!taskId) {
      showToast('Invalid task');
      return;
    }

    // CASE 1  -  POST TASK -> open PCS
    if (postId) {
      if (typeof openPCS !== 'function') {
        console.error('[PCS] openPCS missing');
        showToast('Unable to open post');
        return;
      }
      console.log('[TASK -> PCS]', postId);
      openPCS(postId);
      return;
    }

    // CASE 2  -  INSTRUCTION TASK -> open modal
    console.log('[TASK -> MODAL]', taskId);
    openTaskModal(taskId);
  });
}

// -- Scoreboard block click delegation --
if (!window._scoreboardClickBound) {
  window._scoreboardClickBound = true;

  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-action]');
    if (!el || !el.closest('#pcs-dashboard')) return;

    e.stopPropagation();

    var action = el.dataset.action;

    switch (action) {
      case 'open-production':
        if (typeof navigateWithFilter === 'function') navigateWithFilter('pipeline', ['in_production']);
        break;
      case 'open-pranav':
        if (typeof navigateWithFilter === 'function') navigateWithFilter('pipeline', ['ready', 'awaiting_approval', 'awaiting_brand_input', 'scheduled']);
        break;
      case 'open-chitra':
        if (typeof navigateWithFilter === 'function') navigateWithFilter('pipeline', ['ready', 'awaiting_approval', 'awaiting_brand_input']);
        break;
      case 'open-runway':
        if (typeof navigateWithFilter === 'function') navigateWithFilter('pipeline', ['scheduled']);
        break;
      case 'open-ready':
        if (typeof navigateWithFilter === 'function') navigateWithFilter('pipeline', ['ready']);
        break;
      case 'open-approval':
        if (typeof navigateWithFilter === 'function') navigateWithFilter('pipeline', ['awaiting_approval']);
        break;
      case 'open-input':
        if (typeof navigateWithFilter === 'function') navigateWithFilter('pipeline', ['awaiting_brand_input']);
        break;
      default:
        console.warn('[SB] Unknown action', action);
    }
  });
}

document.addEventListener('change', function(e) {
  if (!e.target.classList.contains('task-check')) return;
  const taskId = e.target.dataset.taskId;
  if (taskId) markTaskDone(Number(taskId));
});

async function deleteTask(id) {
  try {
    await apiFetch(`/tasks?id=eq.${id}`, { method: 'DELETE' });
    await loadTasks();
  } catch { showToast('Failed - try again', 'error'); }
}

function renderAll() {
  if ((window.effectiveRole || '').toLowerCase() === 'client') {
    var clientTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'tasks';
    if (clientTab === 'pipeline') {
      if (typeof renderPipeline === 'function') renderPipeline();
      return;
    }
    if (clientTab === 'library') {
      return;
    }
    if (typeof renderClientView === 'function') renderClientView();
    return;
  }
  if (window._modalOpen) return;
  const run = (name, fn) => { try { fn(); } catch(e) { console.error('renderAll:' + name, e); } };

  // Always render: lightweight stats & role visibility
  run('updateStats',        updateStats);
  run('roleVisibility',     applyRoleVisibility);

  // Active tab detection  -  only render the visible tab
  const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'tasks';

  // Tasks tab widgets (always needed when tasks visible)
  if (activeTab === 'tasks') {
    run('dashboard',          renderDashboard);
    run('dashHdr',            updateDashboardHeader);
    run('pipelineStrip',      renderPipelineStrip);
    run('productionMeter',    renderProductionMeter);
    run('adminInsight',       renderAdminInsight);
    run('taskBanner',         renderTaskBanner);
    run('adminTaskPanel',     renderAdminTaskPanel);
    run('creativeTracker',    renderCreativeTracker);
    run('nextPost',           renderNextPost);
    run('tasks',              renderTasks);
    run('taskStageChips',     renderTaskStageChips);
  } else if (activeTab === 'pipeline') {
    run('pipeline',           renderPipeline);
    run('pipelineHdr',        updatePipelineHeader);
  } else if (activeTab === 'library') {
    run('library',            renderLibrary);
    run('filterDropdowns',    populateFilterDropdowns);
  }

  const pl = document.getElementById('pipeline-label');
  const ll = document.getElementById('library-label');
  if (pl) pl.textContent = `${allPosts.length} posts`;
  const _libDefault = ['scheduled','published'];
  const libCount = allPosts.filter(p => _libDefault.includes(p.stage || '')).length;
  if (ll) ll.textContent = `${libCount} posts`;
}

function updateStats() {
  const today   = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  let published=0,awaitingApproval=0,inPipeline=0,dueWeek=0,overdue=0,readyToSend=0;
  allPosts.forEach(p => {
    const stage = p.stage || '';
    if (stage === 'published') published++;
    if (stage === 'awaiting_approval') awaitingApproval++;
    if (!['published','parked','rejected'].includes(stage)) inPipeline++;
    if (stage === 'ready') readyToSend++;
    const d = parseDate(p.targetDate);
    if (d) {
      if (d > today && d <= weekEnd) dueWeek++;
      if (d < today && !['published','parked','rejected'].includes(stage)) overdue++;
    }
  });
  setText('s-total',     allPosts.length);
  setText('s-published', published);
  setText('s-approval',  awaitingApproval);
  setText('s-pipeline',  inPipeline);
  setText('s-week',      dueWeek);
  setText('s-overdue',   overdue);
  setText('s-ready',     `${readyToSend}/${READY_TO_SEND_TARGET}`);
  updateBadge('badge-tasks',    getMyTasks().length);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function updateBadge(id, count) {
  const el = document.getElementById(id);
  if (el) { el.textContent = count; el.style.display = count > 0 ? '' : 'none'; }
}

function flashScoreboard() {
  const el = document.getElementById('pcs-dashboard');
  if (!el) return;
  el.classList.remove('score-flash');
  // Force reflow so re-adding the class triggers animation
  void el.offsetWidth;
  el.classList.add('score-flash');
  setTimeout(() => el.classList.remove('score-flash'), 350);
}

function _ttNorm(v) { return (v || '').toString().trim().toLowerCase(); }

function _ttIsMine(task, role, emailPrefix) {
  const a = _ttNorm(task.assigned_to);
  return a === role || (emailPrefix && a.includes(emailPrefix));
}

function _ttOldestFirst(a, b) {
  return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
}

function _ttByStage(stage) {
  return allPosts
    .filter(p => (p.stage || '') === stage)
    .sort(_ttOldestFirst);
}

function _ttTruncate(str, n = 42) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '\u2026' : str;
}

// B-02 FIX: Detect failed_publish = scheduled posts whose target_date is in the past
function _ttFailedPublish() {
  var todayStr = new Date().toISOString().split('T')[0];
  return allPosts
    .filter(function(p) { return p.stage === 'scheduled' && p.target_date && p.target_date < todayStr; })
    .sort(function(a, b) { return (a.target_date || '') < (b.target_date || '') ? -1 : 1; });
}

// B-01 FIX: Check if awaiting_approval posts are aging ( 2 days in stage)
function _ttAgingAwaiting() {
  var twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  return allPosts.filter(function(p) {
    return p.stage === 'awaiting_approval' &&
      p.status_changed_at &&
      new Date((p.status_changed_at || '') + 'Z') < twoDaysAgo;
  });
}

function getTopTask() {
  const postMap = Object.fromEntries(
    allPosts.map(p => [getPostId(p), p])
  );
  function _ttPostTitle(postId) {
    if (!postId) return '';
    const p = postMap[postId];
    return p ? getTitle(p) : '';
  }

  const role = _ttNorm(window.effectiveRole || '');
  const email = localStorage.getItem('hinglish_email') || '';
  const emailPrefix = email ? email.split('@')[0].toLowerCase() : '';

  // B-02 FIX: PRIORITY 1  Failed publish (scheduled post past target_date) is same-day emergency
  const failedPub = _ttFailedPublish();
  if (failedPub.length) {
    return { type: 'failed_publish', text: 'FIX PUBLISH  ' + getTitle(failedPub[0]), postId: getPostId(failedPub[0]) };
  }

  // 2. ASSIGNED TASKS (high priority for all roles)
  const myTasks = (window.allTasks || [])
    .filter(t => !t.done && _ttIsMine(t, role, emailPrefix))
    .sort(_ttOldestFirst);
  if (myTasks.length) {
    const t = myTasks[0];
    const msg = t.message || 'Complete assigned task';
    const title = _ttPostTitle(t.post_id);
    return { type: 'assigned', text: title ? msg + ' \u2014 ' + _ttTruncate(title) : msg, postId: t.post_id || null };
  }

  // 3. ROLE-BASED PRIORITY

  if (role === 'pranav') {
    const prod = _ttByStage('in_production');
    if (prod.length) return { type: 'production', text: 'Create post -- ' + getTitle(prod[0]), postId: getPostId(prod[0]) };
    return null;
  }

  if (role === 'chitra') {
    const ready = _ttByStage('ready');
    const agingAwaiting = _ttAgingAwaiting();

    // B-01 FIX: When aging awaiting exists, distinguish between FOLLOW UP + SEND vs FOLLOW UP ONLY
    if (agingAwaiting.length && ready.length) {
      return { type: 'approval', text: 'Follow up + Send -- ' + getTitle(agingAwaiting[0]), postId: getPostId(agingAwaiting[0]) };
    }
    if (agingAwaiting.length && !ready.length) {
      return { type: 'approval', text: 'Follow up only -- ' + getTitle(agingAwaiting[0]), postId: getPostId(agingAwaiting[0]) };
    }

    // Non-aging awaiting_approval  schedule/send first
    const approval = _ttByStage('awaiting_approval');
    if (approval.length) return { type: 'approval', text: 'Follow up -- ' + getTitle(approval[0]), postId: getPostId(approval[0]) };
    if (ready.length) return { type: 'ready', text: 'Send for approval -- ' + getTitle(ready[0]), postId: getPostId(ready[0]) };
    return null;
  }

  // Admin  -  sees everything: failed_publish already handled above, then approval -> ready -> production
  const approval = _ttByStage('awaiting_approval');
  if (approval.length) return { type: 'approval', text: 'Follow up -- ' + getTitle(approval[0]), postId: getPostId(approval[0]) };
  const ready = _ttByStage('ready');
  if (ready.length) return { type: 'ready', text: 'Send for approval -- ' + getTitle(ready[0]), postId: getPostId(ready[0]) };
  const prod = _ttByStage('in_production');
  if (prod.length) return { type: 'production', text: 'Create post -- ' + getTitle(prod[0]), postId: getPostId(prod[0]) };

  return null;
}

// ===============================================
// Dashboard  -  Hero, Pipeline, Blockers
// ===============================================

// -- Scoreboard  -  Data + Render ------------------

// Safe stage accessor
function _safeStage(p) {
  if (!p || typeof p !== 'object') return '';
  return p.stage || '';
}

// Config  -  single source for all thresholds
var SCOREBOARD_CONFIG = {
  MONTHLY_TARGET: 35,
  CRITICAL_THRESHOLD: 7
};

// Single-pass count engine
function getScoreboardCounts(posts) {
  var counts = {
    in_production: 0,
    ready: 0,
    awaiting_approval: 0,
    awaiting_brand_input: 0,
    scheduled: 0,
    published: 0
  };

  if (!Array.isArray(posts)) return counts;

  for (var i = 0; i < posts.length; i++) {
    var s = _safeStage(posts[i]);
    if (counts.hasOwnProperty(s)) counts[s]++;
  }

  return counts;
}

// Final data model
function getScoreboardData() {
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var c = getScoreboardCounts(posts);
  var MONTHLY_TARGET = SCOREBOARD_CONFIG.MONTHLY_TARGET;

  // FIX 6: Runway = scheduled posts with target_date >= today
  var todayStr = new Date().toISOString().split('T')[0];
  var runwayPosts = posts.filter(function(p) {
    return p.stage === 'scheduled' && p.target_date && p.target_date >= todayStr;
  });
  var runwayCount = runwayPosts.length;

  // FIX 7: Pranav = posts in system vs target
  var inSystemPosts = posts.filter(function(p) {
    return ['ready', 'awaiting_approval', 'awaiting_brand_input', 'scheduled'].includes(p.stage);
  });
  var pranavDeficit = inSystemPosts.length - MONTHLY_TARGET;

  // FIX 8: Chitra = posts she needs to act on
  var threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  var threeDaysAgoStr = threeDaysAgo.toISOString();

  // Chitra owns: ready posts + overdue awaiting posts (>3 days old, came back to her)
  var chitraOverdue = posts.filter(function(p) {
    return (p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input') &&
      p.status_changed_at !== null &&
      p.status_changed_at !== undefined &&
      new Date((p.status_changed_at || '') + 'Z') < threeDaysAgo;
  }).length;
  var chitraReady = posts.filter(function(p) {
    return p.stage === 'ready';
  }).length;
  var chitraCount = chitraReady + chitraOverdue;

  // FIX 9: Approval = awaiting_approval still with client (<3 days)
  var approvalCount = posts.filter(function(p) {
    return p.stage === 'awaiting_approval' && (
      !p.status_changed_at ||
      new Date((p.status_changed_at || '') + 'Z') >= threeDaysAgo
    );
  }).length;

  // FIX 10: Input = awaiting_brand_input still with client (<3 days)
  var inputCount = posts.filter(function(p) {
    return p.stage === 'awaiting_brand_input' && (
      !p.status_changed_at ||
      new Date((p.status_changed_at || '') + 'Z') >= threeDaysAgo
    );
  }).length;

  // B-02 FIX: Count failed_publish (scheduled posts past target_date)
  var failedPublishCount = posts.filter(function(p) {
    return p.stage === 'scheduled' && p.target_date && p.target_date < todayStr;
  }).length;

  // B-01 FIX: Count ready posts for Chitra context-aware action
  var readyCount = c.ready || 0;

  console.log('[SCOREBOARD]', { counts: c, runwayCount: runwayCount, pranavDeficit: pranavDeficit, failedPublish: failedPublishCount });

  window._lastScoreboardData = {
    runwayCount: runwayCount,
    pranavDeficit: pranavDeficit,
    chitraCount: chitraCount,
    chitraOverdue: chitraOverdue,
    approvalCount: approvalCount,
    inputCount: inputCount
  };

  return {
    failedPublish: failedPublishCount,
    readyCount: readyCount,
    runway: {
      count: runwayCount
    },
    pranav: {
      deficit: pranavDeficit,
      inSystem: inSystemPosts.length,
      target: MONTHLY_TARGET
    },
    chitra: {
      count: chitraCount,
      overdue: chitraOverdue
    },
    client: {
      approval: approvalCount,
      input: inputCount
    }
  };
}

function dashPad(n) {
  return String(Math.abs(n)).padStart(2, '0');
}

function getDashGreeting() {
  var hour = new Date().getHours();
  var greeting = hour >= 5 && hour < 12 ? 'Good morning' :
                 hour >= 12 && hour < 17 ? 'Good afternoon' :
                 hour >= 17 && hour < 21 ? 'Good evening' :
                 'Working late';
  var role = window.effectiveRole || window.currentRole || '';
  var roleNames = {
    'Admin':     'Shubham',
    'Servicing': 'Chitra',
    'Creative':  'Pranav'
  };
  var name = roleNames[role] || '';
  return { greeting: greeting, name: name };
}

function updateDashGreeting() {
  var nameEl = document.getElementById('dash-greeting-name');
  var hdrEl = document.getElementById('dash-greeting-hdr');
  if (!nameEl || !hdrEl) return;
  var role = (window.effectiveRole || window.currentRole || 'admin').toLowerCase();
  var nameMap = {
    admin: 'Shubham', shubham: 'Shubham',
    servicing: 'Chitra', chitra: 'Chitra',
    creative: 'Pranav', pranav: 'Pranav',
    client: ''
  };
  var name = nameMap[role] || 'Shubham';
  var h = new Date().getHours();
  var timeWord;
  if (h >= 5 && h < 12) timeWord = 'Good morning';
  else if (h >= 12 && h < 17) timeWord = 'Good afternoon';
  else if (h >= 17 && h < 22) timeWord = 'Good evening';
  else timeWord = 'Working late';
  if (name) {
    nameEl.textContent = name;
    nameEl.style.color = '#C8A84B';
    nameEl.style.fontWeight = '500';
    hdrEl.childNodes[0].textContent = timeWord + ', ';
  } else {
    hdrEl.textContent = timeWord;
  }
}

function updateDashKicker(state) {
  var dot = document.getElementById('dash-kicker-dot');
  var text = document.getElementById('dash-kicker-text');
  var line = document.getElementById('dash-kicker-line');
  if (!dot || !text || !line) return;
  var states = {
    crisis: { text: 'BREAKING \u00b7 RUNWAY CRISIS', color: 'var(--c-red)' },
    urgent: { text: 'HEADS UP \u00b7 ACTION NEEDED', color: 'var(--c-amber)' },
    steady: { text: 'ALL SORTED \u00b7 RUNWAY HEALTHY', color: 'var(--c-green)' },
    idle:   { text: 'SORTED \u00b7 QUIET DAY', color: '#444' }
  };
  var s = states[state] || states.idle;
  line.style.color = s.color;
  dot.style.background = s.color;
  text.textContent = s.text;
}

function updateDashDeck(runway, overdue, pranavDef) {
  var el = document.getElementById('dash-deck');
  if (!el) return;
  var parts = [];
  if (runway <= 6) parts.push('Only ' + runway + ' post' + (runway===1?'':'s') + ' scheduled');
  if (pranavDef < 0) parts.push('Pranav ' + Math.abs(pranavDef) + ' behind');
  if (overdue > 0) parts.push(overdue + ' overdue');
  if (parts.length) parts.push('sort now');
  el.textContent = parts.join(' \u00b7 ');
  el.style.cssText = 'font-family:var(--mono);font-size:7px;color:#555;margin:4px 0 4px;line-height:1.4;letter-spacing:0.04em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;';
}

function updateDashDatetime() {
  var el = document.getElementById('dash-datetime');
  if (!el) return;
  var now = new Date();
  var h = now.getHours(), m = now.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  el.textContent = h + ':' + (m<10?'0':'') + m + ' ' + ampm + ' \u00b7 ' + days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
}


function renderScoreboard() {
  try {
    var data = getScoreboardData();
    if (!data || typeof data !== 'object') return;

    window._dashLastUpdated = Date.now();

    function safe(v) { return (v != null && Number.isFinite(v)) ? v : 0; }

    var runwayCount = safe(data.runway.count);
    var pranavDeficit = safe(data.pranav.deficit);
    var pranavInSystem = safe(data.pranav.inSystem);
    var chitraCount = safe(data.chitra.count);
    var chitraOverdue = safe(data.chitra.overdue);
    var approvalCount = safe(data.client.approval);
    var inputCount = safe(data.client.input);

    // --- HEADLINE PRIORITY ---
    var kicker, kickerColor, headline, deck;
    var role = window.effectiveRole || 'Admin';

    if (role === 'Creative') {
      // Pranav-specific headline
      kicker = 'Your Status \u00b7 Creative';
      if (pranavDeficit >= 0) {
        kickerColor = 'var(--green)';
        headline = 'Target met \u00b7 <span class="hl-num" style="color:var(--green)">' + dashPad(pranavDeficit) + '</span> ahead \u00b7 great work';
        deck = dashPad(runwayCount) + ' posts in runway \u00b7 team on track';
      } else if (pranavDeficit <= -15) {
        kickerColor = 'var(--red)';
        headline = 'Pranav \u00b7 <span class="hl-num" style="color:var(--red)">' + dashPad(Math.abs(pranavDeficit)) + '</span> posts behind \u00b7 build now';
        deck = dashPad(runwayCount) + ' posts in runway \u00b7 ' + pranavInSystem + ' in system vs 35 target';
      } else {
        kickerColor = 'var(--amber)';
        headline = 'Pranav \u00b7 <span class="hl-num" style="color:var(--amber)">' + dashPad(Math.abs(pranavDeficit)) + '</span> posts behind \u00b7 keep going';
        deck = dashPad(runwayCount) + ' posts in runway \u00b7 ' + pranavInSystem + ' in system vs 35 target';
      }
    } else if (runwayCount <= 6) {
      // Priority 1 - Runway critical
      kicker = 'Breaking \u00b7 Runway Crisis';
      kickerColor = 'var(--red)';
      headline = 'Runway at \u00b7 <span style="color:var(--c-red);display:inline-block;animation:hb 2.4s ease-in-out infinite;">' + dashPad(runwayCount) + '</span> \u00b7 agency running on empty';
      deck = 'Only ' + runwayCount + ' post' + (runwayCount === 1 ? '' : 's') + ' scheduled from today \u00b7 Pranav ' + Math.abs(pranavDeficit) + ' posts behind \u00b7 sort now';
    } else if (pranavDeficit < -14 && role !== 'Servicing') {
      // Priority 2 - Pranav deficit worse than -14
      kicker = 'Alert \u00b7 Team Behind';
      kickerColor = 'var(--amber)';
      headline = 'Pranav \u00b7 <span class="hl-num" style="color:var(--amber)">' + dashPad(Math.abs(pranavDeficit)) + '</span> posts behind \u00b7 ' + (chitraOverdue > 0 ? chitraOverdue + ' overdue approvals' : 'runway watch closely');
      deck = dashPad(runwayCount) + ' posts in runway \u00b7 ' + (chitraOverdue > 0 ? 'Chitra chasing overdue clients \u00b7 system under strain' : 'team needs to build urgently');
    } else if (chitraOverdue > 0) {
      // Priority 3 - Chitra has overdue
      kicker = 'Alert \u00b7 Client Not Responding';
      kickerColor = 'var(--red)';
      headline = '<span class="hl-num" style="color:var(--red)">' + dashPad(chitraOverdue) + '</span> approvals overdue \u00b7 chase client now';
      deck = 'Chitra has ' + chitraCount + ' posts total \u00b7 ' + chitraOverdue + ' waiting more than 3 days \u00b7 client not responding';
    } else if (runwayCount <= 14) {
      // Priority 4 - Normal
      kicker = 'Update \u00b7 Watch Closely';
      kickerColor = 'var(--amber)';
      headline = 'One week of runway \u00b7 <span class="hl-num" style="color:var(--amber)">' + dashPad(runwayCount) + '</span> posts scheduled';
      deck = 'Pranav ' + Math.abs(pranavDeficit) + ' behind target \u00b7 Chitra has ' + chitraCount + ' to dispatch \u00b7 ' + (approvalCount > 0 ? approvalCount + ' approval pending' : 'no pending approvals');
    } else if (runwayCount <= 21) {
      // Priority 5 - Good
      kicker = 'Good \u00b7 On Track';
      kickerColor = 'var(--green)';
      headline = 'Strong at \u00b7 <span class="hl-num" style="color:var(--green)">' + dashPad(runwayCount) + '</span> \u00b7 team nearly on target';
      deck = 'Pranav ' + Math.abs(pranavDeficit) + ' posts short \u00b7 Chitra has ' + chitraCount + ' ready \u00b7 ' + (approvalCount > 0 ? approvalCount + ' approval pending' : 'all approvals clear');
    } else if (pranavDeficit >= 0) {
      // Priority 6 - Perfect
      kicker = 'Excellent \u00b7 All Systems Go';
      kickerColor = 'var(--green)';
      headline = 'Target met \u00b7 <span class="hl-num" style="color:var(--green)">' + dashPad(runwayCount) + '</span> posts scheduled \u00b7 team firing';
      deck = 'Pranav ' + pranavDeficit + ' ahead of target \u00b7 Chitra all clear \u00b7 no pending approvals';
    } else {
      // Fallback (runwayCount > 21 but pranavDeficit < 0)
      kicker = 'Good \u00b7 On Track';
      kickerColor = 'var(--green)';
      headline = 'Strong at \u00b7 <span class="hl-num" style="color:var(--green)">' + dashPad(runwayCount) + '</span> \u00b7 team nearly on target';
      deck = 'Pranav ' + Math.abs(pranavDeficit) + ' posts short \u00b7 Chitra has ' + chitraCount + ' ready \u00b7 ' + (approvalCount > 0 ? approvalCount + ' approval pending' : 'all approvals clear');
    }

    // --- STEP 3: METRIC ROWS ---

    // RUNWAY
    var rColor = runwayCount <= 6 ? 'var(--red)' : runwayCount <= 14 ? 'var(--amber)' : 'var(--green)';
    var rMsg = runwayCount <= 1 ? 'Almost empty \u00b7 build now' : runwayCount <= 6 ? 'Running out \u00b7 sort now' : runwayCount <= 14 ? 'Getting low \u00b7 sort this week' : runwayCount <= 21 ? 'Good shape \u00b7 keep sorting' : 'Strong runway \u00b7 well done';
    var elRPre = document.getElementById('metric-runway-prefix');
    var elRNum = document.getElementById('metric-runway-num');
    var elRMsg = document.getElementById('metric-runway-msg');
    if (elRPre) { elRPre.textContent = '\u00b7'; elRPre.style.color = rColor; }
    if (elRNum) { elRNum.textContent = dashPad(runwayCount); elRNum.style.color = rColor; }
    var rMsgColor = runwayCount <= 6 ? '#cc3a3a' : runwayCount <= 14 ? 'var(--c-amber)' : 'var(--c-green)';
    if (elRMsg) { elRMsg.textContent = rMsg; elRMsg.style.color = rMsgColor; }

    // PRANAV
    var pPrefix = pranavDeficit >= 0 ? '+' : '-';
    var pColor = pranavDeficit <= -22 ? 'var(--red)' : pranavDeficit <= -15 ? 'var(--red)' : pranavDeficit <= -8 ? 'var(--amber)' : pranavDeficit < 0 ? 'var(--amber)' : 'var(--green)';
    var pMsg = pranavDeficit <= -22 ? 'Pipeline at risk \u00b7 sort now' : pranavDeficit <= -15 ? dashPad(Math.abs(pranavDeficit)) + ' behind \u00b7 team needs you' : pranavDeficit <= -8 ? dashPad(Math.abs(pranavDeficit)) + ' behind \u00b7 pick up pace' : pranavDeficit < 0 ? dashPad(Math.abs(pranavDeficit)) + ' posts behind \u00b7 keep going' : 'Target met \u00b7 great work';
    var elPPre = document.getElementById('metric-pranav-prefix');
    var elPNum = document.getElementById('metric-pranav-num');
    var elPMsg = document.getElementById('metric-pranav-msg');
    if (elPPre) { elPPre.textContent = pPrefix; elPPre.style.color = pColor; }
    if (elPNum) { elPNum.textContent = dashPad(pranavDeficit); elPNum.style.color = pColor; }
    var pMsgColor = pranavDeficit <= -15 ? '#cc3a3a' : pranavDeficit < 0 ? 'var(--c-amber)' : 'var(--c-green)';
    if (elPMsg) { elPMsg.textContent = pMsg; elPMsg.style.color = pMsgColor; }

    // CHITRA
    var cTotal = (allPosts||[]).filter(function(p) {
      var s = p.stage || p.stageLC || '';
      return s === 'awaiting_approval' || s === 'awaiting_brand_input';
    }).length;
    var cPrefix = cTotal > 0 ? '-' : '\u00b7';
    var cColor = chitraOverdue > 0 ? 'var(--red)' : cTotal > 8 ? 'var(--red)' : cTotal > 3 ? 'var(--amber)' : cTotal > 0 ? 'var(--green)' : 'var(--green)';
    var cMsg = chitraOverdue > 0 ? dashPad(chitraOverdue) + ' overdue \u00b7 chase client' : cTotal > 8 ? dashPad(cTotal) + ' posts piling up' : cTotal > 3 ? dashPad(cTotal) + ' posts waiting on you' : cTotal > 0 ? dashPad(cTotal) + ' post' + (cTotal === 1 ? '' : 's') + ' ready to send' : 'All sorted \u00b7 well done';
    var elCPre = document.getElementById('metric-chitra-prefix');
    var elCNum = document.getElementById('metric-chitra-num');
    var elCMsg = document.getElementById('metric-chitra-msg');
    if (elCPre) { elCPre.textContent = cPrefix; elCPre.style.color = cColor; }
    if (elCNum) { elCNum.textContent = dashPad(cTotal); elCNum.style.color = cColor; }
    var cMsgColor = chitraOverdue > 0 ? '#cc3a3a' : cTotal > 8 ? '#cc3a3a' : cTotal > 3 ? 'var(--c-amber)' : 'var(--c-green)';
    if (elCMsg) { elCMsg.textContent = cMsg; elCMsg.style.color = cMsgColor; }

    // CLIENT
    var clientPendingPosts = allPosts.filter(function(p) {
      var owner = (p.owner||'').toLowerCase();
      var stage = p.stage || p.stageLC || '';
      return owner === 'client' &&
        (stage === 'awaiting_approval' || stage === 'awaiting_brand_input');
    });
    var approvalOnly = clientPendingPosts.filter(function(p) {
      return (p.stage||p.stageLC) === 'awaiting_approval';
    }).length;
    var inputOnly = clientPendingPosts.filter(function(p) {
      return (p.stage||p.stageLC) === 'awaiting_brand_input';
    }).length;
    var clTotal = clientPendingPosts.length;
    var clPrefix = clTotal > 0 ? '-' : '\u00b7';
    var clColor = clTotal > 0 ? 'var(--red)' : 'var(--muted)';
    var elClPre = document.getElementById('metric-client-prefix');
    var elClNum = document.getElementById('metric-client-num');
    var elClMsg = document.getElementById('metric-client-msg');
    if (elClPre) { elClPre.textContent = clPrefix; elClPre.style.color = clColor; }
    if (elClNum) { elClNum.textContent = dashPad(clTotal); elClNum.style.color = clColor; }
    var clMsgColor = clTotal > 0 ? '#cc3a3a' : '#aaa';
    if (elClMsg) {
      if (approvalOnly > 0 || inputOnly > 0) {
        elClMsg.innerHTML =
          '<span style="cursor:pointer;color:var(--c-red);"' +
          ' onclick="event.stopPropagation();openStageSheet(\'awaiting_approval\')">' +
          dashPad(approvalOnly) + ' APPROVAL</span>' +
          ' <span style="color:#555;">\u00b7</span> ' +
          '<span style="cursor:pointer;color:#888;"' +
          ' onclick="event.stopPropagation();openStageSheet(\'awaiting_brand_input\')">' +
          dashPad(inputOnly) + ' INPUT</span>';
      } else {
        var clMsg = 'Client sorted \u00b7 good week';
        elClMsg.textContent = clMsg;
        elClMsg.style.color = clMsgColor;
      }
    }

    // --- STEP 4: HEADLINE RENDER ---
    var elHL = document.getElementById('dash-headline');
    if (elHL) {
      elHL.innerHTML = headline;
      elHL.style.cursor = 'pointer';
      elHL.onclick = function() { openRunwaySheet(); };
    }

    // --- STEP 5: KICKER, DECK, DATETIME ---
    var kickerState;
    if (runwayCount <= 3) kickerState = 'crisis';
    else if (runwayCount <= 6 || chitraOverdue > 0) kickerState = 'urgent';
    else if (runwayCount > 6) kickerState = 'steady';
    else kickerState = 'idle';
    updateDashKicker(kickerState);
    updateDashDeck(runwayCount, chitraOverdue, pranavDeficit);
    updateDashDatetime();

    // --- STEP 6: TASK LIST ---
    _renderDashTaskList(role);

    // --- STEP 7: PERSONALIZATION ---
    var rowPranav = document.getElementById('metric-row-pranav');
    var rowChitra = document.getElementById('metric-row-chitra');
    var rowClient = document.getElementById('metric-row-client');
    var rowRunway = document.getElementById('metric-row-runway');

    if (role === 'Servicing') {
      if (rowPranav) rowPranav.style.display = 'none';
      if (rowChitra) rowChitra.style.display = '';
      if (rowClient) rowClient.style.display = '';
      if (rowRunway) rowRunway.style.display = '';
    } else if (role === 'Creative') {
      if (rowChitra) rowChitra.style.display = 'none';
      if (rowClient) rowClient.style.display = 'none';
      if (rowPranav) rowPranav.style.display = '';
      if (rowRunway) rowRunway.style.display = '';
    } else {
      // Admin: show all
      if (rowPranav) rowPranav.style.display = '';
      if (rowChitra) rowChitra.style.display = '';
      if (rowClient) rowClient.style.display = '';
      if (rowRunway) rowRunway.style.display = '';
    }

    // --- STEP 8: TAPPABLE METRIC ROWS ---
    if (rowRunway) rowRunway.onclick = function() { if (typeof openRunwaySheet === 'function') openRunwaySheet(); };
    if (rowPranav) rowPranav.onclick = function() {
      var pranavPosts = (allPosts||[]).filter(function(p) {
        var s = p.stage || p.stageLC || '';
        var owner = (p.owner||'').toLowerCase();
        return (owner === 'pranav' || owner === 'creative') &&
               s === 'in_production';
      });
      if (pranavPosts.length > 0) {
        openStageSheet('pranav_production');
      } else {
        var fab = document.getElementById('fab-btn');
        if (fab) fab.click();
      }
    };
    if (rowChitra) rowChitra.onclick = function() {
      openStageSheet('chitra_active');
    };
    if (rowClient) rowClient.onclick = function() {
      openStageSheet('client_pending');
    };

  } catch (err) {
    console.error('[Scoreboard] Render error', err);
  }
}

function _renderDashTaskList(role) {
  var items = _buildDoThisNowItems(role);
  var container = document.getElementById('dash-task-list');
  if (!container) return;

  // Filter by role
  var filtered = items;
  if (role === 'Servicing') {
    filtered = items.filter(function(item) {
      var who = (item.assignedTo || '').toLowerCase();
      return who === 'chitra' || item.taskId === 'auto';
    });
  } else if (role === 'Creative') {
    filtered = items.filter(function(item) {
      var who = (item.assignedTo || '').toLowerCase();
      return who === 'pranav' || item.taskId === 'auto';
    });
  }

  // Build urgent crisis items from current system state
  var urgentItems = [];
  var scoreData = getScoreboardData();
  if (scoreData && typeof scoreData === 'object') {
    var _rc = scoreData.runway ? scoreData.runway.count : 99;
    var _co = scoreData.chitra ? scoreData.chitra.overdue : 0;
    var _pd = scoreData.pranav ? scoreData.pranav.deficit : 0;
    var _ac = scoreData.client ? scoreData.client.approval : 0;

    if (_rc <= 6) {
      urgentItems.push({
        text: '<span style="color:#FF4B4B">' + dashPad(_rc) + '</span> runway',
        arrow: '#FF4B4B',
        onclick: "if(typeof openRunwaySheet==='function')openRunwaySheet()"
      });
    }
    if (_co > 0) {
      urgentItems.push({
        text: 'chase client <span style="color:#FF4B4B">' + dashPad(_co) + '</span> overdue',
        arrow: '#FF4B4B',
        onclick: "openStageSheet('overdue')"
      });
    }
    if (_pd <= -15) {
      urgentItems.push({
        text: '<span style="color:#FF4B4B">' + dashPad(Math.abs(_pd)) + '</span> posts to build <span style="color:#9b87f5">pranav</span>',
        arrow: '#9b87f5',
        onclick: "openStageSheet('pranav_production')"
      });
    }

    // Only show empty state when system is calm
    if (!filtered.length && !urgentItems.length) {
      if (_rc > 6 && _pd > -8 && _co === 0 && _ac === 0) {
        var emptyMessages = {
          'Admin':     'All sorted - nothing needs you',
          'Servicing': 'All sorted - nothing to dispatch',
          'Creative':  'All sorted - keep creating',
          'Client':    'All sorted - nothing from us right now'
        };
        var emptyRole = window.effectiveRole || window.currentRole || 'Admin';
        var emptyMsg = emptyMessages[emptyRole] || 'All sorted';
        container.innerHTML = '<div class="dash-empty-state">' + emptyMsg + '</div>';
        return;
      }
    }
  } else if (!filtered.length) {
    container.innerHTML = '<div class="dash-empty-state">All sorted</div>';
    return;
  }

  // Separate chase tasks from non-chase tasks
  var normalTasks = [];
  var chaseTasks = [];
  for (var i = 0; i < filtered.length; i++) {
    var item = filtered[i];
    var tLower = (item.title || '').toLowerCase();
    if (tLower.indexOf('chase client') === 0 || tLower.indexOf('brand input pending') === 0 || tLower.indexOf('fix publish') === 0) {
      chaseTasks.push(item);
    } else {
      normalTasks.push(item);
    }
  }

  var html = '';
  // Render non-chase tasks as pipeline cards
  for (var n = 0; n < normalTasks.length; n++) {
    var nItem = normalTasks[n];
    var nTid = nItem.taskId || 'auto';
    html += '<div style="display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;" onclick="toggleDashTask(this, \'' + nTid + '\')">';
    html += '<div style="width:3px;flex-shrink:0;background:#FF4B4B;"></div>';
    html += '<div style="flex:1;padding:8px 12px;">';
    html += '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#e8e2d9;margin-bottom:3px;">' + esc(nItem.title) + '</div>';
    html += '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' +
      '<span style="color:' + _ownerColor(nItem.assignedTo) + '">' + esc((nItem.assignedTo || '').toLowerCase()) + '</span></div>';
    html += '</div></div>';
  }

  // Render chase tasks as pipeline cards (max 3)
  var totalOverdue = chaseTasks.length;
  var chaseShow = Math.min(3, totalOverdue);
  var chaseOverflow = totalOverdue - chaseShow;
  for (var ci = 0; ci < chaseShow; ci++) {
    var cItem = chaseTasks[ci];
    var cPid = cItem.postId || '';
    var cPost = cItem.post;
    var cDays = cPost ? _staleDays(cPost) : 0;
    var cStage = cPost ? (STAGE_META[cPost.stage] || {}).label || cPost.stage : '';
    var cOwner = cPost ? (cPost.owner || '') : (cItem.assignedTo || '');
    var cPillar = cPost ? (cPost.content_pillar || '') : '';
    var cLocation = cPost ? (cPost.location || '') : '';
    var cTitle = cPost ? (cPost.title || 'Untitled') : cItem.title;
    var cClick = cPid ? 'openPostOverSheet(\'' + cPid + '\')' : '';
    var cMeta = [];
    if (cOwner) cMeta.push('<span style="color:' + _ownerColor(cOwner) + '">' + esc(cOwner.toLowerCase()) + '</span>');
    if (cPillar) cMeta.push(esc(cPillar.toLowerCase()));
    if (cLocation) cMeta.push(esc(cLocation.toLowerCase()));
    html += '<div style="display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;"' + (cClick ? ' onclick="' + cClick + '"' : '') + '>';
    html += '<div style="width:3px;flex-shrink:0;background:#FF4B4B;"></div>';
    html += '<div style="flex:1;padding:8px 12px;">';
    html += '<div style="font-family:var(--mono);font-size:8px;letter-spacing:0.04em;margin-bottom:3px;color:#FF4B4B;">' +
      (cDays > 0 ? cDays + 'd waiting' : '') + (cStage ? (cDays > 0 ? ' - ' : '') + esc(cStage.toLowerCase()) : '') + '</div>';
    html += '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#e8e2d9;margin-bottom:3px;">' + esc(cTitle) + '</div>';
    if (cMeta.length) html += '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' + cMeta.join(' - ') + '</div>';
    html += '</div>';
    html += '<div style="padding:8px 14px 8px 8px;display:flex;align-items:center;flex-shrink:0;">';
    html += '<span style="font-family:var(--mono);font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:#FF4B4B;background:transparent;border:none;">chase</span>';
    html += '</div></div>';
  }
  if (chaseOverflow > 0) {
    html += '<div style="padding:7px 18px;font-family:var(--mono);font-size:8px;color:#555;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.07);" onclick="openStageSheet(\'overdue\')">+ ' +
      chaseOverflow + ' more - ' + totalOverdue + ' total overdue</div>';
  }

  // Arrow action items
  if (urgentItems.length) {
    html += '<div style="padding:10px 18px 12px;border-bottom:1px solid rgba(255,255,255,0.07);">';
    for (var u = 0; u < urgentItems.length; u++) {
      var ui = urgentItems[u];
      html += '<div style="display:flex;gap:8px;margin-bottom:5px;cursor:pointer;" onclick="' + ui.onclick + '">';
      html += '<span style="font-size:10px;flex-shrink:0;color:' + ui.arrow + ';">&#8594;</span>';
      html += '<span style="font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#888;">' + ui.text + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }

  if (!html) {
    container.innerHTML = '<div class="dash-empty-state">All sorted</div>';
    return;
  }

  container.innerHTML = html;
}

async function toggleDashTask(row, taskId) {
  var cb = row.querySelector('.dash-task-cb');
  var txt = row.querySelector('.dash-task-text');
  cb.classList.toggle('done');
  txt.classList.toggle('done');
  if (taskId && taskId !== 'auto') {
    try {
      await apiFetch('/tasks?id=eq.' + taskId, {
        method: 'PATCH',
        body: JSON.stringify({ done: cb.classList.contains('done') })
      });
    } catch(e) { console.warn('Task toggle failed:', e); }
  }
}

function openRunwaySheet() {
  var posts = (allPosts || []).filter(function(p) {
    return p.stage === 'scheduled' || p.stageLC === 'scheduled';
  });
  var sheet = document.getElementById('runway-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'runway-sheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center;';
    sheet.onclick = function(e) { if (e.target === sheet) sheet.style.display = 'none'; };
    document.body.appendChild(sheet);
  }
  var html = '<div style="width:100%;max-width:480px;max-height:88vh;overflow-y:auto;background:#141414;border-top:1px solid rgba(255,255,255,0.1);padding-bottom:30px;">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--dotline);">';
  html += '<span style="font-family:var(--mono);font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--text1);">Runway - ' + posts.length + ' scheduled</span>';
  html += '<button onclick="document.getElementById(\'runway-sheet\').style.display=\'none\'" style="background:none;border:none;color:var(--c-text3);font-size:18px;cursor:pointer;line-height:1;">x</button>';
  html += '</div>';
  if (!posts.length) {
    html += '<div style="padding:24px 18px;font-family:var(--mono);font-size:11px;color:var(--c-text3);">Nothing scheduled yet.</div>';
  } else {
    posts.forEach(function(p) {
      var d = p.targetDate || p.target_date;
      var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var dateStr = '-- --';
      if (d) { var dt = new Date(d); dateStr = days[dt.getDay()] + ' - ' + dt.getDate() + ' ' + months[dt.getMonth()]; }
      var rpid = p.id || p.post_id || '';
      html += '<div onclick="openPostOverSheet(\'' + rpid + '\')" style="display:flex;align-items:stretch;border-bottom:1px solid var(--dotline);cursor:pointer;transition:background 0.1s;" onmousedown="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseup="this.style.background=\'\'">';
      html += '<div style="width:3px;flex-shrink:0;background:var(--c-cyan);"></div>';
      html += '<div style="flex:1;padding:10px 14px;">';
      html += '<div style="font-family:var(--mono);font-size:8px;color:var(--c-cyan);letter-spacing:0.08em;margin-bottom:3px;">' + dateStr + '</div>';
      html += '<div style="font-family:var(--sans);font-size:13px;font-weight:500;color:var(--text1);">' + esc(p.title || 'Untitled') + '</div>';
      html += '<div style="font-family:var(--mono);font-size:8px;color:var(--c-text3);margin-top:2px;">' + esc(p.owner || '') + (p.content_pillar ? ' - ' + esc(p.content_pillar) : '') + '</div>';
      html += '</div></div>';
    });
  }
  html += '</div>';
  sheet.innerHTML = html;
  sheet.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
window.openRunwaySheet = openRunwaySheet;

function openPostOverSheet(pid) {
  var match = (allPosts||[]).find(function(p) {
    return p.id === pid || p.post_id === pid;
  });
  var realId = match ? (match.id || match.post_id) : pid;
  if (typeof openPCS === 'function') {
    openPCS(realId, 'pipeline');
  }
}
window.openPostOverSheet = openPostOverSheet;

function openStageSheet(stage) {
  var stageNames = {
    'awaiting_approval': 'Awaiting Approval',
    'awaiting_brand_input': 'Awaiting Input',
    'overdue': 'Overdue Posts',
    'client_pending': 'Client \u00b7 Pending',
    'chitra_overdue': 'Chitra \u00b7 Overdue',
    'chitra_active': 'Chitra \u00b7 Awaiting Action',
    'pranav_overdue': 'Pranav \u00b7 Overdue',
    'pranav_production': 'Pranav \u00b7 In Progress'
  };
  var posts;
  var title;
  if (stage === 'overdue') {
    posts = (allPosts||[]).filter(function(p) {
      return isPostStale(p);
    });
  } else if (stage === 'client_pending') {
    posts = (allPosts||[]).filter(function(p) {
      var owner = (p.owner||'').toLowerCase();
      var s = p.stage || p.stageLC || '';
      return owner === 'client' &&
        (s === 'awaiting_approval' ||
         s === 'awaiting_brand_input');
    });
    title = 'Client \u00b7 Pending';
  } else if (stage === 'chitra_active') {
    posts = (allPosts||[]).filter(function(p) {
      var s = p.stage || p.stageLC || '';
      return s === 'awaiting_approval' ||
             s === 'awaiting_brand_input';
    }).sort(function(a,b) {
      return new Date((a.status_changed_at||a.updated_at||'') + 'Z') -
             new Date((b.status_changed_at||b.updated_at||'') + 'Z');
    });
    title = 'Chitra \u00b7 Awaiting Action';
  } else if (stage === 'chitra_overdue') {
    posts = (allPosts||[]).filter(function(p) {
      var owner = (p.owner||'').toLowerCase();
      var s = p.stage || p.stageLC || '';
      return (owner === 'chitra' || owner === 'servicing') &&
        !['published','parked','rejected'].includes(s);
    }).sort(function(a,b) {
      var ac = a.status_changed_at||a.updated_at||'';
      var bc = b.status_changed_at||b.updated_at||'';
      return new Date(ac) - new Date(bc);
    });
    title = 'Chitra \u00b7 Active Posts';
  } else if (stage === 'pranav_production') {
    posts = (allPosts||[]).filter(function(p) {
      var s = p.stage || p.stageLC || '';
      var owner = (p.owner||'').toLowerCase();
      return (owner === 'pranav' || owner === 'creative') &&
             s === 'in_production';
    }).sort(function(a,b) {
      return new Date((a.status_changed_at||a.updated_at||'') + 'Z') -
             new Date((b.status_changed_at||b.updated_at||'') + 'Z');
    });
    title = 'Pranav \u00b7 In Production';
  } else if (stage === 'pranav_overdue') {
    posts = (allPosts||[]).filter(function(p) {
      var owner = (p.owner||'').toLowerCase();
      var s = p.stage || p.stageLC || '';
      return (owner === 'pranav' || owner === 'creative') &&
        !['published','parked','rejected'].includes(s);
    }).sort(function(a,b) {
      var ac = a.status_changed_at||a.updated_at||'';
      var bc = b.status_changed_at||b.updated_at||'';
      return new Date(ac) - new Date(bc);
    });
    title = 'Pranav \u00b7 Active Posts';
  } else {
    posts = (allPosts||[]).filter(function(p) {
      return (p.stage||p.stageLC) === stage;
    });
  }
  var sheetTitle = title || stageNames[stage] || stage;
  var sheet = document.getElementById('stage-sheet-overlay');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'stage-sheet-overlay';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:1400;'+
      'background:rgba(0,0,0,0.75);display:flex;'+
      'align-items:flex-end;justify-content:center;';
    sheet.onclick = function(e) {
      if (e.target===sheet) sheet.style.display='none';
    };
    document.body.appendChild(sheet);
  }
  var html = '<div style="width:100%;max-width:480px;'+
    'max-height:88vh;overflow-y:auto;background:#141414;'+
    'border-top:1px solid rgba(255,255,255,0.1);'+
    'padding-bottom:30px;">';
  html += '<div style="display:flex;align-items:center;'+
    'justify-content:space-between;padding:14px 18px;'+
    'border-bottom:1px solid rgba(255,255,255,0.07);">'+
    '<span style="font-family:var(--mono);font-size:9px;'+
    'letter-spacing:0.2em;text-transform:uppercase;'+
    'color:#e8e2d9;">'+esc(sheetTitle)+' \u00b7 '+posts.length+'</span>'+
    '<button onclick="document.getElementById('+
    '\'stage-sheet-overlay\').style.display=\'none\'"'+
    ' style="background:none;border:none;color:#555;'+
    'font-size:18px;cursor:pointer;">\u00d7</button></div>';
  if (!posts.length) {
    html += '<div style="padding:20px 18px;font-family:'+
      'var(--mono);font-size:11px;color:#555;">'+
      'All sorted.</div>';
  } else {
    posts.forEach(function(p) {
      var pid = p.id || p.post_id || '';
      var pTitle = esc(p.title || 'Untitled');
      var pOwner = esc(p.owner || '');
      var pStage = esc((p.stage||p.stageLC||'').replace(/_/g,' '));
      html += '<div onclick="openPostOverSheet(\''+pid+'\')"'+
        ' style="display:flex;align-items:stretch;'+
        'border-bottom:1px solid rgba(255,255,255,0.07);'+
        'cursor:pointer;transition:background 0.1s;"'+
        ' onmousedown="this.style.background=\'rgba(255,255,255,0.03)\'"'+
        ' onmouseup="this.style.background=\'\'">'+
        '<div style="width:3px;flex-shrink:0;background:'+
        'var(--c-red);"></div>'+
        '<div style="flex:1;padding:10px 14px;">'+
        '<div style="font-family:var(--mono);font-size:11px;'+
        'color:#bbb;margin-bottom:3px;">'+pTitle+'</div>'+
        '<div style="font-family:var(--mono);font-size:8px;'+
        'color:#444;text-transform:uppercase;">'+
        pOwner+(pStage?' \u00b7 '+pStage:'')+'</div>'+
        '</div></div>';
    });
  }
  html += '</div>';
  sheet.innerHTML = html;
  sheet.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
window.openStageSheet = openStageSheet;

function _buildDoThisNowItems(role) {
  var items = [];
  var todayStr = new Date().toISOString().split('T')[0];
  var threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  role = role || window.effectiveRole || window.currentRole || 'Admin';

  // B-02 FIX: PRIORITY 0  Failed publish items (scheduled posts past target_date)
  if (role !== 'Client') {
    var failedPub = _ttFailedPublish();
    for (var fp = 0; fp < failedPub.length && items.length < 3; fp++) {
      var fpPost = failedPub[fp];
      items.push({
        title: 'FIX PUBLISH - ' + getTitle(fpPost),
        assignedTo: 'Admin',
        taskId: getPostId(fpPost) || 'auto',
        postId: fpPost.id || fpPost.post_id || '',
        post: fpPost
      });
    }
  }

  // 1. Manual tasks first (sorted by due_date ascending)
  var manualTasks = (window.allTasks || []).filter(function(t) { return !t.done; }).sort(function(a, b) {
    var ad = a.due_date || '9999-12-31';
    var bd = b.due_date || '9999-12-31';
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  }).slice(0, 5);
  for (var t = 0; t < manualTasks.length; t++) {
    var task = manualTasks[t];
    items.push({
      title: task.message || 'Task',
      assignedTo: task.assigned_to || 'Unassigned',
      taskId: task.id ? String(task.id) : 'auto'
    });
  }

  // 2. Auto-generated: overdue client posts (Admin and Servicing only)
  if (role === 'Admin' || role === 'Servicing') {
    var overdueApprovalPosts = allPosts.filter(function(p) {
      return p.stage === 'awaiting_approval' &&
        p.status_changed_at && new Date((p.status_changed_at || '') + 'Z') < threeDaysAgo;
    }).sort(function(a, b) {
      return new Date((a.status_changed_at || '') + 'Z') - new Date((b.status_changed_at || '') + 'Z');
    });
    for (var c = 0; c < overdueApprovalPosts.length && items.length < 7; c++) {
      var op = overdueApprovalPosts[c];
      items.push({
        title: 'Chase client - ' + getTitle(op),
        assignedTo: 'Chitra',
        taskId: 'auto',
        postId: op.id || op.post_id || '',
        post: op
      });
    }
    var overdueBrandPosts = allPosts.filter(function(p) {
      return p.stage === 'awaiting_brand_input' &&
        p.status_changed_at && new Date((p.status_changed_at || '') + 'Z') < threeDaysAgo;
    }).sort(function(a, b) {
      return new Date((a.status_changed_at || '') + 'Z') - new Date((b.status_changed_at || '') + 'Z');
    });
    for (var bi = 0; bi < overdueBrandPosts.length && items.length < 8; bi++) {
      var bp = overdueBrandPosts[bi];
      items.push({
        title: 'Brand input pending - ' + getTitle(bp),
        assignedTo: 'Chitra',
        taskId: 'auto',
        postId: bp.id || bp.post_id || '',
        post: bp
      });
    }
  }

  // 3. Auto: Pranav deficit (Admin and Creative only)
  if (role === 'Admin' || role === 'Creative') {
    var inSystemCount = allPosts.filter(function(p) {
      return ['ready', 'awaiting_approval', 'awaiting_brand_input', 'scheduled'].includes(p.stage);
    }).length;
    var awaitingTotal = allPosts.filter(function(p) {
      return p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input';
    }).length;
    var pranavDeficitAuto = inSystemCount - 35;
    if (pranavDeficitAuto < 0 && awaitingTotal === 0 && items.length < 8) {
      if (role === 'Creative') {
        items.push({
          title: dashPad(Math.abs(pranavDeficitAuto)) + ' posts to build \u00b7 target ' + dashPad(35 - Math.abs(pranavDeficitAuto)) + ' of 35',
          assignedTo: 'Pranav',
          taskId: 'auto'
        });
      } else {
        items.push({
          title: pranavDeficitAuto + ' posts needed -- build now',
          assignedTo: 'Pranav',
          taskId: 'auto'
        });
      }
    }
  }

  return items;
}

function renderDashboard() {
  if ((window.effectiveRole || '').toLowerCase() === 'client') return;
  try { _renderDashboardInner(); } catch(e) { console.error('[PCS] renderDashboard crash:', e); }
}
function _renderDashboardInner() {
  var el = document.getElementById('pcs-dashboard');
  if (!el) return;
  if (!window._activityLogsFetched) {
    window._activityLogsFetched = true;
    _fetchActivityLogs();
  }
  updateDashGreeting();
  renderScoreboard();
  updateDashDatetime();
  if (!window._dashDatetimeInterval) {
    window._dashDatetimeInterval = setInterval(updateDashDatetime, 60000);
  }
  _updateStreakLines();
  updateBelowFold();
}

async function _updateStreakLines() {
  try {
    var today = new Date();

    var logs = await apiFetch(
      '/activity_log?select=actor,created_at,action,new_stage,old_stage' +
      '&order=created_at.desc&limit=200'
    );
    if (!Array.isArray(logs)) return;

    logs = logs.map(function(l) {
      var a = l.actor || '';
      if (a === 'system' || a === 'Admin' ||
          a.indexOf('@') > -1) {
        l.actor = 'Shubham';
      }
      return l;
    });

    function getStreak(actor) {
      var days = {};
      logs.filter(function(l) {
        return l.actor === actor;
      }).forEach(function(l) {
        var d = (l.created_at || '').split('T')[0];
        if (d) days[d] = true;
      });
      var streak = 0;
      var check = new Date(today);
      check.setDate(check.getDate() - 1);
      while (true) {
        var ds = check.toISOString().split('T')[0];
        if (days[ds]) {
          streak++;
          check.setDate(check.getDate() - 1);
        } else { break; }
      }
      return streak;
    }

    function getIdleDays(actor) {
      var actorLogs = logs.filter(function(l) {
        return l.actor === actor;
      });
      if (!actorLogs.length) return 99;
      var last = new Date(actorLogs[0].created_at);
      return Math.floor((today - last) / (1000 * 60 * 60 * 24));
    }

    function getLastActive(actor) {
      var actorLogs = logs.filter(function(l) {
        return l.actor === actor;
      });
      if (!actorLogs.length) return '';
      var d = new Date(actorLogs[0].created_at);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
    }

    var pEl = document.getElementById('metric-pranav-streak');
    if (pEl) {
      var pStreak = getStreak('Pranav');
      var pIdle = getIdleDays('Pranav');
      if (pIdle >= 2) {
        var pLast = getLastActive('Pranav');
        pEl.innerHTML = '<span class="dms-idle">\u00b7 idle ' + pIdle + ' days \u00b7 last active ' + pLast + '</span>';
      } else if (pStreak >= 3) {
        pEl.innerHTML = '<span class="dms-on">\u00b7 ' + String(pStreak).padStart(2, '0') + ' day streak \u00b7 ' + String(pStreak) + ' posts created</span>';
      } else {
        pEl.innerHTML = '';
      }
    }

    var cEl = document.getElementById('metric-chitra-streak');
    if (cEl) {
      var chitraLogs = logs.filter(function(l) { return l.actor === 'Chitra'; });
      if (chitraLogs.length === 0) {
        cEl.innerHTML = '';
      } else {
        var cStreak = getStreak('Chitra');
        var cIdle = getIdleDays('Chitra');
        if (cIdle >= 2) {
          var cLast = getLastActive('Chitra');
          cEl.innerHTML = '<span class="dms-idle">- idle ' + cIdle + ' days - last active ' + cLast + '</span>';
        } else if (cStreak >= 3) {
          cEl.innerHTML = '<span class="dms-on">- ' + String(cStreak).padStart(2, '0') + ' day streak</span>';
        } else {
          cEl.innerHTML = '';
        }
      }
    }

    var clEl = document.getElementById('metric-client-streak');
    if (clEl) {
      var todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      var approvedToday = (window._activityLogs||[]).some(function(l) {
        return new Date(l.created_at) >= todayStart &&
          (l.new_stage === 'scheduled' ||
           l.new_stage === 'ready' ||
           l.new_stage === 'published') &&
          l.old_stage === 'awaiting_approval';
      });
      var clientLogs = logs.filter(function(l) {
        return l.actor === 'Client' ||
               l.new_stage === 'scheduled' ||
               l.old_stage === 'awaiting_approval';
      });
      if (approvedToday) {
        clEl.innerHTML = '<span class="dms-good">- approved today</span>';
      } else if (clientLogs.length) {
        var clLast = new Date(clientLogs[0].created_at);
        var clDiff = Math.floor((today - clLast) / (1000 * 60 * 60 * 24));
        var clLastStr = clLast.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
        if (clDiff === 1) {
          clEl.innerHTML = '<span class="dms-good">- approved yesterday</span>';
        } else if (clDiff >= 5) {
          clEl.innerHTML = '<span class="dms-idle">- idle ' + clDiff + ' days - last approved ' + clLastStr + '</span>';
        } else {
          clEl.innerHTML = '<span class="dms-muted">- last approved ' + clLastStr + '</span>';
        }
      } else {
        clEl.innerHTML = '';
      }
    }
  } catch (e) {
    console.warn('Streak update failed:', e);
  }
}

async function _getYesterdaysWin() {
  try {
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yStart = yesterday.toISOString().split('T')[0] + 'T00:00:00';
    var yEnd = yesterday.toISOString().split('T')[0] + 'T23:59:59';

    var logs = await apiFetch(
      '/activity_log?select=actor,action,new_stage,created_at' +
      '&created_at=gte.' + yStart +
      '&created_at=lte.' + yEnd +
      '&order=created_at.desc'
    );
    if (!Array.isArray(logs) || !logs.length) return '';

    logs = logs.map(function(l) {
      var a = l.actor || '';
      if (a === 'system' || a === 'Admin' ||
          a.indexOf('@') > -1) {
        l.actor = 'Shubham';
      }
      return l;
    });

    var pranavBuilt = logs.filter(function(l) {
      return l.actor === 'Pranav' && l.new_stage === 'ready';
    }).length;

    var chitraDispatched = logs.filter(function(l) {
      return l.actor === 'Chitra' && l.new_stage === 'awaiting_approval';
    }).length;

    var scheduled = logs.filter(function(l) {
      return l.new_stage === 'scheduled';
    }).length;

    var wins = [];
    if (pranavBuilt > 0) {
      wins.push('yesterday Pranav finished ' + pranavBuilt + ' post' + (pranavBuilt > 1 ? 's' : ''));
    }
    if (chitraDispatched > 0) {
      wins.push('Chitra dispatched ' + chitraDispatched);
    }
    if (scheduled > 0 && wins.length === 0) {
      wins.push(scheduled + ' post' + (scheduled > 1 ? 's' : '') + ' scheduled yesterday');
    }

    return wins.length ? wins.join(' \u00b7 ') : '';
  } catch (e) {
    return '';
  }
}

async function _appendYesterdaysWin() {
  var elDeck = document.getElementById('dash-deck');
  if (!elDeck) return;
  var win = await _getYesterdaysWin();
  if (win && elDeck.textContent) {
    elDeck.textContent = elDeck.textContent + ' \u00b7 ' + win;
  }
}

function updateBelowFold(posts) {
  var allP = posts || allPosts || [];
  _updateNextScheduled(allP);
  _updateTodaysFocus(allP);
  _updateUnsaidThing(allP);
  _updateLastMove(allP);
}

function _updateNextScheduled(allP) {
  var listEl = document.getElementById('dash-next-list');
  if (!listEl) return;
  var todayStr = new Date().toISOString().slice(0, 10);
  var upcoming = allP.filter(function(p) {
    return p.stage === 'scheduled' && p.target_date && p.target_date >= todayStr;
  }).sort(function(a, b) {
    return (a.target_date || '') < (b.target_date || '') ? -1 : 1;
  });
  var show = upcoming.slice(0, 2);
  if (!show.length) {
    listEl.innerHTML = '<div style="font-family:var(--mono);font-size:8px;color:#888;">Nothing scheduled yet</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < show.length; i++) {
    var p = show[i];
    var fd = formatPipelineDate(p.target_date);
    var pid = p.id || p.post_id || '';
    var owner = p.owner || '';
    var initials = owner.length >= 2 ? owner.slice(0,2).toUpperCase() : owner.toUpperCase();
    var metaParts = [];
    if (owner) metaParts.push('<span style="color:' + _ownerColor(owner) + '">' + esc(owner.toLowerCase()) + '</span>');
    if (p.content_pillar) metaParts.push(esc(p.content_pillar.toLowerCase()));
    if (p.location) metaParts.push(esc(p.location.toLowerCase()));
    html += '<div style="display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;" onclick="openPostOverSheet(\'' + pid + '\')">';
    html += '<div style="width:3px;flex-shrink:0;background:#22D3EE;"></div>';
    html += '<div style="flex:1;padding:8px 12px;">';
    html += '<div style="font-family:var(--mono);font-size:8px;letter-spacing:0.04em;margin-bottom:3px;color:#22D3EE;">' + esc(fd.text) + '</div>';
    html += '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#e8e2d9;margin-bottom:3px;">' + esc(p.title || 'Untitled') + '</div>';
    if (metaParts.length) html += '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' + metaParts.join(' - ') + '</div>';
    html += '</div>';
    html += '<div style="padding:8px 14px 8px 8px;display:flex;align-items:center;flex-shrink:0;">';
    html += '<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:8px;letter-spacing:0.04em;color:' + _ownerColor(owner) + ';">' + esc(initials) + '</div>';
    html += '</div></div>';
  }
  listEl.innerHTML = html;
}

function _updateTodaysFocus(allP) {
  var rowEl = document.getElementById('dash-focus-row');
  if (!rowEl) return;
  var candidates = allP.filter(function(p) {
    return p.stage === 'awaiting_approval' ||
           p.stageLC === 'awaiting_approval';
  }).sort(function(a,b) {
    return new Date((a.status_changed_at||a.statusChangedAt||a.updated_at||'') + 'Z') -
           new Date((b.status_changed_at||b.statusChangedAt||b.updated_at||'') + 'Z');
  });
  var focus = candidates.length ? candidates : allP.filter(function(p) {
    return p.stage === 'in_production' || p.stage === 'ready';
  }).sort(function(a, b) {
    return new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0);
  });
  if (focus.length) {
    var f = focus[0];
    var cfg = STAGE_META[f.stage] || {};
    var waitDays = _staleDays(f);
    var dateParts = [];
    if (waitDays > 0) dateParts.push('waiting ' + waitDays + 'd');
    dateParts.push((cfg.label || f.stage).toLowerCase());
    if (focus.length > 1) dateParts.push('+' + (focus.length - 1) + ' more');
    var owner = f.owner || '';
    var metaParts = [];
    if (owner) metaParts.push('<span style="color:' + _ownerColor(owner) + '">' + esc(owner.toLowerCase()) + '</span>');
    if (f.content_pillar) metaParts.push(esc(f.content_pillar.toLowerCase()));
    if (f.location) metaParts.push(esc(f.location.toLowerCase()));
    var pid = f.id || f.post_id || '';
    rowEl.innerHTML =
      '<div style="display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;" onclick="openPostOverSheet(\'' + pid + '\')">' +
      '<div style="width:3px;flex-shrink:0;background:#F6A623;"></div>' +
      '<div style="flex:1;padding:8px 12px;">' +
      '<div style="font-family:var(--mono);font-size:8px;letter-spacing:0.04em;margin-bottom:3px;color:#F6A623;">' + esc(dateParts.join(' - ')) + '</div>' +
      '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#e8e2d9;margin-bottom:3px;">' + esc(f.title || 'Untitled') + '</div>' +
      (metaParts.length ? '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' + metaParts.join(' - ') + '</div>' : '') +
      '</div>' +
      '<div style="padding:8px 14px 8px 8px;display:flex;align-items:center;flex-shrink:0;">' +
      '<span style="font-family:var(--mono);font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:#FF4B4B;background:transparent;border:none;">chase</span>' +
      '</div></div>';
  } else {
    rowEl.innerHTML =
      '<div style="padding:10px 18px 12px;font-family:var(--sans);font-size:13px;color:#888;line-height:1.5;font-style:italic;">Clear runway - nothing needs attention today</div>';
  }
}

function _updateLastMove(allP) {
  var textEl = document.getElementById('dash-move-text');
  if (!textEl) return;
  var moved = allP.filter(function(p) {
    return p.status_changed_at;
  }).sort(function(a, b) {
    return new Date((b.status_changed_at || '') + 'Z') - new Date((a.status_changed_at || '') + 'Z');
  });
  if (moved.length) {
    var last = moved[0];
    var cfg = STAGE_META[last.stage] || {};
    var ago = _timeAgo(last.status_changed_at);
    var actor = last.owner || '';
    var pid = last.id || last.post_id || '';
    var metaParts = [];
    if (actor) metaParts.push('<span style="color:' + _ownerColor(actor) + '">' + esc(actor.toLowerCase()) + '</span>');
    metaParts.push(esc((cfg.label || last.stage).toLowerCase()));
    var clickAttr = pid ? ' onclick="openPostOverSheet(\'' + pid + '\')"' : '';
    textEl.innerHTML =
      '<div style="display:flex;align-items:stretch;cursor:pointer;"' + clickAttr + '>' +
      '<div style="width:3px;flex-shrink:0;background:' + _ownerColor(actor) + ';"></div>' +
      '<div style="flex:1;padding:8px 12px;">' +
      '<div style="font-family:var(--mono);font-size:8px;letter-spacing:0.04em;margin-bottom:3px;color:#555;">' + esc(ago) + ' - ' + esc((cfg.label || last.stage).toLowerCase()) + '</div>' +
      '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#e8e2d9;margin-bottom:3px;">' + esc(last.title || 'Untitled') + '</div>' +
      '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' + metaParts.join(' - ') + '</div>' +
      '</div></div>';
  } else {
    textEl.innerHTML = '<div style="padding:10px 18px 12px;font-family:var(--sans);font-size:13px;color:#888;line-height:1.5;font-style:italic;">No moves yet</div>';
  }
}

function _timeAgo(dateStr) {
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  return days + 'd ago';
}

function _updateUnsaidThing(allP) {
  var el = document.getElementById('dash-unsaid-text');
  if (!el) return;
  var logs = window._activityLogs || [];

  // Priority 1: Pranav idle 3+ days
  var pranavPosts = allP.filter(function(p) {
    var o = (p.owner||'').toLowerCase();
    return o === 'pranav' || o === 'creative';
  });
  if (pranavPosts.length) {
    var lastPranav = pranavPosts.sort(function(a,b) {
      return new Date(b.updated_at||b.updatedAt||0) -
             new Date(a.updated_at||a.updatedAt||0);
    })[0];
    var pranavIdle = Math.floor(
      (Date.now() - new Date(lastPranav.updated_at||
      lastPranav.updatedAt)) / 86400000);
    if (pranavIdle >= 3) {
      el.textContent = 'Pranav has not submitted anything' +
        ' in ' + pranavIdle + ' days. The pipeline is waiting.';
      return;
    }
  }

  // Priority 2: Client not approving 3+ days
  var oldApprovals = allP.filter(function(p) {
    var s = p.stage || p.stageLC || '';
    return s === 'awaiting_approval' && isPostStale(p);
  });
  if (oldApprovals.length >= 3) {
    el.textContent = oldApprovals.length + ' posts are' +
      ' waiting on client approval for 3+ days.' +
      ' Chitra should be chasing.';
    return;
  }

  // Priority 3: Chitra has overdue posts
  var chitraOverdue = allP.filter(function(p) {
    var s = p.stage || p.stageLC || '';
    return (s === 'awaiting_approval' ||
            s === 'awaiting_brand_input') &&
           isPostStale(p);
  });
  if (chitraOverdue.length) {
    el.textContent = chitraOverdue.length +
      ' posts are waiting on client approval.' +
      ' Chitra needs to follow up.';
    return;
  }

  // Priority 4: runway low
  var runway = allP.filter(function(p) {
    var s = p.stage || p.stageLC || '';
    return s === 'scheduled';
  }).length;
  if (runway <= 3) {
    el.textContent = 'Only ' + runway +
      ' posts scheduled. The runway is thinning.';
    return;
  }

  // Priority 5: all good
  el.textContent = 'Nothing to flag today. Everyone is moving.';
}

function _updateDashTimestamp() {
  var el = document.getElementById('dash-updated');
  if (!el || !window._dashLastUpdated) return;
  var mins = Math.floor((Date.now() - window._dashLastUpdated) / 60000);
  el.textContent = mins === 0 ? 'Updated just now' :
                   mins === 1 ? 'Updated 1 min ago' :
                   'Updated ' + mins + ' min ago';
}

document.addEventListener('DOMContentLoaded', function() {
  setInterval(_updateDashTimestamp, 60000);
});

function renderPipelineStrip() {
  const strip = document.getElementById('pipeline-strip');
  const wrap  = document.getElementById('pipeline-strip-wrap');
  if (!strip) return;
  // Pipeline strip tiles removed - always keep hidden
  if (wrap) wrap.style.display = 'none';
  return;
  const html = STRIP_STAGES.map((group) => {
    const count = allPosts.filter(p =>
      group.stages.includes(p.stage || '')
    ).length;
    let cClass = '';
    if (group.target) cClass = count < READY_TO_SEND_TARGET ? ' warn' : ' ok';
    return `
      <div class="ps-stage" onclick="${group.tab === 'library' ? `goToLibraryFiltered('${group.stages[0]}')` : group.bucket ? `goToTab('tasks');scrollToBucket('${group.bucket}')` : `goToTab('${group.tab}')`}">\n        <span class="ps-dot" style="background:${group.color}"></span>
        <span class="ps-label">${group.label}</span>
        <span class="ps-count${cClass}">${count}</span>
      </div>`;
  }).join('');
  strip.innerHTML = html;
}

function renderProductionMeter() {
  const section = document.getElementById('prod-meter-section');
  if (!section) return;
  if (effectiveRole !== 'Admin') { section.innerHTML = ''; return; }
  const readyCount = allPosts.filter(p => p.stage === 'ready').length;
  const gap  = Math.max(0, READY_TO_SEND_TARGET - readyCount);
  const pct  = Math.min(100, Math.round((readyCount / READY_TO_SEND_TARGET) * 100));
  const isOk = gap === 0;
  section.innerHTML = `
  <div class="compact-meter">
    <div class="compact-meter-top">
      <span class="compact-meter-label">Ready</span>
      <span class="compact-meter-count" style="color:${isOk?'var(--c-green)':'var(--c-red)'}">
        ${readyCount}<span style="color:var(--text3);font-weight:400"> / ${READY_TO_SEND_TARGET}</span>
      </span>
      <span class="compact-meter-gap" style="color:${isOk?'var(--c-green)':'var(--c-red)'}">
        ${isOk ? 'OK On target' : `${gap} needed`}
      </span>
    </div>
    <div class="compact-meter-bar">
      <div class="compact-meter-fill ${isOk?'ok':'warn'}" style="width:${pct}%"></div>
    </div>
  </div>`;
}

function renderAdminInsight() {
  const section = document.getElementById('admin-insight-section');
  if (!section) return;
  if (effectiveRole !== 'Admin') { section.innerHTML = ''; return; }
  const now = Date.now();
  const DAY = 86400000;
  function daysSince(post) {
    const t = post.updated_at || post.updatedAt || post.created_at || post.createdAt;
    if (!t) return 0;
    return Math.floor((now - new Date(t).getTime()) / DAY);
  }
  const stuckProduction = allPosts.filter(p => p.stage === 'in_production' && daysSince(p) >= 3);
  const stuckClient     = allPosts.filter(p => ['awaiting_approval','awaiting_brand_input'].includes(p.stage || '') && daysSince(p) >= 3);
  // stuckReview removed  -  stage no longer exists
  const weekAgo  = now - 7 * DAY;
  function withinWeek(post, field) { const t = post[field]; if (!t) return false; return new Date(t).getTime() >= weekAgo; }
  const published = allPosts.filter(p => p.stage === 'published' && (withinWeek(p,'updated_at') || withinWeek(p,'updatedAt'))).length;
  const readyCount = allPosts.filter(p => p.stage === 'ready').length;
  const parkedPosts = allPosts.filter(p => p.stage !== 'published' && daysSince(p) >= 7);
  window._parkedPosts = parkedPosts;

  // Build pills for summary bar
  const blockers = stuckProduction.length + stuckClient.length;
  const blockPillClass = blockers === 0 ? 'green' : blockers >= 5 ? 'red' : 'amber';
  const readyPillClass = readyCount >= READY_TO_SEND_TARGET ? 'green' : readyCount >= READY_TO_SEND_TARGET * 0.5 ? 'amber' : 'red';

  section.innerHTML = `
    <div class="insight-summary-bar" onclick="openInsights()">
      <span class="insight-summary-pill ${blockPillClass}">[!] ${blockers === 0 ? 'No blockers' : `${blockers} blocked`}</span>
      <span class="insight-summary-pill ${readyPillClass}">OK ${readyCount}/${READY_TO_SEND_TARGET} ready</span>
      <span class="insight-summary-pill blue">[date] ${published} published this week</span>
      ${parkedPosts.length ? `<span class="insight-summary-pill amber">[P] ${parkedPosts.length} parked</span>` : ''}
      <span class="insight-summary-expand">Details -></span>
    </div>`;

  // Populate insights popup body
  const bottleneckRows = [
    stuckProduction.length ? `<div class="insight-flag"><span class="insight-flag-dot ${stuckProduction.length >= 3 ? 'red' : 'amber'}"></span>Production slow - ${stuckProduction.length} post${stuckProduction.length>1?'s':''} stuck 3+ days</div>` : '',
    stuckClient.length ? `<div class="insight-flag"><span class="insight-flag-dot ${stuckClient.length >= 3 ? 'red' : 'amber'}"></span>Client waiting - ${stuckClient.length} post${stuckClient.length>1?'s':''} waiting 3+ days</div>` : '',
  ].filter(Boolean).join('');
  const written  = allPosts.filter(p => withinWeek(p,'created_at') || withinWeek(p,'createdAt')).length;
  const approved = allPosts.filter(p => ['awaiting_approval','scheduled','published'].includes(p.stage || '') && (withinWeek(p,'updated_at') || withinWeek(p,'updatedAt'))).length;

  const body = document.getElementById('insights-body');
  if (body) {
    body.innerHTML = `
      <div class="insight-wrap">
        <div class="insight-panel"><div class="insight-panel-label">Bottlenecks</div>${bottleneckRows || '<div class="insight-flag"><span class="insight-flag-dot" style="background:var(--c-green)"></span>No blockers - pipeline clear</div>'}</div>
        <div class="insight-panel"><div class="insight-panel-label">This Week</div><div class="insight-rows">
          <div class="insight-row"><span class="insight-row-label">Written</span><span class="insight-row-val ${written===0?'warn':''}">${written}</span></div>
          <div class="insight-row"><span class="insight-row-label">Approved</span><span class="insight-row-val ${approved===0?'warn':''}">${approved}</span></div>
          <div class="insight-row"><span class="insight-row-label">Published</span><span class="insight-row-val ${published===0?'warn':'ok'}">${published}</span></div>
        </div></div>
        ${parkedPosts.length ? `<div class="insight-panel"><div class="insight-panel-label">Parked</div><div class="insight-row"><span class="insight-row-label">No movement in 7+ days</span><span class="insight-row-val warn" style="display:flex;align-items:center;gap:var(--sp-2)">${parkedPosts.length}<span class="insight-parked-link" onclick="closeInsights();openParked()">View -></span></span></div></div>` : ''}
      </div>`;
  }
}

function openParked() {
  const posts = window._parkedPosts || [];
  const list  = document.getElementById('parked-sheet-list');
  if (!list) return;
  list.innerHTML = posts.map(p => {
    const id    = getPostId(p);
    const title = getTitle(p);
    const stage = p.stage || '-';
    const { hex } = stageStyle(stage);
    const days  = Math.floor((Date.now() - new Date(p.updated_at || p.updatedAt || p.created_at).getTime()) / 86400000);
    return `<div class="upc-list-row" data-post-id="${esc(id)}" data-list="" data-close-parked="1" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:12px 4px;border-bottom:1px solid var(--border);gap:12px">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">Last moved ${days}d ago</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:${hex}22;color:${hex};flex-shrink:0">${esc(stage)}</span>
    </div>`;
  }).join('') || '<div style="color:var(--text3);padding:var(--sp-4) 0;font-size:14px">No parked posts.</div>';
  document.getElementById('parked-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeParked() {
  document.getElementById('parked-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function renderTaskBanner() {
  const section = document.getElementById('task-banner-section');
  if (!section) return;
  if (effectiveRole === 'Client') { section.innerHTML = ''; return; }
  const email    = localStorage.getItem('hinglish_email') || '';
  const roleName = effectiveRole;
  const myTasks  = allTasks.filter(t => !t.done && (t.assigned_to === roleName || (email && t.assigned_to.toLowerCase().includes(email.split('@')[0].toLowerCase()))));
  if (!myTasks.length) { section.innerHTML = ''; return; }
  const rows = myTasks.map(t => {
    const due = t.due_date ? `Due ${formatDateShort(t.due_date)}` : '';
    return `<div class="task-banner-item" id="task-item-${t.id}" data-task-id="${t.id}" data-post-id="${t.post_id || ''}"><input type="checkbox" class="task-check" data-task-id="${t.id}" /><div><div class="task-banner-msg">${esc(t.message)}</div>${due ? `<div class="task-banner-due">${due}</div>` : ''}</div><button class="btn-task-done" onclick="markTaskDone(${t.id})">Mark Done</button></div>`;
  }).join('');
  section.innerHTML = `<div class="task-banner"><div class="task-banner-label">Your Tasks (${myTasks.length})</div>${rows}</div>`;
}

function renderAdminTaskPanel() {
  const section = document.getElementById('admin-task-section');
  if (!section) return;
  if (effectiveRole !== 'Admin') { section.innerHTML = ''; return; }
  const openTasks = allTasks.filter(t => !t.done);
  const doneTasks = allTasks.filter(t => t.done).slice(0, 5);
  const openRows = openTasks.map(t => {
    const due = t.due_date ? ` . Due ${formatDateShort(t.due_date)}` : '';
    return `<div class="admin-task-item"><div class="admin-task-item-body"><div class="admin-task-item-msg">${esc(t.message)}</div><div class="admin-task-item-meta">${esc(t.assigned_to)}${due}</div></div><button class="btn-task-delete" onclick="deleteTask(${t.id})" title="Delete task">x</button></div>`;
  }).join('');
  const doneRows = doneTasks.map(t => `<div class="admin-task-item"><div class="admin-task-item-body admin-task-item-done"><div class="admin-task-item-msg">${esc(t.message)}</div><div class="admin-task-item-meta">${esc(t.assigned_to)}</div></div><button class="btn-task-delete" onclick="deleteTask(${t.id})" title="Delete task">x</button></div>`).join('');
  section.innerHTML = `<div class="admin-task-wrap"><div class="insight-panel-label">Assign a Task</div><div class="admin-task-form"><div class="admin-task-row"><select id="atask-assignee" style="flex:1"><option value="">Assign to...</option><option>Chitra</option><option>Pranav</option></select><input type="date" id="atask-due" placeholder="Due date (optional)" placeholder="Due date (optional)" title="Due date (optional)" style="flex:0 0 auto;width:140px"></div><input type="text" id="atask-msg" placeholder="e.g. Upload 20 February posts to the system" onkeydown="if(event.key==='Enter')assignTask()"><button class="btn-modal-primary" style="align-self:flex-start;padding:var(--sp-2) var(--sp-5)" onclick="assignTask()">Assign Task</button></div>${openTasks.length ? `<div class="admin-task-section-label">Open (${openTasks.length})</div><div class="admin-task-list">${openRows}</div>` : '<div style="font-size:13px;color:var(--text3)">No open tasks.</div>'}${doneTasks.length ? `<div class="admin-task-section-label">Completed</div><div class="admin-task-list">${doneRows}</div>` : ''}</div>`;
}

function daysInStage(post) {
  const ts = post.updated_at || post.created_at;
  if (!ts) return null;
  return Math.floor((new Date() - new Date(ts)) / 86400000);
}

function staleLabel(days, stageName) {
  if (days === null || days < 3) return null;
  if (stageName) {
    const key = stageName;
    const meta = (typeof STAGE_META !== 'undefined') ? STAGE_META[key] : null;
    const short = meta ? meta.label : stageName;
    return `${days}d in ${short}`;
  }
  return `${days}d`;
}

function staleClass(days) {
  if (days === null || days < 3) return '';
  if (days >= 5) return 'red';
  return 'amber';
}

function getMyTasks() {
  const allowed = ROLE_STAGES[effectiveRole];
  if (!allowed) return allPosts;
  return allPosts.filter(p => allowed.includes(p.stage || ''));
}

function getNextPost() {
  const posts = getMyTasks();
  if (!posts.length) return null;
  return [...posts].sort((a,b) => {
    const ia = STAGE_URGENCY.indexOf(a.stage || '');
    const ib = STAGE_URGENCY.indexOf(b.stage || '');
    return (ia===-1?99:ia) - (ib===-1?99:ib);
  })[0] || null;
}

function getRelativeDate(rawDate) {
  const d = parseDate(rawDate);
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff === 0)  return { text:'Today',     cls:'today' };
  if (diff === 1)  return { text:'Tomorrow',  cls:'soon' };
  if (diff === -1) return { text:'Yesterday', cls:'overdue' };
  if (diff > 0 && diff <= 7) return { text:`In ${diff} days`, cls:'soon' };
  if (diff < 0)   return { text:`${Math.abs(diff)}d overdue`, cls:'overdue' };
  return { text: displayDate(rawDate), cls: '' };
}

function renderNextPost() {
  const section = document.getElementById('next-post-section');
  if (!section) return;
  if (effectiveRole === 'Client') { section.innerHTML=''; return; }
  const post = getNextPost();
  if (!post) {
    section.innerHTML = `<div class="hero-card"><div class="hero-label">Most Urgent Post</div><div class="empty-state" style="padding:var(--sp-5) 0 0"><div class="empty-icon">OK</div><p>All clear - nothing here right now.</p></div></div>`;
    return;
  }
  const id        = getPostId(post);
  const title     = getTitle(post);
  const stage     = post.stage || '';
  const { hex, label: stageLabel } = stageStyle(stage);
  const owner     = formatOwner(post.owner);
  const pillar    = formatPillarDisplay(post.contentPillar);
  const comments  = post.comments || '';
  const postLink  = getPostLink(post);
  const linkLabel = getPostLinkLabel(post);
  const relDate   = getRelativeDate(post.targetDate);
  const days      = daysInStage(post);
  const stLabel   = staleLabel(days, stage);
  const stCls     = staleClass(days);
  const canUpdate = effectiveRole !== 'Client';
  let primaryLabel = '', primaryAction = '', secondaryLabel = '', secondaryAction = '';
  if (stage === 'awaiting_brand_input') { primaryLabel='Start Production'; primaryAction=`quickStage('${esc(id)}','in_production')`; secondaryLabel='Send for Approval'; secondaryAction=`quickStage('${esc(id)}','awaiting_approval')`; }
  else if (stage === 'in_production') { primaryLabel='Mark Ready'; primaryAction=`quickStage('${esc(id)}','ready')`; secondaryLabel='Send for Approval'; secondaryAction=`quickStage('${esc(id)}','awaiting_approval')`; }
  else if (stage === 'ready') { primaryLabel='Send for Approval'; primaryAction=`quickStage('${esc(id)}','awaiting_approval')`; secondaryLabel='Mark Scheduled'; secondaryAction=`quickStage('${esc(id)}','scheduled')`; }
  else if (stage === 'awaiting_approval') { primaryLabel='Mark Scheduled'; primaryAction=`quickStage('${esc(id)}','scheduled')`; secondaryLabel='Copy Approval Link'; secondaryAction=`copyApprovalLink('${window.location.origin}/p/${esc(id)}')`; }
  else { primaryLabel='Update Stage'; primaryAction=`openPCS('${esc(id)}')`; }
  const heroLabel = 'Most Urgent';
  let staleNote = '';
  if (stLabel) staleNote = `<div style="font-size:12px;color:var(--${stCls==='red'?'c-red':'c-amber'});margin-bottom:var(--sp-3);font-weight:600">[T] ${stLabel} in this stage</div>`;
  section.innerHTML = `<div class="hero-card"><div class="hero-label">${heroLabel}</div><div class="hero-title">${esc(title)}</div><div class="hero-meta"><span class="tag tag-stage" style="background:${hex}22;color:${hex}">${esc(stageLabel)}</span>${pillar ? `<span class="tag tag-pillar">${esc(pillar)}</span>` : ''}${owner!=='-' ? `<span class="tag tag-owner">${esc(owner)}</span>` : ''}${relDate ? `<span class="tag tag-date ${relDate.cls}">${relDate.text}</span>` : ''}${stLabel ? `<span class="stale-badge ${stCls}">${stLabel}</span>` : ''}</div>${staleNote}${comments ? `<div class="hero-comments" id="hero-comments-${esc(id)}">${esc(comments)}</div>${comments.length > 120 ? `<button class="hero-read-more" onclick="toggleHeroComments('${esc(id)}', this)">Read more</button><button class="btn-zen" onclick="openZen('${esc(title)}','${esc(comments)}')">[sq] Zen Mode - expand brief</button>` : `<button class="hero-read-more" onclick="toggleHeroComments('${esc(id)}', this)">Read more</button>`}` : ''}${postLink ? `<a href="${esc(postLink)}" target="_blank" rel="noopener" class="hero-design-link">[edit] ${linkLabel} ^</a>` : (stage === 'in_production' || stage === 'awaiting_brand_input') ? `<div class="hero-no-design">[!] No design link - add one below</div>` : ''}<div class="hero-actions"><button class="btn-hero-primary" onclick="${primaryAction}">${primaryLabel}</button>${(stage === 'in_production' || stage === 'awaiting_brand_input') ? `<button class="btn-flag" onclick="flagIssue('${esc(id)}')">[flag] Flag Issue</button>` : secondaryLabel === 'Copy Approval Link' ? `<button class="btn-hero-ghost" onclick="${secondaryAction}" style="flex:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:5px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Copy Approval Link</button>` : secondaryLabel ? `<button class="btn-hero-ghost" onclick="${secondaryAction}">${secondaryLabel}</button>` : ''}${canUpdate ? `<button class="btn-hero-more" onclick="openPCS('${esc(id)}')" title="Edit post">...</button>` : ''}</div></div>`;
}

function toggleHeroComments(id, btn) {
  const el = document.getElementById(`hero-comments-${id}`);
  if (!el) return;
  const expanded = el.classList.toggle('expanded');
  btn.textContent = expanded ? 'Show less' : 'Read more';
}

// -- Unified post list registry -----------------
const _postLists = {};

function buildPostCard(p, listKey) {
  const id     = getPostId(p);
  const title  = getTitle(p);
  const stage  = p.stage || '';
  const pillar = getPillarShort(p.contentPillar);
  const { hex } = stageStyle(stage);

  const d = parseDate(p.targetDate);
  const dateStr = formatDateShort(p.targetDate);
  const isToday = d && d.toDateString() === new Date().toDateString();

  // All posts fully visible  -  no role-based dimming
  const dimClass = 'pc-primary';

  return `
    <div class="row-tile ${dimClass}" id="upc-${esc(id)}" data-post-id="${esc(id)}" data-list="${esc(listKey||'')}">
      <span class="row-date${isToday ? ' today' : ''}">${esc(dateStr)}</span>
      <span class="row-body">
        <span class="row-title">${esc(title)}</span>
        ${pillar ? `<span class="row-pillar">${esc(pillar)}</span>` : ''}
      </span>
      <span class="row-dot" style="background:${hex}" title="${esc(stage)}"></span>
      <span class="row-action"></span>
    </div>`;
}


// -- Pipeline card builder ----------------------
function showChaseToast(msg) {
  var toast = document.getElementById('chase-toast');
  if (!toast) return;
  toast.textContent = msg || 'Copied to clipboard';
  toast.classList.add('visible');
  setTimeout(function() {
    toast.classList.remove('visible');
  }, 1800);
}

function _pipelineStageKey(stage) {
  var s = stage || '';
  if (s === 'in_production') return 'production';
  if (s === 'ready') return 'ready';
  if (s === 'awaiting_brand_input') return 'input';
  if (s === 'awaiting_approval') return 'approval';
  if (s === 'scheduled') return 'scheduled';
  if (s === 'published') return 'published';
  if (s === 'parked') return 'parked';
  if (s === 'rejected') return 'rejected';
  return '';
}

function buildPipelineCard(p, listKey) {
  var id = getPostId(p);
  var title = getTitle(p);
  var stage = p.stage || '';
  var stageLC = stage.toLowerCase();

  // Card type detection
  var _isBrief = (p.stage || '') === 'brief';
  var _hasFeedback = !_isBrief &&
    p.client_feedback && p.client_feedback.trim().length > 0;

  // FIX 1 -- Color bar computation
  var tdRaw = p.targetDate || p.target_date;
  var cardIsStale = isPostStale(p);
  var barColor = _isBrief ? '#C8A84B' :
    _hasFeedback ? '#FF4B4B' :
    cardIsStale && stageLC === 'awaiting_approval'
    ? 'var(--c-red)' :
    cardIsStale ? 'var(--c-amber)' :
    stageLC === 'scheduled' ? 'var(--c-cyan)' :
    stageLC === 'awaiting_brand_input' ? 'var(--c-purple)' :
    'rgba(255,255,255,0.06)';

  // Row wash background
  var rowBg = _isBrief ? 'rgba(200,168,75,0.04)' :
    _hasFeedback ? 'rgba(255,75,75,0.04)' : 'transparent';

  // FIX 2 -- Date
  var dateInfo = formatPipelineDate(tdRaw);

  // FIX 4 -- Meta line: PILLAR . OWNER . LOCATION
  var pillarShort = (p.contentPillar || p.content_pillar || '').slice(0,6).toUpperCase();
  var ownerStr = p.owner || '';
  var locationStr = p.location || '';
  var metaParts = [pillarShort, ownerStr, locationStr].filter(Boolean);
  var metaLine = metaParts.join(' \xB7 ');

  // Brief cards show date/time instead of pillar/owner/location
  if (_isBrief) {
    var _bd = new Date((p.status_changed_at || '') + 'Z');
    var _bdate = _bd.toLocaleDateString('en-IN',
      {day:'numeric',month:'short',timeZone:'Asia/Kolkata'});
    var _btime = _bd.toLocaleTimeString('en-IN',
      {hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'});
    metaLine = 'Client request \xB7 ' + _bdate + ' \xB7 ' + _btime;
  }

  // Chip HTML for brief/feedback card types
  var chipHtml = '';
  if (_isBrief) {
    chipHtml =
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.12em;text-transform:uppercase;' +
      'background:#C8A84B;color:#000;font-weight:600;' +
      'padding:4px 8px;flex-shrink:0;">BRIEF</div>';
  } else if (_hasFeedback) {
    chipHtml =
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.12em;text-transform:uppercase;' +
      'background:#FF4B4B;color:#fff;font-weight:600;' +
      'padding:4px 8px;flex-shrink:0;">FEEDBACK</div>';
  }

  // Right side: chip for brief/feedback, chase/owner badge for normal
  var rightHtml = '';
  if (_isBrief || _hasFeedback) {
    rightHtml = chipHtml;
  } else {
    // FIX 5 -- Chase button (plain text, no border)
    var _isClientCard = (effectiveRole || '').toLowerCase() === 'client';
    if (!_isClientCard && stage === 'awaiting_approval') {
      var changed = p.status_changed_at ? new Date((p.status_changed_at || '') + 'Z') : null;
      var daysWaiting = changed ? Math.floor((new Date() - changed) / 86400000) : 0;
      if (daysWaiting >= 3) {
        var sentDate = changed ? changed.toLocaleDateString('en-GB', {day:'numeric', month:'short', timeZone:'Asia/Kolkata'}) : 'recently';
        var chaseMsg = 'Hi! Following up on ' + title + ' sent for approval on ' + sentDate + '. Please review when you get a chance';
        rightHtml = '<button onclick="event.stopPropagation();copyChase(\'' + encodeURIComponent(chaseMsg) + '\')" ' +
          'style="font-family:var(--mono);font-size:8px;letter-spacing:0.1em;text-transform:uppercase;' +
          'color:var(--c-red);background:transparent;border:none;cursor:pointer;padding:0;">' +
          'CHASE ' + daysWaiting + 'D</button>';
      }
    }
    // FIX 6 -- Owner badge on non-chase cards (colored initials)
    if (!rightHtml) {
      var ownerColors = {
        'client': 'var(--c-red)',
        'chitra': 'var(--c-cyan)',
        'pranav': 'var(--c-purple)'
      };
      var ownerKey = (p.owner || '').toLowerCase();
      var ownerColor = ownerColors[ownerKey] || '#666';
      var ownerInitial = (p.owner || '').slice(0,2).toUpperCase();
      if (ownerInitial) {
        rightHtml = '<div style="width:24px;height:24px;border-radius:50%;' +
          'background:rgba(255,255,255,0.05);font-family:var(--mono);' +
          'font-size:7px;color:' + ownerColor + ';display:flex;align-items:center;' +
          'justify-content:center;flex-shrink:0;">' + esc(ownerInitial) + '</div>';
      }
    }
  }

  // Build card content (all inline -- no CSS classes for card layout)
  var innerCard =
    '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-family:var(--mono);font-size:8px;letter-spacing:0.04em;margin-bottom:4px;color:' + dateInfo.color + ';">' + esc(dateInfo.text) + '</div>' +
        '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#ccc;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(title) + '</div>' +
        (metaLine ? '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' + esc(metaLine) + '</div>' : '') +
      '</div>' +
      (rightHtml ? '<div style="flex-shrink:0;">' + rightHtml + '</div>' : '') +
    '</div>';

  // FIX 1 -- Outer wrapper with 3px color bar + bottom divider
  return '<div data-post-id="' + esc(id) + '" data-list="' + esc(listKey||'pipeline') + '" data-stage="' + esc(stageLC) + '" id="upc-' + esc(id) + '" style="display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;background:' + rowBg + ';">' +
    '<div style="width:3px;flex-shrink:0;background:' + barColor + ';"></div>' +
    '<div style="flex:1;">' + innerCard + '</div>' +
  '</div>';
}

// -- Pipeline chip count updater ----------------
function updatePipelineChipCounts() {
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var pipelinePosts = posts.filter(function(p) {
    return !['published', 'parked', 'rejected'].includes(p.stage);
  });
  var stageCounts = {
    all:                  pipelinePosts.length,
    in_production:        pipelinePosts.filter(function(p) { return p.stage === 'in_production'; }).length,
    ready:                pipelinePosts.filter(function(p) { return p.stage === 'ready'; }).length,
    awaiting_approval:    pipelinePosts.filter(function(p) { return p.stage === 'awaiting_approval'; }).length,
    awaiting_brand_input: pipelinePosts.filter(function(p) { return p.stage === 'awaiting_brand_input'; }).length,
    scheduled:            pipelinePosts.filter(function(p) { return p.stage === 'scheduled'; }).length,
  };
  var chipMap = {
    all: 'all', in_production: 'in_production', ready: 'ready',
    awaiting_approval: 'awaiting_approval', awaiting_brand_input: 'awaiting_brand_input',
    scheduled: 'scheduled'
  };
  var keys = Object.keys(stageCounts);
  for (var k = 0; k < keys.length; k++) {
    var chipKey = chipMap[keys[k]] || keys[k];
    var el = document.getElementById('chip-count-' + chipKey);
    if (el) el.textContent = stageCounts[keys[k]];
  }
  // Hide chips with zero count (except ALL); also filter for Client role
  var _isClientChip = (effectiveRole || '').toLowerCase() === 'client';
  var _clientVisibleStages = ['all', 'awaiting_approval', 'awaiting_brand_input', 'published'];
  document.querySelectorAll('#stage-strip .stage-chip').forEach(function(chip) {
    var stage = chip.dataset.stage;
    if (_isClientChip && _clientVisibleStages.indexOf(stage) === -1) {
      chip.style.display = 'none';
      return;
    }
    if (stage === 'all') return;
    var count = stageCounts[stage] || 0;
    chip.style.display = count > 0 ? 'flex' : 'none';
  });
  // Inject colored dots into stage chips (after counts and visibility)
  var dotColors = {
    all: '#666',
    awaiting_approval: 'var(--c-red)',
    awaiting_brand_input: 'var(--c-purple)',
    scheduled: 'var(--c-cyan)',
    ready: 'var(--c-green)',
    in_production: 'var(--c-amber)'
  };
  document.querySelectorAll('#stage-strip .stage-chip').forEach(function(chip) {
    var stage = chip.dataset.stage;
    if (!chip.querySelector('.chip-dot')) {
      var dot = document.createElement('span');
      dot.className = 'chip-dot';
      dot.style.background = dotColors[stage] || '#555';
      chip.insertBefore(dot, chip.firstChild);
    }
    var countEl = chip.querySelector('.chip-count');
    if (countEl) {
      countEl.style.color = dotColors[stage] || '#555';
    }
  });
}

// -- Person strip count updater ------------------
function updatePersonStripCounts() {
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var clientCount = posts.filter(function(p) {
    return p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input';
  }).length;
  var chitraCount = posts.filter(function(p) {
    return p.stage === 'ready' || p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input';
  }).length;
  var pranavCount = posts.filter(function(p) {
    return p.stage === 'in_production';
  }).length;
  var clientEl = document.getElementById('person-num-client');
  var chitraEl = document.getElementById('person-num-chitra');
  var pranavEl = document.getElementById('person-num-pranav');
  if (clientEl) clientEl.textContent = clientCount;
  if (chitraEl) chitraEl.textContent = chitraCount;
  if (pranavEl) pranavEl.textContent = pranavCount;
}

// -- Person filter handler -----------------------
function filterPipelineByPerson(person) {
  if (_activePerson === person) {
    _activePerson = null;
    document.querySelectorAll('.person-btn').forEach(b => b.classList.remove('active'));
  } else {
    _activePerson = person;
    document.querySelectorAll('.person-btn').forEach(b => b.classList.remove('active'));
    var btn = document.getElementById('person-btn-' + person);
    if (btn) btn.classList.add('active');
  }
  renderPipeline();
}

// -- Pipeline stage chip click handler ----------
function filterPipelineByChip(stage) {
  var strip = document.getElementById('stage-strip');
  if (!strip) return;
  var chips = strip.querySelectorAll('.stage-chip');
  chips.forEach(function(c) { c.classList.remove('active'); });
  var clicked = strip.querySelector('.stage-chip[data-stage="' + stage + '"]');
  if (clicked) clicked.classList.add('active');
  if (stage === 'all') {
    window.pcsPipelineFilter = null;
  } else {
    window.pcsPipelineFilter = [stage];
  }
  renderPipeline();
}

// Wire pipeline stage chip clicks
document.addEventListener('DOMContentLoaded', function() {
  var strip = document.getElementById('stage-strip');
  if (strip) {
    strip.addEventListener('click', function(e) {
      var chip = e.target.closest('.stage-chip');
      if (!chip) return;
      var stage = chip.dataset.stage;
      if (stage) filterPipelineByChip(stage);
    });
  }
});

// -- Task stage chip filter ---------------------
let _taskFilter = null; // null = show all, string = bucket key

function renderTaskStageChips() {
  const el = document.getElementById('task-stage-chips');
  if (!el) return;
  const buckets = ROLE_BUCKETS[effectiveRole];
  if (!buckets || !buckets.length) { el.innerHTML = ''; return; }

  const chips = buckets.map(bucket => {
    const count = allPosts.filter(p =>
      bucket.stages.includes(p.stage || '')
    ).length;
    const active = _taskFilter === bucket.key ? ' chip-active' : '';
    // Find color from STRIP_STAGES
    const stripStage = (window.STRIP_STAGES||[]).find(s => s.bucket === bucket.key);
    const color = stripStage ? stripStage.color : 'var(--text3)';
    const warn = bucket.warn && count > 0 ? ' chip-warn' : '';
    return `
      <button class="pf-chip${active}${warn}" onclick="filterTasksByChip('${bucket.key}')">
        <span class="chip-dot" style="background:${color}"></span>
        <span class="chip-label">${esc(bucket.label)}</span>
        <span class="chip-count">${count}</span>
      </button>`;
  }).join('');

  el.innerHTML = `<div class="stage-chip-grid">${chips}</div>`;
}

function filterTasksByChip(bucketKey) {
  _taskFilter = _taskFilter === bucketKey ? null : bucketKey;
  renderTaskStageChips();
  _renderFilteredTasks();
}

function _renderFilteredTasks() {
  const container = document.getElementById('tasks-container');
  if (!container) return;
  const buckets = ROLE_BUCKETS[effectiveRole];
  if (!buckets) return;

  if (!_taskFilter) {
    // Show all buckets
    renderTasks();
    return;
  }

  const bucket = buckets.find(b => b.key === _taskFilter);
  if (!bucket) { renderTasks(); return; }

  const posts = allPosts.filter(p =>
    bucket.stages.includes(p.stage || '')
  );
  const listKey = `tasks-${bucket.key}`;
  _postLists[listKey] = posts;

  if (!posts.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">OK</div><p>Nothing in ${esc(bucket.label)} right now.</p></div>`;
    return;
  }
  container.innerHTML = `
      <div class="pstage-header">
        <span class="pstage-name">${esc(bucket.label)}</span>
        <span class="pstage-badge">${posts.length}</span>
      </div>
      <div class="row-list">${posts.map(p => buildPostCard(p, listKey)).join('')}</div>`;
}

function renderTasks() {
  try { _renderTasksInner(); } catch(e) { console.error('[PCS] renderTasks crash:', e); }
}
function _renderTasksInner() {
  renderTaskStageChips();

  // If a chip filter is active, let _renderFilteredTasks handle it
  if (_taskFilter) { _renderFilteredTasks(); return; }

  const container = document.getElementById('tasks-container');
  if (!container) return;
  const buckets = ROLE_BUCKETS[effectiveRole];
  if (!buckets) {
    const posts = getMyTasks();
    _postLists['tasks'] = posts;
    container.innerHTML = posts.length
      ? `<div class="row-list">${posts.map(p => buildPostCard(p,'tasks')).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">OK</div><p>All clear - nothing here right now.</p></div>`;
    return;
  }
  const stagesHtml = buckets.map(bucket => {
    const posts = allPosts
      .filter(p => bucket.stages.includes(p.stage || ''))
      .filter(p => !isSnoozed(getPostId(p)));
    const listKey = `tasks-${bucket.key}`;
    _postLists[listKey] = posts;
    const count    = posts.length;
    const badgeCls = bucket.warn && count > 0 ? ' warn' : '';
    const LIMIT    = 8;
    const visible  = posts.slice(0, LIMIT);
    const hidden   = posts.slice(LIMIT);
    const cards    = visible.map(p => buildPostCard(p, listKey)).join('');
    const overflow = hidden.length
      ? `<button class="pstage-overflow" onclick="toggleStageOverflow(this,${hidden.length})"
           data-hidden-ids="${esc(hidden.map(p=>getPostId(p)).join(','))}">+${hidden.length} more</button>` : '';
    return `
      <div class="pstage-header">
        <span class="pstage-name">${esc(bucket.label)}</span>
        <span class="pstage-badge${badgeCls}">${count}</span>
      </div>
      <div class="row-list">${count ? cards + overflow : `<div class="pstage-empty">All clear OK</div>`}</div>`;
  }).join('');
  container.innerHTML = stagesHtml;
}

function toggleStageOverflow(btn, totalHidden) {
  const list = btn.closest('.row-list');
  const isShowing = btn.dataset.showing === '1';
  if (!isShowing) {
    const ids = btn.dataset.hiddenIds.split(',').filter(Boolean);
    const listKey = ids.length ? (document.querySelector(`#upc-${ids[0]}`)?.dataset.list || '') : '';
    const posts = ids.map(id => getPostById(id)).filter(Boolean);
    const html = posts.map(p => buildPostCard(p, listKey)).join('');
    btn.insertAdjacentHTML('beforebegin', html);
    btn.dataset.showing = '1';
    btn.textContent = '? Show less';
  } else {
    // Remove dynamically added cards
    const ids = btn.dataset.hiddenIds.split(',').filter(Boolean);
    ids.forEach(id => document.getElementById(`upc-${id}`)?.remove());
    btn.dataset.showing = '';
    btn.textContent = `+${totalHidden} more`;
  }
}

// ===============================================
// Batch selection mode for Ready group
// ===============================================
function toggleBatchMode() {
  _batchMode = !_batchMode;
  _batchSelected.clear();

  var btn = document.getElementById('batch-select-btn');
  var bar = document.getElementById('batch-bar');

  if (btn) btn.classList.toggle('active', _batchMode);
  if (bar) bar.style.display = _batchMode ? 'flex' : 'none';

  document.querySelectorAll('[data-post-id][data-stage="ready"]').forEach(function(card) {
    if (_batchMode) {
      card.classList.add('batch-mode');
      var cb = document.createElement('div');
      cb.className = 'batch-checkbox';
      cb.setAttribute('data-batch-cb', '1');
      card.insertBefore(cb, card.firstChild);
    } else {
      card.classList.remove('batch-mode', 'batch-selected');
      var existing = card.querySelector('[data-batch-cb]');
      if (existing) existing.remove();
    }
  });

  updateBatchCount();
}

function toggleBatchCard(postId, cardEl) {
  if (!_batchMode) return;
  if (_batchSelected.has(postId)) {
    _batchSelected.delete(postId);
    cardEl.classList.remove('batch-selected');
  } else {
    _batchSelected.add(postId);
    cardEl.classList.add('batch-selected');
  }
  updateBatchCount();
}

function updateBatchCount() {
  var countEl = document.getElementById('batch-count');
  if (countEl) countEl.textContent = _batchSelected.size;
}

async function executeBatchAction(targetStage) {
  if (_batchSelected.size === 0) return;

  var ids = Array.from(_batchSelected);
  var now = new Date().toISOString();
  var dbStage = toDbStage(targetStage);
  var actor = resolveActor();

  try {
    // PostgREST IN filter: post_id=in.(id1,id2,...)
    var inList = ids.map(function(id) { return encodeURIComponent(id); }).join(',');
    await apiFetch('/posts?post_id=in.(' + inList + ')', {
      method: 'PATCH',
      body: JSON.stringify({
        stage: dbStage,
        status_changed_at: now,
        updated_at: now,
        updated_by: actor
      }),
    });

    var notifActor = resolveActor() || 'Chitra';
    var count = ids.length;
    var stageLabel = targetStage === 'awaiting_approval'
      ? 'for approval' : 'for brand input';

    await apiFetch('/notifications', {
      method: 'POST',
      body: JSON.stringify({
        user_role: 'Admin',
        post_id: null,
        type: targetStage,
        message: notifActor + ' sent ' + count + ' posts ' + stageLabel
      })
    });

    toggleBatchMode();
    loadPosts();

  } catch (err) {
    console.error('Batch action error:', err);
    showToast('Batch update failed - try again', 'error');
  }
}

function renderPipeline() {
  try { _renderPipelineInner(); } catch(e) { console.error('[PCS] renderPipeline crash:', e); }
  updatePipelineCritical(allPosts);
  updatePipelineStageBar(allPosts);
  updatePipelineNarrative(allPosts);
}
function updatePipelineHeader() {
  updatePipelineNarrative(allPosts);
}

function updatePipelineNarrative(posts) {
  var wrapEl = document.getElementById('pipeline-narrative');
  if (!wrapEl) return;
  var el = document.getElementById('pipeline-narrative-text');
  if (!el) el = wrapEl;
  var allP = posts || allPosts || [];
  var now = new Date(); now.setHours(0,0,0,0);

  var stageDisplayNames = {
    'awaiting_approval':   'Approval',
    'awaiting_brand_input': 'Input',
    'in_production':       'Production',
    'ready':               'Ready',
    'scheduled':           'Scheduled'
  };

  function setText(text, color, filterStage) {
    el.textContent = text;
    el.style.color = color;
    wrapEl.dataset.filterStage = filterStage || 'all';
  }

  // PRIORITY 1: post stuck in stage 2+ days
  var stuck = allP.filter(function(p) {
    return isPostStale(p);
  }).sort(function(a,b) {
    var aChanged = a.status_changed_at || a.statusChangedAt ||
                   a.updated_at || a.updatedAt;
    var bChanged = b.status_changed_at || b.statusChangedAt ||
                   b.updated_at || b.updatedAt;
    return new Date(aChanged) - new Date(bChanged);
  });

  if (stuck.length) {
    var stuckStage = stuck[0].stage || stuck[0].stageLC;
    var stageName = stageDisplayNames[stuckStage] || 'Post';
    var changed = stuck[0].status_changed_at ||
                  stuck[0].statusChangedAt ||
                  stuck[0].updated_at || stuck[0].updatedAt;
    var daysStuck = Math.floor(
      (Date.now() - new Date(changed)) / 86400000);
    var color = daysStuck >= 4 ? 'var(--c-red)' : 'var(--c-amber)';
    setText(
      stageName + ' \u00b7 ' + daysStuck + 'd waiting',
      color,
      stuckStage
    );
    return;
  }

  // PRIORITY 2a: 5+ approvals waiting
  var approvals = allP.filter(function(p) {
    return p.stage === 'awaiting_approval' ||
           p.stageLC === 'awaiting_approval';
  });
  if (approvals.length >= 5) {
    setText(
      approvals.length + ' waiting on approval',
      'var(--c-red)',
      'awaiting_approval'
    );
    return;
  }

  // PRIORITY 2b: 1-4 approvals waiting
  if (approvals.length >= 1) {
    setText(
      'Approval \u00b7 ' + approvals.length + ' post' +
      (approvals.length === 1 ? '' : 's') + ' waiting',
      'var(--c-amber)',
      'awaiting_approval'
    );
    return;
  }

  // PRIORITY 3: input blocked
  var inputs = allP.filter(function(p) {
    return p.stage === 'awaiting_brand_input' ||
           p.stageLC === 'awaiting_brand_input';
  });
  if (inputs.length) {
    setText(
      'Input \u00b7 ' + inputs.length + ' post' +
      (inputs.length === 1 ? '' : 's') + ' waiting',
      'var(--c-purple)',
      'awaiting_brand_input'
    );
    return;
  }

  // PRIORITY 4: production posts exist
  var production = allP.filter(function(p) {
    return p.stage === 'in_production' ||
           p.stageLC === 'in_production';
  });
  if (production.length) {
    setText(
      'Production \u00b7 ' + production.length + ' in progress',
      'var(--c-amber)',
      'in_production'
    );
    return;
  }

  // PRIORITY 5: Pranav idle 3+ days
  var pranavPosts = allP.filter(function(p) {
    return (p.owner||'').toLowerCase() === 'pranav' ||
           (p.owner||'').toLowerCase() === 'creative';
  });
  if (pranavPosts.length) {
    var last = pranavPosts.sort(function(a,b) {
      return new Date(b.updated_at||b.updatedAt) -
             new Date(a.updated_at||a.updatedAt);
    })[0];
    var idle = Math.floor(
      (Date.now() - new Date(last.updated_at||last.updatedAt))
      / 86400000);
    if (idle >= 3) {
      setText(
        'Pranav idle \u00b7 ' + idle + ' days',
        'var(--c-amber)',
        'all'
      );
      return;
    }
  }

  // PRIORITY 6: scheduled posts exist
  var sched = allP.filter(function(p) {
    return p.stage === 'scheduled' || p.stageLC === 'scheduled';
  });
  if (sched.length) {
    setText(
      'Pipeline sorted \u00b7 ' + sched.length + ' scheduled',
      'var(--c-green)',
      'scheduled'
    );
    return;
  }

  // PRIORITY 7: default
  setText(
    allP.length ? 'All sorted \u00b7 nothing blocking' :
                  'Pipeline empty \u00b7 create now',
    allP.length ? '#555' : '#444',
    'all'
  );
}

function filterFromNarrative() {
  var el = document.getElementById('pipeline-narrative');
  if (!el) return;
  var stage = el.dataset.filterStage || 'all';
  var chip = document.querySelector(
    '.stage-chip[data-stage="' + stage + '"]');
  if (chip) chip.click();
}
window.filterFromNarrative = filterFromNarrative;

function updateDashboardHeader() {
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var runway = 0, active = 0;
  posts.forEach(function(p) {
    var s = (p.stage || '').toLowerCase();
    if (s === 'scheduled') runway++;
    if (['published','parked','rejected','scheduled'].indexOf(s) === -1) active++;
  });
  var el;
  el = document.getElementById('dh-runway'); if (el) el.textContent = runway;
  el = document.getElementById('dh-active'); if (el) el.textContent = active;
}

function _renderPipelineInner() {
  // Consume pressure-click filter (set by dashboard click handler)
  const activeFilter = window.pcsPipelineFilter;
  window.pcsPipelineFilter = null;

  // Pipeline only renders PIPELINE_RENDER_ORDER stages (excludes parked, rejected, published)
  var _clientStages = ['awaiting_approval', 'awaiting_brand_input',
    'scheduled', 'published', 'brief'];
  var _isClient = (effectiveRole || '').toLowerCase() === 'client';
  const base = allPosts.filter(p => {
    if (_isClient && !_clientStages.includes(p.stage || '')) return false;
    return PIPELINE_RENDER_ORDER.includes(p.stage || '');
  });
  var stageFiltered = activeFilter && Array.isArray(activeFilter)
    ? base.filter(p => activeFilter.includes(p.stage || ''))
    : base;

  // -- Pipeline filter sheet --
  stageFiltered = _applyPFFilter(stageFiltered);

  // -- Person filter --
  var source = stageFiltered;
  if (_activePerson === 'client') {
    source = stageFiltered.filter(function(p) { return p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input'; });
  } else if (_activePerson === 'chitra') {
    source = stageFiltered.filter(function(p) { return p.stage === 'ready' || p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input'; });
  } else if (_activePerson === 'pranav') {
    source = stageFiltered.filter(function(p) { return p.stage === 'in_production'; });
  }

  // -- PRIORITY SORT: overdue first, then soonest date --
  function prioritySort(posts) {
    var now = new Date().setHours(0,0,0,0);
    return posts.slice().sort(function(a, b) {
      var da = new Date(a.targetDate || a.target_date).setHours(0,0,0,0);
      var db = new Date(b.targetDate || b.target_date).setHours(0,0,0,0);
      var aOver = da < now; var bOver = db < now;
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      return da - db;
    });
  }

  // -- ROLE-SPECIFIC EMPTY STATES --
  const emptyMsg = {};
  if (activeFilter) {
    const key = activeFilter.sort().join(',');
    if (key.includes('in_production')) emptyMsg.default = 'Nothing in production -- create new posts';
    else if (key.includes('ready')) emptyMsg.default = 'Nothing ready -- wait or push production';
    else if (key.includes('awaiting_approval')) emptyMsg.default = 'Nothing pending -- you are clear';
  }

  const grouped = {};
  source.forEach(p => { const s = p.stage || 'Unknown'; if (!grouped[s]) grouped[s] = []; grouped[s].push(p); });
  const stages = Object.keys(grouped).sort((a,b) => {
    const ia = PIPELINE_RENDER_ORDER.indexOf(a), ib = PIPELINE_RENDER_ORDER.indexOf(b);
    if (ia===-1 && ib===-1) return a.localeCompare(b);
    if (ia===-1) return 1; if (ib===-1) return -1;
    return ia - ib;
  });

  let isFirstCard = true;
  const html = stages.map(stage => {
    var posts;
    if (stage === 'in_production') {
      posts = (grouped[stage] || []).slice().sort(function(a, b) {
        var aIsBrief = (a.stage || '') === 'brief';
        var bIsBrief = (b.stage || '') === 'brief';
        var aHasFeedback = !aIsBrief &&
          a.client_feedback && a.client_feedback.trim().length > 0;
        var bHasFeedback = !bIsBrief &&
          b.client_feedback && b.client_feedback.trim().length > 0;
        var aPriority = aIsBrief ? 0 : aHasFeedback ? 1 : 2;
        var bPriority = bIsBrief ? 0 : bHasFeedback ? 1 : 2;
        if (aPriority !== bPriority) return aPriority - bPriority;
        var aTime = new Date((a.status_changed_at||'')+'Z').getTime();
        var bTime = new Date((b.status_changed_at||'')+'Z').getTime();
        return aTime - bTime;
      });
    } else {
      posts = prioritySort(grouped[stage]);
    }
    const listKey = `pipeline-${stage.toLowerCase().replace(/\s+/g,'-')}`;
    _postLists[listKey] = posts;
    const { label } = stageStyle(stage);
    const sk = _pipelineStageKey(stage);
    const cards = posts.map((p, i) => {
      const card = buildPipelineCard(p, listKey);
      if (isFirstCard && activeFilter) {
        isFirstCard = false;
        return card.replace('data-post-id=', 'data-focus="1" data-post-id=');
      }
      return card;
    }).join('');
    var selectBtn = (stage === 'ready')
      ? '<button class="batch-select-btn" id="batch-select-btn" onclick="event.stopPropagation();toggleBatchMode()">Select</button>'
      : '';
    // Chase All button for awaiting_approval group
    var _isClientCA = (effectiveRole || '').toLowerCase() === 'client';
    var chaseAllBtn = '';
    if (!_isClientCA && stage === 'awaiting_approval') {
      var nowCA = new Date();
      var threeDaysAgoCA = new Date();
      threeDaysAgoCA.setDate(threeDaysAgoCA.getDate() - 3);
      var overdueCount = posts.filter(function(p) {
        if (!p.status_changed_at) return true;
        return new Date((p.status_changed_at || '') + 'Z') < threeDaysAgoCA;
      }).length;
      if (overdueCount >= 1) {
        chaseAllBtn = '<button class="chase-all-btn" onclick="chaseAll()" id="chase-all-btn">Chase All</button>';
      }
    }
    // Per-stage summary line
    var _isClientSum = (effectiveRole || '').toLowerCase() === 'client';
    var summaryText = '';
    var now5 = new Date();
    var stageKey = stage;
    var stagePosts = posts;
    if (_isClientSum) {
      // Client sees no summary lines
    } else if (stageKey === 'awaiting_approval') {
      var clientCount = stagePosts.filter(function(p) { return (p.owner||'').toLowerCase() === 'client'; }).length;
      var sortedByUpdate = stagePosts.slice().sort(function(a,b) { return new Date(a.updated_at||a.updatedAt) - new Date(b.updated_at||b.updatedAt); });
      var oldestPost = sortedByUpdate[0];
      var oldDays = oldestPost ? Math.floor((now5 - new Date(oldestPost.updated_at||oldestPost.updatedAt)) / 86400000) : 0;
      summaryText = stagePosts.length + ' posts waiting \u00b7 oldest ' + oldDays + 'd \u00b7 ' + clientCount + ' from client';
    } else if (stageKey === 'awaiting_brand_input') {
      summaryText = stagePosts.length + ' blocked on brief \u00b7 needs unblocking';
    } else if (stageKey === 'scheduled') {
      var schedSorted = stagePosts.slice().sort(function(a,b) { return new Date(a.targetDate||a.target_date) - new Date(b.targetDate||b.target_date); });
      var nextSched = schedSorted[0];
      var daysToNext = nextSched ? Math.ceil((new Date(nextSched.targetDate||nextSched.target_date) - now5) / 86400000) : 0;
      summaryText = 'Next goes live ' + (daysToNext <= 1 ? 'tomorrow' : 'in ' + daysToNext + 'd') + ' \u00b7 pipeline sorted ' + stagePosts.length + ' days';
    } else if (stageKey === 'in_production') {
      summaryText = stagePosts.length + ' posts in progress \u00b7 keep sorting';
    } else if (stageKey === 'ready') {
      summaryText = stagePosts.length + ' ready to schedule \u00b7 sort now';
    }
    var summaryHtml = summaryText ? '<div style="padding:5px 18px 5px 21px;font-family:var(--mono);font-size:7px;color:#333;letter-spacing:0.04em;border-bottom:1px solid var(--dotline);background:rgba(255,255,255,0.01);">' + summaryText + '</div>' : '';

    return `
      <div class="group-section" id="group-section-${esc(stage)}" data-stage="${esc(stage)}">
      <div class="group-hdr" onclick="togglePipelineGroup('${esc(stage)}')">
        <div class="group-hdr-left">
          <span class="group-chevron">&#9660;</span>
          <div class="group-label ${esc(sk)}" data-stage="${esc(sk)}">${esc(label)}</div>
        </div>
        <div class="group-hdr-right" style="display:flex;align-items:center;gap:8px">
          ${selectBtn}
          <div class="group-count">${posts.length}</div>
        </div>
      </div>
      ${summaryHtml}
      <div class="group-post-list">
        <div class="row-list post-list">
          ${cards || '<div class="pstage-empty">' + (emptyMsg.default || 'Empty') + '</div>'}
        </div>
      </div>
      </div>`;
  }).join('');

  // -- Published collapsed group --
  var pubPosts = allPosts.filter(function(p) { return (p.stage || '') === 'published'; });
  var pubCount = pubPosts.length;
  var pubCardsHtml = '';
  if (pubCount > 0) {
    var pubListKey = 'pipeline-published';
    var pubSorted = pubPosts.slice().sort(function(a, b) {
      var dA = parseDate(a.targetDate), dB = parseDate(b.targetDate);
      if (dA && dB) return dB - dA;
      if (dA) return -1; if (dB) return 1;
      return 0;
    });
    _postLists[pubListKey] = pubSorted;
    pubCardsHtml = pubSorted.map(function(p) { return buildPipelineCard(p, pubListKey); }).join('');
  }
  var pubGroupHtml = '<div class="group-section pipeline-pub-group" id="pipeline-pub-group">' +
    '<div class="pipeline-pub-toggle" onclick="togglePipelinePub()">' +
      '<span class="pipeline-pub-arrow">&#9660;</span>' +
      '<span style="font-family:var(--mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--c-green)">PUBLISHED</span>' +
      '<span style="margin-left:auto"></span>' +
      '<span class="group-count">' + pubCount + '</span>' +
    '</div>' +
    '<div class="pipeline-pub-cards"><div class="row-list post-list">' +
      (pubCardsHtml || '<div class="pstage-empty">No published posts</div>') +
    '</div></div>' +
  '</div>';

  const container = document.getElementById('pipeline-container');
  if (!container) return;
  container.innerHTML = html + pubGroupHtml;

  // -- Restore published expanded state --
  if (window._pipelinePubExpanded) {
    var pubGroup = document.getElementById('pipeline-pub-group');
    if (pubGroup) pubGroup.classList.add('pipeline-pub-expanded');
  }

  // -- Restore collapsed state across re-renders --
  Object.keys(_collapsedGroups).forEach(function(stage) {
    if (_collapsedGroups[stage]) {
      var section = document.getElementById('group-section-' + stage);
      if (section) section.classList.add('collapsed');
    }
  });

  // -- Update chip counts from rendered group headers --
  updatePipelineChipCounts();
  updatePersonStripCounts();

  // -- GLOBAL EMPTY STATE (filtered view with no results) --
  if (activeFilter && stages.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">\u2713</div><p>' + (emptyMsg.default || 'Nothing here -- you are clear') + '</p></div>';
    return;
  }

  // -- AUTO-SCROLL to first focused card --
  if (activeFilter) {
    requestAnimationFrame(function() {
      var focus = container.querySelector('.pc-focus');
      if (focus) {
        focus.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}


function _toTitleCase(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function populateFilterDropdowns() {
  // Fixed order for library stage dropdown
  const LIBRARY_STAGE_ORDER = ['scheduled','published','parked','rejected'];
  const owners  = ['Pranav','Chitra','Client'];
  const pillars = [...new Set(allPosts.map(p=>p.contentPillar||'').filter(Boolean))].sort();

  const stageEl  = document.getElementById('filter-stage');
  const ownerEl  = document.getElementById('filter-owner');
  const pillarEl = document.getElementById('filter-pillar');
  if (!stageEl || !ownerEl) return;

  const curStage  = stageEl.value;
  const curOwner  = ownerEl.value;
  const curPillar = pillarEl?.value || '';

  stageEl.innerHTML  = `<option value="">Stage</option>`  + LIBRARY_STAGE_ORDER.map(s=>`<option value="${esc(s)}">${esc(_toTitleCase(s))}</option>`).join('');
  ownerEl.innerHTML  = `<option value="">Owner</option>`  + owners.map(o=>`<option value="${esc(o)}">${esc(formatOwner(o))}</option>`).join('');
  if (pillarEl) pillarEl.innerHTML = `<option value="">Pillar</option>` + pillars.map(p=>`<option value="${esc(p)}">${esc(formatPillarDisplay(p))}</option>`).join('');

  stageEl.value  = curStage;
  ownerEl.value  = curOwner;
  if (pillarEl) pillarEl.value = curPillar;
}

function filterLibrary() {
  const query  = (document.getElementById('search-input')?.value||'').toLowerCase();
  const stage  = (document.getElementById('filter-stage')?.value||'');
  const owner  = (document.getElementById('filter-owner')?.value||'');
  const pillar = (document.getElementById('filter-pillar')?.value||'').toLowerCase();
  const date   = (document.getElementById('filter-date')?.value||'');

  // Highlight active chips
  ['filter-owner','filter-pillar','filter-stage','filter-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('chip-active', el.value !== '');
  });

  const today  = new Date(); today.setHours(0,0,0,0);
  const week7  = new Date(today); week7.setDate(week7.getDate()+7);

  // Library archive stages (dropdown shows all 4; default view shows only 2)
  const _LIB_STAGES_ALL     = ['published','scheduled','parked','rejected'];
  const _LIB_STAGES_DEFAULT = ['scheduled','published'];
  // When user picks a specific stage, show that; otherwise default to scheduled+published
  const _allowedStages = stage ? _LIB_STAGES_ALL : _LIB_STAGES_DEFAULT;

  const filtered = allPosts.filter(p => {
    var _isClient = (effectiveRole || '').toLowerCase() === 'client';
    if (!_allowedStages.includes(p.stage || '')) return false;
    if (query  && !getTitle(p).toLowerCase().includes(query)) return false;
    if (stage  && (p.stage || '') !== stage) return false;
    if (owner  && (p.owner || '') !== owner) return false;
    if (pillar && (p.contentPillar||'').toLowerCase() !== pillar) return false;
    if (date) {
      const d = parseDate(p.targetDate);
      if (date === 'none')   return !d;
      if (!d) return false;
      if (date === 'past')   return d < today;
      if (date === 'today')  return d.getTime() === today.getTime();
      if (date === 'week')   return d >= today && d <= week7;
      if (date === 'future') return d > week7;
    }
    return true;
  });

  if (_currentLibraryView === 'list')          renderLibraryRows(filtered);
  else if (_currentLibraryView === 'calendar') renderLibraryCalendar(filtered);
}

function renderLibrary() {
  try {
    populateFilterDropdowns();
    filterLibrary();
  } catch(e) { console.error('[PCS] renderLibrary crash:', e); }
}

function _libStageDotColor(stage) {
  var s = stage || '';
  if (s === 'in_production')        return 'var(--amber)';
  if (s === 'ready')                return 'var(--green)';
  if (s === 'awaiting_approval')    return 'var(--red)';
  if (s === 'awaiting_brand_input') return 'var(--purple)';
  if (s === 'scheduled')            return 'var(--cyan)';
  if (s === 'published')            return 'var(--muted)';
  if (s === 'parked')               return 'var(--muted2)';
  if (s === 'rejected')             return 'var(--red)';
  return 'var(--muted)';
}

function _buildLibCard(p) {
  var id    = getPostId(p);
  var title = getTitle(p);
  var pillar = getPillarShort(p.contentPillar);
  var owner  = formatOwner(p.owner || '');
  var stage  = p.stage || '';

  var d = parseDate(p.targetDate);
  var dateStr = formatDateShort(p.targetDate);
  var today = new Date(); today.setHours(0,0,0,0);
  var isToday = d && d.toDateString() === today.toDateString();
  var isOverdue = d && !isToday && d < today && !['published','parked','rejected'].includes(stage);

  var cardCls = 'lib-card';
  if (isOverdue) cardCls += ' overdue';
  if (isToday) cardCls += ' today';

  var dateCls = 'lib-date';
  if (isOverdue) dateCls += ' overdue';
  else if (isToday) dateCls += ' today';

  var dateDisplay = dateStr || '-- --';

  var metaParts = [];
  if (pillar) metaParts.push(esc(pillar));
  if (owner && owner !== ' - ') metaParts.push(esc(owner));
  var metaHtml = metaParts.join('<span class="lib-meta-dot"></span>');

  var dotColor = _libStageDotColor(stage);

  return '<div class="' + cardCls + '" data-post-id="' + esc(id) + '" data-list="library">' +
    '<span class="' + dateCls + '">' + esc(dateDisplay) + '</span>' +
    '<div class="lib-body">' +
      '<div class="lib-title">' + esc(title) + '</div>' +
      (metaHtml ? '<div class="lib-meta">' + metaHtml + '</div>' : '') +
    '</div>' +
    '<span class="lib-stage-dot" style="background:' + dotColor + '"></span>' +
  '</div>';
}

function renderLibraryRows(posts) {
  var listView = document.getElementById('library-list-view');
  if (!listView) return;
  posts = posts.slice().sort(function(a, b) { return (parseDate(a.targetDate) || new Date(9999,0)) - (parseDate(b.targetDate) || new Date(9999,0)); });
  _postLists['library'] = posts;
  if (!posts.length) {
    listView.innerHTML = '<div class="empty-state"><div class="empty-icon">[search]</div><p>No posts match your search.</p></div>';
    return;
  }

  var today = new Date(); today.setHours(0,0,0,0);
  var day7 = new Date(today); day7.setDate(day7.getDate() + 7);
  var day14 = new Date(today); day14.setDate(day14.getDate() + 14);
  var thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0); thisMonthEnd.setHours(23,59,59,999);
  var nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0); nextMonthEnd.setHours(23,59,59,999);

  var _noOverdueStages = ['published','parked','rejected'];
  var groups = { overdue: [], thisWeek: [], nextWeek: [], laterMonth: [], nextMonth: [], later: [], noDate: [] };
  posts.forEach(function(p) {
    var d = parseDate(p.targetDate);
    if (!d) { groups.noDate.push(p); return; }
    if (d < today && !_noOverdueStages.includes(p.stage || '')) { groups.overdue.push(p); return; }
    if (d < today) { groups.thisWeek.push(p); return; }
    if (d < day7) { groups.thisWeek.push(p); return; }
    if (d < day14) { groups.nextWeek.push(p); return; }
    if (d <= thisMonthEnd) { groups.laterMonth.push(p); return; }
    if (d <= nextMonthEnd) { groups.nextMonth.push(p); return; }
    groups.later.push(p);
  });

  var order = [
    { key: 'overdue', label: 'Overdue', dot: 'var(--red)', countCls: ' style="color:var(--red)"' },
    { key: 'thisWeek', label: 'This Week', dot: '', countCls: '' },
    { key: 'nextWeek', label: 'Next Week', dot: '', countCls: '' },
    { key: 'laterMonth', label: 'Later This Month', dot: '', countCls: '' },
    { key: 'nextMonth', label: 'Next Month', dot: '', countCls: '' },
    { key: 'later', label: 'Later', dot: '', countCls: '' },
    { key: 'noDate', label: 'No Date', dot: '', countCls: '' }
  ];

  var html = '';
  order.forEach(function(g) {
    var arr = groups[g.key];
    if (!arr.length) return;
    var dotHtml = g.dot ? '<span class="time-label-dot" style="background:' + g.dot + '"></span>' : '';
    html += '<div class="time-label"><span class="time-label-text">' + dotHtml + g.label + '</span><span class="time-label-count"' + g.countCls + '>' + arr.length + '</span></div>';
    html += arr.map(function(p) { return _buildLibCard(p); }).join('');
  });
  listView.innerHTML = html;
}

function renderClientView() {
  try { _renderClientViewInner(); } catch(e) { console.error('[PCS] renderClientView crash:', e); }
}
function _renderClientViewInner() {
  var fab = document.getElementById('fab') ||
    document.querySelector('.fab');
  if (fab) fab.style.display = 'none';

  var h = new Date().getHours();
  var timeOfDay = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  var greetName = window.currentUserName ||
    (window.currentUser && window.currentUser.name) ||
    (window.currentUserEmail || '').split('@')[0];
  var clientName = greetName.charAt(0).toUpperCase() + greetName.slice(1);

  // CHANGE 2 - Header
  var headerEl = document.getElementById('client-header');
  if (headerEl) {
    headerEl.innerHTML =
      '<div style="display:flex;align-items:center;' +
      'justify-content:space-between;padding:13px 18px;' +
      'border-bottom:1px solid rgba(255,255,255,0.07);">' +
      '<div style="font-family:var(--mono);font-size:13px;' +
      'color:var(--c-gold);letter-spacing:0.08em;">srtd.io</div>' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
      '<button style="font-family:var(--mono);font-size:8px;' +
      'letter-spacing:0.12em;text-transform:uppercase;' +
      'color:var(--c-gold);background:transparent;' +
      'border:1px solid rgba(200,168,75,0.3);padding:6px 10px;' +
      'cursor:pointer;" onclick="(function(){var o=document.getElementById(\'req-overlay\');if(o){o.style.display=\'flex\';var nav=document.getElementById(\'bottom-nav\');if(nav)nav.style.display=\'none\';}})()">+ New Request</button>' +
      '<button onclick="logout()" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.12em;text-transform:uppercase;color:#555;' +
      'background:transparent;border:1px solid rgba(255,255,255,0.07);' +
      'padding:6px 10px;cursor:pointer;">Sign Out</button>' +
      '</div></div>';
  }

  // CHANGE 3 - Greeting
  var now = new Date();
  var timeStr = now.toLocaleDateString('en-IN', {
    weekday:'short', day:'numeric', month:'short', timeZone:'Asia/Kolkata'
  }) + ' \xB7 ' + now.toLocaleTimeString('en-IN', {
    hour:'numeric', minute:'2-digit', hour12:true, timeZone:'Asia/Kolkata'
  });

  var greetEl = document.getElementById('client-greeting');
  if (greetEl) {
    greetEl.innerHTML =
      '<div style="padding:14px 16px 13px;' +
      'border-bottom:1px solid rgba(255,255,255,0.06);' +
      'display:flex;align-items:baseline;' +
      'justify-content:space-between;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:10px;letter-spacing:0.04em;' +
      'color:rgba(255,255,255,0.55);">Good ' + esc(timeOfDay) + ', ' +
      '<span style="color:#C8A84B;font-weight:500;">' +
      esc(clientName) + '</span></div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:9px;letter-spacing:0.04em;' +
      'color:rgba(255,255,255,0.35);">' + esc(timeStr) + '</div>' +
      '</div>';
  }

  // Input needed section
  var inputPosts = allPosts.filter(function(p) { return p.stage === 'awaiting_brand_input'; });

  // CHANGE 4 - Input eyebrow
  var inputEyebrow = document.getElementById('client-input-eyebrow');
  if (inputEyebrow) {
    inputEyebrow.innerHTML =
      '<div style="background:#0a0a10;' +
      'border-top:1px solid rgba(255,255,255,0.05);' +
      'border-bottom:1px solid rgba(255,255,255,0.05);' +
      'padding:10px 16px;display:flex;align-items:center;' +
      'justify-content:space-between;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span style="color:#F6A623;font-size:13px;">&#x25C8;</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.22em;text-transform:uppercase;' +
      'font-weight:500;color:rgba(255,255,255,0.55);">' +
      'Awaiting Input</span>' +
      '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.1em;' +
      'color:rgba(255,255,255,0.4);' +
      'border:1px dashed rgba(255,255,255,0.12);' +
      'padding:2px 8px;">' + inputPosts.length + '</div>' +
      '</div>';
  }

  // CHANGE 7 - Input request cards
  var inputItems = document.getElementById('client-input-items');
  if (inputItems) {
    if (!inputPosts.length) {
      inputItems.innerHTML = '<div style="padding:10px 16px;' +
        'border-bottom:1px solid rgba(255,255,255,0.04);' +
        'display:flex;align-items:center;gap:8px;">' +
        '<div style="width:5px;height:5px;border-radius:50%;' +
        'background:rgba(62,207,142,0.4);flex-shrink:0;"></div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:8px;letter-spacing:0.12em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.35);">' +
        'All clear -- nothing needs your input</div>' +
        '</div>';
    } else {
      inputItems.innerHTML = inputPosts.map(function(p) {
        var id   = getPostId(p);
        var days = daysInStage(p);
        var staleLabel = days >= 1 ? days + 'd' : 'New';
        var _pillar = (p.content_pillar || p.contentPillar || '--').toUpperCase();
        var _loc = (p.location || '--').toUpperCase();

        var sentLine = (function() {
          if (!p.status_changed_at) return 'Submitted recently';
          var d = new Date((p.status_changed_at || '') + 'Z');
          var date = d.toLocaleDateString('en-IN', { day:'numeric', month:'short', timeZone:'Asia/Kolkata' });
          return 'Changes requested \xB7 ' + date;
        })();

        return '<div style="background:#0d0d16;' +
          'border-bottom:1px solid rgba(255,255,255,0.04);' +
          'position:relative;overflow:hidden;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);">' +

          // Amber top bar
          '<div style="height:3px;' +
          'background:linear-gradient(to right,#F6A623,rgba(246,166,35,0));"></div>' +

          // Header row: title + status
          '<div style="display:flex;align-items:flex-start;' +
          'justify-content:space-between;padding:16px 16px;' +
          'border-bottom:1px dashed rgba(255,255,255,0.07);">' +
          '<div style="flex:3;min-width:0;">' +
          '<div style="font-family:\'DM Sans\',sans-serif;font-size:18px;' +
          'font-weight:600;color:#e8e2d9;line-height:1.2;' +
          'word-wrap:break-word;overflow-wrap:break-word;">' +
          esc(getTitle(p)) + '</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;' +
          'font-size:10px;letter-spacing:0.04em;' +
          'color:rgba(255,255,255,0.55);margin-top:6px;">' +
          esc(sentLine) + '</div>' +
          '</div>' +
          '<div style="flex-shrink:0;display:flex;flex-direction:column;' +
          'align-items:flex-end;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
          'letter-spacing:0.08em;text-transform:uppercase;' +
          'color:rgba(255,255,255,0.45);margin-bottom:4px;">Status</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;' +
          'font-weight:500;color:#F6A623;">' + esc(staleLabel) + '</div>' +
          '</div>' +
          '</div>' +

          // Info grid: Pillar | Location | Target
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;' +
          'border-bottom:1px dashed rgba(255,255,255,0.08);">' +

          '<div style="padding:9px 16px;border-right:1px dashed rgba(255,255,255,0.08);">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
          'letter-spacing:0.08em;text-transform:uppercase;' +
          'color:rgba(255,255,255,0.55);margin-bottom:3px;">Pillar</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
          'letter-spacing:0.04em;color:#e8e2d9;white-space:nowrap;' +
          'overflow:hidden;text-overflow:ellipsis;">' +
          esc(_pillar) + '</div>' +
          '</div>' +

          '<div style="padding:9px 16px;border-right:1px dashed rgba(255,255,255,0.08);">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
          'letter-spacing:0.08em;text-transform:uppercase;' +
          'color:rgba(255,255,255,0.55);margin-bottom:3px;">Location</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
          'letter-spacing:0.04em;color:#e8e2d9;white-space:nowrap;' +
          'overflow:hidden;text-overflow:ellipsis;">' +
          esc(_loc) + '</div>' +
          '</div>' +

          '<div style="padding:9px 16px;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
          'letter-spacing:0.08em;text-transform:uppercase;' +
          'color:rgba(255,255,255,0.55);margin-bottom:3px;">Target</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
          'letter-spacing:0.04em;color:#e8e2d9;white-space:nowrap;' +
          'overflow:hidden;text-overflow:ellipsis;">' +
          (p.target_date ? new Date(p.target_date + 'T00:00:00')
            .toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'}) : '--') +
          '</div>' +
          '</div>' +

          '</div>' +

          // Brief section
          '<div style="padding:12px 16px;' +
          'border-bottom:1px dashed rgba(255,255,255,0.07);">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
          'letter-spacing:0.18em;text-transform:uppercase;color:#F6A623;' +
          'margin-bottom:6px;">What we need</div>' +
          '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;' +
          'color:rgba(255,255,255,0.55);line-height:1.55;">' +
          esc(p.comments || 'No brief added yet.') + '</div>' +
          '</div>' +

          // Action row
          '<div style="display:flex;' +
          'border-bottom:1px solid rgba(255,255,255,0.04);">' +
          '<label style="flex:1;font-family:\'IBM Plex Mono\',monospace;' +
          'font-size:8px;letter-spacing:0.14em;text-transform:uppercase;' +
          'color:#F6A623;background:rgba(246,166,35,0.04);' +
          'border:none;border-right:1px dashed rgba(255,255,255,0.08);' +
          'padding:13px 0;cursor:pointer;' +
          'text-align:center;" id="upload-label-' + esc(id) + '">Upload Here<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple style="display:none" onchange="handleClientUpload(this, \'' + esc(id) + '\')"></label>' +
          (function() {
            var inputMsg = 'Hi, we need something from you for the post: ' +
              (p.title || '') + '.\n\n' +
              (p.comments || '') + '\n\nPlease upload or send it here.';
            var inputWaUrl = 'https://wa.me/?text=' + encodeURIComponent(inputMsg);
            return '<a href="' + inputWaUrl + '" target="_blank" ' +
              'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
              'letter-spacing:0.14em;text-transform:uppercase;' +
              'color:rgba(255,255,255,0.55);' +
              'background:transparent;border:none;' +
              'padding:13px 0;cursor:pointer;text-align:center;' +
              'text-decoration:none;display:block;">Send on WhatsApp</a>';
          })() +
          '</div>' +
          '<div id="upload-confirm-' + esc(id) + '"></div>' +
          '</div>';
      }).join('');
    }
  }

  // Approval section
  var approvalPosts = allPosts.filter(function(p) {
    return p.stage === 'awaiting_approval';
  }).sort(function(a, b) {
    var aTime = a.status_changed_at ? new Date((a.status_changed_at || '') + 'Z').getTime() : 0;
    var bTime = b.status_changed_at ? new Date((b.status_changed_at || '') + 'Z').getTime() : 0;
    return aTime - bTime;
  });

  // CHANGE 4 - Approval eyebrow
  var approvalEyebrow = document.getElementById('client-approval-eyebrow');
  if (approvalEyebrow) {

    if (approvalPosts.length === 0) {
      approvalEyebrow.innerHTML =
        '<div style="background:#0a0a10;' +
        'border-top:2px solid rgba(62,207,142,0.1);' +
        'border-bottom:1px solid rgba(255,255,255,0.05);' +
        'padding:10px 16px;display:flex;align-items:center;' +
        'justify-content:space-between;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span style="color:#3ECF8E;font-size:13px;">&#x25C8;</span>' +
        '<span style="font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:8px;letter-spacing:0.22em;text-transform:uppercase;' +
        'font-weight:500;color:rgba(255,255,255,0.55);">' +
        'Awaiting Your Approval</span>' +
        '</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:8px;letter-spacing:0.1em;' +
        'color:rgba(62,207,142,0.7);' +
        'border:1px dashed rgba(62,207,142,0.2);' +
        'padding:2px 8px;">0</div>' +
        '</div>' +
        '<div style="padding:32px 16px;text-align:center;' +
        'border-bottom:1px solid rgba(255,255,255,0.04);">' +
        '<div style="font-size:20px;color:#3ECF8E;margin-bottom:12px;">&#x25C8;</div>' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-size:18px;' +
        'font-weight:600;color:#e8e2d9;margin-bottom:6px;">All approved.</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
        'letter-spacing:0.06em;color:rgba(255,255,255,0.45);">' +
        'Nothing awaiting your approval.</div>' +
        '</div>';
    } else {

    // compute stats
    var now2 = Date.now();
    var waitTimes = approvalPosts.map(function(p) {
      return p.status_changed_at
        ? Math.floor((now2 - new Date((p.status_changed_at || '') + 'Z').getTime()) / 86400000)
        : 0;
    });
    var oldest = waitTimes.length ? Math.max.apply(null, waitTimes) : 0;
    var overdue = waitTimes.filter(function(d){ return d >= 5; }).length;

    // count color
    var countColor = '#e8e2d9';
    if (approvalPosts.length >= 13) countColor = '#FF4B4B';
    else if (approvalPosts.length >= 8) countColor = '#FF8C00';
    else if (approvalPosts.length >= 4) countColor = '#F6A623';

    approvalEyebrow.innerHTML =

      // Zone header
      '<div style="background:#0a0a10;' +
      'border-top:2px solid rgba(62,207,142,0.1);' +
      'border-bottom:1px solid rgba(255,255,255,0.05);' +
      'padding:10px 16px;display:flex;align-items:center;' +
      'justify-content:space-between;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span style="color:#3ECF8E;font-size:13px;">&#x25C8;</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.22em;text-transform:uppercase;' +
      'font-weight:500;color:rgba(255,255,255,0.55);">' +
      'Awaiting Your Approval</span>' +
      '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.1em;' +
      'color:rgba(62,207,142,0.7);' +
      'border:1px dashed rgba(62,207,142,0.2);' +
      'padding:2px 8px;">' + approvalPosts.length + '</div>' +
      '</div>' +

      // Departure board
      '<div style="background:#08080e;' +
      'border-bottom:1px solid rgba(255,255,255,0.05);' +
      'position:relative;overflow:hidden;">' +

      // Scanlines overlay
      '<div style="position:absolute;inset:0;' +
      'background:repeating-linear-gradient(0deg,transparent,' +
      'transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px);' +
      'pointer-events:none;z-index:1;"></div>' +

      '<div style="padding:16px 16px 0;position:relative;z-index:2;">' +

      // Big count
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:64px;' +
      'font-weight:600;line-height:1;letter-spacing:-0.03em;' +
      'color:' + countColor + ';margin-bottom:6px;">' +
      approvalPosts.length + '</div>' +

      // Subtitle
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:11px;letter-spacing:0.04em;' +
      'color:rgba(255,255,255,0.55);margin-bottom:16px;' +
      'line-height:1.4;">posts are waiting for your OK</div>' +

      '</div>' +

      // Stats grid
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;' +
      'border-top:1px solid rgba(255,255,255,0.06);' +
      'position:relative;z-index:2;">' +

      '<div style="padding:10px 16px;' +
      'border-right:1px solid rgba(255,255,255,0.06);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:4px;">Total</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;' +
      'font-weight:500;letter-spacing:0.04em;color:#e8e2d9;">' +
      approvalPosts.length + '</div>' +
      '</div>' +

      '<div style="padding:10px 16px;' +
      'border-right:1px solid rgba(255,255,255,0.06);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:4px;">Oldest</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;' +
      'font-weight:500;letter-spacing:0.04em;color:#F6A623;">' +
      oldest + ' days</div>' +
      '</div>' +

      '<div style="padding:10px 16px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:4px;">Overdue</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;' +
      'font-weight:500;letter-spacing:0.04em;color:#FF4B4B;">' +
      overdue + '</div>' +
      '</div>' +

      '</div>' + // end stats grid
      '</div>'; // end departure board
    } // end else (has approval posts)
  }

  // CHANGE 5 - Approval post cards
  var approvalItems = document.getElementById('client-approval-items');
  if (approvalItems) {
    if (!approvalPosts.length) {
      approvalItems.innerHTML = '<div style="padding:10px 16px;' +
        'border-bottom:1px solid rgba(255,255,255,0.04);' +
        'display:flex;align-items:center;gap:8px;">' +
        '<div style="width:5px;height:5px;border-radius:50%;' +
        'background:rgba(62,207,142,0.4);flex-shrink:0;"></div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:8px;letter-spacing:0.12em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.35);">' +
        'Nothing to approve</div>' +
        '</div>';
    } else {
      var now = Date.now();
      approvalItems.innerHTML = approvalPosts.map(function(p) {
        var daysWaiting = p.status_changed_at
          ? Math.floor((Date.now() - new Date((p.status_changed_at || '') + 'Z').getTime()) / 86400000)
          : 0;

        var barColor, waitColor, waitLabel;
        if (daysWaiting >= 5) {
          barColor = '#FF4B4B';
          waitColor = '#FF4B4B';
          waitLabel = daysWaiting + 'D';
        } else if (daysWaiting >= 2) {
          barColor = '#F6A623';
          waitColor = '#F6A623';
          waitLabel = daysWaiting + 'D';
        } else if (daysWaiting === 1) {
          barColor = '#F6A623';
          waitColor = '#F6A623';
          waitLabel = 'Yesterday';
        } else {
          barColor = '#3ECF8E';
          waitColor = '#3ECF8E';
          waitLabel = 'New';
        }

        var id = getPostId(p);
        var imgs = Array.isArray(p.images) ? p.images : [];
        var hero = imgs[0] || '';
        var _rawSlug = (p.title || '').toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 50);
        var approvalUrl = 'https://srtd.io/ok/?p=' + _rawSlug;
        var waText = encodeURIComponent(
          (p.title || '') + '\n\n' +
          (p.caption || '') + '\n\n' +
          'Approve: ' + approvalUrl + '\n' +
          'Request changes: https://srtd.io/no/?p=' + _rawSlug
        );
        var waLink = 'https://wa.me/?text=' + waText;

        var seatLabel, seatNum, seatColor, seatBorder;
        if (daysWaiting === 0) {
          seatLabel = '';
          seatNum = 'New';
          seatColor = '#3ECF8E';
          seatBorder = 'rgba(62,207,142,0.45)';
        } else if (daysWaiting >= 5) {
          seatLabel = 'WAITING';
          seatNum = daysWaiting + 'D';
          seatColor = '#FF4B4B';
          seatBorder = 'rgba(255,75,75,0.45)';
        } else {
          seatLabel = 'WAITING';
          seatNum = daysWaiting + 'D';
          seatColor = '#F6A623';
          seatBorder = 'rgba(246,166,35,0.45)';
        }

        var urgencyGrad = daysWaiting >= 5
          ? 'linear-gradient(to right,#FF4B4B,rgba(255,75,75,0))'
          : (daysWaiting >= 2
              ? 'linear-gradient(to right,#F6A623,rgba(246,166,35,0))'
              : 'linear-gradient(to right,#3ECF8E,rgba(62,207,142,0))');

        return (
        '<div id="apv-item-' + esc(id) + '" ' +
        'style="background:#0d0d14;position:relative;overflow:hidden;' +
        'border-bottom:1px solid rgba(255,255,255,0.05);">' +

        '<div style="height:3px;background:' + urgencyGrad + ';"></div>' +

        '<div style="display:flex;align-items:flex-start;justify-content:space-between;' +
        'padding:14px 16px 12px;gap:12px;">' +

        '<div style="min-width:0;">' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-size:22px;' +
        'font-weight:700;color:#e8e2d9;line-height:1.1;' +
        'letter-spacing:-0.01em;margin-bottom:5px;' +
        'word-wrap:break-word;overflow-wrap:break-word;min-width:0;">' +
        esc(p.title || '') + '</div>' +
        '<div style="font-size:10px;letter-spacing:0.04em;' +
        'color:rgba(255,255,255,0.5);line-height:1;">' +
        (function() {
          if (!p.status_changed_at) return '';
          var d = new Date((p.status_changed_at || '') + 'Z');
          var date = d.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'
          });
          var time = d.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit',
            hour12: true, timeZone: 'Asia/Kolkata'
          });
          return date + ' \xB7 ' + time;
        })() +
        '</div>' +
        '</div>' +

        '<div style="flex-shrink:0;text-align:center;' +
        'padding:7px 12px 8px;min-width:64px;' +
        'border:1px dashed ' + seatBorder + ';">' +
        (seatLabel
          ? '<span style="font-size:7px;letter-spacing:0.18em;' +
            'text-transform:uppercase;color:rgba(255,255,255,0.45);' +
            'display:block;margin-bottom:3px;line-height:1;">' +
            seatLabel + '</span>'
          : '') +
        '<span style="font-family:\'DM Sans\',sans-serif;font-size:28px;font-weight:700;' +
        'line-height:1;display:block;color:' + seatColor + ';">' +
        seatNum + '</span>' +
        '</div>' +

        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;' +
        'border-top:1px dashed rgba(255,255,255,0.08);">' +

        '<div style="padding:9px 16px 10px;border-right:1px dashed rgba(255,255,255,0.08);">' +
        '<span style="font-size:7px;letter-spacing:0.16em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.38);display:block;margin-bottom:4px;line-height:1;">Pillar</span>' +
        '<span style="font-size:11px;font-weight:500;letter-spacing:0.02em;' +
        'color:#e8e2d9;display:block;line-height:1.1;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        esc(p.content_pillar||p.contentPillar||'--') + '</span>' +
        '</div>' +

        '<div style="padding:9px 16px 10px;border-right:1px dashed rgba(255,255,255,0.08);">' +
        '<span style="font-size:7px;letter-spacing:0.16em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.38);display:block;margin-bottom:4px;line-height:1;">Location</span>' +
        '<span style="font-size:11px;font-weight:500;letter-spacing:0.02em;' +
        'color:#e8e2d9;display:block;line-height:1.1;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        esc(p.location||'--') + '</span>' +
        '</div>' +

        '<div style="padding:9px 16px 10px;">' +
        '<span style="font-size:7px;letter-spacing:0.16em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.38);display:block;margin-bottom:4px;line-height:1;">Target</span>' +
        '<span style="font-size:11px;font-weight:500;letter-spacing:0.02em;' +
        'color:#e8e2d9;display:block;line-height:1.1;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        (p.target_date ? new Date(p.target_date + 'T00:00:00')
          .toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'}) : '--') +
        '</span>' +
        '</div>' +

        '</div>' +

        '<div style="height:14px;background:#080808;margin:0 -1px;display:flex;align-items:center;">' +
        '<div style="width:14px;height:14px;border-radius:0 50% 50% 0;' +
        'background:#0d0d14;border:1px solid rgba(255,255,255,0.07);' +
        'border-left:none;flex-shrink:0;"></div>' +
        '<div style="flex:1;border-top:1px dashed rgba(255,255,255,0.12);"></div>' +
        '<div style="width:14px;height:14px;border-radius:50% 0 0 50%;' +
        'background:#0d0d14;border:1px solid rgba(255,255,255,0.07);' +
        'border-right:none;flex-shrink:0;"></div>' +
        '</div>' +

        (hero
          ? '<div onclick="_openClientEditorial(\'' + esc(p.post_id) + '\')" ' +
            'style="cursor:pointer;">' +
            '<img src="' + hero + '" loading="eager" decoding="async" ' +
            'style="aspect-ratio:1/1;width:100%;object-fit:cover;display:block;"></div>'
          : (p.caption
              ? '<div onclick="_openClientEditorial(\'' + esc(p.post_id) + '\')" ' +
                'style="padding:12px 16px;cursor:pointer;">' +
                '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;' +
                'color:rgba(255,255,255,0.55);line-height:1.6;max-height:52px;overflow:hidden;' +
                '-webkit-mask-image:linear-gradient(to bottom,black 20px,transparent 50px);">' +
                esc(p.caption) + '</div>' +
                '<div style="text-align:right;font-family:\'IBM Plex Mono\',monospace;' +
                'font-size:7px;letter-spacing:0.12em;text-transform:uppercase;' +
                'color:#F6A623;padding-top:6px;">See More &#x2192;</div>' +
                '</div>'
              : ''
            )
        ) +

        '<div style="display:flex;border-top:1px dashed rgba(255,255,255,0.08);position:relative;">' +

        '<button onclick="clientApprove(\'' + esc(id) + '\',this)" ' +
        'style="flex:5;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
        'letter-spacing:0.14em;text-transform:uppercase;color:#3ECF8E;' +
        'background:transparent;border:none;' +
        'border-right:1px solid rgba(255,255,255,0.22);' +
        'padding:14px 0;display:flex;align-items:center;justify-content:center;gap:6px;' +
        'box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);cursor:pointer;">&#x25C8; Approve</button>' +

        '<button onclick="showChangeInput(\'' + esc(id) + '\')" ' +
        'style="flex:3;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
        'letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.55);' +
        'background:transparent;border:none;' +
        'border-right:1px solid rgba(255,255,255,0.22);' +
        'padding:14px 0;display:flex;align-items:center;justify-content:center;gap:6px;' +
        'box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);cursor:pointer;">&#x21A9; Changes</button>' +

        '<a href="' + esc(waLink) + '" target="_blank" ' +
        'style="flex:2;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(37,211,102,0.04);border:none;' +
        'color:#25D366;cursor:pointer;text-decoration:none;padding:14px 0;' +
        'font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.14em;' +
        'text-transform:uppercase;gap:6px;' +
        'box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">' +
        '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>' +
        '</svg>' +
        '</a>' +

        '</div>' +

        '<div class="change-input-wrap" id="change-wrap-' + esc(id) + '">' +
        '<div style="display:flex;align-items:center;' +
        'justify-content:space-between;margin-bottom:10px;">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
        'letter-spacing:0.16em;text-transform:uppercase;color:#F6A623;">' +
        'What needs to change?</div>' +
        '<button onclick="showChangeInput(\'' + esc(id) + '\')" ' +
        'style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;' +
        'color:#e8e2d9;background:rgba(255,255,255,0.08);' +
        'border:1px solid rgba(255,255,255,0.2);' +
        'cursor:pointer;padding:4px 10px;' +
        'line-height:1;letter-spacing:0;">&#x2715;</button>' +
        '</div>' +
        '<textarea class="change-textarea" id="change-text-' + esc(id) + '" ' +
        'placeholder="Be specific -- tone, image, hashtags..." rows="3"></textarea>' +
        '<button class="btn-send-changes" ' +
        'onclick="submitClientChanges(\'' + esc(id) + '\')">&#x2192; Send Feedback</button>' +
        '</div>' +

        '<div class="approval-confirmed" ' +
        'id="approved-confirm-' + esc(id) + '">' +
        'Approved - the team has been notified.</div>' +

        (function(){
          var _isDesktop = window.innerWidth > 768 && !('ontouchstart' in window);
          if (!_isDesktop) return '';
          return '<div style="padding:0 16px 14px;">' +
          '<button onclick="(function(){' +
          'var msg=\'' + (p.title||'').replace(/'/g,"\\'") + '\\n\\n' +
          (p.caption||'').replace(/'/g,"\\'").slice(0,300).replace(/\n/g,'\\n') +
          '\\n\\nApprove: https://srtd.io/ok/?p=' +
          (p.title||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,50) +
          '\\nChanges: https://srtd.io/no/?p=' +
          (p.title||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,50) + '\';' +
          'navigator.clipboard.writeText(msg).then(function(){' +
          'var b=this;b.textContent=\'Copied\';' +
          'setTimeout(function(){b.textContent=\'Copy to Share\';},2000);' +
          '}.bind(this));' +
          '})()" ' +
          'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
          'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);' +
          'background:transparent;border:1px solid rgba(255,255,255,0.1);' +
          'padding:10px 0;cursor:pointer;">' +
          'Copy to Share</button>' +
          '</div>';
        })() +

        '</div>'
        );
      }).join('');
    }
  }

  // CHANGE 8 - New Request section
  var reqEyebrow = document.getElementById('client-request-eyebrow');
  if (reqEyebrow) reqEyebrow.style.display = 'none';

  var reqForm = document.getElementById('client-request-form');
  if (reqForm && !reqForm.dataset.init) {
    var existingOverlay = document.getElementById('req-overlay');
    if (existingOverlay) existingOverlay.remove();
    reqForm.dataset.init = '1';
    var html =
      '<div id="req-overlay" ' +
      'style="position:fixed;inset:0;z-index:2000;background:#080808;' +
      'display:none;flex-direction:column;">' +

      // TOPBAR
      '<div style="display:flex;align-items:baseline;' +
      'justify-content:space-between;padding:16px 18px;' +
      'border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">' +
      '<div style="display:flex;align-items:baseline;gap:8px;">' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
      'letter-spacing:0.22em;text-transform:uppercase;color:#C8A84B;">' +
      'New Request</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.45);">' +
      '-- We\'ll handle everything</span>' +
      '</div>' +
      '<button onclick="_closeReqForm()" ' +
      'style="font-size:15px;color:rgba(255,255,255,0.55);background:transparent;' +
      'border:none;cursor:pointer;padding:4px;">&#x2715;</button>' +
      '</div>' +

      // SCROLLABLE BODY
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;">' +

      // 01 -- Name (mandatory, 30 char max)
      '<div style="padding:16px 18px;' +
      'border-bottom:1px dashed rgba(255,255,255,0.1);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;color:#C8A84B;margin-bottom:4px;">01</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
      'font-weight:600;color:#e8e2d9;margin-bottom:12px;line-height:1.3;">' +
      'Name this request ' +
      '<span style="color:#FF4B4B;font-size:12px;">*</span></div>' +
      '<input type="text" id="req-name" maxlength="30" ' +
      'placeholder="e.g. Somaiya Diaries, Women\'s Day" ' +
      'oninput="_reqValidate()" ' +
      'style="width:100%;background:transparent;border:none;' +
      'border-bottom:1px solid rgba(200,168,75,0.25);color:#e8e2d9;' +
      'font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'padding:6px 0 8px;outline:none;caret-color:#C8A84B;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:6px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-top:5px;">' +
      'Max 30 characters -- becomes the post title</div>' +
      '</div>' +

      // 02 -- Brief (mandatory)
      '<div style="padding:16px 18px;' +
      'border-bottom:1px dashed rgba(255,255,255,0.1);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;color:#C8A84B;margin-bottom:4px;">02</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
      'font-weight:600;color:#e8e2d9;margin-bottom:12px;line-height:1.3;">' +
      'What\'s the brief? ' +
      '<span style="color:#FF4B4B;font-size:12px;">*</span></div>' +
      '<textarea id="req-topic" rows="2" ' +
      'placeholder="Write the brief here -- topic, story, key message..." ' +
      'oninput="this.style.height=\'auto\';' +
      'this.style.height=this.scrollHeight+\'px\';_reqValidate();" ' +
      'style="width:100%;background:transparent;border:none;' +
      'border-bottom:1px solid rgba(200,168,75,0.25);color:#e8e2d9;' +
      'font-family:\'DM Sans\',sans-serif;font-size:14px;padding:6px 0 8px;' +
      'outline:none;resize:none;line-height:1.7;min-height:44px;' +
      'caret-color:#C8A84B;overflow:hidden;"></textarea>' +
      '</div>' +

      // 03 -- Content type (optional)
      '<div style="padding:16px 18px;' +
      'border-bottom:1px dashed rgba(255,255,255,0.1);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;color:#C8A84B;margin-bottom:4px;">03</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
      'font-weight:600;color:#e8e2d9;margin-bottom:4px;line-height:1.3;">' +
      'Content type</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.12em;' +
      'text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:12px;">Optional</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
      ['Photo','Carousel','Video','Text','Creative'].map(function(t) {
        return '<button onclick="_reqToggleChip(this)" ' +
        'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
        'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);' +
        'border:1px solid rgba(255,255,255,0.18);padding:6px 11px;' +
        'cursor:pointer;background:transparent;">' + t + '</button>';
      }).join('') +
      '</div></div>' +

      // 04 -- Target date (optional)
      '<div style="padding:16px 18px;' +
      'border-bottom:1px dashed rgba(255,255,255,0.1);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;color:#C8A84B;margin-bottom:4px;">04</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
      'font-weight:600;color:#e8e2d9;margin-bottom:4px;line-height:1.3;">' +
      'Target date</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.12em;' +
      'text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:12px;">Optional</div>' +
      '<div style="position:relative;display:flex;' +
      'align-items:center;justify-content:space-between;' +
      'border:1px solid rgba(255,255,255,0.18);' +
      'padding:11px 14px;cursor:pointer;margin-top:4px;' +
      'background:rgba(255,255,255,0.02);">' +
      '<span id="req-date-label" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:11px;letter-spacing:0.04em;' +
      'color:rgba(255,255,255,0.45);">Pick a date</span>' +
      '<span style="font-size:10px;color:rgba(255,255,255,0.4);">&#x25BE;</span>' +
      '<input type="date" id="req-date" ' +
      'onchange="(function(v){' +
      'var d=new Date(v+\'T00:00:00\');' +
      'var el=document.getElementById(\'req-date-label\');' +
      'el.textContent=d.toLocaleDateString(\'en-IN\',' +
      '{day:\'numeric\',month:\'short\',year:\'numeric\',timeZone:\'Asia/Kolkata\'});' +
      'el.style.color=\'#e8e2d9\';' +
      '})(this.value)" ' +
      'style="position:absolute;inset:0;opacity:0;' +
      'width:100%;height:100%;cursor:pointer;' +
      'color-scheme:dark;border:none;' +
      'background:transparent;padding:0;outline:none;">' +
      '</div>' +
      '</div>' +

      // 05 -- Reference photos (optional) -- grid + progress bar
      '<div style="padding:16px 18px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;color:#C8A84B;margin-bottom:4px;">05</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
      'font-weight:600;color:#e8e2d9;margin-bottom:4px;line-height:1.3;">' +
      'Reference photos</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.12em;' +
      'text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:12px;">Optional</div>' +

      // Progress bar -- hidden by default
      '<div id="req-progress-wrap" style="display:none;margin-bottom:10px;">' +
      '<div style="height:2px;background:rgba(255,255,255,0.06);margin-bottom:4px;">' +
      '<div id="req-progress-fill" ' +
      'style="height:2px;background:#C8A84B;width:0%;transition:width 0.3s;"></div>' +
      '</div>' +
      '<div id="req-progress-text" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:6px;' +
      'letter-spacing:0.12em;text-transform:uppercase;color:#C8A84B;">' +
      'Preparing...</div>' +
      '</div>' +

      // Photo grid
      '<div id="req-photo-grid" ' +
      'style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">' +
      '<div id="req-add-tile" ' +
      'onclick="document.getElementById(\'req-file\').click()" ' +
      'style="aspect-ratio:1/1;background:rgba(200,168,75,0.04);' +
      'border:1px dashed rgba(200,168,75,0.2);display:flex;' +
      'flex-direction:column;align-items:center;justify-content:center;' +
      'cursor:pointer;gap:4px;">' +
      '<div style="font-size:20px;color:rgba(200,168,75,0.4);line-height:1;">+</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:6px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Add photos</div>' +
      '</div></div>' +
      '<div id="req-photo-count" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-top:6px;">' +
      'No photos added</div>' +
      '<input type="file" id="req-file" accept="image/*" multiple ' +
      'style="display:none;" onchange="_reqAddPhotos(this)">' +
      '</div>' +

      // Keep hidden urgency buttons so submitClientRequest() doesnt break
      '<div style="display:none;">' +
      '<button id="req-urgency-normal"></button>' +
      '<button id="req-urgency-urgent"></button>' +
      '</div>' +

      '</div>' + // end scrollable body

      // FOOTER
      '<div style="flex-shrink:0;padding:12px 18px 20px;' +
      'border-top:1px solid rgba(200,168,75,0.1);background:#080808;' +
      'display:flex;gap:10px;">' +
      '<button onclick="_closeReqForm()" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.5);' +
      'background:transparent;border:1px solid rgba(255,255,255,0.18);' +
      'padding:13px 16px;cursor:pointer;flex-shrink:0;">Cancel</button>' +
      '<button id="req-submit-btn" onclick="submitClientRequest()" disabled ' +
      'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
      'letter-spacing:0.2em;text-transform:uppercase;color:#444;' +
      'background:transparent;border:1px solid rgba(255,255,255,0.1);' +
      'padding:13px 0;cursor:not-allowed;transition:all 0.2s;" ' +
      '>&#x2192; Send Request</button>' +
      '</div>' +

      '</div>';
    var existing = document.getElementById('req-overlay');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.innerHTML = html;
    var overlay = div.firstElementChild;
    document.body.appendChild(overlay);
  }

  renderClientApproved();
}

function _closeReqForm() {
  var o = document.getElementById('req-overlay');
  if (o) o.style.display = 'none';
  var nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = '';
  // Reset name field
  var nameEl = document.getElementById('req-name');
  if (nameEl) nameEl.value = '';
  // Reset all fields for next open
  var topic = document.getElementById('req-topic');
  if (topic) topic.value = '';
  var date = document.getElementById('req-date');
  if (date) date.value = '';
  var dateLabel = document.getElementById('req-date-label');
  if (dateLabel) { dateLabel.textContent = 'Pick a date'; dateLabel.style.color = 'rgba(255,255,255,0.45)'; }
  // Reset chips
  var chips = document.querySelectorAll('#req-overlay button[onclick*="_reqToggleChip"]');
  chips.forEach(function(c) {
    c.style.color = 'rgba(255,255,255,0.55)';
    c.style.background = 'transparent';
    c.style.borderColor = 'rgba(255,255,255,0.18)';
  });
  // Reset photo grid
  window._reqStoredFiles = [];
  var grid = document.getElementById('req-photo-grid');
  if (grid) {
    var thumbs = grid.querySelectorAll('[data-file-idx]');
    thumbs.forEach(function(t) { t.remove(); });
  }
  var countEl = document.getElementById('req-photo-count');
  if (countEl) countEl.textContent = 'No photos added';
  var fi = document.getElementById('req-file');
  if (fi) fi.value = '';
  var pw = document.getElementById('req-progress-wrap');
  if (pw) pw.style.display = 'none';
  // Reset submit button to disabled state
  var btn = document.getElementById('req-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.style.color = '#444';
    btn.style.borderColor = 'rgba(255,255,255,0.1)';
    btn.style.background = 'transparent';
    btn.style.cursor = 'not-allowed';
    btn.style.boxShadow = 'none';
  }
}
window._closeReqForm = _closeReqForm;

function _reqToggleChip(el) {
  var allChips = el.parentNode.querySelectorAll('button');
  allChips.forEach(function(chip) {
    chip.style.color = 'rgba(255,255,255,0.55)';
    chip.style.background = 'transparent';
    chip.style.borderColor = 'rgba(255,255,255,0.18)';
  });
  el.style.color = '#C8A84B';
  el.style.background = 'rgba(200,168,75,0.07)';
  el.style.borderColor = 'rgba(200,168,75,0.4)';
}
window._reqToggleChip = _reqToggleChip;

function _reqSetUrgency(el, type) {
  var n = document.getElementById('req-urgency-normal');
  var u = document.getElementById('req-urgency-urgent');
  if (n) { n.style.color='#555'; n.style.background='transparent'; n.style.borderColor='rgba(255,255,255,0.07)'; }
  if (u) { u.style.color='#555'; u.style.background='transparent'; u.style.borderColor='rgba(255,255,255,0.07)'; }
  if (type === 'urgent' && u) {
    u.style.color='#FF4B4B'; u.style.background='rgba(255,75,75,0.06)'; u.style.borderColor='rgba(255,75,75,0.3)';
  } else if (n) {
    n.style.color='#3ECF8E'; n.style.background='rgba(62,207,142,0.08)'; n.style.borderColor='rgba(62,207,142,0.3)';
  }
}
window._reqSetUrgency = _reqSetUrgency;

function _reqPreviewFile(input) {
  var files = Array.from(input.files);
  if (!files.length) return;
  var area = document.getElementById('req-upload-area');
  var preview = document.getElementById('req-upload-preview');
  var img = document.getElementById('req-preview-img');
  var name = document.getElementById('req-preview-name');
  var reader = new FileReader();
  reader.onload = function(e) {
    if (img) img.src = e.target.result;
    if (area) area.style.display = 'none';
    if (preview) preview.style.display = 'block';
  };
  reader.readAsDataURL(files[0]);
  if (name) name.textContent = files.length === 1
    ? files[0].name
    : files.length + ' photos selected';
}
window._reqPreviewFile = _reqPreviewFile;

function _reqClearUpload() {
  var input = document.getElementById('req-file');
  var area = document.getElementById('req-upload-area');
  var preview = document.getElementById('req-upload-preview');
  if (input) input.value = '';
  if (area) area.style.display = 'block';
  if (preview) preview.style.display = 'none';
}
window._reqClearUpload = _reqClearUpload;

function _reqAddPhotos(input) {
  var files = Array.from(input.files);
  if (!files.length) return;
  var grid = document.getElementById('req-photo-grid');
  var addTile = document.getElementById('req-add-tile');
  var progressWrap = document.getElementById('req-progress-wrap');
  var progressFill = document.getElementById('req-progress-fill');
  var progressText = document.getElementById('req-progress-text');
  if (!grid || !addTile) return;

  window._reqStoredFiles = window._reqStoredFiles || [];
  var total = files.length;
  var loaded = 0;

  // Show progress bar
  if (progressWrap) progressWrap.style.display = 'block';
  if (progressFill) progressFill.style.background = '#C8A84B';

  // Disable send button during upload
  var sendBtn = document.getElementById('req-submit-btn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.style.color = '#444';
    sendBtn.style.borderColor = 'rgba(255,255,255,0.1)';
    sendBtn.style.cursor = 'not-allowed';
    sendBtn.style.boxShadow = 'none';
    sendBtn.textContent = 'Loading photos...';
  }

  files.forEach(function(file) {
    var fileIdx = window._reqStoredFiles.length;
    window._reqStoredFiles.push(file);
    var reader = new FileReader();
    reader.onload = function(e) {
      loaded++;
      var pct = Math.round((loaded / total) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.textContent =
        'Loading ' + loaded + ' of ' + total + ' photos...';

      var div = document.createElement('div');
      div.dataset.fileIdx = fileIdx;
      div.style.cssText = 'aspect-ratio:1/1;position:relative;' +
        'overflow:hidden;background:#111;';
      div.innerHTML =
        '<img src="' + e.target.result + '" ' +
        'style="width:100%;height:100%;object-fit:cover;display:block;">' +
        '<button onclick="(function(el){' +
        'var idx=el.closest(\'div\').dataset.fileIdx;' +
        'if(window._reqStoredFiles&&idx!==undefined)' +
        'window._reqStoredFiles[idx]=null;' +
        'el.closest(\'div\').remove();' +
        '_reqUpdatePhotoCount();})(this)" ' +
        'style="position:absolute;top:3px;right:3px;width:22px;height:22px;' +
        'background:rgba(0,0,0,0.85);border-radius:50%;display:flex;' +
        'align-items:center;justify-content:center;font-size:11px;' +
        'color:#e8e2d9;cursor:pointer;border:none;">&#x2715;</button>';
      grid.insertBefore(div, addTile);
      _reqUpdatePhotoCount();

      // All loaded
      if (loaded === total) {
        if (progressFill) {
          progressFill.style.background = '#3ECF8E';
          progressFill.style.width = '100%';
        }
        if (progressText) {
          progressText.style.color = '#3ECF8E';
          progressText.textContent =
            window._reqStoredFiles.filter(function(f){return f!==null;}).length +
            ' photos ready';
        }
        // Re-enable send if name + brief filled
        _reqValidate();
      }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}
window._reqAddPhotos = _reqAddPhotos;

function _reqUpdatePhotoCount() {
  var grid = document.getElementById('req-photo-grid');
  var count = grid ? grid.querySelectorAll('img').length : 0;
  var el = document.getElementById('req-photo-count');
  if (el) el.textContent = count > 0
    ? count + ' photo' + (count !== 1 ? 's' : '') + ' selected'
    : 'No photos added';
}
window._reqUpdatePhotoCount = _reqUpdatePhotoCount;

function _reqValidate() {
  var name = (document.getElementById('req-name') || {}).value || '';
  var brief = (document.getElementById('req-topic') || {}).value || '';
  var btn = document.getElementById('req-submit-btn');
  if (!btn) return;
  var valid = name.trim().length > 0 && brief.trim().length > 0;
  if (valid) {
    btn.disabled = false;
    btn.style.color = '#C8A84B';
    btn.style.borderColor = '#C8A84B';
    btn.style.background = 'rgba(200,168,75,0.06)';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 0 12px rgba(200,168,75,0.12)';
    btn.innerHTML = '&#x2192; Send Request';
  } else {
    btn.disabled = true;
    btn.style.color = '#444';
    btn.style.borderColor = 'rgba(255,255,255,0.1)';
    btn.style.background = 'transparent';
    btn.style.cursor = 'not-allowed';
    btn.style.boxShadow = 'none';
  }
}
window._reqValidate = _reqValidate;

function renderClientApproved() {
  // Hide published section on Client home - still visible in Library
  var pubSection = document.getElementById('client-published-section');
  if (pubSection && effectiveRole === 'Client') { pubSection.style.display = 'none'; return; }
  if (pubSection) pubSection.style.display = '';
  var published = allPosts.filter(function(p) { return p.stage === 'published'; });

  // Eyebrow
  var pubEyebrow = document.getElementById('client-published-eyebrow');
  if (pubEyebrow) {
    pubEyebrow.innerHTML =
      '<div style="display:flex;align-items:center;' +
      'justify-content:space-between;padding:8px 18px;' +
      'font-family:var(--mono);font-size:7px;' +
      'letter-spacing:0.22em;text-transform:uppercase;' +
      'color:#555;border-bottom:1px solid rgba(255,255,255,0.07);">' +
      '<span>Published</span>' +
      '<span style="font-size:8px;color:var(--c-amber);' +
      'border:1px solid rgba(246,166,35,0.25);' +
      'padding:1px 6px;">' + published.length + '</span></div>';
  }

  var wrap = document.getElementById('client-approved-tbody-wrap');
  if (!wrap) return;
  if (!published.length) {
    wrap.innerHTML = '<div style="padding:18px;font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.1em;text-transform:uppercase;">No published posts yet</div>';
    return;
  }
  wrap.innerHTML = '<table class="cp-pub-table"><thead><tr><th>Post</th><th>Published</th><th>View</th></tr></thead><tbody>' +
    published.map(function(p) {
      var link = getPostLink(p);
      return '<tr><td>' + esc(getTitle(p)) + '</td><td class="mono">' + displayDate(p.targetDate) + '</td><td>' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">View</a>' : '-') + '</td></tr>';
    }).join('') + '</tbody></table>';
}

// -- Production Tracker ----------
function renderCreativeTracker() {
  const section = document.getElementById('admin-insight-section');
  if (!section || effectiveRole === 'Client') return;
  const now  = Date.now();
  const DAY  = 86400000;
  const weekAgo = now - 7 * DAY;
  const monthAgo = now - 30 * DAY;
  const myPosts = allPosts.filter(p => {
    return (p.owner||'').toLowerCase() === 'pranav';
  });
  const doneThisWeek = myPosts.filter(p => {
    const stage = p.stage || '';
    const t = new Date(p.updated_at || p.created_at).getTime();
    return ['ready','awaiting_approval','scheduled','published'].includes(stage) && t >= weekAgo;
  }).length;
  const doneThisMonth = myPosts.filter(p => {
    const stage = p.stage || '';
    const t = new Date(p.updated_at || p.created_at).getTime();
    return ['ready','awaiting_approval','scheduled','published'].includes(stage) && t >= monthAgo;
  }).length;
  const _activeStages = typeof STAGES_DB !== 'undefined' ? STAGES_DB.filter(s => !['ready','awaiting_approval','scheduled','published','parked'].includes(s)) : ['in_production','awaiting_brand_input'];
  const inProgress = myPosts.filter(p => _activeStages.includes(p.stage || '')).length;
  const WEEKLY_TARGET  = 5;
  const MONTHLY_TARGET = 20;
  const weekPct  = Math.min(100, Math.round((doneThisWeek / WEEKLY_TARGET) * 100));
  const weekCls  = doneThisWeek >= WEEKLY_TARGET ? 'ok' : doneThisWeek >= WEEKLY_TARGET * 0.6 ? '' : 'warn';

  section.innerHTML = `
    <div class="creative-tracker">
      <div class="creative-tracker-head">
        <span class="creative-tracker-label">Your Production</span>
        <span class="creative-tracker-period">This week . target ${WEEKLY_TARGET}</span>
      </div>
      <div class="creative-tracker-stats">
        <div class="ct-stat"><div class="ct-stat-num ${weekCls}">${doneThisWeek}</div><div class="ct-stat-label">This Week</div></div>
        <div class="ct-stat"><div class="ct-stat-num">${doneThisMonth}</div><div class="ct-stat-label">This Month</div></div>
        <div class="ct-stat"><div class="ct-stat-num">${inProgress}</div><div class="ct-stat-label">In Progress</div></div>
      </div>
      <div class="creative-tracker-bar">
        <div class="creative-tracker-fill" style="width:${weekPct}%"></div>
      </div>
    </div>`;
}

// -- Fix 17: Library view switch ---------------
let _currentLibraryView = 'list';

function switchLibraryView(btn) {
  document.querySelectorAll('.vt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _currentLibraryView = btn.dataset.view;

  const llv = document.getElementById('library-list-view');
  const lcv = document.getElementById('library-calendar-view');
  if (llv) llv.style.display = _currentLibraryView === 'list'     ? '' : 'none';
  if (lcv) lcv.style.display = _currentLibraryView === 'calendar' ? '' : 'none';

  filterLibrary();
}


let _calMonth = new Date().getMonth();
let _calYear  = new Date().getFullYear();

function _calNav(delta) {
  _calMonth += delta;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
  filterLibrary();
}

function groupPostsByDay(posts, month, year) {
  var map = {};
  posts.forEach(function(p) {
    var d = parseDate(p.targetDate);
    if (!d || d.getMonth() !== month || d.getFullYear() !== year) return;
    var key = p.targetDate;
    if (!map[key]) map[key] = [];
    map[key].push(p);
  });
  return map;
}

var _calDayMap = {}; // stored for drawer access

function renderLibraryCalendar(posts) {
  var container = document.getElementById('library-calendar-view');
  if (!container) return;
  posts = posts || allPosts;

  var dayMap = groupPostsByDay(posts, _calMonth, _calYear);
  _calDayMap = dayMap;
  var monthLabel = MONTHS[_calMonth] + ' ' + _calYear;

  var firstDay = new Date(_calYear, _calMonth, 1).getDay();
  var numDays = new Date(_calYear, _calMonth + 1, 0).getDate();
  var totalCells = firstDay + numDays <= 35 ? 35 : 42;

  var today = new Date(); today.setHours(0,0,0,0);

  // Count stats for month bar
  var statSched = 0, statReady = 0, statLate = 0;
  Object.keys(dayMap).forEach(function(k) {
    dayMap[k].forEach(function(p) {
      var s = p.stage || '';
      if (s === 'scheduled') statSched++;
      else if (s === 'ready') statReady++;
      var pd = parseDate(p.targetDate);
      if (pd && pd < today) statLate++;
    });
  });

  // Month bar
  var html = '<div class="month-bar">' +
    '<div class="month-nav">' +
      '<button class="month-arrow" id="cal-prev" onclick="_calNav(-1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>' +
      '<div class="month-title" id="cal-month-title">' + esc(monthLabel) + '</div>' +
      '<button class="month-arrow" id="cal-next" onclick="_calNav(1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg></button>' +
    '</div>' +
    '<div class="month-stats" id="month-stats">' +
      '<div class="mstat-pill sched" title="Scheduled"><div class="mstat-dot"></div><span id="stat-sched">' + statSched + '</span></div>' +
      '<div class="mstat-pill ready" title="Ready"><div class="mstat-dot"></div><span id="stat-ready">' + statReady + '</span></div>' +
      '<div class="mstat-pill late" title="Overdue"><div class="mstat-dot"></div><span id="stat-late">' + statLate + '</span></div>' +
    '</div>' +
  '</div>';

  // DOW header
  html += '<div class="pcs-cal-grid pcs-cal-dow">';
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function(d) {
    html += '<div class="pcs-cal-dow-label">' + d + '</div>';
  });
  html += '</div>';

  // Cells with dots
  html += '<div class="pcs-cal-grid" id="cal-grid">';
  for (var i = 0; i < totalCells; i++) {
    var dayNum = i - firstDay + 1;
    if (i < firstDay || dayNum > numDays) {
      html += '<div class="cal-cell-empty"></div>';
      continue;
    }

    var dd = String(dayNum).padStart(2, '0');
    var mm = String(_calMonth + 1).padStart(2, '0');
    var key = _calYear + '-' + mm + '-' + dd;
    var cellDate = new Date(_calYear, _calMonth, dayNum);
    var isToday = cellDate.getTime() === today.getTime();
    var dayPosts = dayMap[key] || [];

    var cellCls = 'cal-cell';
    if (isToday) cellCls += ' today';

    html += '<div class="' + cellCls + '" data-cal-date="' + key + '">';
    html += '<div class="cc-num">' + dayNum + '</div>';

    if (dayPosts.length) {
      html += '<div class="cc-dots">';
      var maxDots = Math.min(dayPosts.length, 6);
      for (var j = 0; j < maxDots; j++) {
        var dotColor = _libStageDotColor(dayPosts[j].stage);
        html += '<span class="cc-dot" style="background:' + dotColor + '"></span>';
      }
      html += '</div>';
      if (dayPosts.length > 6) {
        html += '<div class="cc-overflow">+' + (dayPosts.length - 6) + '</div>';
      }
    }

    html += '</div>';
  }
  html += '</div>';

  // Day drawer
  html += '<div class="day-drawer" id="day-drawer">' +
    '<div class="drawer-hdr">' +
      '<div class="drawer-date" id="drawer-date">Select a day</div>' +
      '<div class="drawer-close" id="drawer-close">x close</div>' +
    '</div>' +
    '<div id="drawer-posts"></div>' +
  '</div>';

  container.innerHTML = html;

  // Wire up cell clicks for drawer
  var grid = document.getElementById('cal-grid');
  if (grid) {
    grid.addEventListener('click', function(e) {
      var cell = e.target.closest('.cal-cell');
      if (!cell) return;
      var dateKey = cell.getAttribute('data-cal-date');
      if (!dateKey) return;
      _openDayDrawer(dateKey, cell);
    });
  }

  // Wire up drawer close
  var closeBtn = document.getElementById('drawer-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() { _closeDayDrawer(); });
  }
}

function _stagePillClass(stage) {
  var sk = _pipelineStageKey(stage);
  if (sk === 'production') return 's-prod';
  if (sk === 'ready')      return 's-ready';
  if (sk === 'input')      return 's-input';
  if (sk === 'approval')   return 's-appr';
  if (sk === 'scheduled')  return 's-sched';
  return '';
}

function _openDayDrawer(dateKey, cell) {
  // Deselect previous
  var prev = document.querySelector('.cal-cell.selected');
  if (prev) prev.classList.remove('selected');
  cell.classList.add('selected');

  var drawer = document.getElementById('day-drawer');
  var dateEl = document.getElementById('drawer-date');
  var postsEl = document.getElementById('drawer-posts');
  if (!drawer || !postsEl) return;

  var d = parseDate(dateKey);
  if (dateEl) dateEl.textContent = d ? (d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear()) : dateKey;

  var posts = _calDayMap[dateKey] || [];
  if (!posts.length) {
    postsEl.innerHTML = '<div class="drawer-empty">No posts on this day</div>';
  } else {
    postsEl.innerHTML = posts.map(function(p) {
      var id = getPostId(p);
      var dotColor = _libStageDotColor(p.stage);
      var owner = formatOwner(p.owner || '');
      var pillar = getPillarShort(p.contentPillar);
      var stLabel = stageStyle(p.stage).label;
      var stCls = _stagePillClass(p.stage);
      var html = '<div class="drawer-post" data-post-id="' + esc(id) + '" data-list="library">' +
        '<span class="drawer-stage-dot" style="background:' + dotColor + '"></span>' +
        '<div>' +
          '<div class="drawer-post-title">' + esc(getTitle(p)) + '</div>' +
          '<div class="drawer-post-meta">';
      if (owner && owner !== ' - ') html += '<span class="meta-pill owner">' + esc(owner) + '</span>';
      if (pillar) html += '<span class="meta-pill pillar">' + esc(pillar) + '</span>';
      if (stLabel) html += '<span class="meta-pill ' + stCls + '">' + esc(stLabel) + '</span>';
      html += '</div></div></div>';
      return html;
    }).join('');
  }

  drawer.classList.add('open');
}

function _closeDayDrawer() {
  var drawer = document.getElementById('day-drawer');
  if (drawer) drawer.classList.remove('open');
  var prev = document.querySelector('.cal-cell.selected');
  if (prev) prev.classList.remove('selected');
}

// ===============================================
// Event delegation for card clicks
// Single document-level listener  -  survives ALL innerHTML replacements.
// Covers: .row-tile, .pcs-cal-cell, .upc-list-row (any element with data-post-id)
// ===============================================
document.addEventListener('click', function _cardClickDelegate(e) {
  var card = e.target.closest('[data-post-id]');
  if (!card) return;
  var postId  = card.dataset.postId;
  var listKey = card.dataset.list || '';
  if (!postId) return;
  // Batch mode intercept: clicking a ready card toggles selection
  if (_batchMode && card.dataset.stage === 'ready') {
    toggleBatchCard(postId, card);
    return;
  }
  // Parked overlay rows also need to close the parked sheet
  if (card.dataset.closeParked) {
    try { closeParked(); } catch (_) {}
  }
  var clickedPost = (typeof getPostById === 'function')
    ? getPostById(postId) : null;
  var _isBriefPost = clickedPost &&
    (clickedPost.stage === 'brief');
  if (_isBriefPost) {
    _openBriefSheet(postId);
    return;
  }
  openPCS(postId, listKey);
});

// -- Wire batch action bar buttons --
document.addEventListener('DOMContentLoaded', function() {
  var approvalBtn = document.getElementById('batch-approval-btn');
  if (approvalBtn) approvalBtn.addEventListener('click', function() {
    executeBatchAction('awaiting_approval');
  });
  var inputBtn = document.getElementById('batch-input-btn');
  if (inputBtn) inputBtn.addEventListener('click', function() {
    executeBatchAction('awaiting_brand_input');
  });

  document.addEventListener('click', function(e) {
    if (!_pipelineSearchOpen) return;
    var bar = document.getElementById('pipeline-search-bar');
    var trigger = document.getElementById('pipeline-search-trigger');
    var resultsEl = document.getElementById('pipeline-search-results');
    if (bar && !bar.contains(e.target) &&
        trigger && !trigger.contains(e.target) &&
        (!resultsEl || !resultsEl.contains(e.target))) {
      closePipelineSearch();
    }
  });
});

// ===============================================
// Chase functions
// ===============================================
function copyChase(encodedMsg) {
  var msg = decodeURIComponent(encodedMsg);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(function() {
      showChaseToast('Copied to clipboard');
    }).catch(function() {
      fallbackCopy(msg);
    });
  } else {
    fallbackCopy(msg);
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    showChaseToast('Copied to clipboard');
  } catch(e) {
    showChaseToast('Copy failed');
  }
  document.body.removeChild(ta);
}

function chaseAll() {
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var now = new Date();
  var threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  var overduePosts = posts.filter(function(p) {
    if (p.stage !== 'awaiting_approval') return false;
    if (!p.status_changed_at) return true;
    return new Date((p.status_changed_at || '') + 'Z') < threeDaysAgo;
  });

  if (overduePosts.length === 0) return;

  var lines = overduePosts.map(function(p) {
    var sentDate = 'recently';
    if (p.status_changed_at) {
      var d = new Date((p.status_changed_at || '') + 'Z');
      sentDate = d.toLocaleDateString('en-GB', {day:'numeric', month:'short', timeZone:'Asia/Kolkata'});
    }
    return '- ' + (p.title || 'Untitled') + ' (sent ' + sentDate + ')';
  });

  var msg = 'Hi! Following up on ' + overduePosts.length + ' posts awaiting approval:\n' + lines.join('\n') + '\nPlease review when you get a chance';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(function() {
      showChaseToast(overduePosts.length + ' posts copied');
    }).catch(function() {
      fallbackCopy(msg);
    });
  } else {
    fallbackCopy(msg);
  }
}

// -- Client Editorial Full-Screen View ----------
function _openClientEditorial(postId) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;

  var existing = document.getElementById('client-editorial-overlay');
  if (existing) existing.remove();

  var imgs = Array.isArray(post.images) ? post.images : [];
  var hero = imgs[0] || '';
  var img2 = imgs[1] || '';
  var pillar = (post.content_pillar || post.contentPillar || '').toUpperCase();
  var location = (post.location || '').toUpperCase();
  var caption = post.caption || '';
  var title = post.title || '';

  var overlay = document.createElement('div');
  overlay.id = 'client-editorial-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;' +
    'background:#0a0a0a;overflow-y:auto;' +
    '-webkit-overflow-scrolling:touch;';

  overlay.innerHTML =
    // Topbar
    '<div style="position:sticky;top:0;z-index:10;' +
    'background:rgba(10,10,10,0.92);backdrop-filter:blur(8px);' +
    'display:flex;align-items:center;justify-content:space-between;' +
    'padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
    '<button onclick="_closeClientEditorial()" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.12em;text-transform:uppercase;color:#e8e2d9;' +
    'background:transparent;border:none;cursor:pointer;">&#x2190; Back</button>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.14em;text-transform:uppercase;color:#333;">' +
    'Awaiting Approval</div>' +
    '<div style="width:60px;"></div>' +
    '</div>' +

    // Hero image
    (hero ?
      '<img src="' + hero + '" style="width:100%;max-height:280px;' +
      'object-fit:cover;display:block;cursor:pointer;" loading="eager" ' +
      'onclick="_edOpenLightbox(\'' + postId + '\',0)">'
      : '') +

    // Body
    '<div style="padding:28px 22px 0;max-width:390px;margin:0 auto;">' +

    // Pillar label
    (pillar ?
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.22em;text-transform:uppercase;color:#C8A84B;' +
      'margin-bottom:10px;">' + pillar + '</div>'
      : '') +

    // Title
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:26px;' +
    'font-weight:700;color:#f0ece4;line-height:1.2;margin-bottom:20px;' +
    'letter-spacing:-0.01em;">' + title + '</div>' +

    // Gold divider
    '<div style="width:32px;height:1px;background:#C8A84B;' +
    'margin-bottom:22px;"></div>' +

    // Caption
    '<div id="ed-caption-' + postId + '" style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
    'color:#888;line-height:1.8;white-space:pre-wrap;' +
    'word-wrap:break-word;margin-bottom:28px;">' + caption + '</div>' +

    '</div>' +

    // Image gallery strip with dots
    (function(){
      var stripId = 'ed-strip-' + postId;
      var dotsId = 'ed-dots-' + postId;
      return (imgs.length > 1 ?
      '<div style="padding:0 0 20px;">' +

      '<div style="display:flex;align-items:center;' +
      'justify-content:space-between;padding:0 22px 8px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#555;">All Photos</div>' +
      '<div onclick="_edOpenLightbox(\'' + postId + '\',0)" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#F6A623;cursor:pointer;">' +
      imgs.length + ' photos &#x2192;</div>' +
      '</div>' +

      '<div id="' + stripId + '" ' +
      'style="display:flex;gap:2px;overflow-x:auto;' +
      'scrollbar-width:none;-webkit-overflow-scrolling:touch;' +
      'padding-left:22px;" ' +
      'onscroll="_edUpdateDots(\'' + stripId + '\',\'' + dotsId + '\',' + imgs.length + ')">' +
      imgs.map(function(url, i) {
        return '<img src="' + url + '" loading="eager" decoding="async" ' +
        'onclick="_edOpenLightbox(\'' + postId + '\',' + i + ')" ' +
        'style="flex-shrink:0;width:100px;height:100px;object-fit:cover;' +
        'display:block;cursor:pointer;">';
      }).join('') +
      '<div style="flex-shrink:0;width:22px;"></div>' +
      '</div>' +

      '<div id="' + dotsId + '" ' +
      'style="display:flex;justify-content:center;gap:5px;padding:10px 0 0;">' +
      imgs.map(function(u, i) {
        return '<div style="width:5px;height:5px;border-radius:50%;background:' +
        (i === 0 ? '#e8e2d9' : '#2a2a2a') + ';transition:background 0.2s;"></div>';
      }).join('') +
      '</div></div>'
      : '');
    })() +

    // Footer
    '<div style="padding:0 22px 44px;max-width:390px;margin:0 auto;">' +

    // Meta pills -- pillar + location only, NOT client
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;">' +
    (pillar ?
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:#777;' +
      'border:1px solid rgba(255,255,255,0.15);padding:4px 8px;">' +
      pillar + '</div>'
      : '') +
    (location ?
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:#777;' +
      'border:1px solid rgba(255,255,255,0.15);padding:4px 8px;">' +
      location + '</div>'
      : '') +
    '</div>' +

    // WhatsApp share
    (function(){
      var _isDesktop = window.innerWidth > 768 && !('ontouchstart' in window);
      var rawSlug = (post.title||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,50);
      return '<div style="display:' + (_isDesktop ? 'flex' : 'block') + ';gap:8px;margin-bottom:10px;">' +
      '<button onclick="(function(){' +
      'var msg=\'' + (post.title||'').replace(/'/g,"\\'") + '\\n\\n\'+' +
      '(document.getElementById(\'ed-caption-\'+\'' + postId + '\') ? ' +
      'document.getElementById(\'ed-caption-\'+\'' + postId + '\').textContent : ' +
      '\'' + (post.caption||'').replace(/'/g,"\\'").slice(0,200) + '\') +' +
      '\'\\n\\nPlease review and let me know.\'+' +
      '\'\\n\\nApprove: https://srtd.io/ok/?p=' + rawSlug + '\'+' +
      '\'\\nChanges: https://srtd.io/no/?p=' + rawSlug + '\';' +
      'window.open(\'https://wa.me/?text=\'+encodeURIComponent(msg),\'_blank\');' +
      '})()" ' +
      'style="flex:1;width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#e8e2d9;' +
      'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);' +
      'padding:14px 0;cursor:pointer;display:block;">' +
      '&#x2197; Share on WhatsApp</button>' +
      (_isDesktop ?
        '<button onclick="(function(){' +
        'var msg=\'' + (post.title||'').replace(/'/g,"\\'") + '\\n\\n\'+' +
        '(document.getElementById(\'ed-caption-' + postId + '\') ? ' +
        'document.getElementById(\'ed-caption-' + postId + '\').textContent : ' +
        '\'' + (post.caption||'').replace(/'/g,"\\'").slice(0,200) + '\') +' +
        '\'\\n\\nApprove: https://srtd.io/ok/?p=' + rawSlug + '\'+' +
        '\'\\nChanges: https://srtd.io/no/?p=' + rawSlug + '\';' +
        'navigator.clipboard.writeText(msg).then(function(){' +
        'var b=document.getElementById(\'ed-copy-' + postId + '\');' +
        'if(b){b.textContent=\'Copied\';' +
        'setTimeout(function(){b.textContent=\'&#x2318; Copy to Share\';},2000);}' +
        '});' +
        '})()" id="ed-copy-' + postId + '" ' +
        'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
        'letter-spacing:0.14em;text-transform:uppercase;color:#888;' +
        'background:transparent;border:1px solid rgba(255,255,255,0.12);' +
        'padding:14px 0;cursor:pointer;">' +
        '\u2398 Copy to Share</button>'
        : '') +
      '</div>';
    })() +

    // Approve button
    '<button onclick="_editorialApprove(\'' + postId + '\')" ' +
    'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.2em;text-transform:uppercase;color:#3ECF8E;' +
    'background:rgba(62,207,142,0.08);border:1px solid rgba(62,207,142,0.35);' +
    'padding:16px 0;cursor:pointer;display:block;margin-bottom:10px;">' +
    '&#x2713; Approve Post</button>' +

    // Request Changes button
    '<button onclick="_editorialChanges(\'' + postId + '\')" ' +
    'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.2em;text-transform:uppercase;color:#555;' +
    'background:transparent;border:1px solid rgba(255,255,255,0.07);' +
    'padding:14px 0;cursor:pointer;display:block;">' +
    'Request Changes</button>' +

    '</div>';

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}
window._openClientEditorial = _openClientEditorial;

function _closeClientEditorial() {
  var overlay = document.getElementById('client-editorial-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
}
window._closeClientEditorial = _closeClientEditorial;

function _editorialApprove(postId) {
  var overlay = document.getElementById('client-editorial-overlay');
  if (overlay) {
    overlay.innerHTML =
      '<div style="position:fixed;inset:0;background:#0a0a0f;' +
      'display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:14px;z-index:6000;">' +
      '<div style="font-size:32px;color:#3ECF8E;line-height:1;">&#x2713;</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:22px;' +
      'font-weight:600;color:#e8e2d9;letter-spacing:-0.01em;">Approved.</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.5);">' +
      'Team has been notified.</div>' +
      '</div>';
  }
  setTimeout(function() {
    _closeClientEditorial();
    if (typeof clientApprove === 'function') clientApprove(postId);
  }, 1500);
}
window._editorialApprove = _editorialApprove;

function _editorialChanges(postId) {
  var overlay = document.getElementById('client-editorial-overlay');
  if (overlay) {
    overlay.innerHTML =
      '<div style="position:fixed;inset:0;background:#0a0a0f;' +
      'display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:14px;z-index:6000;">' +
      '<div style="font-size:28px;color:#F6A623;line-height:1;">&#x25C8;</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:20px;' +
      'font-weight:600;color:#e8e2d9;letter-spacing:-0.01em;">Opening feedback...</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.5);">' +
      'Tell us what to change.</div>' +
      '</div>';
  }
  setTimeout(function() {
    _closeClientEditorial();
    if (typeof showChangeInput === 'function') showChangeInput(postId);
  }, 1200);
}
window._editorialChanges = _editorialChanges;

function _edUpdateDots(stripId, dotsId, total) {
  var strip = document.getElementById(stripId);
  var dotsEl = document.getElementById(dotsId);
  if (!strip || !dotsEl) return;
  var idx = Math.round(strip.scrollLeft / 102);
  idx = Math.max(0, Math.min(idx, total - 1));
  var dots = dotsEl.querySelectorAll('div');
  dots.forEach(function(d, i) {
    d.style.background = i === idx ? '#e8e2d9' : '#2a2a2a';
  });
}
window._edUpdateDots = _edUpdateDots;

function _edOpenLightbox(postId, startIdx) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;
  var imgs = Array.isArray(post.images) ? post.images : [];
  if (!imgs.length) return;
  var idx = startIdx || 0;

  var existing = document.getElementById('ed-lightbox');
  if (existing) existing.remove();

  var lb = document.createElement('div');
  lb.id = 'ed-lightbox';
  lb.style.cssText = 'position:fixed;inset:0;z-index:9900;background:#000;' +
    'display:flex;flex-direction:column;';

  lb.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;' +
    'padding:14px 18px;background:rgba(0,0,0,0.8);flex-shrink:0;">' +
    '<button onclick="document.getElementById(\'ed-lightbox\').remove();' +
    'document.body.style.overflow=\'\';" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.12em;text-transform:uppercase;color:#e8e2d9;' +
    'background:transparent;border:none;cursor:pointer;">&#x2190; Close</button>' +
    '<span id="ed-lb-counter" style="font-family:\'IBM Plex Mono\',monospace;' +
    'font-size:8px;color:#555;">' + (idx+1) + ' / ' + imgs.length + '</span>' +
    '<a id="ed-lb-dl" href="' + imgs[idx] + '" download ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.12em;text-transform:uppercase;color:#3ECF8E;' +
    'text-decoration:none;border:1px solid rgba(62,207,142,0.3);' +
    'padding:5px 10px;">&#x2193; Save</a>' +
    '</div>' +
    '<div style="flex:1;display:flex;align-items:center;justify-content:center;' +
    'padding:20px;">' +
    '<img id="ed-lb-img" src="' + imgs[idx] + '" ' +
    'style="max-width:100%;max-height:100%;object-fit:contain;display:block;">' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;' +
    'padding:10px 18px 28px;background:rgba(0,0,0,0.8);flex-shrink:0;">' +
    '<button onclick="_edLbNav(-1)" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;color:#555;' +
    'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);' +
    'width:44px;height:44px;cursor:pointer;">&#x2190;</button>' +
    '<div id="ed-lb-dots" style="display:flex;gap:5px;">' +
    imgs.map(function(u,i){
      return '<div style="width:5px;height:5px;border-radius:50%;background:' +
      (i===idx?'#e8e2d9':'#2a2a2a') + ';"></div>';
    }).join('') +
    '</div>' +
    '<button onclick="_edLbNav(1)" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;color:#555;' +
    'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);' +
    'width:44px;height:44px;cursor:pointer;">&#x2192;</button>' +
    '</div>';

  window._edLbImages = imgs;
  window._edLbIdx = idx;
  document.body.appendChild(lb);
  document.body.style.overflow = 'hidden';

  var tx = 0;
  lb.addEventListener('touchstart', function(e){ tx = e.touches[0].clientX; });
  lb.addEventListener('touchend', function(e){
    var diff = tx - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) _edLbNav(diff > 0 ? 1 : -1);
  });

  var mx = 0;
  var dragging = false;
  lb.addEventListener('mousedown', function(e) {
    mx = e.clientX; dragging = true;
  });
  lb.addEventListener('mouseup', function(e) {
    if (!dragging) return;
    dragging = false;
    var diff = mx - e.clientX;
    if (Math.abs(diff) > 40) _edLbNav(diff > 0 ? 1 : -1);
  });
  lb.addEventListener('mouseleave', function() { dragging = false; });
}
window._edOpenLightbox = _edOpenLightbox;

function _edLbNav(dir) {
  var imgs = window._edLbImages || [];
  var idx = (window._edLbIdx + dir + imgs.length) % imgs.length;
  window._edLbIdx = idx;
  var img = document.getElementById('ed-lb-img');
  var counter = document.getElementById('ed-lb-counter');
  var dl = document.getElementById('ed-lb-dl');
  var dots = document.getElementById('ed-lb-dots');
  if (img) img.src = imgs[idx];
  if (counter) counter.textContent = (idx+1) + ' / ' + imgs.length;
  if (dl) dl.href = imgs[idx];
  if (dots) {
    dots.querySelectorAll('div').forEach(function(d,i){
      d.style.background = i === idx ? '#e8e2d9' : '#2a2a2a';
    });
  }
}
window._edLbNav = _edLbNav;

// ===============================================
// Brief Sheet - full-screen overlay for brief/REQ posts
// ===============================================
function _openBriefSheet(postId) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;

  var existing = document.getElementById('brief-sheet-overlay');
  if (existing) existing.remove();

  var isChitra = (window.effectiveRole || '').toLowerCase() !== 'client';
  var sentTime = '';
  if (post.status_changed_at) {
    var d = new Date((post.status_changed_at || '') + 'Z');
    sentTime = d.toLocaleDateString('en-IN',
      {day:'numeric',month:'short',timeZone:'Asia/Kolkata'}) + ' \xB7 ' +
      d.toLocaleTimeString('en-IN',
      {hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'});
  }

  var overlay = document.createElement('div');
  overlay.id = 'brief-sheet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;' +
    'background:#0a0a0f;overflow-y:auto;-webkit-overflow-scrolling:touch;';

  overlay.innerHTML =
    // Topbar
    '<div style="position:sticky;top:0;z-index:10;' +
    'background:rgba(10,10,15,0.95);backdrop-filter:blur(8px);' +
    'display:flex;align-items:center;justify-content:space-between;' +
    'padding:14px 18px;border-bottom:1px solid rgba(200,168,75,0.15);">' +
    '<button onclick="document.getElementById(\'brief-sheet-overlay\').remove();' +
    'document.body.style.overflow=\'\';" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.5);' +
    'background:transparent;border:none;cursor:pointer;">&#x2190; Back</button>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.18em;text-transform:uppercase;color:#C8A84B;">Brief</div>' +
    '<div style="width:60px;"></div>' +
    '</div>' +

    // Title + meta
    '<div style="padding:24px 18px 20px;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);' +
    'margin-bottom:8px;">Client Request</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:24px;' +
    'font-weight:700;color:#e8e2d9;line-height:1.2;margin-bottom:6px;">' +
    esc(post.title || '') + '</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.04em;color:rgba(255,255,255,0.4);">' +
    esc(sentTime) + '</div>' +
    '</div>' +

    // Brief text
    '<div style="padding:0 18px 24px;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.18em;text-transform:uppercase;' +
    'color:#C8A84B;margin-bottom:10px;">The Brief</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
    'color:#e8e2d9;line-height:1.7;white-space:pre-wrap;">' +
    esc(post.comments || 'No brief text provided.') + '</div>' +
    '</div>' +

    // Reference photos
    (Array.isArray(post.images) && post.images.length ?
      '<div style="padding:0 18px 24px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.18em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.4);margin-bottom:10px;">Reference Photos</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;">' +
      post.images.map(function(url, i) {
        return '<img src="' + url + '" loading="lazy" ' +
        'onclick="_edOpenLightbox(\'' + postId + '\',' + i + ')" ' +
        'style="aspect-ratio:1/1;width:100%;object-fit:cover;' +
        'display:block;cursor:pointer;">';
      }).join('') +
      '</div></div>'
      : '') +

    // Chitra direction input (agency only)
    (isChitra ?
      '<div style="padding:0 18px 24px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.18em;text-transform:uppercase;' +
      'color:#C8A84B;margin-bottom:10px;">Your Direction for Pranav</div>' +
      '<textarea id="brief-direction-' + postId + '" rows="4" ' +
      'placeholder="Add your creative direction, angle, key message..." ' +
      'style="width:100%;background:transparent;border:none;' +
      'border-bottom:1px solid rgba(200,168,75,0.3);color:#e8e2d9;' +
      'font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'padding:8px 0 10px;outline:none;resize:none;line-height:1.7;' +
      'caret-color:#C8A84B;"></textarea>' +
      '</div>' +
      // Assign to Pranav button
      '<div style="padding:0 18px 32px;">' +
      '<button onclick="_assignBriefToPranav(\'' + postId + '\')" ' +
      'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
      'letter-spacing:0.2em;text-transform:uppercase;color:#C8A84B;' +
      'background:rgba(200,168,75,0.06);border:1px solid #C8A84B;' +
      'padding:16px 0;cursor:pointer;' +
      'box-shadow:0 0 14px rgba(200,168,75,0.12);">&#x2192; Assign to Pranav</button>' +
      '</div>'
      :
      // Client view - read only
      '<div style="padding:0 18px 32px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.12em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.35);text-align:center;">' +
      'The team is working on this</div>' +
      '</div>'
    );

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}
window._openBriefSheet = _openBriefSheet;

function _assignBriefToPranav(postId) {
  var direction = (document.getElementById('brief-direction-' + postId) || {}).value || '';
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  var updatedComments = (post ? (post.comments || '') : '');
  if (direction.trim()) {
    updatedComments += '\n\n[CHITRA NOTE] ' + direction.trim();
  }
  apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
    method: 'PATCH',
    body: JSON.stringify({
      stage: 'in_production',
      owner: 'Pranav',
      comments: updatedComments,
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  }).then(function() {
    logActivity({
      post_id: postId,
      actor: 'Chitra',
      actor_role: 'Servicing',
      action: 'Brief assigned to Pranav' +
        (direction.trim() ? ' with direction' : '')
    });
    document.getElementById('brief-sheet-overlay').remove();
    document.body.style.overflow = '';
    showToast('Assigned to Pranav', 'success');
    loadPosts();
  }).catch(function() {
    showToast('Failed - try again', 'error');
  });
}
window._assignBriefToPranav = _assignBriefToPranav;
