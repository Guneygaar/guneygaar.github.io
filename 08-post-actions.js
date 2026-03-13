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

// ── Post Card — mobile control panel ──────────
function openPostCard(postId) {
  const post = allPosts.find(p => getPostId(p) === postId);
  if (!post) return;
  const id        = getPostId(post);
  const title     = getTitle(post);
  const stage     = post.stage || '';
  const stageLC   = stage.toLowerCase().trim();
  const { hex, label: stageLabel } = stageStyle(stage);
  const owner     = post.owner || '—';
  const pillar    = post.contentPillar || '';
  const location  = post.location || '';
  const comments  = post.comments || '';
  const postLink  = post.postLink || post.post_link || '';
  const relDate   = getRelativeDate(post.targetDate);
  const days      = daysInStage(post);
  const stCls     = staleClass(days);
  const updatedAt = post.updated_at || post.updatedAt || post.created_at || '';
  const lastActivity = updatedAt ? timeAgo(updatedAt) : '';
  const approvalLink = `${window.location.origin}/p/${id}`;

  // 1 — Status Row
  const statusRow = `
    <div class="pc2-status-row">
      <span class="pc2-stage-badge" style="background:${hex}22;color:${hex};border:1px solid ${hex}44">${esc(stageLabel)}</span>
      <div class="pc2-status-right">
        ${relDate ? `<span class="pc2-deadline ${relDate.cls}">${relDate.text}</span>` : ''}
        ${days >= 3 ? `<span class="pc2-stale ${stCls}">⏳ ${days}d</span>` : ''}
        <button class="pc2-close" onclick="closePostCard()">✕</button>
      </div>
    </div>`;

  // 2 — Title
  const titleRow = `<div class="pc2-title">${esc(title)}</div>`;

  // 3 — Metadata
  const metaParts = [
    pillar   ? esc(pillar)           : '',
    location ? `📍 ${esc(location)}` : '',
    owner !== '—' ? esc(owner)       : '',
  ].filter(Boolean);
  const metaRow = metaParts.length
    ? `<div class="pc2-meta">${metaParts.join('<span class="pc2-meta-sep"> · </span>')}</div>` : '';

  // 4+5 — Actions (role-based)
  let primaryBtn = '';
  let opsButtons = '';
  const isClientWait = ['awaiting brand input','awaiting approval','sent for approval'].includes(stageLC);
  const canNudge     = isClientWait && days >= 3;

  if (currentRole === 'Creative') {
    primaryBtn = postLink
      ? `<a href="${esc(postLink)}" target="_blank" rel="noopener" class="pc2-btn-canva">✏ Open in Canva ↗</a>`
      : `<div class="pc2-no-canva">No Canva link attached yet</div>`;

  } else if (currentRole === 'Admin' || currentRole === 'Servicing') {
    primaryBtn = postLink
      ? `<a href="${esc(postLink)}" target="_blank" rel="noopener" class="pc2-btn-canva">✏ Open in Canva ↗</a>`
      : '';

    const editBtn     = `<button class="pc2-op-btn" onclick="closePostCard();openAdminEdit('${esc(id)}')">✏ Edit</button>`;
    const stageBtn    = `<button class="pc2-op-btn" onclick="closePostCard();openPostModal('${esc(id)}')">↕ Move Stage</button>`;
    const schedBtn    = !['scheduled','published'].includes(stageLC)
      ? `<button class="pc2-op-btn" onclick="closePostCard();quickStage('${esc(id)}','Scheduled')">📅 Schedule</button>` : '';
    const nudgeBtn    = canNudge
      ? `<button class="pc2-op-btn pc2-op-accent" onclick="closePostCard();nudgeClient('${esc(id)}','${esc(title)}','${esc(post.targetDate||'')}')">💬 Nudge</button>` : '';
    const captionBtn  = comments
      ? `<button class="pc2-op-btn" onclick="copyCaption('${esc(id)}')">📋 Caption</button>` : '';
    const linkBtn     = `<button class="pc2-op-btn" onclick="copyApprovalLink('${esc(approvalLink)}')">🔗 Share Link</button>`;
    const deleteBtn   = `<button class="pc2-op-btn pc2-op-danger" onclick="closePostCard();deletePost('${esc(id)}')">🗑 Delete</button>`;
    opsButtons = `<div class="pc2-ops-grid">${editBtn}${stageBtn}${schedBtn}${nudgeBtn}${captionBtn}${linkBtn}${deleteBtn}</div>`;
  }

  // Brief
  const briefBlock = comments
    ? `<div class="pc2-brief">${esc(comments)}</div>` : '';

  // 6 — Activity (expandable)
  const activityRow = `
    <button class="pc2-activity-toggle" onclick="togglePcActivity(this)">
      <span>Activity Timeline</span>
      <span class="pc2-chevron">›</span>
    </button>
    <div class="pc2-activity-body" id="pc-activity-${esc(id)}"></div>`;

  // 7 — Footer
  const footer = `
    <div class="pc2-footer">
      <span class="pc2-footer-id">${esc(id)}</span>
      ${lastActivity ? `<span class="pc2-footer-time">${lastActivity}</span>` : ''}
    </div>`;

  document.getElementById('post-card-content').innerHTML =
    statusRow + titleRow + metaRow + briefBlock +
    (primaryBtn ? `<div class="pc2-canva-wrap">${primaryBtn}</div>` : '') +
    opsButtons + activityRow + footer;

  document.getElementById('post-card-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function togglePcActivity(btn) {
  const body = btn.nextElementSibling;
  const chevron = btn.querySelector('.pc2-chevron');
  const isOpen = body.classList.toggle('open');
  chevron.style.transform = isOpen ? 'rotate(90deg)' : '';
  if (!isOpen || body.dataset.loaded) return;
  body.dataset.loaded = '1';
  const postId = body.id.replace('pc-activity-', '');
  body.innerHTML = `<div class="pc2-activity-loading">Loading…</div>`;
  apiFetch(`/activity_log?post_id=eq.${encodeURIComponent(postId)}&order=created_at.asc&limit=20`)
    .then(rows => {
      if (!rows.length) { body.innerHTML = `<div class="pc2-activity-empty">No activity recorded yet.</div>`; return; }
      body.innerHTML = rows.map(r => `
        <div class="pc2-activity-item">
          <span class="pc2-activity-dot"></span>
          <div class="pc2-activity-content">
            <span class="pc2-activity-actor">${esc(r.actor||'System')}</span>
            <span class="pc2-activity-action">${esc(r.action||'')}</span>
          </div>
          <span class="pc2-activity-time">${r.created_at ? timeAgo(r.created_at) : ''}</span>
        </div>`).join('');
    })
    .catch(() => { body.innerHTML = `<div class="pc2-activity-empty">Could not load activity.</div>`; });
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function closePostCard() {
  document.getElementById('post-card-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
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
