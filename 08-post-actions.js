/* ===============================================
   08-post-actions.js  -  Stage updates & modals
=============================================== */
console.log("LOADED:", "08-post-actions.js");

async function quickStage(postId, newStage) {
  const post = getPostById(postId);
  if (!post) return;
  // Block duplicate writes  -  if a PATCH is already in-flight, bail
  if (post._isSaving) return;
  const oldStage = post.stage;
  setStage(post, newStage, 'quickStage');
  post._isSaving = true;
  console.log('[PCS] LOCAL UPDATE:', postId, newStage, Date.now());
  scheduleRender();
  try {
    console.log('[PCS] DB WRITE SENT:', postId, newStage, Date.now());
    const actor = resolveActor();
    const rows = await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: toDbStage(newStage), updated_at: new Date().toISOString(), status_changed_at: new Date().toISOString(), updated_by: actor }),
    });
    console.log('[PCS] DB WRITE SUCCESS:', postId, newStage, Date.now());
    // Apply server response
    if (Array.isArray(rows) && rows[0]) {
      const server = normalise(rows)[0];
      if (server.stage) server.stage = toUiStage(server.stage);
      Object.assign(post, server);
    }
    post._isSaving = false;
    scheduleRender();
    await logActivity({ post_id: postId, actor: actor, actor_role: currentRole, action: `Stage -> ${newStage}` });
    showUndoToast(`Moved to ${newStage}`, () => quickStage(postId, oldStage));
  } catch (err) {
    post._isSaving = false;
    setStage(post, oldStage, 'quickStage_rollback');
    scheduleRender();
    showToast('Update failed  -  try again', 'error');
  }
}

function openAdminEdit(postId) {
  console.log('[openAdminEdit] MODAL POST ID:', postId);
  const post = getPostById(postId);
  if (!post) {
    console.error('[openAdminEdit] BLOCKED: post not found for', postId);
    showToast('Post not found', 'error');
    return;
  }
  window._modalOpen = true;
  const _ae = id => document.getElementById(id);
  const aePostid = _ae('ae-postid');    if (aePostid) aePostid.textContent = postId;
  const aeTitle  = _ae('ae-title');     if (aeTitle) aeTitle.value = getTitle(post);
  const aeOwner  = _ae('ae-owner');     if (aeOwner) aeOwner.value = post.owner || ' - ';
  const aePillar = _ae('ae-pillar');    if (aePillar) aePillar.value = post.contentPillar || '';
  const aeLoc    = _ae('ae-location');  if (aeLoc) aeLoc.value = post.location || '';
  const aeDate   = _ae('ae-date');      if (aeDate) aeDate.value = post.targetDate || '';
  const aeComm   = _ae('ae-comments');  if (aeComm) aeComm.value = post.comments || '';
  const aeLink   = _ae('ae-postlink');  if (aeLink) aeLink.value = post.postLink || post.linkedinUrl || '';
  const sel = _ae('ae-stage');
  if (sel) sel.innerHTML = PIPELINE_ORDER.map(s => `<option value="${s}" ${post.stage===s?'selected':''}>${s}</option>`).join('');
  const aeBtn = _ae('ae-save-btn');     if (aeBtn) aeBtn.dataset.postId = postId;
  console.log('[openAdminEdit] ae-save-btn.dataset.postId SET TO:', aeBtn?.dataset?.postId);
  const aeOverlay = _ae('admin-edit-overlay');
  if (aeOverlay) aeOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAdminEdit() {
  document.getElementById('admin-edit-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
  window._modalOpen = false;
  _drainDeferredRender();
}

async function saveAdminEdit() {
  console.log('[saveAdminEdit] SAVE CLICKED');
  const _ae = id => document.getElementById(id);
  const postId   = _ae('ae-save-btn')?.dataset?.postId;
  console.log('[saveAdminEdit] SAVE postId:', postId);
  if (!postId) {
    console.error('[saveAdminEdit] BLOCKED: no postId on ae-save-btn dataset');
    showToast('Save failed  -  post not found', 'error');
    return;
  }
  const title    = (_ae('ae-title')?.value || '').trim();
  const owner    = _ae('ae-owner')?.value || '';
  const pillar   = _ae('ae-pillar')?.value || '';
  const location = _ae('ae-location')?.value || '';
  const stage    = _ae('ae-stage')?.value || '';
  const date     = _ae('ae-date')?.value || '';
  const comments = (_ae('ae-comments')?.value || '').trim();
  const postLink = (_ae('ae-postlink')?.value || '').trim();
  if (!title) {
    console.warn('[saveAdminEdit] BLOCKED: title empty');
    showToast('Title is required', 'error');
    return;
  }
  const btn = _ae('ae-save-btn');
  if (btn) btn.disabled = true;
  const _payload = { title, owner: owner||null, content_pillar: sanitizePillar(pillar)||null, location: location||null, stage: toDbStage(stage)||null, target_date: date||null, comments: comments||null, updated_at: new Date().toISOString() };
  // Defensive: remove any invalid field names that must never reach DB
  delete _payload.post_link;
  delete _payload.linkedin_url;
  delete _payload.linkedinLink;
  delete _payload.postLink;
  // Route link to correct DB column based on URL content
  if (postLink) {
    if (postLink.includes('linkedin.com')) {
      _payload.linkedin_link = postLink;
    } else {
      _payload.canva_link = postLink;
    }
  }
  console.log('[saveAdminEdit] VALIDATION PASSED');
  console.log('FINAL PAYLOAD:', JSON.stringify(_payload, null, 2));
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify(_payload),
    });
    console.log('[saveAdminEdit] API SUCCESS for', postId);
    await logActivity({ post_id: postId, actor: 'Admin', actor_role: 'Admin', action: 'Full edit saved' });
    closeAdminEdit();
    await loadPosts();
    showToast('Post saved ok', 'success');
  } catch (err) {
    console.error('[saveAdminEdit] API FAILED:', err);
    showToast('Save failed  -  try again', 'error');
    if (btn) btn.disabled = false;
  }
}

