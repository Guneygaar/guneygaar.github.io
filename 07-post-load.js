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
      'awaiting_approval,awaiting_brand_input,published,brief,brief_done,scheduled,in_production';
    var data  = await apiFetch(
      '/posts?stage=in.(' + allowedStages +
      ')&select=*&order=created_at.desc'
    );
    if (!_commitPostsResult(reqId, 'network')) return;

    var postIds = data.map(function(p) { return p.post_id || p.id; }).filter(Boolean);
    if (postIds.length) {
      try {
        var comments = await apiFetch(
          '/post_comments?post_id=in.(' + postIds.join(',') +
          ')&order=created_at.asc'
        );
        if (Array.isArray(comments)) {
          data.forEach(function(p) {
            var pid = p.post_id || p.id;
            p.post_comments = comments.filter(function(c) { return c.post_id === pid; });
          });
        }
      } catch (_) { /* comments fetch failed - render without them */ }
    }

    data = data.filter(function(p) {
      if (p.stage === 'in_production') {
        return p.post_comments && p.post_comments.length > 0;
      }
      return true;
    });

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
    run('productionMeter',    renderProductionMeter);
    run('adminInsight',       renderAdminInsight);
    run('taskBanner',         renderTaskBanner);
    run('adminTaskPanel',     renderAdminTaskPanel);
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
  var _ss = document.getElementById('stage-sheet-overlay');
  if (_ss) _ss.style.display = 'none';
  var _rs = document.getElementById('runway-sheet');
  if (_rs) _rs.style.display = 'none';
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
    <div class="insight-summary-bar" onclick="showInsights()">
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
  if (!window.effectiveRole) return;
  var _role = (window.effectiveRole || '').toLowerCase();
  if (_role === 'client') {
    var card = e.target.closest('[data-post-id]');
    if (!card) return;
    var pid = card.getAttribute('data-post-id');
    if (!pid) return;
    var post = (window.allPosts || []).find(function(p) {
      return p.post_id === pid;
    });
    var stage = post ? post.stage : '';
    if (stage === 'brief' || stage === 'brief_done') {
      if (typeof window._openBriefSheet === 'function')
        window._openBriefSheet(pid);
    } else {
      if (typeof window._openClientPostOverlay === 'function')
        window._openClientPostOverlay(pid);
    }
    return;
  }
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


