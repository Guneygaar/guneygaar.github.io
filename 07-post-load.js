/* ===============================================
   07-post-load.js - Data loading & all render*
=============================================== */
console.log("LOADED:", "07-post-load.js");

// Depends on: 01-config.js (STAGES_DB, STAGE_DISPLAY, PILLARS_DB, PILLAR_DISPLAY)

// ── Central merge — the ONLY way to update allPosts from server data ──
// Skips posts with _dirty === true (in-flight PATCH).
// Never replaces allPosts blindly — always mutates existing objects in-place.
function mergePosts(fresh) {
  // Normalize DB stage values → UI stage values on ingest
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
    if (existing._dirty) {
      console.log('[PCS] MERGE SKIP (dirty):', id, 'local=' + existing.stage, 'server=' + fp.stage);
      return;
    }

    // No in-flight write — let server win
    // Log stage change from poll merge BEFORE Object.assign overwrites it
    if (existing.stage !== fp.stage) {
      setStage(existing, fp.stage, 'poll_merge');
    }
    Object.assign(existing, fp);
  });

  // Remove posts deleted on server
  const freshIds = new Set(fresh.map(p => getPostId(p)));
  map.forEach((_, id) => { if (!freshIds.has(id)) map.delete(id); });

  // Mutate in-place — preserve the single array reference
  allPosts.length = 0;
  map.forEach(p => allPosts.push(p));
  cachedPosts = allPosts;
}

function showLoadingSkeleton(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = [1,2,3].map(() => `<div class="skeleton skeleton-card"></div>`).join('');
}