async function clientApprove(postId, btn) {
  const post = getPostById(postId);
  if (!post) return;
  const alreadyApproved = (post.stage||'') === 'scheduled';
  if (alreadyApproved) { showToast('Already approved ok', 'success'); return; }
  if (btn) btn.disabled = true;
  try {
    // scheduled -> owner remains unchanged (per ownership rules)
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'scheduled', updated_at: new Date().toISOString(), status_changed_at: new Date().toISOString(), updated_by: 'Client' }),
    });
    await logActivity({ post_id: postId, actor: 'Client', actor_role: 'Client', action: 'Approved  -  moved to Scheduled' });
    const confirmEl = document.getElementById(`approved-confirm-${postId}`);
    if (confirmEl) confirmEl.classList.add('active');
    setStage(post, 'scheduled', 'clientApprove');
    setTimeout(() => loadPostsForClient(), 1200);
  } catch { if (btn) btn.disabled = false; showToast('Failed  -  try again', 'error'); }
}

function showChangeInput(postId) {
  const wrap = document.getElementById(`change-wrap-${postId}`);
  if (wrap) { wrap.classList.toggle('active'); document.getElementById(`change-text-${postId}`)?.focus(); }
}

async function submitClientChanges(postId) {
  const text = (document.getElementById(`change-text-${postId}`)?.value||'').trim();
  if (!text) { showToast('Please describe what you want changed', 'error'); return; }
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'in_production', comments: text, updated_at: new Date().toISOString(), status_changed_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor: 'Client', actor_role: 'Client', action: `Changes requested: ${text.substring(0,80)}` });
    const item = document.getElementById(`apv-item-${postId}`);
    if (item) item.innerHTML = `<div style="padding:var(--sp-4);text-align:center;color:var(--text2);font-size:14px">Changes sent  -  the team will take care of it.</div>`;
    setTimeout(() => loadPostsForClient(), 1000);
  } catch { showToast('Failed  -  try again', 'error'); }
}

async function clientAcknowledge(postId) {
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'in_production', updated_at: new Date().toISOString(), status_changed_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor: 'Client', actor_role: 'Client', action: 'Acknowledged  -  sending via WhatsApp' });
    showToast('Got it! The team has been notified.', 'success');
    setTimeout(() => loadPostsForClient(), 800);
  } catch { showToast('Failed  -  try again', 'error'); }
}

async function handleClientUpload(input, postId) {
  const file = input.files[0];
  if (!file) return;
  const label = document.getElementById(`upload-label-${postId}`);
  if (label) label.textContent = 'Uploading...';
  try {
    const url = await uploadPostAsset(file, postId);
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ canva_link: url, stage: 'in_production', updated_at: new Date().toISOString(), status_changed_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor: 'Client', actor_role: 'Client', action: 'Uploaded asset' });
    const confirmEl = document.getElementById(`upload-confirm-${postId}`);
    if (confirmEl) confirmEl.innerHTML = `<div style="color:var(--c-green);font-size:13px;margin-top:var(--sp-2)">ok File uploaded! The team has been notified.</div>`;
    if (label) label.textContent = '^ Upload Here';
    setTimeout(() => loadPostsForClient(), 1000);
  } catch (err) {
    if (label) label.textContent = '^ Upload Here';
    showToast('Upload failed  -  try again', 'error');
  }
}

function scrollToNewRequest() {
  document.getElementById('client-request-section')?.scrollIntoView({ behavior: 'smooth' });
}

async function submitClientRequest() {
  console.log('[REQUEST] Client submit clicked');
  const brief = document.getElementById('req-topic')?.value.trim();
  if (!brief) {
    console.warn('[REQUEST] BLOCKED: missing brief');
    showToast('Please describe what you need', 'error');
    return;
  }
  const btn       = document.getElementById('req-submit-btn');
  const fileInput = document.getElementById('req-file');
  const file      = fileInput?.files[0] || null;
  if (btn) btn.disabled = true;
  try {
    const postId = 'REQ-' + Date.now();
    const email  = localStorage.getItem('hinglish_email') || 'Client';
    const payload = {
      post_id:     postId,
      title:       'Client Request - ' + new Date().getDate() + ' ' + MONTHS[new Date().getMonth()],
      stage:       'awaiting_brand_input',
      owner:       email,
      comments:    brief,
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    };
    console.log('[REQUEST] PAYLOAD:', payload);
    await apiFetch('/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log('[REQUEST] API SUCCESS');
    if (file) await uploadPostAsset(file, postId);
    await logActivity({ post_id: postId, actor: email, actor_role: 'Client', action: 'New request: ' + brief.substring(0, 60) });
    const topicEl = document.getElementById('req-topic');
    if (topicEl) topicEl.value = '';
    if (fileInput) fileInput.value = '';
    if (btn) btn.disabled = false;
    showToast('Request sent - The team will be in touch.', 'success');
    setTimeout(() => loadPostsForClient(), 800);
  } catch (err) {
    console.error('[REQUEST] API FAILED:', err);
    showToast('Failed - try again', 'error');
    if (btn) btn.disabled = false;
  }
}

function handleRequestFileUpload(input) {
  const label = document.getElementById('req-file-label');
  if (label) label.textContent = input.files[0] ? input.files[0].name : '+ Attach a file (optional)';
}

async function flagIssue(postId) {
  const msg = prompt('Describe the issue or what you\'re blocked on:');
  if (!msg) return;
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ comments: `! ${msg}`, updated_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor: currentRole, actor_role: currentRole, action: `Issue flagged: ${msg.substring(0,80)}` });
    showToast('Issue flagged  -  team has been notified', 'success');
    await loadPosts();
  } catch { showToast('Failed  -  try again', 'error'); }
}

