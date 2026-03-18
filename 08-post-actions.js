/* ═══════════════════════════════════════════════
   08-post-actions.js — Stage updates & modals
═══════════════════════════════════════════════ */
console.log("LOADED:", "08-post-actions.js");

async function quickStage(postId, newStage) {
  const post = getPostById(postId);
  if (!post) return;
  const oldStage = post.stage;
  post.stage = newStage;
  scheduleRender();
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: newStage, updated_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor_name: localStorage.getItem('gbl_email') || currentRole, actor_role: currentRole, action: `Stage → ${newStage}` });
    showUndoToast(`Moved to ${newStage}`, () => quickStage(postId, oldStage));
  } catch (err) {
    post.stage = oldStage;
    scheduleRender();
    showToast('Update failed — try again', 'error');
  }
}

function openAdminEdit(postId) {
  const post = getPostById(postId);
  if (!post) return;
  window._modalOpen = true;
  document.getElementById('ae-postid').textContent   = postId;
  document.getElementById('ae-title').value          = getTitle(post);
  document.getElementById('ae-owner').value          = getResponsibleOwner(post) || '—';
  document.getElementById('ae-pillar').value         = post.contentPillar || '';
  document.getElementById('ae-location').value       = post.location || '';
  document.getElementById('ae-date').value           = post.targetDate || '';
  document.getElementById('ae-comments').value       = post.comments || '';
  document.getElementById('ae-postlink').value       = post.postLink || '';
  const sel = document.getElementById('ae-stage');
  sel.innerHTML = PIPELINE_ORDER.map(s => `<option value="${s}" ${post.stage===s?'selected':''}>${s}</option>`).join('');
  document.getElementById('ae-save-btn').dataset.postId = postId;
  document.getElementById('admin-edit-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAdminEdit() {
  document.getElementById('admin-edit-overlay').classList.remove('open');
  document.body.style.overflow = '';
  window._modalOpen = false;
  _drainDeferredRender();
}

async function saveAdminEdit() {
  const postId   = document.getElementById('ae-save-btn').dataset.postId;
  const title    = document.getElementById('ae-title').value.trim();
  const owner    = document.getElementById('ae-owner').value;
  const pillar   = document.getElementById('ae-pillar').value;
  const location = document.getElementById('ae-location').value;
  const stage    = document.getElementById('ae-stage').value;
  const date     = document.getElementById('ae-date').value;
  const comments = document.getElementById('ae-comments').value.trim();
  const postLink = document.getElementById('ae-postlink').value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }
  const btn = document.getElementById('ae-save-btn');
  btn.disabled = true;
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, owner: owner||null, content_pillar: sanitizePillar(pillar)||null, location: location||null, stage: stage||null, target_date: date||null, comments: comments||null, post_link: postLink||null, updated_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor_name: 'Admin', actor_role: 'Admin', action: 'Full edit saved' });
    closeAdminEdit();
    await loadPosts();
    showToast('Post saved ✓', 'success');
  } catch (err) {
    showToast('Save failed — try again', 'error');
    btn.disabled = false;
  }
}

async function clientApprove(postId, btn) {
  const post = getPostById(postId);
  if (!post) return;
  const alreadyApproved = (post.stage||'').toLowerCase().trim() === 'scheduled';
  if (alreadyApproved) { showToast('Already approved ✓', 'success'); return; }
  if (btn) btn.disabled = true;
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'scheduled', updated_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor_name: 'Client', actor_role: 'Client', action: 'Approved — moved to Scheduled' });
    const confirmEl = document.getElementById(`approved-confirm-${postId}`);
    if (confirmEl) confirmEl.classList.add('active');
    post.stage = 'scheduled';
    setTimeout(() => loadPostsForClient(), 1200);
  } catch { if (btn) btn.disabled = false; showToast('Failed — try again', 'error'); }
}

function showRevisionInput(postId) {
  const wrap = document.getElementById(`revision-wrap-${postId}`);
  if (wrap) { wrap.classList.toggle('active'); document.getElementById(`revision-text-${postId}`)?.focus(); }
}