async function loadPosts() {
  showLoadingSkeleton('tasks-container');
  try {
    const data = await apiFetch('/posts?select=*&order=id.desc');
    mergePosts(normalise(data));
    hideErrorBanner();
    scheduleRender();
    showToast(`${allPosts.length} posts loaded`, 'success');
  } catch (err) {
    console.error('loadPosts:', err);
    if (cachedPosts.length) {
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
  try {
    const data  = await apiFetch('/posts?select=*&order=created_at.desc');
    mergePosts(normalise(data));
    hideErrorBanner();
    renderClientView();
  } catch (err) {
    if (cachedPosts.length) {
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

  // Data polling — every 15 seconds (was 8s; reduces API calls & DOM churn)
  _realtimeTimer = setInterval(async () => {
    if (document.hidden) return;
    // Skip poll while user is in a modal — they'll get fresh data on close
    if (window._modalOpen) return;
    try {
      const data  = await apiFetch('/posts?select=*&order=created_at.desc');
      const fresh = normalise(data);
      if (_postsFingerprint(fresh) !== _postsFingerprint(allPosts)) {
        mergePosts(fresh);
        scheduleRender();
        fetchUnreadCount();
      }
    } catch (e) {
      console.warn('realtime poll failed:', e.message);
    }
  }, 15000);

  // Proactive token refresh — every 50 minutes
  // Keeps sessions alive indefinitely without user action
  if (!_tokenRefreshTimer) {
    _tokenRefreshTimer = setInterval(async () => {
      if (!localStorage.getItem('sb_refresh_token')) return;
      const newToken = await refreshSession();
      if (!newToken) {
        console.warn('Background token refresh failed — user may need to re-login');
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
  if (el) el.style.opacity = '0.4';
  try {
    await apiFetch(`/tasks?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ done: true }),
    });
    showToast('Task marked done OK', 'success');
    await loadTasks();
  } catch { showToast('Failed - try again', 'error'); if (el) el.style.opacity = ''; }
}

async function deleteTask(id) {
  try {
    await apiFetch(`/tasks?id=eq.${id}`, { method: 'DELETE' });
    await loadTasks();
  } catch { showToast('Failed - try again', 'error'); }
}

function renderAll() {
  const run = (name, fn) => { try { fn(); } catch(e) { console.error('renderAll:' + name, e); } };

  // Always render: lightweight stats & role visibility
  run('updateStats',        updateStats);
  run('roleVisibility',     applyRoleVisibility);

  // Active tab detection — only render the visible tab
  const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'tasks';

  // Tasks tab widgets (always needed when tasks visible)
  if (activeTab === 'tasks') {
    run('dashboard',          renderDashboard);
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
  } else if (activeTab === 'library') {
    run('library',            renderLibrary);
    run('filterDropdowns',    populateFilterDropdowns);
  }

  const pl = document.getElementById('pipeline-label');
  const ll = document.getElementById('library-label');
  if (pl) pl.textContent = `${allPosts.length} posts`;
  const _libDefault = ['scheduled','published'];
  const libCount = allPosts.filter(p => _libDefault.includes((p.stage||'').toLowerCase().trim())).length;
  if (ll) ll.textContent = `${libCount} posts`;
}

function updateStats() {
  const today   = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  let published=0,awaitingApproval=0,inPipeline=0,dueWeek=0,overdue=0,readyToSend=0;
  allPosts.forEach(p => {
    const stage = (p.stage||'').toLowerCase().trim();
    if (stage === 'published') published++;
    if (stage.includes('approval')) awaitingApproval++;
    if (!['published','archive'].includes(stage)) inPipeline++;
    if (stage === 'ready') readyToSend++;
    const d = parseDate(p.targetDate);
    if (d) {
      if (d > today && d <= weekEnd) dueWeek++;
      if (d < today && stage !== 'published') overdue++;
    }
  });
  setText('s-total',     allPosts.length);
  setText('s-published', published);
  setText('s-approval',  awaitingApproval);
  setText('s-pipeline',  inPipeline);
  setText('s-week',      dueWeek);
  setText('s-overdue',   overdue);
  setText('s-ready',     `${readyToSend}/${READY_TO_SEND_TARGET}`);
  // Legacy stats removed
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

// ═══════════════════════════════════════════════
// Dashboard — Hero, Pipeline, Blockers
// ═══════════════════════════════════════════════

function computeDelayMeta(posts) {
  const now = Date.now();
  const HOUR = 3600000;
  // Stages that require status_changed_at for delay computation
  const needsStatusTs = new Set(['in production', 'scheduled', 'awaiting approval']);

  const enrichedPosts = posts.map(p => {
    const s = (p.stage || '').toLowerCase().trim();
    const hasStatusTimestamp = !!(p.status_changed_at || p.statusChangedAt);
    const createdAt = p.created_at || p.createdAt;

    // If this stage needs status_changed_at and it's missing → unknown
    if (needsStatusTs.has(s) && !hasStatusTimestamp) {
      return { ...p, delayType: 'unknown', delayHours: null, isDelayed: false, isCritical: false };
    }

    // Pick the right reference timestamp per delay type
    // request delay: uses created_at (when the request was made)
    // internal/client delay: uses status_changed_at (when it entered this stage)
    let ref = 0;
    if (s === 'awaiting brand input') {
      ref = createdAt ? new Date(createdAt).getTime() : 0;
    } else {
      const changedAt = p.status_changed_at || p.statusChangedAt;
      ref = changedAt ? new Date(changedAt).getTime() : 0;
    }

    if (!ref) {
      return { ...p, delayType: 'unknown', delayHours: null, isDelayed: false, isCritical: false };
    }

    const hours = (now - ref) / HOUR;
    let delayType = 'none';
    let isDelayed = false;
    let isCritical = false;

    if (s === 'awaiting brand input' && hours > 24) {
      delayType = 'request'; isDelayed = true;
    } else if ((s === 'in production' || s === 'scheduled') && hours > 72) {
      delayType = 'internal'; isDelayed = true;
    } else if (s === 'awaiting approval' && hours > 72) {
      delayType = 'client'; isDelayed = true;
      if (hours > 120) isCritical = true;
    }

    return { ...p, delayType, delayHours: Math.round(hours), isDelayed, isCritical };
  });

  const delayed = enrichedPosts.filter(p => p.isDelayed);
  return {
    enrichedPosts,
    aggregates: {
      totalDelayed:      delayed.length,
      internalDelayed:   delayed.filter(p => p.delayType === 'internal').length,
      clientDelayed:     delayed.filter(p => p.delayType === 'client').length,
      requestDelayed:    delayed.filter(p => p.delayType === 'request').length,
      criticalCount:     delayed.filter(p => p.isCritical).length,
      unknownDelayCount: enrichedPosts.filter(p => p.delayType === 'unknown').length,
    }
  };
}

function renderDashboard() {
  try { _renderDashboardInner(); } catch(e) { console.error('[PCS] renderDashboard crash:', e); }
}
function _renderDashboardInner() {
  const el = document.getElementById('pcs-dashboard');
  if (!el) return;

  function stg(p) { return (p.stage || '').toLowerCase().trim(); }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const DAY = 86400000;

  // ═══════════════════════════════════════════════
  // SECTION 1 — LOCKED COUNTS (from allPosts, not filtered)
  // ═══════════════════════════════════════════════

  // RUNWAY: count(posts WHERE status = 'scheduled' AND target_date >= today)
  const scheduledFuture = allPosts.filter(p => {
    if (stg(p) !== 'scheduled') return false;
    const d = parseDate(p.targetDate);
    return d && d >= now;
  });
  const runway_posts = scheduledFuture.length;

  // PIPELINE COUNTS
  const ready_count = allPosts.filter(p => stg(p) === 'ready').length;
  const awaiting_approval_count = allPosts.filter(p => stg(p) === 'awaiting approval').length;
  const awaiting_brand_count = allPosts.filter(p => stg(p) === 'awaiting brand input').length;
  const awaiting_total = awaiting_approval_count + awaiting_brand_count;

  // approved / failed_publish — stages don't exist in current DB schema
  // If they're ever added, these counts will activate automatically
  const approved_count = allPosts.filter(p => stg(p) === 'approved').length;
  const failed_publish_count = allPosts.filter(p => stg(p) === 'failed_publish').length;

  // PIPELINE TOTAL — excludes 'in production' (not countable)
  const pipeline_total = ready_count + awaiting_total + approved_count + runway_posts;

  // ═══════════════════════════════════════════════
  // SECTION 2 — RUNWAY STATE
  // ═══════════════════════════════════════════════

  let runwayState, runwayLabel;
  if (runway_posts <= 7) {
    runwayState = 'critical'; runwayLabel = 'CRITICAL';
  } else if (runway_posts <= 10) {
    runwayState = 'low'; runwayLabel = 'LOW';
  } else {
    runwayState = 'stable'; runwayLabel = 'STABLE';
  }

  // ═══════════════════════════════════════════════
  // SECTION 3 — PRANAV SCOREBOARD
  // ═══════════════════════════════════════════════

  const pranavTarget = 35;
  const pranavAction = pipeline_total < pranavTarget ? 'CREATE' : 'HOLD';

  // ═══════════════════════════════════════════════
  // SECTION 4 — CHITRA SCOREBOARD (PRIORITY ENGINE)
  // ═══════════════════════════════════════════════

  // Aging: posts in awaiting stages >= 2 days
  const agingThreshold = 2;
  const awaitingAged = allPosts.filter(p => {
    const s = stg(p);
    if (s !== 'awaiting approval' && s !== 'awaiting brand input') return false;
    const changed = p.status_changed_at || p.statusChangedAt || p.updated_at || p.updatedAt || p.created_at || p.createdAt;
    if (!changed) return false;
    const age = Math.floor((now.getTime() - new Date(changed).getTime()) / DAY);
    return age >= agingThreshold;
  }).length;

  let chitraAction, chitraContext, chitraFilter;

  if (failed_publish_count > 0) {
    chitraAction = 'FIX PUBLISH';
    chitraContext = `${failed_publish_count} failed`;
    chitraFilter = ['failed_publish'];
  } else if (approved_count > 0) {
    chitraAction = 'SCHEDULE NOW';
    chitraContext = `${approved_count} approved`;
    chitraFilter = ['approved'];
  } else if (awaiting_total > 0 && awaitingAged > 0) {
    if (ready_count > 0) {
      chitraAction = 'FOLLOW UP + SEND';
      chitraContext = `${awaitingAged} aging, ${ready_count} ready`;
      chitraFilter = ['awaiting approval', 'awaiting brand input', 'ready'];
    } else {
      chitraAction = 'FOLLOW UP';
      chitraContext = `${awaitingAged} aging ${agingThreshold}d+`;
      chitraFilter = ['awaiting approval', 'awaiting brand input'];
    }
  } else if (ready_count > 0) {
    chitraAction = 'SEND FOR APPROVAL';
    chitraContext = `${ready_count} ready`;
    chitraFilter = ['ready'];
  } else if (runway_posts < 7 && ready_count === 0 && approved_count === 0 && awaiting_total === 0) {
    chitraAction = 'SYSTEM DRY \u2014 ESCALATE';
    chitraContext = 'No posts in pipeline';
    chitraFilter = null;
  } else {
    chitraAction = 'ALL CLEAR';
    chitraContext = '';
    chitraFilter = null;
  }

  // ═══════════════════════════════════════════════
  // SECTION 5 — CLIENT
  // ═══════════════════════════════════════════════

  // Two separate counts per spec
  const clientApprovalAction = awaiting_approval_count > 0 ? 'REVIEW NOW' : '';
  // awaiting_brand_input is info only — no action

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  el.innerHTML = `<div class="pc-root" data-runway="${runwayState}">

    <div class="pc-runway-strip pc-runway--${runwayState}" data-nav="runway">
      <div class="pc-runway-num">${runway_posts}</div>
      <div class="pc-runway-meta">
        <div class="pc-runway-state">${runwayLabel}</div>
        <div class="pc-runway-sub">POSTS SCHEDULED</div>
      </div>
    </div>

    <div class="pc-board" data-nav="pranav">
      <div class="pc-board-label">Pranav</div>
      <div class="pc-board-score">${pipeline_total}<span class="pc-board-target"> / ${pranavTarget}</span></div>
      <div class="pc-board-status">PIPELINE</div>
      <div class="pc-board-action pc-board-action--${pranavAction === 'CREATE' ? 'warn' : 'ok'}"${pranavAction === 'CREATE' ? ' data-nav="create"' : ''}>${pranavAction}</div>
    </div>

    <div class="pc-board" data-nav="chitra">
      <div class="pc-board-label">Chitra</div>
      <div class="pc-board-detail">${chitraContext || '\u2014'}</div>
      <div class="pc-board-action pc-board-action--${chitraAction === 'ALL CLEAR' ? 'ok' : 'warn'}">${chitraAction}</div>
    </div>

    <div class="pc-client-row">
      <div class="pc-client-cell${awaiting_approval_count > 0 ? ' pc-client-cell--active' : ''}" data-nav="client">
        <div class="pc-client-num">${awaiting_approval_count}</div>
        <div class="pc-client-label">AWAITING APPROVAL</div>
        ${clientApprovalAction ? `<div class="pc-client-action">${clientApprovalAction}</div>` : ''}
      </div>
      <div class="pc-client-cell" data-nav="awaiting-input">
        <div class="pc-client-num">${awaiting_brand_count}</div>
        <div class="pc-client-label">AWAITING INPUT</div>
      </div>
    </div>

  </div>`;

  // ═══════════════════════════════════════════════
  // CLICK DELEGATION
  // ═══════════════════════════════════════════════

  el.querySelector('[data-nav="runway"]')?.addEventListener('click', () => {
    navigateWithFilter('pipeline', ['scheduled']);
  });

  el.querySelector('[data-nav="pranav"]')?.addEventListener('click', () => {
    navigateWithFilter('pipeline', ['in production', 'awaiting brand input', 'ready']);
  });

  el.querySelector('[data-nav="chitra"]')?.addEventListener('click', () => {
    if (chitraFilter) {
      navigateWithFilter('pipeline', chitraFilter);
    } else {
      goToTab('pipeline');
    }
  });

  el.querySelector('[data-nav="client"]')?.addEventListener('click', () => {
    navigateWithFilter('pipeline', ['awaiting approval']);
  });

  el.querySelector('[data-nav="awaiting-input"]')?.addEventListener('click', () => {
    navigateWithFilter('pipeline', ['awaiting brand input']);
  });

  el.querySelector('[data-nav="create"]')?.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent bubbling to parent pranav tile
    if (typeof openNewPostModal === 'function') openNewPostModal();
  });
}

/* Legacy stubs — keep function names callable so renderAll doesn't error */
function renderDashHero() {}
function renderDashPipeline() {}
function renderDashBlockers() {}
function renderDashIntel() {}
function renderDashApprovalIntel() {}
function renderDashActions() {}
function renderDashEnterFlow() {}

function renderPipelineStrip() {
  const strip = document.getElementById('pipeline-strip');
  const wrap  = document.getElementById('pipeline-strip-wrap');
  if (!strip) return;
  // Pipeline strip tiles removed - always keep hidden
  if (wrap) wrap.style.display = 'none';
  return;
  const html = STRIP_STAGES.map((group) => {
    const count = allPosts.filter(p =>
      group.stages.includes((p.stage||'').toLowerCase().trim())
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
  const readyCount = allPosts.filter(p=>(p.stage||'').toLowerCase().trim()==='ready').length;
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
  const stuckProduction = allPosts.filter(p => (p.stage||'').toLowerCase().trim() === 'in production' && daysSince(p) >= 3);
  const stuckClient     = allPosts.filter(p => ['awaiting approval','awaiting brand input'].includes((p.stage||'').toLowerCase().trim()) && daysSince(p) >= 3);
  // stuckReview removed — stage no longer exists
  const weekAgo  = now - 7 * DAY;
  function withinWeek(post, field) { const t = post[field]; if (!t) return false; return new Date(t).getTime() >= weekAgo; }
  const published = allPosts.filter(p => (p.stage||'').toLowerCase().trim() === 'published' && (withinWeek(p,'updated_at') || withinWeek(p,'updatedAt'))).length;
  const readyCount = allPosts.filter(p=>(p.stage||'').toLowerCase().trim()==='ready').length;
  const parkedPosts = allPosts.filter(p => (p.stage||'').toLowerCase().trim() !== 'published' && daysSince(p) >= 7);
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
  const approved = allPosts.filter(p => ['awaiting approval','scheduled','published'].includes((p.stage||'').toLowerCase().trim()) && (withinWeek(p,'updated_at') || withinWeek(p,'updatedAt'))).length;

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
  const email    = localStorage.getItem('gbl_email') || '';
  const roleName = effectiveRole;
  const myTasks  = allTasks.filter(t => !t.done && (t.assigned_to === roleName || (email && t.assigned_to.toLowerCase().includes(email.split('@')[0].toLowerCase()))));
  if (!myTasks.length) { section.innerHTML = ''; return; }
  const rows = myTasks.map(t => {
    const due = t.due_date ? `Due ${formatDateShort(t.due_date)}` : '';
    return `<div class="task-banner-item" id="task-item-${t.id}"><div><div class="task-banner-msg">${esc(t.message)}</div>${due ? `<div class="task-banner-due">${due}</div>` : ''}</div><button class="btn-task-done" onclick="markTaskDone(${t.id})">Mark Done</button></div>`;
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
    const key = stageName.toLowerCase().trim();
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
  return allPosts.filter(p => allowed.includes((p.stage||'').toLowerCase().trim()));
}

function getNextPost() {
  const posts = getMyTasks();
  if (!posts.length) return null;
  return [...posts].sort((a,b) => {
    const ia = STAGE_URGENCY.indexOf((a.stage||'').toLowerCase().trim());
    const ib = STAGE_URGENCY.indexOf((b.stage||'').toLowerCase().trim());
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
  const stageLC   = stage.toLowerCase().trim();
  const { hex, label: stageLabel } = stageStyle(stage);
  const owner     = formatOwner(post.owner);
  const pillar    = formatPillarDisplay(post.contentPillar);
  const comments  = post.comments || '';
  const postLink  = post.postLink || '';
  const relDate   = getRelativeDate(post.targetDate);
  const days      = daysInStage(post);
  const stLabel   = staleLabel(days, stage);
  const stCls     = staleClass(days);
  const canUpdate = effectiveRole !== 'Client';
  let primaryLabel = '', primaryAction = '', secondaryLabel = '', secondaryAction = '';
  if (stageLC === 'awaiting brand input') { primaryLabel='Start Production'; primaryAction=`quickStage('${esc(id)}','in production')`; secondaryLabel='Send for Approval'; secondaryAction=`quickStage('${esc(id)}','awaiting approval')`; }
  else if (stageLC === 'in production') { primaryLabel='Mark Ready'; primaryAction=`quickStage('${esc(id)}','ready')`; secondaryLabel='Send for Approval'; secondaryAction=`quickStage('${esc(id)}','awaiting approval')`; }
  else if (stageLC === 'ready') { primaryLabel='Send for Approval'; primaryAction=`quickStage('${esc(id)}','awaiting approval')`; secondaryLabel='Mark Scheduled'; secondaryAction=`quickStage('${esc(id)}','scheduled')`; }
  else if (stageLC === 'awaiting approval') { primaryLabel='Mark Scheduled'; primaryAction=`quickStage('${esc(id)}','scheduled')`; secondaryLabel='Copy Approval Link'; secondaryAction=`copyApprovalLink('${window.location.origin}/p/${esc(id)}')`; }
  else { primaryLabel='Update Stage'; primaryAction=`openPCS('${esc(id)}')`; }
  const heroLabel = 'Most Urgent';
  let staleNote = '';
  if (stLabel) staleNote = `<div style="font-size:12px;color:var(--${stCls==='red'?'c-red':'c-amber'});margin-bottom:var(--sp-3);font-weight:600">[T] ${stLabel} in this stage</div>`;
  section.innerHTML = `<div class="hero-card"><div class="hero-label">${heroLabel}</div><div class="hero-title">${esc(title)}</div><div class="hero-meta"><span class="tag tag-stage" style="background:${hex}22;color:${hex}">${esc(stageLabel)}</span>${pillar ? `<span class="tag tag-pillar">${esc(pillar)}</span>` : ''}${owner!=='-' ? `<span class="tag tag-owner">${esc(owner)}</span>` : ''}${relDate ? `<span class="tag tag-date ${relDate.cls}">${relDate.text}</span>` : ''}${stLabel ? `<span class="stale-badge ${stCls}">${stLabel}</span>` : ''}</div>${staleNote}${comments ? `<div class="hero-comments" id="hero-comments-${esc(id)}">${esc(comments)}</div>${comments.length > 120 ? `<button class="hero-read-more" onclick="toggleHeroComments('${esc(id)}', this)">Read more</button><button class="btn-zen" onclick="openZen('${esc(title)}','${esc(comments)}')">[sq] Zen Mode - expand brief</button>` : `<button class="hero-read-more" onclick="toggleHeroComments('${esc(id)}', this)">Read more</button>`}` : ''}${postLink ? `<a href="${esc(postLink)}" target="_blank" rel="noopener" class="hero-design-link">[edit] Open in Canva ^</a>` : (stageLC === 'in production' || stageLC === 'awaiting brand input') ? `<div class="hero-no-design">[!] No design link - add one below</div>` : ''}<div class="hero-actions"><button class="btn-hero-primary" onclick="${primaryAction}">${primaryLabel}</button>${(stageLC === 'in production' || stageLC === 'awaiting brand input') ? `<button class="btn-flag" onclick="flagIssue('${esc(id)}')">[flag] Flag Issue</button>` : secondaryLabel === 'Copy Approval Link' ? `<button class="btn-hero-ghost" onclick="${secondaryAction}" style="flex:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:5px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Copy Approval Link</button>` : secondaryLabel ? `<button class="btn-hero-ghost" onclick="${secondaryAction}">${secondaryLabel}</button>` : ''}${canUpdate ? `<button class="btn-hero-more" onclick="openPCS('${esc(id)}')" title="Edit post">...</button>` : ''}</div></div>`;
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

  // Role-based dimming: primary stages are bright, others are dimmed
  const stageLC = stage.toLowerCase().trim();
  const isPrimary = ROLE_PRIMARY_STAGES[effectiveRole]?.includes(stageLC);
  const dimClass = isPrimary ? 'pc-primary' : 'pc-dim';

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


// -- Task stage chip filter ---------------------
let _taskFilter = null; // null = show all, string = bucket key

function renderTaskStageChips() {
  const el = document.getElementById('task-stage-chips');
  if (!el) return;
  const buckets = ROLE_BUCKETS[effectiveRole];
  if (!buckets || !buckets.length) { el.innerHTML = ''; return; }

  const chips = buckets.map(bucket => {
    const count = allPosts.filter(p =>
      bucket.stages.includes((p.stage||'').toLowerCase().trim())
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
    bucket.stages.includes((p.stage||'').toLowerCase().trim())
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
      .filter(p => bucket.stages.includes((p.stage||'').toLowerCase().trim()))
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

function renderPipeline() {
  try { _renderPipelineInner(); } catch(e) { console.error('[PCS] renderPipeline crash:', e); }
}
function _renderPipelineInner() {
  // Consume pressure-click filter (set by dashboard click handler)
  const activeFilter = window.pcsPipelineFilter;
  window.pcsPipelineFilter = null;

  // Pipeline only renders PIPELINE_RENDER_ORDER stages (excludes parked, rejected, published)
  const base = allPosts.filter(p => {
    const s = (p.stage || '').toLowerCase().trim();
    return PIPELINE_RENDER_ORDER.includes(s);
  });
  const source = activeFilter && Array.isArray(activeFilter)
    ? base.filter(p => activeFilter.includes((p.stage || '').toLowerCase().trim()))
    : base;

  // ── PRIORITY SORT: daysInStage DESC → targetDate ASC → created_at ASC ──
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

  // ── ROLE-SPECIFIC EMPTY STATES ──
  const emptyMsg = {};
  if (activeFilter) {
    const key = activeFilter.sort().join(',');
    if (key.includes('in production')) emptyMsg.default = 'Nothing in production \u2014 create new posts';
    else if (key.includes('ready')) emptyMsg.default = 'Nothing ready \u2014 wait or push production';
    else if (key.includes('awaiting approval')) emptyMsg.default = 'Nothing pending \u2014 you\u2019re clear';
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
    const { hex, label } = stageStyle(stage);
    const cards = posts.map((p, i) => {
      const card = buildPostCard(p, listKey);
      if (isFirstCard && activeFilter) {
        isFirstCard = false;
        return card.replace('class="row-tile"', 'class="row-tile pc-focus"');
      }
      return card;
    }).join('');
    return `
      <div class="pstage-header">
        <span class="pstage-name" style="color:${hex}">${esc(label)}</span>
        <span class="pstage-badge">${posts.length}</span>
      </div>
      <div class="row-list">
        ${cards || `<div class="pstage-empty">${emptyMsg.default || 'Empty'}</div>`}
      </div>`;
  }).join('');

  const container = document.getElementById('pipeline-container');
  if (!container) return;
  container.innerHTML = html;

  // ── GLOBAL EMPTY STATE (filtered view with no results) ──
  if (activeFilter && stages.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">\u2713</div><p>${emptyMsg.default || 'Nothing here \u2014 you\u2019re clear'}</p></div>`;
    return;
  }

  // ── AUTO-SCROLL to first focused card ──
  if (activeFilter) {
    requestAnimationFrame(() => {
      const focus = container.querySelector('.pc-focus');
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
  const owners  = ['PRANAV','CHITRA','CLIENT'];
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
  const stage  = (document.getElementById('filter-stage')?.value||'').toLowerCase();
  const owner  = (document.getElementById('filter-owner')?.value||'').toLowerCase();
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
    if (!_allowedStages.includes((p.stage||'').toLowerCase().trim())) return false;
    if (query  && !getTitle(p).toLowerCase().includes(query)) return false;
    if (stage  && (p.stage||'').toLowerCase() !== stage) return false;
    if (owner  && (p.owner||'').toLowerCase() !== owner) return false;
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

function renderLibraryRows(posts) {
  const listView = document.getElementById('library-list-view');
  if (!listView) return;
  posts = posts.slice().sort((a, b) => (parseDate(b.targetDate) || 0) - (parseDate(a.targetDate) || 0));
  _postLists['library'] = posts;
  if (!posts.length) {
    listView.innerHTML = `<div class="empty-state"><div class="empty-icon">[search]</div><p>No posts match your search.</p></div>`;
    return;
  }

  // Group posts by month
  const groups = {};
  posts.forEach(p => {
    const d = parseDate(p.targetDate);
    const key = d ? formatMonthYear(p.targetDate) : 'No Date';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  let html = '';
  for (const [month, group] of Object.entries(groups)) {
    html += `<div class="pcs-month-group"><div class="pcs-library-month"><span class="pcs-month-label">${esc(month)}</span><span class="pcs-month-count">${group.length} post${group.length === 1 ? '' : 's'}</span></div><div class="row-list">${group.map(p => buildPostCard(p, 'library')).join('')}</div></div>`;
  }
  listView.innerHTML = html;
}

function renderClientView() {
  try { _renderClientViewInner(); } catch(e) { console.error('[PCS] renderClientView crash:', e); }
}
function _renderClientViewInner() {
  const inputPosts = allPosts.filter(p => (p.stage||'').toLowerCase().trim() === 'awaiting brand input');
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
  const approvalPosts = allPosts.filter(p => { const s = (p.stage||'').toLowerCase().trim(); return s === 'awaiting approval'; });
  const approvalCount = document.getElementById('client-approval-count');
  if (approvalCount) approvalCount.textContent = approvalPosts.length;
  const approvalItems = document.getElementById('client-approval-items');
  if (approvalItems) {
    if (!approvalPosts.length) { approvalItems.innerHTML = `<div class="empty-state"><div class="empty-icon">?</div><p>Nothing waiting for approval right now.</p></div>`; }
    else {
      approvalItems.innerHTML = approvalPosts.map(p => {
        const id          = getPostId(p);
        const postLink    = p.postLink || p.post_link || '';
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
  // Hide published section on Client home — still visible in Library
  const pubSection = document.getElementById('client-published-section');
  if (pubSection && effectiveRole === 'Client') { pubSection.style.display = 'none'; return; }
  if (pubSection) pubSection.style.display = '';
  const published = allPosts.filter(p=>(p.stage||'').toLowerCase().trim()==='published');
  const label     = document.getElementById('client-approved-label');
  if (label) label.textContent = published.length;
  const tbody = document.getElementById('client-approved-tbody');
  if (!tbody) return;
  if (!published.length) { tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">?</div><p>No published posts yet.</p></div></td></tr>`; return; }
  tbody.innerHTML = published.map(p => { const link = p.postLink || p.post_link || ''; return `<tr><td>${esc(getTitle(p))}</td><td class="mono">${displayDate(p.targetDate)}</td><td class="post-link-cell">${link?`<a href="${esc(link)}" target="_blank" rel="noopener">^ View</a>`:'-'}</td></tr>`; }).join('');
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
    const stage = (p.stage||'').toLowerCase().trim();
    const t = new Date(p.updated_at || p.created_at).getTime();
    return ['ready','awaiting approval','scheduled','published'].includes(stage) && t >= weekAgo;
  }).length;
  const doneThisMonth = myPosts.filter(p => {
    const stage = (p.stage||'').toLowerCase().trim();
    const t = new Date(p.updated_at || p.created_at).getTime();
    return ['ready','awaiting approval','scheduled','published'].includes(stage) && t >= monthAgo;
  }).length;
  const _activeStages = typeof STAGES_DB !== 'undefined' ? STAGES_DB.filter(s => !['ready','awaiting approval','scheduled','published','parked'].includes(s)) : ['in production','awaiting brand input'];
  const inProgress = myPosts.filter(p => _activeStages.includes((p.stage||'').toLowerCase().trim())).length;
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
  document.querySelectorAll('.lib-view-btn').forEach(b => b.classList.remove('active'));
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

function normalizeOwner(owner) {
  return (owner || '').trim() || '—';
}

function normalizePillar(pillar) {
  if (!pillar) return '';
  return sanitizePillar(pillar);
}

function groupPostsByDay(posts, month, year) {
  const map = {};
  posts.forEach(p => {
    const d = parseDate(p.targetDate);
    if (!d || d.getMonth() !== month || d.getFullYear() !== year) return;
    const s = (p.stage || '').toLowerCase().trim();
    if (s !== 'published' && s !== 'scheduled') return;
    const key = p.targetDate;
    if (!map[key]) map[key] = [];
    map[key].push(p);
  });
  return map;
}

function renderLibraryCalendar(posts) {
  const container = document.getElementById('library-calendar-view');
  if (!container) return;
  posts = posts || allPosts;

  const dayMap = groupPostsByDay(posts, _calMonth, _calYear);
  const monthLabel = MONTHS_LONG[_calMonth] + ' ' + _calYear;

  // Grid: first day of month and total days
  const firstDay = new Date(_calYear, _calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const totalCells = firstDay + daysInMonth <= 35 ? 35 : 42;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Header
  let html = `<div class="pcs-cal-header">
    <span class="pcs-cal-title">${esc(monthLabel)}</span>
    <span class="pcs-cal-nav">
      <button class="pcs-cal-nav-btn" onclick="_calNav(-1)">&lsaquo;</button>
      <button class="pcs-cal-nav-btn" onclick="_calNav(1)">&rsaquo;</button>
    </span>
  </div>`;

  // Day-of-week labels
  html += `<div class="pcs-cal-grid pcs-cal-dow">`;
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
    html += `<div class="pcs-cal-dow-label">${d}</div>`;
  });
  html += `</div>`;

  // Cells
  html += `<div class="pcs-cal-grid">`;
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDay + 1;
    if (i < firstDay || dayNum > daysInMonth) {
      html += `<div class="pcs-cal-cell pcs-cal-cell-empty"></div>`;
      continue;
    }

    const dd = String(dayNum).padStart(2, '0');
    const mm = String(_calMonth + 1).padStart(2, '0');
    const key = `${_calYear}-${mm}-${dd}`;
    const cellDate = new Date(_calYear, _calMonth, dayNum);
    const isToday = cellDate.getTime() === today.getTime();
    const dayPosts = dayMap[key] || [];

    const first = dayPosts[0];
    const pillarFilterActive = !!(document.getElementById('filter-pillar')?.value);
    const cellLabel = first
      ? (pillarFilterActive ? getPillarShort(first.contentPillar) : getTitle(first))
      : '';
    const postId = first ? getPostId(first) : '';
    const extra = dayPosts.length > 1 ? dayPosts.length - 1 : 0;

    const clickAttr = postId ? ` data-post-id="${esc(postId)}" data-list="library"` : '';
    const todayClass = isToday ? ' pcs-cal-today' : '';
    const hasPost = dayPosts.length ? ' pcs-cal-has-post' : '';

    html += `<div class="pcs-cal-cell${todayClass}${hasPost}"${clickAttr}>`;
    html += `<div class="pcs-cal-date">${dayNum}</div>`;
    if (cellLabel) html += `<div class="pcs-cal-pill">${esc(cellLabel)}</div>`;
    if (extra)  html += `<div class="pcs-cal-more">+${extra}</div>`;
    html += `</div>`;
  }
  html += `</div>`;

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════
// Event delegation for card clicks
// Single document-level listener — survives ALL innerHTML replacements.
// Covers: .row-tile, .pcs-cal-cell, .upc-list-row (any element with data-post-id)
// ═══════════════════════════════════════════════
(document.getElementById('dashboard-view') || document).addEventListener('click', function _cardClickDelegate(e) {
  var card = e.target.closest('[data-post-id]');
  if (!card) return;
  var postId  = card.dataset.postId;
  var listKey = card.dataset.list || '';
  if (!postId) return;
  // Parked overlay rows also need to close the parked sheet
  if (card.dataset.closeParked) {
    try { closeParked(); } catch (_) {}
  }
  openPCS(postId, listKey);
});