async function nudgeClient(postId, title, targetDate) {
  const days      = daysInStage(getPostById(postId));
  const dateInfo  = targetDate ? `\n\nTarget date: ${formatDate(targetDate)}` : '';
  const msg       = encodeURIComponent(`Hi! Just a quick note  -  we're waiting on your input for:\n\n"${title}"\n\nWhen you get a chance, could you check in?${dateInfo}\n\nThanks!`);
  const waLink    = `https://wa.me/?text=${msg}`;
  window.open(waLink, '_blank');
  await logActivity({ post_id: postId, actor: currentRole, actor_role: currentRole, action: `Client nudged after ${days}d` });
}

async function copyCaption(postId) {
  const post = getPostById(postId);
  if (!post || !post.comments) { showToast('No caption found', 'error'); return; }
  try {
    await navigator.clipboard.writeText(post.comments);
    showToast('Caption copied ok', 'success');
  } catch { showToast('Could not copy  -  try manually', 'error'); }
}

// -- Delete post (Admin only) ------------------
async function deletePost(postId) {
  const post = getPostById(postId);
  const title = post ? getTitle(post) : postId;
  if (!confirm(`Delete "${title}"?\n\nThis cannot be undone.`)) return;
  const btn = document.getElementById('ae-delete-btn');
  if (btn) btn.disabled = true;
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, { method: 'DELETE' });
    await logActivity({ post_id: postId, actor: 'Admin', actor_role: 'Admin', action: `Post deleted: ${title}` });
    closeAdminEdit();
    const idx = allPosts.findIndex(p => getPostId(p) === postId);
    if (idx !== -1) allPosts.splice(idx, 1);
    scheduleRender();
    showToast('Post deleted', 'info');
  } catch {
    showToast('Delete failed  -  try again', 'error');
    if (btn) btn.disabled = false;
  }
}

// ===============================================
// PCS  -  Post Control Screen
// ===============================================

const _pcs = {
  postId:  null,
  listKey: null,
  list:    [],
  idx:     0,
};
let _pcsCloseTimer = null; // tracks deferred forcePCSReset from closePCS
let _pcsEditingTarget = null; // 'canva' | 'linkedin'  -  which link the attach input saves to

function openPCS(postId, listKey) {
  // Cancel any deferred forcePCSReset from a previous closePCS()  - 
  // without this, a rapid close->open reopens the sheet, then the
  // stale timer fires 300ms later and nukes it back to hidden.
  if (_pcsCloseTimer) { clearTimeout(_pcsCloseTimer); _pcsCloseTimer = null; }

  // Force-clean any stale PCS state from a previous session
  forcePCSReset();

  var list = (listKey && window._postLists && _postLists[listKey])
    ? _postLists[listKey]
    : allPosts;
  var idx = list.findIndex(function(p) { return getPostId(p) === postId; });
  _pcs.listKey = listKey || '';
  _pcs.list    = list;
  _pcs.idx     = idx >= 0 ? idx : 0;
  _pcs.postId  = postId;

  var overlay = document.getElementById('pcs-overlay');
  if (!overlay) return;
  var screen = document.getElementById('pcs-screen');

  // 1. Clear every inline style  -  no stale transform/transition/opacity
  if (screen) {
    screen.style.cssText = '';
  }

  // 2. Show the overlay WITHOUT .open  -  screen sits at translateY(100%)
  //    via the base CSS rule, which is our desired starting position.
  overlay.classList.remove('open');
  overlay.style.display       = 'flex';
  overlay.style.pointerEvents = '';

  window._modalOpen = true;
  document.body.style.overflow = 'hidden';

  try {
    _renderPCS(postId);
  } catch (err) {
    console.error('[PCS] openPCS failed  -  cleaning up:', err);
    forcePCSReset();
    return;
  }

  // 3. Force Safari to commit the current computed transform (translateY(100%))
  //    before we add .open. Reading getComputedStyle().transform forces both
  //    style resolution AND layout  -  more reliable than offsetHeight on
  //    Mobile Safari, which can skip style recalc in some DOM states.
  if (screen) { void getComputedStyle(screen).transform; }

  // 4. Now add .open  -  CSS transition animates translateY(100%) -> translateY(0).
  //    No inline transform needed. The CSS rules handle everything.
  overlay.classList.add('open');
}

function closePCS() {
  forcePCSReset();
  // Safety: re-verify after animations settle (catches mobile compositor lag).
  // Store the timer so openPCS can cancel it if the user reopens quickly.
  if (_pcsCloseTimer) clearTimeout(_pcsCloseTimer);
  _pcsCloseTimer = setTimeout(function() {
    _pcsCloseTimer = null;
    forcePCSReset();
  }, 300);
}

