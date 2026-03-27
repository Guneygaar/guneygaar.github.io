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
    // Fetch comment counts for all posts
    apiFetch('/post_comments?select=post_id')
      .then(function(rows) {
        if (!Array.isArray(rows)) return;
        var counts = {};
        rows.forEach(function(r) {
          if (r.post_id) {
            counts[r.post_id] = (counts[r.post_id] || 0) + 1;
          }
        });
        (allPosts || []).forEach(function(p) {
          p._commentCount = counts[p.post_id] || 0;
        });
        scheduleRender();
      }).catch(function(){});
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
    const allowedStages =
      'awaiting_approval,awaiting_brand_input,published';
    const data  = await apiFetch(
      '/posts?stage=in.(' + allowedStages +
      ')&select=*&order=created_at.desc'
    );
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
window._tokenRefreshTimer = null;

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
  if (!window._tokenRefreshTimer) {
    window._tokenRefreshTimer = setInterval(async () => {
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
  clearInterval(window._tokenRefreshTimer);
  window._tokenRefreshTimer = null;
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
window._postLists = {};

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


// -- Task stage chip filter ---------------------
window._taskFilter = null; // null = show all, string = bucket key

function renderTaskStageChips() {
  const el = document.getElementById('task-stage-chips');
  if (!el) return;
  const buckets = ROLE_BUCKETS[effectiveRole];
  if (!buckets || !buckets.length) { el.innerHTML = ''; return; }

  const chips = buckets.map(bucket => {
    const count = allPosts.filter(p =>
      bucket.stages.includes(p.stage || '')
    ).length;
    const active = window._taskFilter === bucket.key ? ' chip-active' : '';
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
  window._taskFilter = window._taskFilter === bucketKey ? null : bucketKey;
  renderTaskStageChips();
  _renderFilteredTasks();
}

function _renderFilteredTasks() {
  const container = document.getElementById('tasks-container');
  if (!container) return;
  const buckets = ROLE_BUCKETS[effectiveRole];
  if (!buckets) return;

  if (!window._taskFilter) {
    // Show all buckets
    renderTasks();
    return;
  }

  const bucket = buckets.find(b => b.key === window._taskFilter);
  if (!bucket) { renderTasks(); return; }

  const posts = allPosts.filter(p =>
    bucket.stages.includes(p.stage || '')
  );
  const listKey = `tasks-${bucket.key}`;
  window._postLists[listKey] = posts;

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
  if (window._taskFilter) { _renderFilteredTasks(); return; }

  const container = document.getElementById('tasks-container');
  if (!container) return;
  const buckets = ROLE_BUCKETS[effectiveRole];
  if (!buckets) {
    const posts = getMyTasks();
    window._postLists['tasks'] = posts;
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
    window._postLists[listKey] = posts;
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
  if (window._batchMode && card.dataset.stage === 'ready') {
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

// ===============================================
// Chase functions
// ===============================================

// -- Shared lightbox (used by client editorial + brief sheet) --
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

// ===============================================
// Brief Sheet - full-screen overlay for brief/REQ posts
// ===============================================
function _openBriefSheet(postId) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;

  var existing = document.getElementById('brief-sheet-overlay');
  if (existing) existing.remove();

  var _role = (window.effectiveRole || '').toLowerCase();
  var _isClient = _role === 'client';
  var _isPranav = _role === 'creative' ||
    _role === 'pranav' ||
    (window.currentUserEmail || '').toLowerCase().includes('pranav');
  var _isChitra = !_isClient && !_isPranav;
  var _isBriefDone = (post.stage || '') === 'brief_done';
  var sentTime = '';
  if (post.status_changed_at && post.status_changed_at !== 'null') {
    var _d = new Date((post.status_changed_at || '') + 'Z');
    if (!isNaN(_d.getTime())) {
      var _date = _d.toLocaleDateString('en-IN',
        {day:'numeric',month:'short',timeZone:'Asia/Kolkata'});
      var _time = _d.toLocaleTimeString('en-IN',
        {hour:'numeric',minute:'2-digit',hour12:true,
        timeZone:'Asia/Kolkata'});
      sentTime = _date + ' ' + _time;
    }
  }

  var rawComments = post.comments || '';
  var contentType = '';
  var typeMatch = rawComments.match(/\[Type:\s*([^\]]+)\]/);
  if (typeMatch) {
    contentType = typeMatch[1].trim();
    rawComments = rawComments.replace(/\s*\[Type:[^\]]+\]/, '').trim();
  }
  var briefText = rawComments;
  briefText = briefText.replace(/^\[URGENT\]\s*/, '').trim();

  var chitraNote = '';
  var chitraMatch = briefText.match(/\[CHITRA NOTE\]([\s\S]*)/i);
  if (chitraMatch) {
    chitraNote = chitraMatch[1].trim();
    briefText = briefText.replace(/\[CHITRA NOTE\][\s\S]*/i, '').trim();
  }

  var _isAssignedToPranav =
    (post.owner || '').toLowerCase() === 'pranav' &&
    !_isBriefDone;
  var _hasLinkedPost = !!(post.linked_post_id);
  var linkedPost = null;
  if (_hasLinkedPost) {
    linkedPost = (allPosts || []).find(function(p) {
      return p.post_id === post.linked_post_id;
    });
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
    '<div style="padding:28px 18px 0;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);' +
    'margin-bottom:8px;">Brief Title</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:24px;' +
    'font-weight:700;color:#e8e2d9;line-height:1.2;margin-bottom:10px;">' +
    esc(post.title || '') + '</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.04em;color:rgba(255,255,255,0.4);">' +
    esc(sentTime) + '</div>' +
    '</div>' +

    // Brief Done status banner
    (_isBriefDone ?
      '<div style="padding:8px 18px;background:rgba(200,168,75,0.08);' +
      'border-left:3px solid #C8A84B;margin:0 0 4px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#C8A84B;">' +
      'Brief Closed</div>' +
      '</div>'
      : '') +

    // Linked post info (if linked)
    (_hasLinkedPost && linkedPost ?
      '<div style="padding:12px 18px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.2em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.4);margin-bottom:8px;">Linked Post</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
      'padding:12px 14px;border:1px dashed rgba(200,168,75,0.25);">' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'font-weight:600;color:#e8e2d9;">' + esc(linkedPost.title) + '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);">' +
      esc((linkedPost.stage || '').replace(/_/g,' ')) + '</div>' +
      '</div></div>'
      : '') +

    // Divider
    '<div style="height:1px;background:rgba(200,168,75,0.12);margin:0 18px;"></div>' +

    // Content type (extracted from comments)
    (contentType ?
      '<div style="padding:16px 18px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.2em;text-transform:uppercase;' +
      'color:#C8A84B;margin-bottom:10px;display:block;">Content Type</div>' +
      '<div style="display:inline-flex;align-items:center;' +
      'border:1px dashed rgba(200,168,75,0.3);padding:5px 10px;">' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
      'letter-spacing:0.1em;text-transform:uppercase;' +
      'color:#e8e2d9;font-weight:500;">' + esc(contentType) + '</span>' +
      '</div></div>' +
      '<div style="height:1px;background:rgba(200,168,75,0.12);margin:0 18px;"></div>'
      : '') +

    // Brief text
    '<div style="padding:0 18px 24px;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.18em;text-transform:uppercase;' +
    'color:#C8A84B;margin-bottom:10px;">The Brief</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
    'color:#e8e2d9;line-height:1.7;white-space:pre-wrap;">' +
    esc(briefText || 'No brief text provided.') + '</div>' +
    '</div>' +

    // Chitra Note section
    (chitraNote ?
      '<div style="height:1px;background:rgba(200,168,75,0.12);margin:0 18px;"></div>' +
      '<div style="padding:16px 18px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.2em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:8px;">Direction from Chitra</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'color:rgba(255,255,255,0.75);line-height:1.65;font-style:italic;">' +
      esc(chitraNote) + '</div>' +
      '</div>'
      : '') +

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

    // Role-based bottom action (state machine)
    (function() {
      var _viewPostBtn = (_hasLinkedPost && linkedPost) ?
        '<div style="padding:0 18px 32px;">' +
        '<button onclick="(function(){' +
        'var o=document.getElementById(\'brief-sheet-overlay\');' +
        'if(o)o.remove();' +
        'document.body.style.overflow=\'\';' +
        'setTimeout(function(){openPCS(\'' +
        esc(linkedPost.post_id) + '\',\'\');},150);' +
        '})()" ' +
        'style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
        'color:#3ECF8E;background:rgba(62,207,142,0.06);' +
        'border:1px solid #3ECF8E;padding:16px 0;cursor:pointer;">' +
        '&#x2192; View Post</button>' +
        '</div>' : '';
      var _reopenBtn =
        '<div style="padding:0 18px 32px;">' +
        '<button onclick="_reopenBrief(\'' + postId + '\')" ' +
        'style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.4);background:transparent;' +
        'border:1px solid rgba(255,255,255,0.12);' +
        'padding:14px 0;cursor:pointer;">&#x21BA; Reopen Brief</button>' +
        '</div>';
      var _closeBtn =
        '<div style="padding:12px 18px 0;">' +
        '<button onclick="_closeBriefConfirm(\'' + postId + '\')" ' +
        'style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.4);background:transparent;' +
        'border:1px solid rgba(255,255,255,0.12);' +
        'padding:14px 0;cursor:pointer;">&#x2715; Close Brief</button>' +
        '</div>';
      var _readOnly =
        '<div style="padding:0 18px 32px;">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
        'letter-spacing:0.12em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.35);text-align:center;">' +
        'The team is working on this</div>' +
        '</div>';

      // STATE: brief_done
      if (_isBriefDone) {
        return _viewPostBtn +
          (_isChitra ? _reopenBtn : '');
      }
      // STATE: has linked post (post already created)
      if (_hasLinkedPost && linkedPost) {
        return _viewPostBtn +
          (_isChitra ? _closeBtn : '');
      }
      // STATE: assigned to Pranav, no linked post yet
      if (_isAssignedToPranav) {
        if (_isChitra) {
          return '<div style="padding:0 18px 32px;">' +
            '<div style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
            'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
            'color:rgba(255,255,255,0.4);background:transparent;' +
            'border:1px solid rgba(255,255,255,0.1);' +
            'padding:14px 0;text-align:center;">' +
            '&#x2713; Assigned to Pranav</div>' +
            '</div>' + _closeBtn;
        }
        if (_isPranav) {
          return '<div style="padding:0 18px 32px;">' +
            '<button onclick="_createPostFromBrief(\'' + postId + '\')" ' +
            'style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
            'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
            'color:#C8A84B;background:rgba(200,168,75,0.06);' +
            'border:1px solid #C8A84B;padding:16px 0;cursor:pointer;' +
            'box-shadow:0 0 14px rgba(200,168,75,0.12);">&#x2192; Create Post</button>' +
            '</div>' + _closeBtn;
        }
        return _readOnly;
      }
      // STATE: unassigned (owner=Chitra)
      if (_isChitra) {
        return '<div style="padding:0 18px 24px;">' +
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
          '<div style="padding:0 18px 32px;">' +
          '<button onclick="_assignBriefToPranav(\'' + postId + '\')" ' +
          'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
          'letter-spacing:0.2em;text-transform:uppercase;color:#C8A84B;' +
          'background:rgba(200,168,75,0.06);border:1px solid #C8A84B;' +
          'padding:16px 0;cursor:pointer;' +
          'box-shadow:0 0 14px rgba(200,168,75,0.12);">&#x2192; Assign to Pranav</button>' +
          '</div>' + _closeBtn;
      }
      return _readOnly;
    }());

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
      stage: 'brief',
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

function _closeBriefConfirm(postId) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  var title = post ? (post.title || postId) : postId;

  var existing = document.getElementById('brief-confirm-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'brief-confirm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9600;' +
    'background:rgba(0,0,0,0.75);display:flex;' +
    'align-items:center;justify-content:center;padding:24px;';

  overlay.innerHTML =
    '<div style="background:#0d0d14;border:1px solid rgba(200,168,75,0.2);' +
    'padding:28px 24px;max-width:340px;width:100%;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.18em;text-transform:uppercase;' +
    'color:#C8A84B;margin-bottom:12px;">Close This Brief?</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:16px;' +
    'font-weight:600;color:#e8e2d9;margin-bottom:8px;">' +
    esc(title) + '</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;' +
    'color:rgba(255,255,255,0.5);line-height:1.6;margin-bottom:24px;">' +
    'This marks the brief as delivered. It will move to Closed Briefs.' +
    '</div>' +
    '<div style="display:flex;gap:10px;">' +
    '<button onclick="document.getElementById(\'brief-confirm-overlay\').remove()" ' +
    'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.14em;text-transform:uppercase;' +
    'background:transparent;border:1px solid rgba(255,255,255,0.12);' +
    'color:rgba(255,255,255,0.5);padding:12px 0;cursor:pointer;">Cancel</button>' +
    '<button onclick="_closeBrief(\'' + postId + '\')" ' +
    'style="flex:2;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.14em;text-transform:uppercase;' +
    'background:rgba(200,168,75,0.1);border:1px solid #C8A84B;' +
    'color:#C8A84B;padding:12px 0;cursor:pointer;">' +
    'Close Brief &#x2192;</button>' +
    '</div></div>';

  document.body.appendChild(overlay);
}
window._closeBriefConfirm = _closeBriefConfirm;

function _closeBrief(postId) {
  document.getElementById('brief-confirm-overlay') &&
    document.getElementById('brief-confirm-overlay').remove();

  apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
    method: 'PATCH',
    body: JSON.stringify({
      stage: 'brief_done',
      updated_at: new Date().toISOString()
    })
  }).then(function() {
    var overlay = document.getElementById('brief-sheet-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    showToast('Brief closed', 'success');
    loadPosts();
  }).catch(function() {
    showToast('Failed - try again', 'error');
  });
}
window._closeBrief = _closeBrief;

function _reopenBrief(postId) {
  apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
    method: 'PATCH',
    body: JSON.stringify({
      stage: 'brief',
      owner: 'Chitra',
      updated_at: new Date().toISOString()
    })
  }).then(function() {
    var overlay = document.getElementById('brief-sheet-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    showToast('Brief reopened', 'success');
    loadPosts();
  }).catch(function() {
    showToast('Failed - try again', 'error');
  });
}
window._reopenBrief = _reopenBrief;

function _createPostFromBrief(briefPostId) {
  var brief = (typeof getPostById === 'function')
    ? getPostById(briefPostId) : null;
  if (!brief) return;

  // Close brief sheet
  var overlay = document.getElementById('brief-sheet-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';

  // Open new post form
  if (typeof openNewPostModal === 'function') {
    openNewPostModal();
  }

  // Pre-fill after short delay to let form render
  setTimeout(function() {
    var titleEl = document.getElementById('new-post-title');
    var captionEl = document.getElementById('new-post-caption');
    var ownerEl = document.getElementById('new-post-owner');

    if (titleEl) {
      titleEl.value = brief.title || '';
      titleEl.dispatchEvent(new Event('input'));
    }
    if (captionEl && brief.comments) {
      // Strip [CHITRA NOTE] and [URGENT] from comments
      var cleanBrief = (brief.comments || '')
        .replace(/\[URGENT\]\s*/g, '')
        .replace(/\[CHITRA NOTE\][^]*/gi, '')
        .trim();
      captionEl.value = cleanBrief;
      captionEl.style.height = 'auto';
      captionEl.style.height = captionEl.scrollHeight + 'px';
    }
    if (ownerEl) {
      ownerEl.value = 'Pranav';
      ownerEl.dispatchEvent(new Event('change'));
    }

    // Trigger validation so Create Post button enables
    if (typeof _npsCheckValid === 'function') _npsCheckValid();

    // Store brief post ID so we can park it after creation
    window._activeBriefPostId = briefPostId;
  }, 150);
}
window._createPostFromBrief = _createPostFromBrief;
