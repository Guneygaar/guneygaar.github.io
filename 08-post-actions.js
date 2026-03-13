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
  document.getElementById('pm-title').textContent  = getTitle(post);
  document.getElementById('pm-postid').textContent = postId;
  const sel = document.getElementById('pm-stage-select');
  sel.innerHTML = PIPELINE_ORDER.map(s => `<option value="${s}" ${post.stage===s?'selected':''}>${s}</option>`).join('');
  document.getElementById('pm-comments').value = post.comments || '';
  document.getElementById('pm-postlink').value  = post.postLink || post.post_link || '';
  document.getElementById('pm-save-btn').dataset.postId = postId;
  document.getElementById('post-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePostModal() {
  document.getElementById('post-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function saveStageUpdate() {
  const postId   = document.getElementById('pm-save-btn').dataset.postId;
  const newStage = document.getElementById('pm-stage-select').value;
  const comments = document.getElementById('pm-comments').value.trim();
  const postLink = document.getElementById('pm-postlink').value.trim();
  const btn      = document.getElementById('pm-save-btn');
  btn.disabled   = true;
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: newStage, comments: comments || null, post_link: postLink || null, updated_at: new Date().toISOString() }),
    });
    await logActivity({ post_id: postId, actor_name: currentRole, actor_role: currentRole, action: `Updated: stage=${newStage}` });
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

// ── Post Card (fix 15+16) ─────────────────────
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
  const stLabel   = staleLabel(days, stage);
  const stCls     = staleClass(days);

  // Role-based action buttons
  let actionsHtml = '';
  if (currentRole === 'Admin') {
    actionsHtml = `
      <button class="pc-btn-primary" onclick="closePostCard();openAdminEdit('${esc(id)}')">✏ Edit Post</button>
      <button class="pc-btn-secondary" onclick="closePostCard();openTimeline('${esc(id)}','${esc(title)}')">⏱ Activity Timeline</button>`;
  } else if (currentRole === 'Servicing') {
    const isClientWait = ['awaiting brand input','awaiting approval','sent for approval'].includes(stageLC);
    const canNudge = isClientWait && days >= 3;
    actionsHtml = `
      <button class="pc-btn-primary" onclick="closePostCard();openPostModal('${esc(id)}')">Update Stage</button>
      ${canNudge ? `<button class="pc-btn-secondary" onclick="closePostCard();nudgeClient('${esc(id)}','${esc(title)}','${esc(post.targetDate||'')}')">💬 Nudge Client</button>` : ''}
      ${comments ? `<button class="pc-btn-secondary" onclick="closePostCard();copyCaption('${esc(id)}')">📋 Copy Caption</button>` : ''}
      ${postLink ? `<button class="pc-btn-secondary" onclick="copyApprovalLink('${window.location.origin}/p/${esc(id)}')">🔗 Copy Approval Link</button>` : ''}
      <button class="pc-btn-secondary" onclick="closePostCard();openTimeline('${esc(id)}','${esc(title)}')">⏱ Activity Timeline</button>`;
  } else if (currentRole === 'Creative') {
    const inProd = ['in production','awaiting brand input','revisions needed'].includes(stageLC);
    actionsHtml = `
      ${postLink ? `<a href="${esc(postLink)}" target="_blank" rel="noopener" class="pc-design-link">✏ Open in Canva ↗</a>` : ''}
      ${inProd ? `<button class="pc-btn-primary" onclick="closePostCard();quickStage('${esc(id)}','Ready to Send')">Mark Ready to Send</button>` : ''}
      ${inProd ? `<button class="pc-btn-secondary" onclick="closePostCard();flagIssue('${esc(id)}')">⚑ Flag Issue</button>` : ''}
      <button class="pc-btn-secondary" onclick="closePostCard();openTimeline('${esc(id)}','${esc(title)}')">⏱ View Brief History</button>`;
  }

  const content = `
    <div class="pc-stage-bar">
      <span class="tag tag-stage" style="background:${hex}22;color:${hex}">${esc(stageLabel)}</span>
      ${stLabel ? `<span class="stale-badge ${stCls}">${stLabel}</span>` : ''}
      ${relDate ? `<span class="tag tag-date ${relDate.cls}">${relDate.text}</span>` : ''}
      <button class="pc-close" onclick="closePostCard()">✕</button>
    </div>
    <div class="pc-title">${esc(title)}</div>
    <div class="pc-meta-row">
      ${pillar ? `<span class="tag tag-pillar">${esc(pillar)}</span>` : ''}
      ${owner !== '—' ? `<span class="tag tag-owner">${esc(owner)}</span>` : ''}
      ${location ? `<span class="tag" style="background:var(--surface2);color:var(--text2)">📍 ${esc(location)}</span>` : ''}
    </div>
    ${comments ? `<div class="pc-brief">${esc(comments)}</div>` : ''}
    ${!comments && postLink && currentRole !== 'Creative' ? `<a href="${esc(postLink)}" target="_blank" rel="noopener" class="pc-design-link">✏ Open in Canva ↗</a>` : ''}
    <div class="pc-actions">${actionsHtml}</div>
    <div class="pc-divider"></div>
    <div class="pc-meta-grid">
      <div><div class="pc-meta-key">Post ID</div><div class="pc-meta-val" style="font-family:var(--font-mono);font-size:11px">${esc(id)}</div></div>
      <div><div class="pc-meta-key">Owner</div><div class="pc-meta-val">${esc(owner)}</div></div>
      ${post.targetDate ? `<div><div class="pc-meta-key">Target Date</div><div class="pc-meta-val">${formatDate(post.targetDate)||'—'}</div></div>` : ''}
      ${pillar ? `<div><div class="pc-meta-key">Pillar</div><div class="pc-meta-val">${esc(pillar)}</div></div>` : ''}
    </div>
  `;

  document.getElementById('post-card-content').innerHTML = content;
  document.getElementById('post-card-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePostCard() {
  document.getElementById('post-card-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}