// ===============================================
// forcePCSReset  -  single authoritative cleanup
// Tears down ALL PCS visual state, compositing layers,
// and event-capturing surfaces. Safe to call multiple times.
// ===============================================
function forcePCSReset() {
  var screen  = document.getElementById('pcs-screen');
  var overlay = document.getElementById('pcs-overlay');

  // 1. Nuke ALL inline styles on screen  -  catches any stale transform,
  //    transition, opacity, or anything else set by any code path
  if (screen) {
    screen.style.cssText = '';
    // Tear down GPU compositing layer (mobile Safari ghost-layer fix)
    screen.style.willChange    = 'auto';
    // Block the screen from capturing any touch/click events
    screen.style.pointerEvents = 'none';
  }

  // 2. Remove .open class AND force display:none as inline backup
  if (overlay) {
    overlay.classList.remove('open');
    overlay.style.display      = 'none';
    overlay.style.pointerEvents = 'none';
  }

  // 3. Remove dynamically-created confirm overlays
  document.querySelectorAll('.pcs-confirm-overlay').forEach(
    function(el) { el.remove(); }
  );

  // 4. Reset body scroll lock
  document.body.style.overflow = '';

  // 5. Reset all state flags
  window._modalOpen = false;

  // 6. Clear PCS context
  _pcs.postId = null;

  // 7. Flush any deferred background renders
  _drainDeferredRender();
}

function _renderPCS(postId) {
  _removePcsConfirm();

  // 1. Fetch post
  const post = getPostById(postId);
  if (!post) { closePCS(); return; }

  // 2. Compute derived state
  const id          = getPostId(post);
  const title       = getTitle(post);
  const stageLC     = post.stage || '';
  console.log('[PCS] _renderPCS READING:', id, 'stage=' + post.stage, 'stageLC=' + stageLC, Date.now());
  const isPublished = stageLC === 'published';
  const canvaUrl    = post.postLink || '';
  const linkedinUrl = post.linkedinUrl || '';
  const canEdit     = effectiveRole !== 'Client';
  const dateValue   = post.targetDate || '';

  // 3. Render into DOM
  const elTitle    = document.getElementById('pcs-topbar-title');
  const elProgress = document.getElementById('pcs-progress-wrap');
  const elDesign   = document.getElementById('pcs-action-btn-wrap');
  const elFields   = document.getElementById('pcs-fields');
  const elActivity = document.getElementById('pcs-activity-body');

  // Title  -  inline editable on tap
  if (elTitle) {
    elTitle.textContent = title;
    if (canEdit) {
      elTitle.classList.add('pcs-title--editable');
      elTitle.onclick = function() { _pcsTitleEdit(elTitle, id); };
    } else {
      elTitle.classList.remove('pcs-title--editable');
      elTitle.onclick = null;
    }
  }

  _updateSubtitle(post);
  if (elProgress) elProgress.innerHTML = _buildStageProgress(stageLC);
  if (elDesign)   elDesign.innerHTML = _buildInlineActions(canvaUrl, linkedinUrl, isPublished, canEdit, id, stageLC);
  if (elFields)   elFields.innerHTML = _buildInfoGrid(post, canEdit, id) + _buildNotes(post, canEdit, id) + '<input type="hidden" id="pcs-post-id" value="' + esc(id) + '">';

  // Stage advance button
  _renderAdvanceButton(stageLC);

  // Activity count
  _renderActivityCount(id);

  // 5. Load activity asynchronously
  if (elActivity) {
    if (elActivity.dataset.loadedFor !== id) {
      elActivity.dataset.loadedFor = id;
      elActivity.innerHTML = '<div class="pcs-activity-loading">Loading...</div>';
      _loadPCSActivity(id, elActivity);
    }
  }
}

// -- Subtitle sync (single source of truth) --------------
function _updateSubtitle(post) {
  const el = document.getElementById('pcs-subtitle');
  if (!el || !post) return;
  const stLC = post.stage || '';
  const isPub = stLC === 'published';
  const pLabel = post.contentPillar
    ? getPillarShort(post.contentPillar)
    : ' - ';
  const dVal = post.targetDate || '';
  const dDisp = formatDate(dVal) || ' - ';
  var parts = [esc(pLabel), esc(formatOwner(post.owner)), esc(dDisp)];
  var html = parts.join('<span class="pc-sub-dot"></span>');
  // Overdue badge (exclude published/parked/rejected)
  var _noOverdue = ['published', 'parked', 'rejected'];
  if (_noOverdue.indexOf(stLC) === -1 && dVal) {
    var td = parseDate(dVal);
    var now = new Date(); now.setHours(0,0,0,0);
    if (td && td < now) {
      html += '<span class="pc-sub-dot"></span><span class="pc-overdue-badge">Overdue</span>';
    }
  }
  el.innerHTML = html;
}

// -- Inline title editing --------------
function _pcsTitleEdit(el, postId) {
  if (el.querySelector('input')) return; // already editing
  // Close other interactive layers  -  only one at a time
  _removePcsConfirm();
  pcsCloseAttach(postId);
  const current = el.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'pcs-title-input';
  input.value = current;
  input.maxLength = 200;
  el.textContent = '';
  el.appendChild(input);
  input.focus();
  input.select();

  function save() {
    const val = input.value.trim();
    if (val && val !== current) {
      el.textContent = val;
      updatePost(postId, 'title', val);
    } else {
      el.textContent = current;
    }
  }
  function cancel() { el.textContent = current; }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', save); cancel(); }
  });
}

// -- Unified stage change with confirmation --
function changeStage(newStage) {
  const postId = _pcs.postId;
  if (!postId) return;
  const post = getPostById(postId);
  if (!post) return;
  const current = post.stage || '';
  if (current === newStage) return; // same stage

  _showStageConfirm(postId, newStage);
}

