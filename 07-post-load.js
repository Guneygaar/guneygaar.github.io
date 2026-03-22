/* ===============================================
   07-post-load.js - Data loading & all render*
=============================================== */
console.log("LOADED:", "07-post-load.js");

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
      new Date(p.status_changed_at) < twoDaysAgo;
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
      new Date(p.status_changed_at) < threeDaysAgo;
  }).length;
  var chitraReady = posts.filter(function(p) {
    return p.stage === 'ready';
  }).length;
  var chitraCount = chitraReady + chitraOverdue;

  // FIX 9: Approval = awaiting_approval still with client (<3 days)
  var approvalCount = posts.filter(function(p) {
    return p.stage === 'awaiting_approval' && (
      !p.status_changed_at ||
      new Date(p.status_changed_at) >= threeDaysAgo
    );
  }).length;

  // FIX 10: Input = awaiting_brand_input still with client (<3 days)
  var inputCount = posts.filter(function(p) {
    return p.stage === 'awaiting_brand_input' && (
      !p.status_changed_at ||
      new Date(p.status_changed_at) >= threeDaysAgo
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
    var cTotal = chitraCount;
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
    var clTotal = approvalCount + inputCount;
    var clPrefix = clTotal > 0 ? '-' : '\u00b7';
    var clColor = clTotal > 0 ? 'var(--red)' : 'var(--muted)';
    var clMsg = approvalCount > 0 && inputCount > 0 ? dashPad(approvalCount) + ' approval \u00b7 ' + dashPad(inputCount) + ' input' : approvalCount > 0 ? dashPad(approvalCount) + ' awaiting approval' : inputCount > 0 ? dashPad(inputCount) + ' input missing' : 'Client sorted \u00b7 good week';
    var elClPre = document.getElementById('metric-client-prefix');
    var elClNum = document.getElementById('metric-client-num');
    var elClMsg = document.getElementById('metric-client-msg');
    if (elClPre) { elClPre.textContent = clPrefix; elClPre.style.color = clColor; }
    if (elClNum) { elClNum.textContent = dashPad(clTotal); elClNum.style.color = clColor; }
    var clMsgColor = clTotal > 0 ? '#cc3a3a' : '#aaa';
    if (elClMsg) { elClMsg.textContent = clMsg; elClMsg.style.color = clMsgColor; }

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
      var inProd = (window.allPosts || []).filter(function(p) {
        return p.stage === 'in_production';
      });
      if (inProd.length > 0) {
        navigateWithFilter('pipeline', ['in_production']);
      } else {
        if (typeof openNewPostModal === 'function') {
          openNewPostModal();
        } else {
          showToast('No posts in production \u00b7 create one', 'info');
        }
      }
    };
    if (rowChitra) rowChitra.onclick = function() {
      var data = window._lastScoreboardData || {};
      var total = (data.chitraCount || 0) + (data.chitraOverdue || 0);
      if (total === 0) {
        showToast('All dispatched - nothing pending', 'success');
      } else {
        navigateWithFilter('pipeline', ['ready']);
      }
    };
    if (rowClient) rowClient.onclick = function() {
      var data = window._lastScoreboardData || {};
      var approvals = data.approvalCount || 0;
      var inputs = data.inputCount || 0;
      if (approvals === 0 && inputs === 0) {
        showToast('Client all clear', 'success');
        return;
      }
      if (inputs > approvals) {
        navigateWithFilter('pipeline', ['awaiting_brand_input']);
      } else {
        navigateWithFilter('pipeline', ['awaiting_approval']);
      }
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
        text: 'Unsort the pipeline \u00b7 runway at ' + dashPad(_rc),
        cls: 'dash-task-urgent',
        onclick: "navigateWithFilter('pipeline',['in_production'])"
      });
    }
    if (_co > 0) {
      urgentItems.push({
        text: 'Chase client \u00b7 ' + dashPad(_co) + ' post' + (_co > 1 ? 's' : '') + ' overdue',
        cls: 'dash-task-urgent',
        onclick: "navigateWithFilter('pipeline',['awaiting_approval'])"
      });
    }
    if (_pd <= -15) {
      urgentItems.push({
        text: dashPad(Math.abs(_pd)) + ' posts to build \u00b7 check in with Pranav',
        cls: 'dash-task-urgent dash-task-amber',
        onclick: "navigateWithFilter('pipeline',['in_production'])"
      });
    }

    // Only show empty state when system is calm
    if (!filtered.length && !urgentItems.length) {
      if (_rc > 6 && _pd > -8 && _co === 0 && _ac === 0) {
        var emptyMessages = {
          'Admin':     'All sorted \u00b7 nothing needs you',
          'Servicing': 'All sorted \u00b7 nothing to dispatch',
          'Creative':  'All sorted \u00b7 keep creating',
          'Client':    'All sorted \u00b7 nothing from us right now'
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

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var item = filtered[i];
    var tid = item.taskId || 'auto';
    html += '<div class="dash-task-row" onclick="toggleDashTask(this, \'' + tid + '\')">';
    html += '<div class="dash-task-cb"></div>';
    html += '<span class="dash-task-text">' + esc(item.title) + '</span>';
    html += '<span class="dash-task-who">' + esc(item.assignedTo || '') + '</span>';
    html += '</div>';
  }

  // Append urgent items after manual tasks
  for (var u = 0; u < urgentItems.length; u++) {
    var ui = urgentItems[u];
    html += '<div class="' + ui.cls + '" onclick="' + ui.onclick + '">' + ui.text + '</div>';
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
      html += '<div style="display:flex;align-items:stretch;border-bottom:1px solid var(--dotline);">';
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
        taskId: getPostId(fpPost) || 'auto'
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
        p.status_changed_at && new Date(p.status_changed_at) < threeDaysAgo;
    }).sort(function(a, b) {
      return new Date(a.status_changed_at || 0) - new Date(b.status_changed_at || 0);
    });
    for (var c = 0; c < overdueApprovalPosts.length && items.length < 7; c++) {
      var op = overdueApprovalPosts[c];
      items.push({
        title: 'Chase client - ' + getTitle(op),
        assignedTo: 'Chitra',
        taskId: 'auto'
      });
    }
    var overdueBrandPosts = allPosts.filter(function(p) {
      return p.stage === 'awaiting_brand_input' &&
        p.status_changed_at && new Date(p.status_changed_at) < threeDaysAgo;
    }).sort(function(a, b) {
      return new Date(a.status_changed_at || 0) - new Date(b.status_changed_at || 0);
    });
    for (var bi = 0; bi < overdueBrandPosts.length && items.length < 8; bi++) {
      var bp = overdueBrandPosts[bi];
      items.push({
        title: 'Brand input pending - ' + getTitle(bp),
        assignedTo: 'Chitra',
        taskId: 'auto'
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
  try { _renderDashboardInner(); } catch(e) { console.error('[PCS] renderDashboard crash:', e); }
}
function _renderDashboardInner() {
  var el = document.getElementById('pcs-dashboard');
  if (!el) return;
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
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
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
      var clientLogs = logs.filter(function(l) {
        return l.actor === 'Client' ||
               l.new_stage === 'scheduled' ||
               l.old_stage === 'awaiting_approval';
      });
      if (clientLogs.length) {
        var clLast = new Date(clientLogs[0].created_at);
        var clDiff = Math.floor((today - clLast) / (1000 * 60 * 60 * 24));
        var clLastStr = clLast.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        if (clDiff === 0) {
          clEl.innerHTML = '<span class="dms-good">\u00b7 approved today</span>';
        } else if (clDiff === 1) {
          clEl.innerHTML = '<span class="dms-good">\u00b7 approved yesterday</span>';
        } else if (clDiff >= 5) {
          clEl.innerHTML = '<span class="dms-idle">\u00b7 idle ' + clDiff + ' days \u00b7 last approved ' + clLastStr + '</span>';
        } else {
          clEl.innerHTML = '<span class="dms-muted">\u00b7 last approved ' + clLastStr + '</span>';
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
  var show = upcoming.slice(0, 3);
  if (!show.length) {
    listEl.innerHTML = '<div style="font-family:var(--mono);font-size:8px;color:#888;">Nothing scheduled yet</div>';
    return;
  }
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var html = '';
  for (var i = 0; i < show.length; i++) {
    var p = show[i];
    var d = new Date(p.target_date + 'T00:00:00');
    var dateStr = days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
    var title = esc(p.title || 'Untitled');
    var pid = esc(getPostId(p));
    html += '<div style="display:flex;align-items:baseline;gap:0;margin-bottom:5px;cursor:pointer;transition:background 0.1s;" onclick="if(window.libOpenPostCard)window.libOpenPostCard(\'' + pid + '\')">' +
      '<span style="font-family:var(--mono);font-size:9px;color:#444;margin-right:8px;">&#8250;</span>' +
      '<span style="font-family:var(--mono);font-size:8px;color:var(--c-cyan);min-width:74px;flex-shrink:0;">' + dateStr + '</span>' +
      '<span style="font-family:var(--sans);font-size:14px;font-weight:500;color:#ccc;">' + title + '</span>' +
      '</div>';
  }
  listEl.innerHTML = html;
}

function _updateTodaysFocus(allP) {
  var rowEl = document.getElementById('dash-focus-row');
  if (!rowEl) return;
  var todayStr = new Date().toISOString().slice(0, 10);
  var focus = allP.filter(function(p) {
    return p.stage === 'scheduled' && p.target_date && p.target_date === todayStr;
  });
  if (!focus.length) {
    focus = allP.filter(function(p) {
      return p.stage === 'in_production' || p.stage === 'ready' || p.stage === 'awaiting_approval';
    }).sort(function(a, b) {
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    });
  }
  if (focus.length) {
    var f = focus[0];
    var t = f.title || 'Untitled';
    if (t.length > 36) t = t.slice(0, 36) + '...';
    var cfg = STAGE_META[f.stage] || {};
    var metaParts = [];
    // Calculate waiting days
    var changed = f.status_changed_at || f.updated_at || f.created_at;
    if (changed) {
      var waitDays = Math.floor((Date.now() - new Date(changed).getTime()) / 86400000);
      if (waitDays > 0) metaParts.push('waiting ' + waitDays + ' day' + (waitDays > 1 ? 's' : ''));
    }
    if (f.owner) metaParts.push(f.owner.toLowerCase());
    metaParts.push(cfg.label || f.stage);
    if (focus.length > 1) metaParts.push('+' + (focus.length - 1) + ' more');
    var pid = esc(getPostId(f));
    rowEl.innerHTML =
      '<div style="display:flex;align-items:baseline;gap:0;cursor:pointer;transition:background 0.1s;" onclick="if(window.libOpenPostCard)window.libOpenPostCard(\'' + pid + '\')">' +
      '<span style="font-family:var(--mono);font-size:9px;color:#444;margin-right:8px;">&#8250;</span>' +
      '<span style="font-family:var(--sans);font-size:14px;font-weight:500;color:#ccc;">' + esc(t) + '</span>' +
      '</div>' +
      '<div style="font-family:var(--mono);font-size:8px;color:#777;margin-top:2px;padding-left:17px;">' + esc(metaParts.join(' \xB7 ')) + '</div>';
  } else {
    rowEl.innerHTML =
      '<div style="font-family:var(--sans);font-size:14px;font-weight:500;color:#ccc;">Clear runway</div>' +
      '<div style="font-family:var(--mono);font-size:8px;color:#777;">nothing needs attention today</div>';
  }
}

function _updateLastMove(allP) {
  var textEl = document.getElementById('dash-move-text');
  if (!textEl) return;
  var moved = allP.filter(function(p) {
    return p.status_changed_at;
  }).sort(function(a, b) {
    return new Date(b.status_changed_at) - new Date(a.status_changed_at);
  });
  if (moved.length) {
    var last = moved[0];
    var t = last.title || 'Untitled';
    if (t.length > 36) t = t.slice(0, 36) + '...';
    var cfg = STAGE_META[last.stage] || {};
    var ago = _timeAgo(last.status_changed_at);
    var text = esc(t) + ' \xB7 ' + esc(cfg.label || last.stage) + ' \xB7 ' + esc(ago);
    var pid = getPostId(last);
    var clickAttr = pid ? ' onclick="if(window.libOpenPostCard)window.libOpenPostCard(\'' + esc(pid) + '\')" style="font-family:var(--mono);font-size:8px;color:#888;line-height:1.6;cursor:pointer;transition:background 0.1s;"' : ' style="font-family:var(--mono);font-size:8px;color:#888;line-height:1.6;"';
    textEl.innerHTML = '<div' + clickAttr + '>' + text + '</div>';
  } else {
    textEl.innerHTML = '<div style="font-family:var(--mono);font-size:8px;color:#888;line-height:1.6;">No moves yet</div>';
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
  el.style.fontFamily = 'var(--sans)';
  el.style.fontSize = '13px';
  el.style.color = '#888';
  el.style.fontStyle = 'italic';
  el.style.lineHeight = '1.5';
  var todayStr = new Date().toISOString().slice(0, 10);
  var inProd = allP.filter(function(p) { return p.stage === 'in_production'; }).length;
  var ready = allP.filter(function(p) { return p.stage === 'ready'; }).length;
  var scheduled = allP.filter(function(p) {
    return p.stage === 'scheduled' && p.target_date && p.target_date >= todayStr;
  }).length;
  var awaiting = allP.filter(function(p) { return p.stage === 'awaiting_approval'; }).length;
  var stale = allP.filter(function(p) {
    if (!p.status_changed_at) return false;
    return (Date.now() - new Date(p.status_changed_at).getTime()) > 3 * 86400000 &&
           p.stage !== 'published' && p.stage !== 'parked' && p.stage !== 'rejected';
  }).length;

  var lines = [];
  if (scheduled === 0) {
    lines.push('runway is empty -- nothing scheduled ahead');
  } else if (scheduled < 3) {
    lines.push('only ' + scheduled + ' in the runway -- thin buffer');
  }
  if (inProd > 4) {
    lines.push(inProd + ' posts stuck in production');
  }
  if (awaiting > 2) {
    lines.push(awaiting + ' waiting on approval -- bottleneck?');
  }
  if (stale > 0) {
    lines.push(stale + ' post' + (stale > 1 ? 's' : '') + ' untouched 3+ days');
  }
  if (ready > 3 && scheduled === 0) {
    lines.push(ready + ' ready but none scheduled -- dispatch gap');
  }
  if (!lines.length) {
    lines.push('pipeline is clean -- no flags');
  }
  el.textContent = lines.join(' / ');
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
  var id     = getPostId(p);
  var title  = getTitle(p);
  var stage  = p.stage || '';
  var pillar = getPillarShort(p.contentPillar);
  var sk     = _pipelineStageKey(stage);

  var d = parseDate(p.targetDate);
  var dateStr = formatDateShort(p.targetDate);
  var today = new Date();
  today.setHours(0,0,0,0);
  var isToday = d && d.toDateString() === today.toDateString();
  var _noOverdueStages = ['published', 'parked', 'rejected'];
  var isOverdue = d && !isToday && d < today && _noOverdueStages.indexOf(stage) === -1;

  var cardCls = 'post-card';
  if (isOverdue) cardCls += ' overdue';
  if (isToday) cardCls += ' due-today';

  var dateCls = 'pc-date';
  if (isOverdue) dateCls += ' overdue';
  else if (isToday) dateCls += ' today';
  else if (!d) dateCls += ' nodate';

  var dateDisplay = dateStr || '-- --';

  // Responsibility badge
  var badgeCls = 'resp-badge';
  var badgeText = '';
  if (sk === 'production')  { badgeCls += ' p'; badgeText = 'P'; }
  else if (sk === 'ready')  { badgeCls += ' ch'; badgeText = 'Ch'; }
  else if (sk === 'input')  { badgeCls += ' cl-input'; badgeText = 'Cl'; }
  else if (sk === 'approval') { badgeCls += ' cl-approval'; badgeText = 'Cl'; }
  else if (sk === 'scheduled') { badgeCls += ' sched'; badgeText = 'Ch'; }
  else if (sk === 'published') { badgeCls += ' pub'; badgeText = 'ok'; }
  else if (sk === 'parked') { badgeCls += ' parked'; badgeText = 'P'; }
  else if (sk === 'rejected') { badgeCls += ' rejected'; badgeText = 'X'; }

  // Status dot
  var dotCls = 'status-dot';
  if (sk) dotCls += ' sd-' + sk;

  // Chase button for awaiting_approval posts waiting >= 3 days
  var chaseHtml = '';
  if (stage === 'awaiting_approval') {
    var now = new Date();
    var changed = p.status_changed_at ? new Date(p.status_changed_at) : null;
    var daysWaiting = changed ? Math.floor((now - changed) / (1000*60*60*24)) : 0;
    if (daysWaiting >= 3) {
      var sentDate = changed ? changed.toLocaleDateString('en-GB', {day:'numeric', month:'short'}) : 'recently';
      var chaseMsg = 'Hi! Following up on ' + title + ' sent for approval on ' + sentDate + '. Please review when you get a chance \uD83D\uDE4F';
      chaseHtml = '<div class="chase-btn" onclick="event.stopPropagation(); copyChase(\'' + encodeURIComponent(chaseMsg) + '\')">' +
        '<span class="chase-arrow">-></span>' +
        '<span class="chase-label">Chase</span>' +
        '<span class="chase-days">' + daysWaiting + 'd</span>' +
        '</div>';
    }
  }

  return '<div class="' + cardCls + '" id="upc-' + esc(id) + '" data-post-id="' + esc(id) + '" data-stage="' + esc(stage) + '" data-list="' + esc(listKey||'') + '">' +
    '<span class="' + dateCls + '">' + esc(dateDisplay) + '</span>' +
    '<span class="pc-body">' +
      '<span class="pc-title">' + esc(title) + '</span>' +
      (pillar ? '<span class="pc-meta">' + esc(pillar) + '</span>' : '') +
    '</span>' +
    '<span class="pc-right">' +
      '<span class="' + badgeCls + '">' + badgeText + '</span>' +
      '<span class="' + dotCls + '"></span>' +
    '</span>' +
    chaseHtml +
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
      <button class="stage-chip${active}${warn}" onclick="filterTasksByChip('${bucket.key}')">
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

  document.querySelectorAll('.post-card[data-stage="ready"]').forEach(function(card) {
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
}
function updatePipelineHeader() {
  updatePipelineNarrative();
}

function updatePipelineNarrative() {
  var el = document.getElementById('pipeline-narrative');
  if (!el) return;
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var todayStr = new Date().toISOString().split('T')[0];
  var activePosts = posts.filter(function(p) {
    return ['published','parked','rejected'].indexOf(p.stage) === -1;
  });
  // 1. Check overdue
  var overdue = null;
  var maxDays = 0;
  posts.forEach(function(p) {
    var d = p.target_date || p.targetDate;
    if (!d) return;
    if (d < todayStr && ['published','parked','rejected','scheduled'].indexOf(p.stage) === -1) {
      var diff = Math.floor((new Date(todayStr) - new Date(d)) / 86400000);
      if (diff > maxDays) { maxDays = diff; overdue = p; }
    }
  });
  if (overdue) {
    el.textContent = (overdue.title || 'Untitled') + ' ' + maxDays + 'd overdue';
    return;
  }
  // 2. Approval count >= 5
  var approvalCount = posts.filter(function(p) {
    return p.stage === 'awaiting_approval';
  }).length;
  if (approvalCount >= 5) {
    el.textContent = approvalCount + ' posts waiting on approval';
    return;
  }
  // 3. Pranav idle >= 3 days
  var pranavPosts = posts.filter(function(p) {
    return (p.owner || '').toLowerCase() === 'pranav' && ['published','parked','rejected'].indexOf(p.stage) === -1;
  });
  var pranavIdle = 0;
  pranavPosts.forEach(function(p) {
    var u = p.updated_at || p.created_at;
    if (u) {
      var diff = Math.floor((new Date() - new Date(u)) / 86400000);
      if (diff > pranavIdle) pranavIdle = diff;
    }
  });
  if (pranavIdle >= 3) {
    el.textContent = 'Pranav idle ' + pranavIdle + 'd - pipeline slowing';
    return;
  }
  // 4. Default
  el.textContent = 'Pipeline sorted - ' + activePosts.length + ' posts active';
}

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
  const base = allPosts.filter(p => {
    return PIPELINE_RENDER_ORDER.includes(p.stage || '');
  });
  var stageFiltered = activeFilter && Array.isArray(activeFilter)
    ? base.filter(p => activeFilter.includes(p.stage || ''))
    : base;

  // -- Person filter --
  var source = stageFiltered;
  if (_activePerson === 'client') {
    source = stageFiltered.filter(function(p) { return p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input'; });
  } else if (_activePerson === 'chitra') {
    source = stageFiltered.filter(function(p) { return p.stage === 'ready' || p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input'; });
  } else if (_activePerson === 'pranav') {
    source = stageFiltered.filter(function(p) { return p.stage === 'in_production'; });
  }

  // -- PRIORITY SORT: daysInStage DESC -> targetDate ASC -> created_at ASC --
  function prioritySort(posts) {
    return posts.slice().sort((a, b) => {
      const dA = daysInStage(a) || 0, dB = daysInStage(b) || 0;
      if (dB !== dA) return dB - dA; // longest in stage first
      const tA = parseDate(a.targetDate), tB = parseDate(b.targetDate);
      if (tA && tB) return tA - tB; // nearest date first
      if (tA) return -1; if (tB) return 1;
      const cA = a.created_at || a.createdAt || '', cB = b.created_at || b.createdAt || '';
      return cA < cB ? -1 : cA > cB ? 1 : 0; // oldest first
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
    const posts   = prioritySort(grouped[stage]);
    const listKey = `pipeline-${stage.toLowerCase().replace(/\s+/g,'-')}`;
    _postLists[listKey] = posts;
    const { label } = stageStyle(stage);
    const sk = _pipelineStageKey(stage);
    const cards = posts.map((p, i) => {
      const card = buildPipelineCard(p, listKey);
      if (isFirstCard && activeFilter) {
        isFirstCard = false;
        return card.replace('class="post-card', 'class="post-card pc-focus');
      }
      return card;
    }).join('');
    var selectBtn = (stage === 'ready')
      ? '<button class="batch-select-btn" id="batch-select-btn" onclick="event.stopPropagation();toggleBatchMode()">Select</button>'
      : '';
    // Chase All button for awaiting_approval group
    var chaseAllBtn = '';
    if (stage === 'awaiting_approval') {
      var nowCA = new Date();
      var threeDaysAgoCA = new Date();
      threeDaysAgoCA.setDate(threeDaysAgoCA.getDate() - 3);
      var overdueCount = posts.filter(function(p) {
        if (!p.status_changed_at) return true;
        return new Date(p.status_changed_at) < threeDaysAgoCA;
      }).length;
      if (overdueCount >= 1) {
        chaseAllBtn = '<button class="chase-all-btn" onclick="chaseAll()" id="chase-all-btn">Chase All</button>';
      }
    }
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
  const inputPosts = allPosts.filter(p => p.stage === 'awaiting_brand_input');
  const inputCount = document.getElementById('client-input-count');
  if (inputCount) inputCount.textContent = inputPosts.length;
  const inputItems = document.getElementById('client-input-items');
  if (inputItems) {
    if (!inputPosts.length) { inputItems.innerHTML = `<div class="empty-state"><div class="empty-icon">?</div><p>All clear - nothing needed from you right now.</p></div>`; }
    else {
      inputItems.innerHTML = inputPosts.map(p => {
        const id   = getPostId(p);
        const days = daysInStage(p);
        const sl   = staleLabel(days, p.stage);
        const sc   = staleClass(days);
        const waitingHtml = sl ? `<div class="client-item-waiting ${sc}">Waiting ${sl} - we need your input</div>` : `<div class="client-item-waiting amber">Waiting for your input</div>`;
        return `<div class="client-input-item"><div class="client-item-title">${esc(getTitle(p))}</div><div class="client-item-need">${esc(p.comments||'We need your input to move this post forward.')}</div>${waitingHtml}<div class="client-item-actions"><label class="btn-client-upload" id="upload-label-${esc(id)}">? Upload Here<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" style="display:none" onchange="handleClientUpload(this, '${esc(id)}')"></label><button class="btn-client-ack" onclick="clientAcknowledge('${esc(id)}')">I'll send it on WhatsApp</button></div><div id="upload-confirm-${esc(id)}"></div></div>`;
      }).join('');
    }
  }
  const approvalPosts = allPosts.filter(p => p.stage === 'awaiting_approval');
  const approvalCount = document.getElementById('client-approval-count');
  if (approvalCount) approvalCount.textContent = approvalPosts.length;
  const approvalItems = document.getElementById('client-approval-items');
  if (approvalItems) {
    if (!approvalPosts.length) { approvalItems.innerHTML = `<div class="empty-state"><div class="empty-icon">?</div><p>Nothing waiting for approval right now.</p></div>`; }
    else {
      approvalItems.innerHTML = approvalPosts.map(p => {
        const id          = getPostId(p);
        const postLink    = getPostLink(p);
        const approvalUrl = `${window.location.origin}/p/${id}`;
        const waText      = encodeURIComponent(`LinkedIn post ready for review\n\nPreview and approve here:\n${approvalUrl}\n\nTakes 5 seconds.`);
        const waLink      = `https://wa.me/?text=${waText}`;
        const preview     = postLink ? `<a href="${esc(postLink)}" target="_blank" rel="noopener" style="display:block;width:100%;height:100px;background:var(--surface3);border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:13px;font-weight:600;text-decoration:none;margin-bottom:var(--sp-3)">View Post Design ^</a>` : `<div class="approval-item-preview">No preview - review brief above</div>`;
        return `<div class="client-approval-item" id="apv-item-${esc(id)}"><div class="client-item-title" style="margin-bottom:var(--sp-3)">${esc(getTitle(p))}</div>${preview}<div class="approval-item-actions"><button class="btn-approve-green" onclick="clientApprove('${esc(id)}', this)">OK Approve</button><button class="btn-revise-outline" onclick="showChangeInput('${esc(id)}')">? Changes</button></div><div class="change-input-wrap" id="change-wrap-${esc(id)}"><textarea class="change-textarea" id="change-text-${esc(id)}" placeholder="What would you like changed? Be as specific as possible..." rows="3"></textarea><button class="btn-send-changes" onclick="submitClientChanges('${esc(id)}')">Send Change Request</button></div><div class="approval-confirmed" id="approved-confirm-${esc(id)}">OK Approved! The team has been notified.</div><a href="${waLink}" target="_blank" rel="noopener" class="btn-whatsapp"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>Share on WhatsApp</a></div>`;
      }).join('');
    }
  }
  renderClientApproved();
}

function renderClientApproved() {
  // Hide published section on Client home  -  still visible in Library
  const pubSection = document.getElementById('client-published-section');
  if (pubSection && effectiveRole === 'Client') { pubSection.style.display = 'none'; return; }
  if (pubSection) pubSection.style.display = '';
  const published = allPosts.filter(p => p.stage === 'published');
  const label     = document.getElementById('client-approved-label');
  if (label) label.textContent = published.length;
  const tbody = document.getElementById('client-approved-tbody');
  if (!tbody) return;
  if (!published.length) { tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">?</div><p>No published posts yet.</p></div></td></tr>`; return; }
  tbody.innerHTML = published.map(p => { const link = getPostLink(p); return `<tr><td>${esc(getTitle(p))}</td><td class="mono">${displayDate(p.targetDate)}</td><td class="post-link-cell">${link?`<a href="${esc(link)}" target="_blank" rel="noopener">^ View</a>`:'-'}</td></tr>`; }).join('');
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
(document.getElementById('dashboard-view') || document).addEventListener('click', function _cardClickDelegate(e) {
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
    return new Date(p.status_changed_at) < threeDaysAgo;
  });

  if (overduePosts.length === 0) return;

  var lines = overduePosts.map(function(p) {
    var sentDate = 'recently';
    if (p.status_changed_at) {
      var d = new Date(p.status_changed_at);
      sentDate = d.toLocaleDateString('en-GB', {day:'numeric', month:'short'});
    }
    return '- ' + (p.title || 'Untitled') + ' (sent ' + sentDate + ')';
  });

  var msg = 'Hi! Following up on ' + overduePosts.length + ' posts awaiting approval:\n' + lines.join('\n') + '\nPlease review when you get a chance \uD83D\uDE4F';

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