async function submitClientRevision(postId) {
  const text = (document.getElementById(`revision-text-${postId}`)?.value||'').trim();
  if (!text) { showToast('Please describe what you want changed', 'error'); return; }
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'revisions needed', comments: text, updated_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor_name: 'Client', actor_role: 'Client', action: `Revision requested: ${text.substring(0,80)}` });
    const item = document.getElementById(`apv-item-${postId}`);
    if (item) item.innerHTML = `<div style="padding:var(--sp-4);text-align:center;color:var(--text2);font-size:14px">↺ Revision sent — the team will take care of it.</div>`;
    setTimeout(() => loadPostsForClient(), 1000);
  } catch { showToast('Failed — try again', 'error'); }
}

async function clientAcknowledge(postId) {
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'in production', updated_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor_name: 'Client', actor_role: 'Client', action: 'Acknowledged — sending via WhatsApp' });
    showToast('Got it! The team has been notified.', 'success');
    setTimeout(() => loadPostsForClient(), 800);
  } catch { showToast('Failed — try again', 'error'); }
}

async function handleClientUpload(input, postId) {
  const file = input.files[0];
  if (!file) return;
  const label = document.getElementById(`upload-label-${postId}`);
  if (label) label.textContent = 'Uploading…';
  try {
    const url = await uploadPostAsset(file, postId);
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ post_link: url, stage: 'in production', updated_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor_name: 'Client', actor_role: 'Client', action: 'Uploaded asset' });
    const confirmEl = document.getElementById(`upload-confirm-${postId}`);
    if (confirmEl) confirmEl.innerHTML = `<div style="color:var(--c-green);font-size:13px;margin-top:var(--sp-2)">✓ File uploaded! The team has been notified.</div>`;
    if (label) label.textContent = '↑ Upload Here';
    setTimeout(() => loadPostsForClient(), 1000);
  } catch (err) {
    if (label) label.textContent = '↑ Upload Here';
    showToast('Upload failed — try again', 'error');
  }
}

function scrollToNewRequest() {
  document.getElementById('client-request-section')?.scrollIntoView({ behavior: 'smooth' });
}