function _showStageConfirm(postId, newStage) {
  _removePcsConfirm();
  // Close any open attach editor  -  only one interactive layer at a time
  if (_pcs.postId) pcsCloseAttach(_pcs.postId);
  const displayName = (typeof STAGE_DISPLAY !== 'undefined' && STAGE_DISPLAY[newStage]) || newStage;
  const overlay = document.createElement('div');
  overlay.className = 'pcs-confirm-overlay';
  overlay.addEventListener('click', function(e) { if (e.target === this) this.remove(); });
  overlay.addEventListener('keydown', function(e) { if (e.key === 'Escape') this.remove(); });
  overlay.innerHTML = `
    <div class="pcs-confirm-sheet">
      <div class="pcs-confirm-msg">Move this post to <strong>${esc(displayName)}</strong>?</div>
      <div class="pcs-confirm-btns">
        <button class="pcs-confirm-cancel" onclick="this.closest('.pcs-confirm-overlay').remove()">Cancel</button>
        <button class="pcs-confirm-stage" onclick="_executeStageChange('${esc(postId)}','${esc(newStage)}')">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function _executeStageChange(postId, newStage) {
  _removePcsConfirm();

  // -- 1. Optimistic local state update --
  const post = getPostById(postId);
  if (!post) return;
  // Block duplicate writes  -  if a PATCH is already in-flight, bail
  if (post._isSaving) return;
  const previousStage = post.stage;
  setStage(post, newStage, '_executeStageChange');
  post._isSaving = true;
  console.log('[PCS] LOCAL UPDATE:', postId, newStage, Date.now());

  // -- 2. Instant UI re-render (before DB) --
  _renderPCS(postId);
  triggerStageConfirmation();
  _renderBackgroundViews();

  // -- 3. Async DB persistence  -  isolated from side effects --
  _executeStageChangeAsync(post, postId, newStage, previousStage);
}

async function _executeStageChangeAsync(post, postId, newStage, previousStage) {
  // -- DB WRITE  -  rollback ONLY if this fails --
  const actor = resolveActor();
  try {
    console.log('[PCS] DB WRITE SENT:', postId, newStage, Date.now());

    const rows = await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: toDbStage(newStage), updated_at: new Date().toISOString(), status_changed_at: new Date().toISOString(), updated_by: actor }),
    });

    console.log('[PCS] DB WRITE SUCCESS:', postId, newStage, Date.now());

    // Apply server response
    if (Array.isArray(rows) && rows[0]) {
      const server = normalise(rows)[0];
      if (server.stage) server.stage = toUiStage(server.stage);
      Object.assign(post, server);
    }
    post._isSaving = false;

    // FINAL TRUTH RENDER
    _renderPCS(postId);
    _renderBackgroundViews();
    console.log('[PCS] FINAL RENDER SYNC:', postId, post.stage, Date.now());

  } catch (err) {
    console.error('[PCS] DB WRITE FAILED:', postId, err);

    post._isSaving = false;
    setStage(post, previousStage, '_executeStageChange_rollback');

    _renderPCS(postId);
    _renderBackgroundViews();
    showToast('Update failed  -  rolled back', 'error');
    return; // STOP  -  do not run side effects
  }

  // -- NON-CRITICAL  -  completely outside DB try/catch --
  try { logActivity({ post_id: postId, actor: actor, actor_role: currentRole, action: `Stage -> ${newStage}` }); } catch(e) { console.warn('[PCS] logActivity failed:', e); }
  try { showUndoToast(`Moved to ${newStage}`, () => _executeStageChange(postId, previousStage)); } catch(e) { console.warn('[PCS] showUndoToast failed:', e); }
}


function triggerStageConfirmation() {
  const el = document.getElementById('pcs-screen');
  if (!el) return;
  el.classList.add('pcs-confirm');
  setTimeout(() => { el.classList.remove('pcs-confirm'); }, 420);
}

function _buildStageProgress(stageLC) {
  const steps = [
    { key: 'in_production',      label: 'Production' },
    { key: 'ready',              label: 'Ready' },
    { key: 'awaiting_approval',  label: 'Approval' },
    { key: 'scheduled',          label: 'Scheduled' },
    { key: 'published',          label: 'Published' },
  ];
  // Normalise variant stages to a progress step
  const norm =
    (stageLC === 'awaiting_brand_input') ? 'in_production'     :
    (stageLC === 'parked')               ? 'scheduled'         :
    (stageLC === 'rejected')             ? 'in_production'     :
    stageLC;

  const activeIdx = steps.findIndex(function(s) { return s.key === norm; });

  var html = steps.map(function(s, i) {
    var isDone    = activeIdx !== -1 && i < activeIdx;
    var isCurrent = i === activeIdx;
    var dotCls = isDone ? 'pc-pipe-dot done' : isCurrent ? 'pc-pipe-dot current' : 'pc-pipe-dot future';
    var lblCls = isDone ? 'pc-pipe-lbl done' : isCurrent ? 'pc-pipe-lbl current' : 'pc-pipe-lbl future';
    return '<div class="pc-pipe-step">' +
      '<div class="' + dotCls + '"></div>' +
      '<div class="' + lblCls + '">' + s.label + '</div>' +
    '</div>';
  }).join('');

  return '<div class="pc-pipeline">' + html + '</div>';
}

function _buildInlineActions(canvaUrl, linkedinUrl, isPublished, canEdit, postId, stageLC) {
  // URL-aware label for the design link
  var designLabel = canvaUrl
    ? (canvaUrl.includes('canva.com') ? 'Canva' : canvaUrl.includes('linkedin.com') ? 'LinkedIn' : 'Design')
    : '';

  var links = '';
  if (canvaUrl) {
    links += '<a href="' + esc(canvaUrl) + '" target="_blank" rel="noopener" class="pc-action-link canva" onclick="closePCS()">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
      esc(designLabel) + '</a>';
  }
  if (linkedinUrl) {
    links += '<a href="' + esc(linkedinUrl) + '" target="_blank" rel="noopener" class="pc-action-link linkedin" onclick="closePCS()">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
      'LinkedIn</a>';
  }
  if (!canvaUrl && canEdit) {
    links += '<button class="pc-action-link canva" onclick="_pcsEditLink(\'' + esc(postId) + '\',\'canva\')">+ Design</button>';
  }
  if (!linkedinUrl && canEdit) {
    links += '<button class="pc-action-link linkedin" onclick="_pcsEditLink(\'' + esc(postId) + '\',\'linkedin\')">LinkedIn</button>';
  }

  // Attach URL editor
  var attachRow = canEdit
    ? '<div class="pcs-attach-row" id="pcs-attach-row-' + esc(postId) + '" style="display:none">' +
        '<input type="url" class="pcs-attach-input" id="pcs-attach-input-' + esc(postId) + '" placeholder="Paste link...">' +
        '<button class="pcs-attach-save" onclick="pcsSaveAttach(\'' + esc(postId) + '\')">Save</button>' +
      '</div>' +
      '<button class="pcs-attach-cancel" id="pcs-attach-cancel-' + esc(postId) + '" style="display:none" onclick="pcsCloseAttach(\'' + esc(postId) + '\')">Cancel</button>'
    : '';

  return '<div class="pc-actions-block">' + links + attachRow + '</div>';
}

function _pcsEditLink(postId, target) {
  _pcsEditingTarget = target; // 'canva' or 'linkedin'
  const row = document.getElementById(`pcs-attach-row-${postId}`);
  const cancel = document.getElementById(`pcs-attach-cancel-${postId}`);
  if (!row) return;
  row.style.display = 'flex';
  if (cancel) cancel.style.display = '';
  // Close any confirm overlay first  -  only one interactive layer at a time
  _removePcsConfirm();
  const input = document.getElementById(`pcs-attach-input-${postId}`);
  if (input) {
    input.value = '';
    input.placeholder = target === 'linkedin' ? 'Paste LinkedIn link...' : 'Paste Canva link...';
    input.focus();
    input.onkeydown = function(e) {
      if (e.key === 'Escape') { pcsCloseAttach(postId); }
    };
  }
}

// Legacy alias  -  attach toggle used in _showStageConfirm guard
function pcsToggleAttach(postId) { _pcsEditLink(postId, _pcsEditingTarget || 'canva'); }

function pcsCloseAttach(postId) {
  _pcsEditingTarget = null;
  const row = document.getElementById(`pcs-attach-row-${postId}`);
  const cancel = document.getElementById(`pcs-attach-cancel-${postId}`);
  if (row) row.style.display = 'none';
  if (cancel) cancel.style.display = 'none';
}

async function pcsSaveAttach(postId) {
  const input = document.getElementById(`pcs-attach-input-${postId}`);
  const url = (input?.value || '').trim();
  if (!url || !url.startsWith('http')) { showToast('Enter a valid URL', 'error'); return; }
  // Save to the field that matches the editing target  -  never infer from stage
  const field = _pcsEditingTarget === 'linkedin' ? 'linkedinUrl' : 'postLink';
  await updatePost(postId, field, url);
  // Clear editing state and hide attach row (auto-disappear)
  _pcsEditingTarget = null;
  pcsCloseAttach(postId);
  // Re-render design section with updated links
  const post = getPostById(postId);
  if (post) {
    const stageLC     = post.stage || '';
    const isPublished = stageLC === 'published';
    const canvaUrl    = post.postLink || '';
    const linkedinUrl = post.linkedinUrl || '';
    const canEdit = effectiveRole !== 'Client';
    const el = document.getElementById('pcs-action-btn-wrap');
    if (el) el.innerHTML = _buildInlineActions(canvaUrl, linkedinUrl, isPublished, canEdit, postId, stageLC);
  }
}

function refreshSystemViews() {
  // Only render the active tab  -  no need to rebuild hidden containers
  const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'tasks';
  try {
    if (activeTab === 'tasks')    renderTasks();
    else if (activeTab === 'pipeline') renderPipeline();
    else if (activeTab === 'library')  renderLibrary();
  } catch(e) { console.error('refreshSystemViews:', e); }
}

// Re-render all stage-dependent background views (dashboard + active tab)
function _renderBackgroundViews() {
  try { renderDashboard(); } catch(e) { console.error('renderDashboard:', e); }
  // refreshSystemViews renders the active tab (pipeline/tasks/library).
  // Pipeline filter is preserved  -  refreshSystemViews calls renderPipeline which
  // reads window.pcsPipelineFilter directly. Single render, no duplicates.
  try { refreshSystemViews(); } catch(e) { console.error('refreshSystemViews:', e); }
}

function handleOwnerChange(postId, value) {
  updatePost(postId, 'owner', value);
}

async function updatePost(postId, field, value) {
  // Sanitize pillar before any write  -  enforce lowercase
  if (field === 'contentPillar') value = sanitizePillar(value);

  // Optimistic update in memory  -  store old value for rollback
  const post = getPostById(postId);
  if (!post) return;
  // Block duplicate writes  -  if a PATCH is already in-flight, bail
  if (post._isSaving) return;
  const oldValue = post[field];
  post[field] = value;
  post._isSaving = true;

  // Sync subtitle immediately after optimistic update
  _updateSubtitle(post);

  const dbField = {
    title:         'title',
    stage:         'stage',
    contentPillar: 'content_pillar',
    owner:         'owner',
    location:      'location',
    format:        'format',
    targetDate:    'target_date',
    postLink:      'canva_link',
    linkedinUrl:   'linkedin_link',
    comments:      'comments',
  }[field] || field;

  // Guard: reject any legacy/invalid field names before they reach DB
  const _blocked = ['post_link', 'linkedin_url', 'linkedinLink'];
  if (_blocked.includes(dbField)) {
    console.error('[updatePost] BLOCKED invalid DB field:', dbField, '(from UI field:', field + ')');
    post._isSaving = false;
    return;
  }

  // Convert stage value to DB format before sending
  const wireValue = (dbField === 'stage') ? toDbStage(value) : (value || null);
  const _writePayload = { [dbField]: wireValue, updated_at: new Date().toISOString() };
  console.log('FINAL PAYLOAD:', JSON.stringify(_writePayload, null, 2));

  try {
    const rows = await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify(_writePayload),
    });
    // Apply server truth  -  preserves the exact memory reference
    if (Array.isArray(rows) && rows[0]) {
      const server = normalise(rows)[0];
      if (server.stage) server.stage = toUiStage(server.stage);
      Object.assign(post, server);
    }
    post._isSaving = false;
    showToast('Saved', 'success');
    refreshSystemViews();
  } catch(e) {
    // Rollback optimistic update on failure
    post._isSaving = false;
    post[field] = oldValue;
    scheduleRender();
    showToast('Save failed', 'error');
  }
}

function _loadPCSActivity(postId, bodyEl) {
  // READ from activity_log removed - activity_log contains system noise.
  // Use notifications table for user-facing messages instead.
  bodyEl.innerHTML = '<div class="pcs-activity-empty">No activity yet.</div>';
}

function _buildInfoGrid(post, canEdit, id) {
  var LOCS     = ['Mumbai','Sakarwadi','Sameerwadi','Other'];
  var OWNERS   = ALLOWED_OWNERS;
  var FORMATS  = ['Creative','Photo','Carousel','Video','Text'];

  var stageLC     = post.stage || '';
  var isPublished = stageLC === 'published';
  var dateLabel   = isPublished ? 'Published Date' : 'Target Date';
  var dateValue   = isPublished
    ? (post.targetDate || '')
    : (post.targetDate || '');

  // Stage color class
  var stageColorCls = '';
  if (stageLC === 'in_production' || stageLC === 'awaiting_brand_input') stageColorCls = ' pc-meta-val--production';
  else if (stageLC === 'ready') stageColorCls = ' pc-meta-val--ready';
  else if (stageLC === 'awaiting_approval') stageColorCls = ' pc-meta-val--approval';
  else if (stageLC === 'scheduled') stageColorCls = ' pc-meta-val--scheduled';
  else if (stageLC === 'published') stageColorCls = ' pc-meta-val--published';

  // Overdue date class
  var dateColorCls = '';
  if (!isPublished && dateValue) {
    var td = parseDate(dateValue);
    var now = new Date(); now.setHours(0,0,0,0);
    if (td && td < now) dateColorCls = ' pc-meta-val--overdue';
  }

  function mkSel(field, opts, val, dbField, displayMap) {
    var options = opts.map(function(o) {
      var label = displayMap ? (displayMap[o] || o) : o;
      return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    return '<select' + (canEdit ? ' onchange="updatePost(\'' + esc(id) + '\',\'' + (dbField||field) + '\',this.value)"' : ' disabled') + '>' + options + '</select>';
  }

  function mkRo(val) { return '<span>' + esc(val || ' - ') + '</span>'; }

  // Stage selector
  var stageSel = canEdit
    ? (function() {
        var opts = STAGES_DB.map(function(o) {
          var dl = STAGE_DISPLAY ? (STAGE_DISPLAY[o] || o) : o;
          return '<option value="' + esc(o) + '"' + (o === (post.stage||'') ? ' selected' : '') + '>' + esc(dl) + '</option>';
        }).join('');
        return '<select onchange="changeStage(this.value)">' + opts + '</select>';
      })()
    : '<span>' + esc(stageStyle(post.stage).label || post.stage || ' - ') + '</span>';

  // Date field
  var dateInput = canEdit
    ? '<label class="pcs-date-tap"><span class="pcs-date-text">' + esc(displayDate(dateValue)) + '</span>' +
      '<input type="date" class="pcs-date-input-native" value="' + esc(dateValue) + '"' +
      ' onchange="this.closest(\'.pcs-date-tap\').querySelector(\'.pcs-date-text\').textContent=displayDate(this.value);updatePost(\'' + esc(id) + '\',\'targetDate\',this.value)"' +
      ' style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer"></label>'
    : '<span>' + esc(formatDate(dateValue) || ' - ') + '</span>';

  function cell(label, content, extraCls) {
    return '<div class="pc-meta-cell">' +
      '<div class="pc-meta-lbl">' + label + '</div>' +
      '<div class="pc-meta-val' + (extraCls || '') + '">' + content + '</div>' +
    '</div>';
  }

  return '<div class="pc-meta-block"><div class="pc-meta-grid">' +
    cell('Stage', stageSel, stageColorCls) +
    cell('Owner', canEdit
      ? (function() {
          var opts = OWNERS.map(function(o) {
            return '<option value="' + esc(o) + '"' + (o === (post.owner||'') ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('');
          return '<select onchange="handleOwnerChange(\'' + esc(id) + '\',this.value)">' + opts + '</select>';
        })()
      : mkRo(formatOwner(post.owner))) +
    cell('Pillar', canEdit ? mkSel('contentPillar', PILLARS_DB, post.contentPillar||'', 'contentPillar', PILLAR_DISPLAY) : mkRo(formatPillarDisplay(post.contentPillar) || ' - ')) +
    cell('Location', canEdit ? mkSel('location', LOCS, post.location||'', 'location') : mkRo(post.location)) +
    cell('Format', canEdit ? mkSel('format', FORMATS, post.format||'', 'format') : mkRo(post.format)) +
    cell(dateLabel, dateInput, dateColorCls) +
  '</div></div>';
}

function _buildNotes(post, canEdit, id) {
  if (!canEdit && !post.comments) return '';

  var notesInput = canEdit
    ? '<textarea class="pc-notes-area" placeholder="Brief or caption..."' +
      ' onblur="updatePost(\'' + esc(id) + '\',\'comments\',this.value)">' + esc(post.comments || '') + '</textarea>'
    : (post.comments ? '<div class="pc-notes-ro">' + esc(post.comments) + '</div>' : '');

  return '<div class="pc-notes-block">' +
    '<div class="pc-notes-lbl">Notes</div>' +
    (notesInput || '<div class="pcs-activity-empty">No notes.</div>') +
  '</div>';
}

// -- Stage advance button (FIX 7) --
var _ADVANCE_SEQ = ['in_production', 'ready', 'awaiting_approval', 'scheduled', 'published'];
var _ADVANCE_LABELS = {
  'ready': 'Move to Ready',
  'awaiting_approval': 'Send for Approval',
  'scheduled': 'Mark Scheduled',
  'published': 'Mark Published'
};
var _ADVANCE_CLS = {
  'ready': 'to-ready',
  'awaiting_approval': 'to-approval',
  'scheduled': 'to-scheduled',
  'published': 'to-published'
};

function _renderAdvanceButton(stageLC) {
  var block = document.getElementById('pc-advance-block');
  var btn = document.getElementById('pc-advance-btn');
  var label = document.getElementById('pc-advance-label');
  if (!block || !btn || !label) return;

  // Hide advance for terminal/special stages
  if (stageLC === 'published' || stageLC === 'parked' || stageLC === 'rejected') {
    block.style.display = 'none';
    return;
  }

  // awaiting_brand_input skips ahead to scheduled
  if (stageLC === 'awaiting_brand_input') {
    label.textContent = 'Mark Scheduled';
    btn.className = 'pc-advance-btn';
    btn.classList.add('to-scheduled');
    btn.onclick = function() { changeStage('scheduled'); };
    block.style.display = '';
    return;
  }

  var idx = _ADVANCE_SEQ.indexOf(stageLC);
  if (idx < 0 || idx >= _ADVANCE_SEQ.length - 1) {
    block.style.display = 'none';
    return;
  }

  var nextStage = _ADVANCE_SEQ[idx + 1];
  label.textContent = _ADVANCE_LABELS[nextStage] || ('Move to ' + nextStage);

  // Remove old color classes
  btn.className = 'pc-advance-btn';
  var cls = _ADVANCE_CLS[nextStage];
  if (cls) btn.classList.add(cls);

  btn.onclick = function() { changeStage(nextStage); };
  block.style.display = '';
}

// -- Activity count (FIX 9) --
function _renderActivityCount(postId) {
  var countEl = document.getElementById('pc-activity-count');
  if (!countEl) return;
  countEl.textContent = '';
  // Attempt to count from already-loaded activity body
  var body = document.getElementById('pcs-activity-body');
  if (body && body.dataset.loadedFor === postId) {
    var rows = body.querySelectorAll('.pcs-activity-row');
    if (rows.length) countEl.textContent = rows.length;
  }
}

function _removePcsConfirm() {
  document.querySelectorAll('.pcs-confirm-overlay').forEach(el => el.remove());
}

function pcsConfirmDelete() {
  // Guard: don't create if PCS is already closed (handles race with delayed click after close)
  const pcsOpen = document.getElementById('pcs-overlay')?.classList.contains('open');
  if (!pcsOpen || !_pcs.postId) return;
  // Only one confirm overlay may exist at a time
  _removePcsConfirm();
  const overlay = document.createElement('div');
  overlay.className = 'pcs-confirm-overlay';
  // Backdrop tap dismisses the confirm overlay
  overlay.addEventListener('click', function(e) { if (e.target === this) this.remove(); });
  overlay.innerHTML = `
    <div class="pcs-confirm-sheet">
      <div class="pcs-confirm-msg">Are you sure you want to delete this post?</div>
      <div class="pcs-confirm-btns">
        <button class="pcs-confirm-cancel" onclick="this.closest('.pcs-confirm-overlay').remove()">Cancel</button>
        <button class="pcs-confirm-delete" onclick="pcsDoDelete()">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function pcsDoDelete() {
  _removePcsConfirm();
  const id = _pcs.postId;
  if (!id) return;
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('Post deleted');
    closePCS();
    await loadPosts();
  } catch(e) { showToast('Delete failed', 'error'); }
}
