/* ═══════════════════════════════════════════════
   08-post-actions.js — Stage updates & modals
═══════════════════════════════════════════════ */
console.log("LOADED:", "08-post-actions.js");

async function quickStage(postId, newStage) {
  const post = allPosts.find(p => getPostId(p) === postId);
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

function openPostModal(postId) {
  const post = allPosts.find(p => getPostId(p) === postId);
  if (!post) return;
  window._modalOpen = true;
  document.getElementById('pmd-title').textContent  = getTitle(post);
  document.getElementById('pmd-id').textContent     = postId;
  const sel = document.getElementById('pmd-stage-select');
  sel.innerHTML = PIPELINE_ORDER.map(s => `<option value="${s}" ${post.stage===s?'selected':''}>${s}</option>`).join('');
  document.getElementById('pmd-comments').value    = post.comments || '';
  document.getElementById('pmd-postlink').value    = post.postLink || post.post_link || '';
  const adminFields = document.getElementById('pmd-admin-fields');
  if (adminFields) {
    adminFields.style.display = currentRole === 'Admin' ? '' : 'none';
    if (currentRole === 'Admin') {
      document.getElementById('pmd-owner-select').value = post.owner || '';
      document.getElementById('pmd-date-input').value   = post.targetDate || '';
    }
  }
  document.getElementById('pmd-save-btn').dataset.postId = postId;
  document.getElementById('post-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePostModal() {
  document.getElementById('post-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  window._modalOpen = false;
  _drainDeferredRender();
}

async function saveStageUpdate() {
  const postId   = document.getElementById('pmd-save-btn').dataset.postId;
  const newStage = document.getElementById('pmd-stage-select').value;
  const comments = document.getElementById('pmd-comments').value.trim();
  const postLink = document.getElementById('pmd-postlink').value.trim();
  const btn      = document.getElementById('pmd-save-btn');
  btn.disabled   = true;
  const ownerEl  = document.getElementById('pmd-owner-select');
  const dateEl   = document.getElementById('pmd-date-input');
  const payload  = { stage: newStage, comments: comments || null, post_link: postLink || null, updated_at: new Date().toISOString() };
  if (ownerEl && currentRole === 'Admin') payload.owner = ownerEl.value || null;
  if (dateEl  && currentRole === 'Admin') payload.target_date = dateEl.value || null;
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    await logActivity({ post_id: postId, actor_name: localStorage.getItem('gbl_email') || currentRole, actor_role: currentRole, action: `Updated: stage=${newStage}` });
    closePostModal();
    await loadPosts();
    showToast('Post updated ✓', 'success');
  } catch (err) {
    showToast('Save failed — try again', 'error');
    btn.disabled = false;
  }
}

function openAdminEdit(postId) {
  const post = allPosts.find(p => getPostId(p) === postId);
  if (!post) return;
  window._modalOpen = true;
  document.getElementById('ae-postid').textContent   = postId;
  document.getElementById('ae-title').value          = getTitle(post);
  document.getElementById('ae-owner').value          = post.owner || '';
  document.getElementById('ae-pillar').value         = post.contentPillar || '';
  document.getElementById('ae-location').value       = post.location || '';
  document.getElementById('ae-date').value           = post.targetDate || '';
  document.getElementById('ae-comments').value       = post.comments || '';
  document.getElementById('ae-postlink').value       = post.postLink || post.post_link || '';
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
      body: JSON.stringify({ title, owner: owner||null, content_pillar: pillar||null, location: location||null, stage: stage||null, target_date: date||null, comments: comments||null, post_link: postLink||null, updated_at: new Date().toISOString() }),
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
  const post = allPosts.find(p => getPostId(p) === postId);
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
      body: JSON.stringify({ post_id: postId, title: `Client Request — ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`, stage: 'awaiting brand input', owner: email, comments: brief, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
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
    await logActivity({ post_id: postId, actor_name: 'Creative', actor_role: 'Creative', action: `Issue flagged: ${msg.substring(0,80)}` });
    showToast('Issue flagged — Servicing has been notified ✓', 'success');
    await loadPosts();
  } catch { showToast('Failed — try again', 'error'); }
}

// (handleBucketDrop removed — was dead code, never wired to DOM)

async function nudgeClient(postId, title, targetDate) {
  const days      = daysInStage(allPosts.find(p=>getPostId(p)===postId));
  const dateInfo  = targetDate ? `\n\nTarget date: ${formatDate(targetDate)}` : '';
  const msg       = encodeURIComponent(`Hi! Just a quick note — we're waiting on your input for:\n\n"${title}"\n\nWhen you get a chance, could you check in?${dateInfo}\n\nThanks!`);
  const waLink    = `https://wa.me/?text=${msg}`;
  window.open(waLink, '_blank');
  await logActivity({ post_id: postId, actor_name: 'Servicing', actor_role: 'Servicing', action: `Client nudged after ${days}d` });
}

async function copyCaption(postId) {
  const post = allPosts.find(p => getPostId(p) === postId);
  if (!post || !post.comments) { showToast('No caption found', 'error'); return; }
  try {
    await navigator.clipboard.writeText(post.comments);
    showToast('Caption copied ✓', 'success');
  } catch { showToast('Could not copy — try manually', 'error'); }
}

// Legacy stubs kept for HTML compatibility
function submitPostRequest() { submitClientRequest(); }
function renderClientApprovedLegacy() { renderClientApproved(); }

// ── Delete post (Admin only) ──────────────────
async function deletePost(postId) {
  const post = allPosts.find(p => getPostId(p) === postId);
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

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
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
  // Dismiss confirm overlay when navigating to a different card
  _removePcsConfirm();
  const post = allPosts.find(p => getPostId(p) === postId);
  if (!post) { closePCS(); return; }

  const id          = getPostId(post);
  const title       = getTitle(post);
  const stage       = post.stage || '';
  const stageLC     = stage.toLowerCase().trim();
  const isPublished = stageLC === 'published';
  const postLink    = post.postLink || post.post_link || '';
  const canEdit     = !isPublished && ['Admin','Servicing'].includes(currentRole);
  const { hex, label: stageLabel } = stageStyle(stage);

  // Cache DOM elements — guard every write
  const elTitle    = document.getElementById('pcs-topbar-title');
  const elSubtitle = document.getElementById('pcs-subtitle');
  const elProgress = document.getElementById('pcs-progress-wrap');
  const elDesign   = document.getElementById('pcs-action-btn-wrap');
  const elNext     = document.getElementById('pcs-next-action-wrap');
  const elFields   = document.getElementById('pcs-fields');
  const elActivity = document.getElementById('pcs-activity-body');

  // Title — dominant element
  if (elTitle) elTitle.textContent = title;

  // Subtitle: only non-empty parts, stage gets colour, pillar as short label
  if (elSubtitle) {
    const pillarLabel = post.contentPillar
      ? (PILLAR_SHORT[post.contentPillar] || PILLAR_DISPLAY[post.contentPillar] || post.contentPillar)
      : '';
    const parts = [
      stageLabel    ? `<span class="pcs-subtitle-stage" style="color:${hex}">${esc(stageLabel)}</span>` : '',
      post.owner    ? `<span>${esc(post.owner)}</span>`    : '',
      post.location ? `<span>${esc(post.location)}</span>` : '',
      pillarLabel   ? `<span>${esc(pillarLabel)}</span>`   : '',
    ].filter(Boolean);
    elSubtitle.innerHTML = parts.join('<span class="pcs-subtitle-sep">·</span>');
  }

  // Stage progress
  if (elProgress) elProgress.innerHTML = _buildStageProgress(stageLC);

  // Design block
  if (elDesign) elDesign.innerHTML = _buildDesignBlock(postLink, isPublished, canEdit, id);

  // Next Action button
  if (elNext) {
    const { label: naLabel, nextStage } = _pcsNextAction(stageLC);
    if (naLabel && canEdit && nextStage) {
      elNext.innerHTML =
        `<button class="pcs-next-action-btn" onclick="pcsDoNextAction('${esc(id)}','${esc(nextStage)}')">
           ${esc(naLabel)} →
         </button>`;
    } else if (naLabel) {
      elNext.innerHTML = `<div class="pcs-next-action-info">${esc(naLabel)}</div>`;
    } else {
      elNext.innerHTML = '';
    }
  }

  // Information + Notes sections
  if (elFields) elFields.innerHTML = _buildPCSGrid(post, canEdit, id);

  // History
  if (elActivity) {
    elActivity.innerHTML = '<div class="pcs-activity-loading">Loading…</div>';
    _loadPCSActivity(id, elActivity);
  }
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

  const dots = steps.map((s, i) => {
    const isDone    = activeIdx !== -1 && i < activeIdx;
    const isCurrent = i === activeIdx;
    const cls = isCurrent ? 'prog-dot active' : isDone ? 'prog-dot done' : 'prog-dot';
    return `<div class="prog-step">
      <div class="${cls}"></div>
      <div class="prog-label">${s.label}</div>
    </div>`;
  }).join('<div class="prog-line"></div>');

  return `<div class="pcs-progress">${dots}</div>`;
}

function _buildDesignBlock(postLink, isPublished, canEdit, postId) {
  // State 2: published/LinkedIn link
  if (isPublished && postLink) {
    return `<div class="pcs-design-block">
      <div class="pcs-design-info">
        <div class="design-icon-wrap design-icon-linkedin">in</div>
        <div class="pcs-design-text">
          <div class="pcs-design-label">Post</div>
          <div class="pcs-design-status">Published on LinkedIn</div>
        </div>
      </div>
      <div class="pcs-design-actions">
        <a href="${esc(postLink)}" target="_blank" rel="noopener" class="pcs-primary" onclick="closePCS()">View on LinkedIn ↗</a>
      </div>
    </div>`;
  }

  // State 1: Canva link exists
  if (postLink) {
    return `<div class="pcs-design-block">
      <div class="pcs-design-info">
        <div class="design-icon-wrap design-icon-canva">C</div>
        <div class="pcs-design-text">
          <div class="pcs-design-label">Design</div>
          <div class="pcs-design-status">Canva connected</div>
        </div>
      </div>
      <div class="pcs-design-actions">
        <a href="${esc(postLink)}" target="_blank" rel="noopener" class="pcs-primary" onclick="closePCS()">Open Canva ↗</a>
        ${canEdit ? `<button class="pcs-design-replace" onclick="pcsToggleAttach('${esc(postId)}')">Replace</button>` : ''}
      </div>
      ${canEdit ? `<div class="pcs-attach-row" id="pcs-attach-row-${esc(postId)}" style="display:none">
        <input type="url" class="pcs-attach-input" id="pcs-attach-input-${esc(postId)}" placeholder="Paste new Canva URL…">
        <button class="pcs-attach-save" onclick="pcsSaveAttach('${esc(postId)}')">Save</button>
      </div>` : ''}
    </div>`;
  }

  // State 3: no link
  if (!canEdit) return '';
  return `<div class="pcs-design-block pcs-design-empty">
    <div class="pcs-design-info">
      <div class="design-icon-wrap design-icon-empty">+</div>
      <div class="pcs-design-text">
        <div class="pcs-design-label">Design</div>
        <div class="pcs-design-status muted">No design attached</div>
      </div>
    </div>
    <div class="pcs-attach-row" id="pcs-attach-row-${esc(postId)}">
      <input type="url" class="pcs-attach-input" id="pcs-attach-input-${esc(postId)}" placeholder="Paste Canva URL…">
      <button class="pcs-attach-save" onclick="pcsSaveAttach('${esc(postId)}')">Attach</button>
    </div>
  </div>`;
}

function pcsToggleAttach(postId) {
  const row = document.getElementById(`pcs-attach-row-${postId}`);
  if (!row) return;
  const open = row.style.display === 'none';
  row.style.display = open ? 'flex' : 'none';
  if (open) document.getElementById(`pcs-attach-input-${postId}`)?.focus();
}

async function pcsSaveAttach(postId) {
  const input = document.getElementById(`pcs-attach-input-${postId}`);
  const url = (input?.value || '').trim();
  if (!url || !url.startsWith('http')) { showToast('Enter a valid URL', 'error'); return; }
  await updatePost(postId, 'postLink', url);
  // Re-render design block with new link
  const post = allPosts.find(p => getPostId(p) === postId);
  if (post) {
    const stageLC = (post.stage || '').toLowerCase().trim();
    const isPublished = stageLC === 'published';
    const canEdit = !isPublished && ['Admin','Servicing'].includes(currentRole);
    const el = document.getElementById('pcs-action-btn-wrap');
    if (el) el.innerHTML = _buildDesignBlock(url, isPublished, canEdit, postId);
  }
}

async function pcsDoNextAction(postId, nextStage) {
  await quickStage(postId, nextStage);
  refreshSystemViews();
  closePCS();
}

// Legacy stub — replaced by pcsToggleAttach/pcsSaveAttach
function pcsReplaceDesign(postId) { pcsToggleAttach(postId); }

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
  // Optimistic update in memory
  const post = allPosts.find(p => getPostId(p) === postId);
  if (post) post[field] = value;

  const dbField = {
    stage:         'stage',
    contentPillar: 'content_pillar',
    owner:         'owner',
    location:      'location',
    format:        'format',
    targetDate:    'target_date',
    postLink:      'post_link',
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
    showToast('Save failed', 'error');
  }
}

function _pcsNextAction(stageLC) {
  const map = {
    'awaiting brand input':  { label: 'Start Production',       nextStage: 'in production' },
    'in production':         { label: 'Mark Ready',             nextStage: 'ready' },
    'revisions needed':      { label: 'Apply Revisions',        nextStage: 'in production' },
    'ready':                 { label: 'Send for Approval',      nextStage: 'awaiting approval' },
    'awaiting approval':     { label: 'Schedule Post',          nextStage: 'scheduled' },
    'scheduled':             { label: 'Post Scheduled',         nextStage: null },
    'published':             { label: 'Post Published',         nextStage: null },
  };
  return map[stageLC] || { label: 'No action available', nextStage: null };
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

function _pcsListLabel(listKey) {
  if (!listKey) return 'Posts';
  if (listKey === 'tasks') return 'My Tasks';
  if (listKey === 'upcoming') return 'Upcoming';
  if (listKey === 'library') return 'Content Library';
  if (listKey === 'pipeline') return 'Pipeline';
  if (listKey.startsWith('tasks-')) {
    const key = listKey.replace('tasks-','');
    const bucket = (window.ROLE_BUCKETS?.[currentRole]||[]).find(b=>b.key===key);
    return bucket ? bucket.label : key;
  }
  return 'Posts';
}

function _buildPCSGrid(post, canEdit, id) {
  // Use canonical lists from 01-config.js (STAGE_META, STAGES_DB, PILLARS_DB)
  const LOCS     = ['Mumbai','Sakarwadi','Sameerwadi','Other'];
  const OWNERS   = ['Chitra','Pranav','Admin'];
  const FORMATS  = ['Creative','Photo','Carousel','Video','Text'];

  const stageLC     = (post.stage || '').toLowerCase().trim();
  const isPublished = stageLC === 'published';
  const dateLabel   = isPublished ? 'Published Date' : 'Target Date';
  const dateValue   = isPublished
    ? (post.published_date || post.publishedDate || post.targetDate || '')
    : (post.targetDate || '');
  const { hex } = stageStyle(post.stage);

  // sel: value stored is DB lowercase, option text is Title Case display label
  const sel = (field, opts, val, dbField, displayMap) =>
    `<select class="pcs-field-val" ${canEdit ? `onchange="updatePost('${esc(id)}','${dbField||field}',this.value)"` : 'disabled'}>
       ${opts.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(displayMap ? (displayMap[o] || o) : o)}</option>`).join('')}
     </select>`;

  const ro = val => `<span class="pcs-field-val-ro">${esc(val || '—')}</span>`;

  const dateInput = canEdit
    ? `<input type="date" class="pcs-field-val" value="${esc(dateValue)}"
             onchange="updatePost('${esc(id)}','targetDate',this.value)">`
    : `<div class="pcs-date-field"><span class="pcs-date-value">${esc(formatDate(dateValue) || '—')}</span>${formatDate(dateValue) ? '<span class="pcs-date-icon">📅</span>' : ''}</div>`;

  const notesInput = canEdit
    ? `<textarea class="pcs-notes-input" placeholder="Brief or caption…" rows="3"
                 onblur="updatePost('${esc(id)}','comments',this.value)">${esc(post.comments || '')}</textarea>`
    : (post.comments ? `<div class="pcs-notes-ro">${esc(post.comments)}</div>` : '');

  const cell = (label, content) =>
    `<div class="pcs-field">
       <div class="pcs-field-label">${label}</div>
       ${content}
     </div>`;

  const stageCell = canEdit
    ? sel('stage', STAGES_DB, post.stage||'', 'stage', STAGE_DISPLAY)
    : `<span class="pcs-field-val-ro" style="color:${hex}">${esc(stageStyle(post.stage).label || post.stage || '—')}</span>`;

  return `
    <div class="pcs-section">
      <div class="pcs-section-label">Information</div>
      <div class="pcs-grid">
        ${cell('Stage',    stageCell)}
        ${cell('Owner',    canEdit ? sel('owner', OWNERS, post.owner||'', 'owner') : ro(post.owner))}
        ${cell('Pillar',   canEdit ? sel('contentPillar', PILLARS_DB, post.contentPillar||'', 'contentPillar', PILLAR_DISPLAY) : ro(PILLAR_DISPLAY[post.contentPillar] || post.contentPillar || '—'))}
        ${cell('Location', canEdit ? sel('location', LOCS, post.location||'', 'location') : ro(post.location))}
        ${cell('Format',   canEdit ? sel('format', FORMATS, post.format||'', 'format') : ro(post.format))}
        ${cell(dateLabel,  dateInput)}
      </div>
    </div>
    ${(canEdit || post.comments) ? `
    <div class="pcs-section">
      <div class="pcs-section-label">Notes</div>
      ${notesInput || '<div class="pcs-activity-empty">No notes.</div>'}
    </div>` : ''}
    <input type="hidden" id="pcs-post-id" value="${esc(id)}">`;
}

function _renderPCSFooter(post, isPublished, canEdit) {
  // No persistent footer — actions are inline or in primary/next-action buttons
  const footer = document.getElementById('pcs-footer');
  if (footer) footer.innerHTML = '';
}

function updatePCSPreview(link) {
  // Legacy stub — inline editing now handles updates
  if (link && _pcs.postId) updatePost(_pcs.postId, 'postLink', link);
}

async function savePCS() {
  // Legacy stub — fields now auto-save via updatePost()
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