async function submitClientRequest() {
  const brief = document.getElementById('client-req-brief')?.value.trim();
  if (!brief) { showToast('Please describe what you need', 'error'); return; }
  const btn  = document.getElementById('client-req-submit');
  const fileInput = document.getElementById('client-req-file');
  const file = fileInput?.files[0] || null;
  if (btn) btn.disabled = true;
  try {
    const postId = 'REQ-' + Date.now();
    const email  = localStorage.getItem('gbl_email') || 'Client';
    await apiFetch('/posts', {
      method: 'POST',
      body: JSON.stringify({ post_id: postId, title: `Client Request — ${new Date().getDate()} ${MONTHS[new Date().getMonth()]}`, stage: 'awaiting brand input', owner: email, comments: brief, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    if (file) await uploadPostAsset(file, postId);
    await logActivity({ post_id: postId, actor_name: email, actor_role: 'Client', action: `New request: ${brief.substring(0,60)}` });
    if (document.getElementById('client-req-brief')) document.getElementById('client-req-brief').value = '';
    if (fileInput) fileInput.value = '';
    if (btn) btn.disabled = false;
    showToast('Request sent ✓ The team will be in touch.', 'success');
    setTimeout(() => loadPostsForClient(), 800);
  } catch (err) {
    showToast('Failed — try again', 'error');
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
      body: JSON.stringify({ comments: `⚑ ${msg}`, updated_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor_name: currentRole, actor_role: currentRole, action: `Issue flagged: ${msg.substring(0,80)}` });
    showToast('Issue flagged — team has been notified', 'success');
    await loadPosts();
  } catch { showToast('Failed — try again', 'error'); }
}

async function nudgeClient(postId, title, targetDate) {
  const days      = daysInStage(getPostById(postId));
  const dateInfo  = targetDate ? `\n\nTarget date: ${formatDate(targetDate)}` : '';
  const msg       = encodeURIComponent(`Hi! Just a quick note — we're waiting on your input for:\n\n"${title}"\n\nWhen you get a chance, could you check in?${dateInfo}\n\nThanks!`);
  const waLink    = `https://wa.me/?text=${msg}`;
  window.open(waLink, '_blank');
  await logActivity({ post_id: postId, actor_name: currentRole, actor_role: currentRole, action: `Client nudged after ${days}d` });
}

async function copyCaption(postId) {
  const post = getPostById(postId);
  if (!post || !post.comments) { showToast('No caption found', 'error'); return; }
  try {
    await navigator.clipboard.writeText(post.comments);
    showToast('Caption copied ✓', 'success');
  } catch { showToast('Could not copy — try manually', 'error'); }
}

// ── Delete post (Admin only) ──────────────────
async function deletePost(postId) {
  const post = getPostById(postId);
  const title = post ? getTitle(post) : postId;
  if (!confirm(`Delete "${title}"?\n\nThis cannot be undone.`)) return;
  const btn = document.getElementById('ae-delete-btn');
  if (btn) btn.disabled = true;
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, { method: 'DELETE' });
    await logActivity({ post_id: postId, actor_name: 'Admin', actor_role: 'Admin', action: `Post deleted: ${title}` });
    closeAdminEdit();
    allPosts = allPosts.filter(p => getPostId(p) !== postId);
    scheduleRender();
    showToast('Post deleted', 'info');
  } catch {
    showToast('Delete failed — try again', 'error');
    if (btn) btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════
// PCS — Post Control Screen
// ═══════════════════════════════════════════════

const _pcs = {
  postId:  null,
  listKey: null,
  list:    [],
  idx:     0,
};
let _pcsCloseTimer = null; // tracks deferred forcePCSReset from closePCS
let _pcsEditingTarget = null; // 'canva' | 'linkedin' — which link the attach input saves to

function openPCS(postId, listKey) {
  // Cancel any deferred forcePCSReset from a previous closePCS() —
  // without this, a rapid close→open reopens the sheet, then the
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

  // 1. Clear every inline style — no stale transform/transition/opacity
  if (screen) {
    screen.style.cssText = '';
  }

  // 2. Show the overlay WITHOUT .open — screen sits at translateY(100%)
  //    via the base CSS rule, which is our desired starting position.
  overlay.classList.remove('open');
  overlay.style.display       = 'flex';
  overlay.style.pointerEvents = '';

  window._modalOpen = true;
  document.body.style.overflow = 'hidden';

  try {
    _renderPCS(postId);
  } catch (err) {
    console.error('[PCS] openPCS failed — cleaning up:', err);
    forcePCSReset();
    return;
  }

  // 3. Force Safari to commit the current computed transform (translateY(100%))
  //    before we add .open. Reading getComputedStyle().transform forces both
  //    style resolution AND layout — more reliable than offsetHeight on
  //    Mobile Safari, which can skip style recalc in some DOM states.
  if (screen) { void getComputedStyle(screen).transform; }

  // 4. Now add .open — CSS transition animates translateY(100%) → translateY(0).
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

// ═══════════════════════════════════════════════
// forcePCSReset — single authoritative cleanup
// Tears down ALL PCS visual state, compositing layers,
// and event-capturing surfaces. Safe to call multiple times.
// ═══════════════════════════════════════════════
function forcePCSReset() {
  var screen  = document.getElementById('pcs-screen');
  var overlay = document.getElementById('pcs-overlay');

  // 1. Nuke ALL inline styles on screen — catches any stale transform,
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
  const stageLC     = (post.stage || '').toLowerCase().trim();
  const isPublished = stageLC === 'published';
  const canvaUrl    = post.postLink || '';
  const linkedinUrl = post.linkedinUrl || '';
  const canEdit     = ['Admin','Servicing'].includes(currentRole);
  const dateValue   = isPublished ? (post.publishedDate || post.targetDate || '') : (post.targetDate || '');

  // 3. Render into DOM
  const elTitle    = document.getElementById('pcs-topbar-title');
  const elProgress = document.getElementById('pcs-progress-wrap');
  const elDesign   = document.getElementById('pcs-action-btn-wrap');
  const elFields   = document.getElementById('pcs-fields');
  const elActivity = document.getElementById('pcs-activity-body');

  // Title — inline editable on tap
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
  if (elFields)   elFields.innerHTML = _buildInfoGrid(post, canEdit, id) + _buildNotes(post, canEdit, id) + `<input type="hidden" id="pcs-post-id" value="${esc(id)}">`;

  // 5. Load activity asynchronously
  if (elActivity) {
    if (elActivity.dataset.loadedFor !== id) {
      elActivity.dataset.loadedFor = id;
      elActivity.innerHTML = '<div class="pcs-activity-loading">Loading…</div>';
      _loadPCSActivity(id, elActivity);
    }
  }
}

// ── Subtitle sync (single source of truth) ──────────────
function _updateSubtitle(post) {
  const el = document.getElementById('pcs-subtitle');
  if (!el || !post) return;
  const stLC = (post.stage || '').toLowerCase().trim();
  const isPub = stLC === 'published';
  const pLabel = post.contentPillar
    ? getPillarShort(post.contentPillar)
    : '—';
  const dVal = isPub ? (post.publishedDate || post.targetDate || '') : (post.targetDate || '');
  const dDisp = formatDate(dVal) || '—';
  const parts = [pLabel, getResponsibleOwner(post) || '—', dDisp];
  el.innerHTML = parts.map(p => `<span>${esc(p)}</span>`).join('<span class="pcs-subtitle-sep">\u00b7</span>');
}

// ── Inline title editing ──────────────
function _pcsTitleEdit(el, postId) {
  if (el.querySelector('input')) return; // already editing
  // Close other interactive layers — only one at a time
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

// ── Unified stage change with confirmation ──
function changeStage(newStage) {
  const postId = _pcs.postId;
  if (!postId) return;
  const post = getPostById(postId);
  if (!post) return;
  const current = (post.stage || '').toLowerCase().trim();
  if (current === newStage.toLowerCase().trim()) return; // same stage

  _showStageConfirm(postId, newStage);
}

function _showStageConfirm(postId, newStage) {
  _removePcsConfirm();
  // Close any open attach editor — only one interactive layer at a time
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

async function _executeStageChange(postId, newStage) {
  _removePcsConfirm();
  await quickStage(postId, newStage);
  // Immediately update the PCS pipeline visually
  _refreshPCSAfterStageChange(postId);
  refreshSystemViews();
}

// Targeted re-render of only the stage-dependent sections (no full re-render)
function _refreshPCSAfterStageChange(postId) {
  const post = getPostById(postId);
  if (!post || _pcs.postId !== postId) return;

  const stageLC     = (post.stage || '').toLowerCase().trim();
  const isPublished = stageLC === 'published';
  const canvaUrl    = post.postLink || '';
  const linkedinUrl = post.linkedinUrl || '';
  const canEdit     = ['Admin','Servicing'].includes(currentRole);
  const id          = getPostId(post);

  const elProgress = document.getElementById('pcs-progress-wrap');
  const elDesign   = document.getElementById('pcs-action-btn-wrap');
  const elFields   = document.getElementById('pcs-fields');

  if (elProgress) elProgress.innerHTML = _buildStageProgress(stageLC);
  if (elDesign)   elDesign.innerHTML   = _buildInlineActions(canvaUrl, linkedinUrl, isPublished, canEdit, id, stageLC);
  _updateSubtitle(post);
  // Note: elFields is intentionally NOT rebuilt here.
  // Rebuilding the grid via innerHTML destroys <select> and <input>
  // elements while other async saves (pillar, owner, etc.) may still
  // be in flight, causing those changes to silently revert.
}

function _buildStageProgress(stageLC) {
  const steps = [
    { key: 'in production',     label: 'Production' },
    { key: 'ready',             label: 'Ready' },
    { key: 'awaiting approval', label: 'Approval' },
    { key: 'scheduled',         label: 'Scheduled' },
    { key: 'published',         label: 'Published' },
  ];
  // Normalise all variant/edge stages to a progress step
  const norm =
    (stageLC === 'awaiting brand input') ? 'in production'     :
    (stageLC === 'revisions needed')     ? 'in production'     :
    (stageLC === 'draft')                ? 'in production'     :
    (stageLC === 'parked')               ? 'scheduled'         :
    (stageLC === 'archive')              ? 'published'         :
    stageLC;

  const activeIdx = steps.findIndex(s => s.key === norm);

  const html = steps.map((s, i) => {
    const isDone    = activeIdx !== -1 && i < activeIdx;
    const isCurrent = i === activeIdx;
    const dotCls = isDone ? 'pipeline-dot completed' : isCurrent ? 'pipeline-dot active' : 'pipeline-dot pending';
    return `<div class="pipeline-stage">
      <div class="${dotCls}"></div>
      <div class="pipeline-label">${s.label}</div>
    </div>`;
  }).join('');

  return `<div class="pipeline-container">${html}</div>`;
}

function _buildInlineActions(canvaUrl, linkedinUrl, isPublished, canEdit, postId, stageLC) {
  // Design section — each link gets its own button + pencil edit icon.
  // Pipeline is the sole stage control; no Next Stage chip here.
  const pencilStyle = 'style="font-size:12px;margin-left:6px;opacity:0.55;cursor:pointer;background:none;border:none;padding:2px"';

  let buttons = '';
  if (canvaUrl) {
    buttons += `<div class="pcs-link-group" style="display:inline-flex;align-items:center">
      <a href="${esc(canvaUrl)}" target="_blank" rel="noopener" class="pcs-action-chip pcs-action-chip--canva" onclick="closePCS()">Canva ↗</a>
      ${canEdit ? `<button class="pcs-link-edit pcs-edit-canva" ${pencilStyle} onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='0.55'" onclick="_pcsEditLink('${esc(postId)}','canva')">✎</button>` : ''}
    </div>`;
  }
  if (isPublished && linkedinUrl) {
    buttons += `<div class="pcs-link-group" style="display:inline-flex;align-items:center">
      <a href="${esc(linkedinUrl)}" target="_blank" rel="noopener" class="pcs-action-chip pcs-action-chip--linkedin" onclick="closePCS()">LinkedIn ↗</a>
      ${canEdit ? `<button class="pcs-link-edit pcs-edit-linkedin" ${pencilStyle} onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='0.55'" onclick="_pcsEditLink('${esc(postId)}','linkedin')">✎</button>` : ''}
    </div>`;
  }
  if (!canvaUrl && canEdit) {
    buttons += `<button class="pcs-action-chip pcs-action-chip--secondary" onclick="_pcsEditLink('${esc(postId)}','canva')">+ Design</button>`;
  }
  if (isPublished && !linkedinUrl && canEdit) {
    buttons += `<button class="pcs-action-chip pcs-action-chip--secondary" onclick="_pcsEditLink('${esc(postId)}','linkedin')">+ LinkedIn</button>`;
  }

  // Attach URL editor — inline, aligned to primary button width
  const attachRow = canEdit
    ? `<div class="pcs-attach-row" id="pcs-attach-row-${esc(postId)}" style="display:none">
        <input type="url" class="pcs-attach-input" id="pcs-attach-input-${esc(postId)}" placeholder="Paste link...">
        <button class="pcs-attach-save" onclick="pcsSaveAttach('${esc(postId)}')">Save</button>
      </div>
      <button class="pcs-attach-cancel" id="pcs-attach-cancel-${esc(postId)}" style="display:none" onclick="pcsCloseAttach('${esc(postId)}')">Cancel</button>`
    : '';

  return `<div class="pcs-design-stack">${buttons}${attachRow}</div>`;
}

function _pcsEditLink(postId, target) {
  _pcsEditingTarget = target; // 'canva' or 'linkedin'
  const row = document.getElementById(`pcs-attach-row-${postId}`);
  const cancel = document.getElementById(`pcs-attach-cancel-${postId}`);
  if (!row) return;
  row.style.display = 'flex';
  if (cancel) cancel.style.display = '';
  // Close any confirm overlay first — only one interactive layer at a time
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

// Legacy alias — attach toggle used in _showStageConfirm guard
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
  // Save to the field that matches the editing target — never infer from stage
  const field = _pcsEditingTarget === 'linkedin' ? 'linkedinUrl' : 'postLink';
  await updatePost(postId, field, url);
  // Clear editing state and hide attach row (auto-disappear)
  _pcsEditingTarget = null;
  pcsCloseAttach(postId);
  // Re-render design section with updated links
  const post = getPostById(postId);
  if (post) {
    const stageLC     = (post.stage || '').toLowerCase().trim();
    const isPublished = stageLC === 'published';
    const canvaUrl    = post.postLink || '';
    const linkedinUrl = post.linkedinUrl || '';
    const canEdit = ['Admin','Servicing'].includes(currentRole);
    const el = document.getElementById('pcs-action-btn-wrap');
    if (el) el.innerHTML = _buildInlineActions(canvaUrl, linkedinUrl, isPublished, canEdit, postId, stageLC);
  }
}

function refreshSystemViews() {
  // Only render the active tab — no need to rebuild hidden containers
  const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'tasks';
  try {
    if (activeTab === 'tasks')    renderTasks();
    else if (activeTab === 'pipeline') renderPipeline();
    else if (activeTab === 'upcoming') renderUpcoming();
    else if (activeTab === 'library')  renderLibrary();
  } catch(e) { console.error('refreshSystemViews:', e); }
}

async function updatePost(postId, field, value) {
  // Sanitize pillar before any write — enforce lowercase
  if (field === 'contentPillar') value = sanitizePillar(value);

  // Optimistic update in memory — store old value for rollback
  const post = getPostById(postId);
  const oldValue = post ? post[field] : undefined;
  if (post) post[field] = value;

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
    postLink:      'post_link',
    linkedinUrl:   'linkedin_url',
    comments:      'comments',
  }[field] || field;

  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ [dbField]: value || null, updated_at: new Date().toISOString() }),
    });
    showToast('Saved', 'success');
    refreshSystemViews();
  } catch(e) {
    // Rollback optimistic update on failure
    if (post) post[field] = oldValue;
    scheduleRender();
    showToast('Save failed', 'error');
  }
}

function _loadPCSActivity(postId, bodyEl) {
  apiFetch(`/activity_log?post_id=eq.${encodeURIComponent(postId)}&order=created_at.desc&limit=25`)
    .then(rows => {
      if (_pcs.postId !== postId) return; // stale response — discard
      if (!rows || !rows.length) {
        bodyEl.innerHTML = '<div class="pcs-activity-empty">No activity yet.</div>';
        return;
      }
      bodyEl.innerHTML = rows.map(r => {
        const ago = r.created_at ? timeAgo(r.created_at) : '';
        return `<div class="pcs-activity-row">
          <span class="pcs-activity-who">${esc(r.actor_name || r.actor || 'System')}</span>
          <span class="pcs-activity-what">${esc(r.action || '')}</span>
          <span class="pcs-activity-when">${esc(ago)}</span>
        </div>`;
      }).join('');
    })
    .catch(() => { bodyEl.innerHTML = '<div class="pcs-activity-empty">Could not load.</div>'; });
}

function _buildInfoGrid(post, canEdit, id) {
  const LOCS     = ['Mumbai','Sakarwadi','Sameerwadi','Other'];
  const OWNERS   = ALLOWED_OWNERS;
  const FORMATS  = ['Creative','Photo','Carousel','Video','Text'];

  const stageLC     = (post.stage || '').toLowerCase().trim();
  const isPublished = stageLC === 'published';
  const dateLabel   = isPublished ? 'Published Date' : 'Target Date';
  const dateValue   = isPublished
    ? (post.publishedDate || post.targetDate || '')
    : (post.targetDate || '');
  const { hex } = stageStyle(post.stage);

  const sel = (field, opts, val, dbField, displayMap) =>
    `<select class="pcs-field-val" ${canEdit ? `onchange="updatePost('${esc(id)}','${dbField||field}',this.value)"` : 'disabled'}>
       ${opts.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(displayMap ? (displayMap[o] || o) : o)}</option>`).join('')}
     </select>`;

  const ro = val => `<span class="pcs-field-val-ro">${esc(val || '—')}</span>`;

  // Stage selector uses unified changeStage() with confirmation
  const stageSel = canEdit
    ? `<select class="pcs-field-val" onchange="changeStage(this.value)">
         ${STAGES_DB.map(o => `<option value="${esc(o)}" ${o === (post.stage||'') ? 'selected' : ''}>${esc(STAGE_DISPLAY ? (STAGE_DISPLAY[o] || o) : o)}</option>`).join('')}
       </select>`
    : `<span class="pcs-field-val-ro" style="color:${hex}">${esc(stageStyle(post.stage).label || post.stage || '—')}</span>`;

  // Date field — full click area with 44px minimum tap target
  const dateInput = canEdit
    ? `<label class="pcs-date-tap"><span class="pcs-date-text">${esc(displayDate(dateValue))}</span><input type="date" class="pcs-field-val pcs-date-input-native" value="${esc(dateValue)}"
             onchange="this.closest('.pcs-date-tap').querySelector('.pcs-date-text').textContent=displayDate(this.value);updatePost('${esc(id)}','targetDate',this.value)" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;color:transparent;background:transparent;border:none"><svg class="pcs-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></label>`
    : `<div class="pcs-date-tap"><span class="pcs-date-text">${esc(formatDate(dateValue) || '—')}</span><svg class="pcs-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>`;

  const cell = (label, content) =>
    `<div class="pcs-field">
       <div class="pcs-field-label">${label}</div>
       <div class="pcs-value-shell">${content}</div>
     </div>`;

  return `
    <div class="pcs-info-divider"></div>
    <div class="pcs-section">
      <div class="pcs-grid">
        ${cell('Stage',    stageSel)}
        ${cell('Owner',    ro(getResponsibleOwner(post) || '—'))}
        ${cell('Pillar',   canEdit ? sel('contentPillar', PILLARS_DB, post.contentPillar||'', 'contentPillar', PILLAR_DISPLAY) : ro(formatPillarDisplay(post.contentPillar) || '—'))}
        ${cell('Location', canEdit ? sel('location', LOCS, post.location||'', 'location') : ro(post.location))}
        ${cell('Format',   canEdit ? sel('format', FORMATS, post.format||'', 'format') : ro(post.format))}
        ${cell(dateLabel,  dateInput)}
      </div>
    </div>`;
}

function _buildNotes(post, canEdit, id) {
  if (!canEdit && !post.comments) return '';

  // Notes — reduced default height, auto-expand
  const notesInput = canEdit
    ? `<div class="pcs-notes-box"><textarea class="pcs-notes-input" placeholder="Brief or caption…" rows="2"
                 oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
                 onblur="updatePost('${esc(id)}','comments',this.value)">${esc(post.comments || '')}</textarea></div>`
    : (post.comments ? `<div class="pcs-notes-box"><div class="pcs-notes-ro">${esc(post.comments)}</div></div>` : '');

  return `
    <div class="pcs-section pcs-notes-section">
      <div class="pcs-section-label">Notes</div>
      ${notesInput || '<div class="pcs-activity-empty">No notes.</div>'}
    </div>`;
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
