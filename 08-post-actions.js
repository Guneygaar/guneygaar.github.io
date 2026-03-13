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
  postId:   null,
  listKey:  null,
  list:     [],
  idx:      0,
  touchX0:  0,
  touchY0:  0,
  dragging: false,
};

function openPCS(postId, listKey) {
  // Build the list for swipe navigation
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
}

function closePCS() {
  document.getElementById('pcs-overlay').classList.remove('open');
  document.body.style.overflow = '';
  _pcs.postId = null;
}

function _renderPCS(postId) {
  const post = allPosts.find(p => getPostId(p) === postId);
  if (!post) { closePCS(); return; }

  const id         = getPostId(post);
  const title      = getTitle(post);
  const stage      = post.stage || '';
  const stageLC    = stage.toLowerCase().trim();
  const isPublished = stageLC === 'published';
  const postLink   = post.postLink || post.post_link || '';
  const pillar     = post.contentPillar || '';
  const location   = post.location || '';
  const owner      = post.owner || '';
  const targetDate = post.targetDate || '';
  const comments   = post.comments || '';

  // Context bar
  const listLabel  = _pcsListLabel(_pcs.listKey);
  const remaining  = Math.max(0, _pcs.list.length - _pcs.idx - 1);
  const ctxBar = document.getElementById('pcs-context-bar');
  ctxBar.innerHTML = `
    <span class="pcs-context-list">${esc(listLabel)}</span>
    <span class="pcs-context-remaining">${remaining} remaining</span>`;

  // Preview
  const previewWrap = document.getElementById('pcs-preview-wrap');
  previewWrap.innerHTML = _buildPCSPreview(postLink, title, pillar, post);
  previewWrap.onclick = () => { if (postLink) window.open(postLink, '_blank', 'noopener'); };

  // Fields
  const canEdit = !isPublished && ['Admin','Servicing'].includes(currentRole);
  const fieldsEl = document.getElementById('pcs-fields');
  fieldsEl.innerHTML = _buildPCSFields(post, canEdit, id);

  // Activity
  const actBody = document.getElementById('pcs-activity-body');
  actBody.classList.remove('open');
  actBody.innerHTML = '';
  actBody.dataset.loaded = '';
  document.getElementById('pcs-activity-chevron').textContent = '▼';

  // Footer
  _renderPCSFooter(post, isPublished, canEdit);
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

function _buildPCSPreview(postLink, title, pillar, post) {
  const { hex } = stageStyle(post.stage);
  let inner;
  if (postLink && postLink.includes('canva.com')) {
    inner = `
      <div class="upc-preview-canva" style="height:100%">
        <div class="upc-preview-canva-logo">
          <svg width="16" height="16" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#7D2AE8"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="18" font-family="sans-serif" font-weight="bold">C</text></svg>
          Canva Design
        </div>
        <div class="upc-preview-canva-title">${esc(title)}</div>
        <div style="margin-top:8px;font-size:11px;color:rgba(255,255,255,0.5)">Tap to open ↗</div>
      </div>`;
  } else if (postLink) {
    let domain = '';
    try { domain = new URL(postLink.startsWith('http') ? postLink : 'https://'+postLink).hostname.replace('www.',''); } catch(e){}
    inner = `
      <div class="upc-preview-link" style="height:100%">
        <div class="upc-preview-link-domain">${esc(domain)}</div>
        <div class="upc-preview-link-title">${esc(title)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">Tap to open ↗</div>
      </div>`;
  } else {
    inner = `
      <div class="upc-preview-text" style="border-left:3px solid ${hex};height:100%">
        <div class="upc-preview-text-label">${esc(pillar||'Post')}</div>
        <div class="upc-preview-text-title">${esc(title)}</div>
        ${post.comments ? `<div style="font-size:12px;color:var(--text3);margin-top:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(post.comments)}</div>` : ''}
      </div>`;
  }
  return `${inner}<span class="upc-open-icon" style="${postLink?'':'opacity:0.3'}">↗</span>`;
}

function _buildPCSFields(post, canEdit, id) {
  const PILLARS  = ['Leadership','Sustainability by Design','Inclusivity & Discipline','Education','Events','Announcement','Social Media'];
  const LOCS     = ['Mumbai','Sakarwadi','Sameerwadi','Other'];
  const OWNERS   = ['Chitra','Pranav','Admin'];
  const STAGES   = ['Draft','Awaiting Input','In Production','Ready to Send','Awaiting Approval','Scheduled','Published'];

  const f = (label, content) => `
    <div class="pcs-field">
      <span class="pcs-field-label">${label}</span>
      ${content}
    </div>`;

  const sel = (elId, opts, val) => `
    <select id="${elId}" ${canEdit?'':'disabled'}>
      ${opts.map(o=>`<option value="${esc(o)}" ${o===val?'selected':''}>${esc(o)}</option>`).join('')}
    </select>`;

  const ro = (val) => `<div class="pcs-field-readonly">${esc(val||'—')}</div>`;

  const pillarSel   = canEdit ? sel(`pcs-pillar`,  PILLARS, post.contentPillar||'') : ro(post.contentPillar);
  const locationSel = canEdit ? sel(`pcs-location`, LOCS,    post.location||'')     : ro(post.location);
  const ownerSel    = canEdit ? sel(`pcs-owner`,    OWNERS,  post.owner||'')        : ro(post.owner);
  const stageSel    = canEdit ? sel(`pcs-stage`,    STAGES,  post.stage||'')        : ro(post.stage);
  const dateFld     = canEdit
    ? `<input type="date" id="pcs-date" value="${esc(post.targetDate||'')}">`
    : ro(formatDate(post.targetDate));
  const canvaFld    = canEdit
    ? `<input type="url" id="pcs-canva-link" placeholder="https://canva.com/design/…" value="${esc(post.postLink||post.post_link||'')}" oninput="updatePCSPreview(this.value)">`
    : ro(post.postLink || post.post_link || 'No Canva link');
  const commentsFld = canEdit
    ? `<textarea id="pcs-comments" placeholder="Brief or caption…" rows="3">${esc(post.comments||'')}</textarea>`
    : ro(post.comments);

  return [
    f('Content Pillar', pillarSel),
    f('Location',       locationSel),
    f('Owner',          ownerSel),
    f('Stage',          stageSel),
    f('Target Date',    dateFld),
    f('Canva Link',     canvaFld),
    f('Notes / Brief',  commentsFld),
    `<input type="hidden" id="pcs-post-id" value="${esc(id)}">`,
  ].join('');
}

function _renderPCSFooter(post, isPublished, canEdit) {
  const footer = document.getElementById('pcs-footer');
  const postLink = post.postLink || post.post_link || '';
  if (isPublished) {
    footer.innerHTML = postLink
      ? `<button class="pcs-btn-linkedin" onclick="window.open('${esc(postLink)}','_blank','noopener')">Open LinkedIn ↗</button>`
      : `<span style="font-size:13px;color:var(--text3)">Published</span>`;
  } else if (canEdit) {
    footer.innerHTML = `
      <button class="pcs-btn-delete" onclick="pcsConfirmDelete()">Delete</button>
      <button class="pcs-btn-save"   onclick="savePCS()">Save</button>`;
  } else {
    footer.innerHTML = '';
  }
}

function updatePCSPreview(link) {
  const post = allPosts.find(p => getPostId(p) === _pcs.postId);
  if (!post) return;
  const title  = getTitle(post);
  const pillar = post.contentPillar || '';
  const wrap   = document.getElementById('pcs-preview-wrap');
  wrap.innerHTML = _buildPCSPreview(link, title, pillar, post);
  wrap.onclick   = () => { if (link) window.open(link,'_blank','noopener'); };
}

async function savePCS() {
  const id       = document.getElementById('pcs-post-id')?.value;
  const pillar   = document.getElementById('pcs-pillar')?.value;
  const location = document.getElementById('pcs-location')?.value;
  const owner    = document.getElementById('pcs-owner')?.value;
  const stage    = document.getElementById('pcs-stage')?.value;
  const date     = document.getElementById('pcs-date')?.value;
  const canva    = document.getElementById('pcs-canva-link')?.value;
  const comments = document.getElementById('pcs-comments')?.value;

  if (!id) return;
  const btn = document.querySelector('.pcs-btn-save');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        contentPillar: pillar,
        location:      location,
        owner:         owner,
        stage:         stage,
        targetDate:    date || null,
        postLink:      canva || null,
        comments:      comments || null,
        updated_at:    new Date().toISOString(),
      }),
    });
    showToast('Saved ✓');
    await loadPosts();
    closePCS();
  } catch(e) {
    showToast('Save failed — try again', 'error');
    if (btn) { btn.textContent = 'Save'; btn.disabled = false; }
  }
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

function togglePCSActivity() {
  const body    = document.getElementById('pcs-activity-body');
  const chevron = document.getElementById('pcs-activity-chevron');
  const isOpen  = body.classList.toggle('open');
  chevron.textContent = isOpen ? '▲' : '▼';

  if (!isOpen || body.dataset.loaded) return;
  body.dataset.loaded = '1';
  body.innerHTML = `<div class="pcs-activity-empty">Loading…</div>`;

  apiFetch(`/activity_log?post_id=eq.${encodeURIComponent(_pcs.postId)}&order=created_at.desc&limit=25`)
    .then(rows => {
      if (!rows || !rows.length) {
        body.innerHTML = `<div class="pcs-activity-empty">No activity yet.</div>`;
        return;
      }
      body.innerHTML = rows.map(r => {
        const ts = r.created_at
          ? new Date(r.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
          : '';
        return `
          <div class="pcs-activity-entry">
            <span class="pcs-activity-dot"></span>
            <span class="pcs-activity-text">
              <span class="pcs-activity-actor">${esc(r.actor||'System')}</span>
              ${esc(r.action||'')}
            </span>
            <span class="pcs-activity-time">${esc(ts)}</span>
          </div>`;
      }).join('');
    })
    .catch(() => { body.innerHTML = `<div class="pcs-activity-empty">Could not load activity.</div>`; });
}

// ── Swipe navigation ──────────────────────────

function pcsSwipeStart(e) {
  if (e.touches.length !== 1) return;
  _pcs.touchX0  = e.touches[0].clientX;
  _pcs.touchY0  = e.touches[0].clientY;
  _pcs.dragging = false;
}

function pcsSwipeMove(e) {
  if (!e.touches.length) return;
  const dx = e.touches[0].clientX - _pcs.touchX0;
  const dy = e.touches[0].clientY - _pcs.touchY0;
  // Only activate for clear horizontal swipes (left)
  if (!_pcs.dragging && Math.abs(dx) > 10 && Math.abs(dy) < 50 && dx < 0) {
    _pcs.dragging = true;
  }
  if (_pcs.dragging) e.preventDefault();
}

function pcsSwipeEnd(e) {
  if (!_pcs.dragging) return;
  _pcs.dragging = false;
  const dx = e.changedTouches[0].clientX - _pcs.touchX0;
  if (dx < -60) _pcsNext();   // swipe left → next post
}

function _pcsNext() {
  const nextIdx = _pcs.idx + 1;
  if (nextIdx >= _pcs.list.length) {
    // End of list
    const screen = document.getElementById('pcs-screen');
    screen.classList.add('pcs-swipe-out');
    setTimeout(() => {
      screen.classList.remove('pcs-swipe-out');
      document.getElementById('pcs-context-bar').innerHTML =
        `<span class="pcs-context-list">${esc(_pcsListLabel(_pcs.listKey))}</span><span class="pcs-context-remaining">0 remaining</span>`;
      document.getElementById('pcs-preview-wrap').innerHTML = '';
      document.getElementById('pcs-fields').innerHTML = '';
      document.getElementById('pcs-footer').innerHTML = '';
      document.getElementById('pcs-scroll').innerHTML = `
        <div class="pcs-end-screen">
          <div class="pcs-end-icon">✓</div>
          <div>No posts left.</div>
        </div>`;
      setTimeout(closePCS, 1800);
    }, 220);
    return;
  }

  const screen = document.getElementById('pcs-screen');
  screen.classList.add('pcs-swipe-out');
  setTimeout(() => {
    screen.classList.remove('pcs-swipe-out');
    _pcs.idx    = nextIdx;
    _pcs.postId = getPostId(_pcs.list[nextIdx]);
    _renderPCS(_pcs.postId);
    screen.classList.add('pcs-swipe-in');
    setTimeout(() => screen.classList.remove('pcs-swipe-in'), 220);
  }, 220);
}
