/* ═══════════════════════════════════════════════
   08-post-actions.js — Stage updates & modals
═══════════════════════════════════════════════ */

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
    await logActivity({ post_id: postId, actor_name: currentRole, actor_role: currentRole, action: `Stage → ${newStage}` });
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
    await logActivity({ post_id: postId, actor_name: currentRole, actor_role: currentRole, action: `Updated: stage=${newStage}` });
    document.getElementById('post-modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
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
      body: JSON.stringify({ stage: 'Scheduled', updated_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor_name: 'Client', actor_role: 'Client', action: 'Approved — moved to Scheduled' });
    const confirmEl = document.getElementById(`approved-confirm-${postId}`);
    if (confirmEl) confirmEl.classList.add('active');
    post.stage = 'Scheduled';
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
      body: JSON.stringify({ stage: 'Revisions Needed', comments: text, updated_at: new Date().toISOString() }),
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
      body: JSON.stringify({ stage: 'In Production', updated_at: new Date().toISOString() }),
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
      body: JSON.stringify({ post_link: url, stage: 'In Production', updated_at: new Date().toISOString() }),
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
      body: JSON.stringify({ post_id: postId, title: `Client Request — ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`, stage: 'Awaiting Brand Input', owner: email, comments: brief, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
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

function handleBucketDrop(event, targetPostId) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const sourcePostId = event.dataTransfer.getData('text/plain');
  if (!sourcePostId || sourcePostId === targetPostId) return;
  const source = allPosts.find(p => getPostId(p) === sourcePostId);
  if (!source) return;
  quickStage(sourcePostId, source.stage);
}

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

// ── Drag & Drop (desktop + mobile) ───────────
let _dragPostId   = null;
let _dragStage    = null;
let _isDragging   = false;
let _touchTimer   = null;
let _touchGhost   = null;
let _touchStartY  = 0;

function onPcardDragStart(event, postId, stage) {
  _dragPostId = postId;
  _dragStage  = stage;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', postId);
  event.currentTarget.classList.add('pcard-dragging');
}

function onPcardDragEnd(event) {
  event.currentTarget.classList.remove('pcard-dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  _dragPostId = null;
  _dragStage  = null;
}

function onStageDrop(event, dropZone) {
  event.preventDefault();
  dropZone.classList.remove('drag-over');
  const targetStage = dropZone.dataset.stage;
  const postId = _dragPostId || event.dataTransfer.getData('text/plain');
  if (!postId || !targetStage || targetStage === _dragStage) return;
  // Capitalise to match DB values
  const stageMap = {};
  (window.PIPELINE_ORDER || []).forEach(s => { stageMap[s.toLowerCase()] = s; });
  const newStage = stageMap[targetStage] || targetStage;
  quickStage(postId, newStage);
}

// Mobile long-press drag
function onPcardTouchStart(event, postId) {
  _touchStartY = event.touches[0].clientY;
  _isDragging  = false;
  _touchTimer  = setTimeout(() => {
    _isDragging = true;
    _dragPostId = postId;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    _touchGhost = card.cloneNode(true);
    _touchGhost.style.cssText = `
      position:fixed; left:${rect.left}px; top:${rect.top}px;
      width:${rect.width}px; opacity:0.75; pointer-events:none;
      z-index:9999; border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.4);
      transform:scale(1.02);`;
    document.body.appendChild(_touchGhost);
    card.style.opacity = '0.3';
    if (navigator.vibrate) navigator.vibrate(40);
  }, 500);
}

function onPcardTouchMove(event) {
  const dy = Math.abs(event.touches[0].clientY - _touchStartY);
  if (dy > 8 && !_isDragging) { clearTimeout(_touchTimer); return; }
  if (!_isDragging) return;
  event.preventDefault();
  const touch = event.touches[0];
  if (_touchGhost) {
    _touchGhost.style.top = (touch.clientY - 40) + 'px';
  }
  // Highlight drop zone under finger
  document.querySelectorAll('.pstage-cards').forEach(z => z.classList.remove('drag-over'));
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  const zone = el?.closest('.pstage-cards');
  if (zone) zone.classList.add('drag-over');
}

function onPcardTouchEnd(event) {
  clearTimeout(_touchTimer);
  if (!_isDragging) return;
  _isDragging = false;
  const touch = event.changedTouches[0];
  if (_touchGhost) { _touchGhost.remove(); _touchGhost = null; }
  // Restore card opacity
  const card = document.getElementById(`pcard-${_dragPostId}`);
  if (card) card.style.opacity = '';
  // Find drop zone
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  const zone = el?.closest('.pstage-cards');
  document.querySelectorAll('.pstage-cards').forEach(z => z.classList.remove('drag-over'));
  if (zone) onStageDrop(event, zone);
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

function openPCS(postId, listKey) {
  const list = (listKey && window._postLists && _postLists[listKey])
    ? _postLists[listKey]
    : allPosts;
  const idx = list.findIndex(p => getPostId(p) === postId);
  _pcs.listKey = listKey || '';
  _pcs.list    = list;
  _pcs.idx     = idx >= 0 ? idx : 0;
  _pcs.postId  = postId;

  document.getElementById('pcs-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  _renderPCS(postId);
  _pcsAttachSwipe();
}

function closePCS() {
  document.getElementById('pcs-overlay').classList.remove('open');
  document.body.style.overflow = '';
  _pcs.postId = null;
}

// ── Swipe attachment ──────────────────────────
function _pcsAttachSwipe() {
  const screen = document.getElementById('pcs-screen');
  // Remove any existing listeners to avoid doubles
  screen.removeEventListener('touchstart', _pcsTouchStart);
  screen.removeEventListener('touchmove',  _pcsTouchMove);
  screen.removeEventListener('touchend',   _pcsTouchEnd);
  screen.addEventListener('touchstart', _pcsTouchStart, { passive: true });
  screen.addEventListener('touchmove',  _pcsTouchMove,  { passive: false }); // must be non-passive to preventDefault
  screen.addEventListener('touchend',   _pcsTouchEnd,   { passive: true });
}

const _swipe = { x0: 0, y0: 0, lock: null }; // lock: null | 'h' | 'v'

function _pcsTouchStart(e) {
  if (e.touches.length !== 1) return;
  _swipe.x0   = e.touches[0].clientX;
  _swipe.y0   = e.touches[0].clientY;
  _swipe.lock = null;
  const screen = document.getElementById('pcs-screen');
  screen.style.transition = 'none';
}

function _pcsTouchMove(e) {
  if (e.touches.length !== 1 || _swipe.lock === 'v') return;
  const dx = e.touches[0].clientX - _swipe.x0;
  const dy = e.touches[0].clientY - _swipe.y0;
  const adx = Math.abs(dx), ady = Math.abs(dy);

  // Lock gesture direction once we know which way it's going
  if (!_swipe.lock && (adx > 8 || ady > 8)) {
    _swipe.lock = adx > ady ? 'h' : 'v';
  }
  if (_swipe.lock !== 'h') return;

  // Prevent vertical scroll during horizontal swipe
  e.preventDefault();

  // Only track leftward drag (right swipe does nothing)
  if (dx < 0) {
    const resist = Math.max(dx, -window.innerWidth * 0.6); // cap drag at 60vw
    document.getElementById('pcs-screen').style.transform = `translateX(${resist}px)`;
  }
}

function _pcsTouchEnd(e) {
  if (_swipe.lock !== 'h') return;
  const dx  = e.changedTouches[0].clientX - _swipe.x0;
  const screen = document.getElementById('pcs-screen');

  if (dx < -80) {
    // Committed — animate out then load next
    screen.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
    screen.style.transform  = 'translateX(-100%)';
    screen.style.opacity    = '0';
    setTimeout(() => {
      screen.style.transition = '';
      screen.style.transform  = '';
      screen.style.opacity    = '';
      _pcsNext();
    }, 220);
  } else {
    // Spring back
    screen.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    screen.style.transform  = 'translateX(0)';
    setTimeout(() => { screen.style.transition = ''; }, 260);
  }
}

function _pcsNext() {
  const nextIdx = _pcs.idx + 1;

  if (nextIdx >= _pcs.list.length) {
    // End of list — show completion screen then close
    const scroll = document.getElementById('pcs-scroll');
    const _f = document.getElementById('pcs-footer'); if (_f) _f.innerHTML = '';
    scroll.innerHTML = `
      <div class="pcs-end-screen">
        <div class="pcs-end-icon">✓</div>
        <div>No posts left.</div>
      </div>`;
    // Slide in the end screen
    const screen = document.getElementById('pcs-screen');
    screen.style.transform = 'translateX(40px)';
    screen.style.opacity   = '0';
    screen.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
    requestAnimationFrame(() => {
      screen.style.transform = 'translateX(0)';
      screen.style.opacity   = '1';
    });
    setTimeout(closePCS, 1800);
    return;
  }

  // Slide in next post
  _pcs.idx    = nextIdx;
  _pcs.postId = getPostId(_pcs.list[nextIdx]);

  // Reset scroll position
  const scrollEl = document.getElementById('pcs-scroll');
  if (scrollEl) scrollEl.scrollTop = 0;

  _renderPCS(_pcs.postId);

  // Animate in from right
  const screen = document.getElementById('pcs-screen');
  screen.style.transform  = 'translateX(40px)';
  screen.style.opacity    = '0';
  screen.style.transition = 'none';
  requestAnimationFrame(() => {
    screen.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
    screen.style.transform  = 'translateX(0)';
    screen.style.opacity    = '1';
    setTimeout(() => { screen.style.transition = ''; }, 230);
  });
}

function _renderPCS(postId) {
  const post = allPosts.find(p => getPostId(p) === postId);
  if (!post) { closePCS(); return; }

  const id          = getPostId(post);
  const title       = getTitle(post);
  const stage       = post.stage || '';
  const stageLC     = stage.toLowerCase().trim();
  const isPublished = stageLC === 'published';
  const postLink    = post.postLink || post.post_link || '';
  const canEdit     = !isPublished && ['Admin','Servicing'].includes(currentRole);

  // Two-line header
  const titleEl = document.getElementById('pcs-topbar-title');
  if (titleEl) titleEl.textContent = title;

  // Primary action — full-width button
  const actionWrap = document.getElementById('pcs-action-btn-wrap');
  if (postLink) {
    const btnLabel = isPublished ? 'View on LinkedIn ↗' : 'Open Canva ↗';
    actionWrap.innerHTML =
      `<a href="${esc(postLink)}" target="_blank" rel="noopener" class="pcs-primary"
          onclick="closePCS()">${btnLabel}</a>`;
  } else {
    actionWrap.innerHTML = '';
  }

  // Next Action — clickable button that performs stage transition
  const nextActionWrap = document.getElementById('pcs-next-action-wrap');
  const { label: naLabel, nextStage } = _pcsNextAction(stageLC);
  if (naLabel && canEdit && nextStage) {
    nextActionWrap.innerHTML =
      `<button class="pcs-next-action-btn" onclick="pcsDoNextAction('${esc(id)}','${esc(nextStage)}')">
         Next Action: ${esc(naLabel)}
       </button>`;
  } else if (naLabel) {
    nextActionWrap.innerHTML =
      `<div class="pcs-next-action-info">Next Action: ${esc(naLabel)}</div>`;
  } else {
    nextActionWrap.innerHTML = '';
  }

  // Metadata grid — inline-edit, no save button
  document.getElementById('pcs-fields').innerHTML = _buildPCSGrid(post, canEdit, id);

  // Activity
  const actBody = document.getElementById('pcs-activity-body');
  actBody.innerHTML = '<div class="pcs-activity-loading">Loading…</div>';
  _loadPCSActivity(id, actBody);
}

async function pcsDoNextAction(postId, nextStage) {
  await quickStage(postId, nextStage);
  refreshSystemViews();
  closePCS();
}

function refreshSystemViews() {
  try { renderTasks();    } catch(e) {}
  try { renderPipeline(); } catch(e) {}
  try { renderUpcoming(); } catch(e) {}
  try { renderLibrary();  } catch(e) {}
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
    'awaiting brand input':  { label: 'Assign to Creative',    nextStage: 'In Production' },
    'in production':         { label: 'Send for Review',        nextStage: 'Ready to Send' },
    'revisions needed':      { label: 'Mark Revision Done',     nextStage: 'In Production' },
    'ready to send':         { label: 'Send for Approval',      nextStage: 'Sent for Approval' },
    'sent for approval':     { label: 'Schedule Post',          nextStage: 'Scheduled' },
    'awaiting approval':     { label: 'Schedule Post',          nextStage: 'Scheduled' },
    'scheduled':             { label: 'Wait for Publish',       nextStage: null },
    'published':             { label: 'Post is Live',           nextStage: null },
  };
  return map[stageLC] || { label: '', nextStage: null };
}

function _loadPCSActivity(postId, bodyEl) {
  apiFetch(`/activity_log?post_id=eq.${encodeURIComponent(postId)}&order=created_at.desc&limit=25`)
    .then(rows => {
      if (!rows || !rows.length) {
        bodyEl.innerHTML = '<div class="pcs-activity-empty">No activity yet.</div>';
        return;
      }
      bodyEl.innerHTML = rows.map(r => {
        const ago = r.created_at ? timeAgo(r.created_at) : '';
        return `<div class="pcs-activity-row">
          <span class="pcs-activity-who">${esc(r.actor || 'System')}</span>
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
  const STAGES   = ['Draft','Awaiting Input','In Production','Ready to Send','Awaiting Approval','Scheduled','Published'];
  const PILLARS  = ['Leadership','Sustainability by Design','Inclusivity & Discipline','Education','Events','Announcement','Social Media'];
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

  // Inline-edit select: changes call updatePost immediately
  const sel = (field, opts, val, dbField) =>
    `<select class="pcs-field-val" ${canEdit ? `onchange="updatePost('${esc(id)}','${dbField||field}',this.value)"` : 'disabled'}>
       ${opts.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}
     </select>`;

  const ro = val => `<span class="pcs-field-val-ro">${esc(val || '—')}</span>`;

  const dateInput = canEdit
    ? `<input type="date" class="pcs-field-val" value="${esc(dateValue)}"
             onchange="updatePost('${esc(id)}','targetDate',this.value)">`
    : ro(formatDate(dateValue));

  const notesInput = canEdit
    ? `<textarea class="pcs-notes-input" placeholder="Brief or caption…" rows="3"
                 onblur="updatePost('${esc(id)}','comments',this.value)">${esc(post.comments || '')}</textarea>`
    : (post.comments ? `<div class="pcs-notes-ro">${esc(post.comments)}</div>` : '');

  const canvaInput = canEdit
    ? `<input type="url" class="pcs-field-val" placeholder="https://canva.com/design/…"
              value="${esc(post.postLink || post.post_link || '')}"
              onblur="updatePost('${esc(id)}','postLink',this.value)">`
    : ro(post.postLink || post.post_link || '');

  const cell = (icon, label, content) =>
    `<div class="pcs-field">
       <div class="pcs-field-label">${icon} ${label}</div>
       ${content}
     </div>`;

  return `
    <div class="pcs-grid">
      ${cell('●', 'Stage',    canEdit ? sel('stage', STAGES, post.stage||'', 'stage') : `<span class="pcs-field-val-ro" style="color:${hex}">${esc(post.stage||'—')}</span>`)}
      ${cell('👤', 'Owner',   canEdit ? sel('owner', OWNERS, post.owner||'', 'owner') : ro(post.owner))}
      ${cell('🏷', 'Pillar',  canEdit ? sel('contentPillar', PILLARS, post.contentPillar||'', 'contentPillar') : ro(post.contentPillar))}
      ${cell('📍', 'Location',canEdit ? sel('location', LOCS, post.location||'', 'location') : ro(post.location))}
      ${cell('📝', 'Format',  canEdit ? sel('format', FORMATS, post.format||'', 'format') : ro(post.format))}
      ${cell('📅', dateLabel, dateInput)}
    </div>
    ${canEdit ? `<div class="pcs-field pcs-field-full">${cell('🔗', 'Canva Link', canvaInput)}</div>` : ''}
    ${(canEdit || post.comments) ? `<div class="pcs-field pcs-field-full">${cell('📋', 'Notes', notesInput)}</div>` : ''}
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

function pcsConfirmDelete() {
  const overlay = document.createElement('div');
  overlay.className = 'pcs-confirm-overlay';
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
  document.querySelector('.pcs-confirm-overlay')?.remove();
  const id = _pcs.postId;
  if (!id) return;
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('Post deleted');
    closePCS();
    await loadPosts();
  } catch(e) { showToast('Delete failed', 'error'); }
}

// ── Swipe navigation ──────────────────────────
