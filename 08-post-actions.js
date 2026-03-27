/* ===============================================
   08-post-actions.js  -  Stage updates & modals
=============================================== */
console.log("LOADED:", "08-post-actions.js");

function _stageLabel(stage) {
  var map = {
    'brief': 'Brief',
    'brief_done': 'Closed Brief',
    'in_production': 'In Production',
    'awaiting_approval': 'Awaiting Approval',
    'awaiting_brand_input': 'Awaiting Input',
    'scheduled': 'Scheduled',
    'published': 'Published',
    'ready': 'Ready',
    'parked': 'Parked',
    'rejected': 'Rejected'
  };
  return map[stage] || stage;
}

function isAssetUrl(url) {
  if (!url) return false;
  return url.includes('supabase.co/storage') ||
    /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

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
    var _qsPost = (typeof getPostById === 'function')
      ? getPostById(postId) : null;
    var _qsTitle = _qsPost ? (_qsPost.title || postId) : postId;
    var _qsPostId = _qsPost ? _qsPost.post_id : postId;
    if (newStage === 'awaiting_approval') {
      apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_role: 'Client',
          post_id:   _qsPostId,
          type:      'awaiting_approval',
          message:   _qsTitle + ' is ready for your approval'
        })
      }).catch(function(){});
    }
    apiFetch('/notifications', {
      method: 'POST',
      body: JSON.stringify({
        user_role: 'Admin',
        post_id:   _qsPostId,
        type:      'stage_change',
        message:   resolveActor() + ' moved ' + _qsTitle + ' to ' + _stageLabel(newStage)
      })
    }).catch(function(){});
    showUndoToast('Moved to ' + _stageLabel(newStage), function() { quickStage(postId, oldStage); });
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
  var _aeRole = (effectiveRole || '').toLowerCase();
  var _aeDeleteBtn = document.getElementById('ae-delete-btn');
  if (_aeDeleteBtn) {
    _aeDeleteBtn.style.display = _aeRole === 'admin' ? '' : 'none';
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
    var _approvedTitle = post.title || postId;
    var _approvedPostId = post.post_id || postId;
    ['Servicing', 'Admin'].forEach(function(role) {
      apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_role: role,
          post_id:   _approvedPostId,
          type:      'awaiting_approval',
          message:   'Client approved -- ' + _approvedTitle +
                     ' is ready to schedule'
        })
      }).catch(function(){});
    });
    const confirmEl = document.getElementById(`approved-confirm-${postId}`);
    if (confirmEl) confirmEl.classList.add('show');
    var cardEl = document.getElementById('approved-confirm-' + postId);
    if (cardEl) {
      var parent = cardEl.parentNode;
      if (parent) {
        var actions = parent.querySelector('[style*="display:flex;border-top"]') ||
          parent.querySelector('.bp-actions');
        if (actions) {
          actions.innerHTML =
            '<div style="flex:1;padding:13px 16px;' +
            'font-family:\'IBM Plex Mono\',monospace;' +
            'font-size:10px;letter-spacing:0.1em;text-transform:uppercase;' +
            'color:#3ECF8E;display:flex;align-items:center;gap:8px;">' +
            '&#x2713; Approved -- team notified</div>';
        }
      }
    }
    setStage(post, 'scheduled', 'clientApprove');
    setTimeout(() => loadPostsForClient(), 1200);
  } catch { if (btn) btn.disabled = false; showToast('Failed  -  try again', 'error'); }
}

function showBoardingComment(postId) {
  var wrap = document.getElementById('boarding-comment-wrap-' + postId);
  if (!wrap) return;
  var isOpen = wrap.style.display === 'block';
  wrap.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    var input = document.getElementById('boarding-comment-input-' + postId);
    if (input) input.focus();
  }
}
window.showBoardingComment = showBoardingComment;

async function submitBoardingComment(postId) {
  var input = document.getElementById('boarding-comment-input-' + postId);
  if (!input) return;
  var message = (input.value || '').trim();
  if (!message) {
    showToast('Please write a comment first', 'error');
    return;
  }

  var _post = (allPosts||[]).find(function(p) {
    return p.post_id === postId || p.id === postId;
  });
  var _realPostId = _post ? _post.post_id : postId;
  var _title = _post ? (_post.title || postId) : postId;
  var _author = window.currentUserName || 'Client';
  var _role = window.effectiveRole || 'Client';
  var _normalRole = _role.charAt(0).toUpperCase() + _role.slice(1).toLowerCase();

  try {
    await apiFetch('/post_comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: _realPostId,
        author: _author,
        author_role: _normalRole,
        message: message
      })
    });

    logActivity({
      post_id: _realPostId,
      actor: _author,
      actor_role: _normalRole,
      action: 'Commented: ' + message
    });

    ['Servicing', 'Admin'].forEach(function(role) {
      apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_role: role,
          post_id: _realPostId,
          type: 'comment',
          message: _author + ' commented on ' + _title
        })
      }).catch(function(){});
    });

    var item = document.getElementById('apv-item-' + postId);
    if (item) {
      item.innerHTML =
        '<div style="padding:20px 16px;text-align:center;">' +
        '<div style="font-size:20px;margin-bottom:8px;">&#x1F4AC;</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:#C8A84B;">Comment sent</div>' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-size:12px;color:rgba(255,255,255,0.4);margin-top:6px;">The team has been notified.</div>' +
        '</div>';
    }

  } catch(e) {
    console.error('submitBoardingComment failed:', e);
    showToast('Failed to send comment', 'error');
  }
}
window.submitBoardingComment = submitBoardingComment;

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
  var files = Array.from(input.files);
  if (!files.length) return;
  var label = document.getElementById('upload-label-' + postId);
  if (label) label.textContent = 'Uploading...';
  try {
    // Upload all files in parallel
    var urls = await Promise.all(files.map(function(file) {
      return uploadPostAsset(file, postId);
    }));

    // Fetch existing images array from allPosts
    var existing = [];
    var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
    if (post && Array.isArray(post.images)) existing = post.images;

    // Merge existing + new URLs
    var merged = existing.concat(urls);

    // PATCH images array + move to in_production
    await apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
      method: 'PATCH',
      body: JSON.stringify({
        images: merged,
        stage: 'in_production',
        updated_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString()
      }),
    });

    await logActivity({
      post_id: postId,
      actor: 'Client',
      actor_role: 'Client',
      action: 'Uploaded ' + urls.length + ' asset' + (urls.length > 1 ? 's' : '')
    });

    var confirmEl = document.getElementById('upload-confirm-' + postId);
    if (confirmEl) confirmEl.innerHTML =
      '<div style="color:var(--c-green);font-size:13px;margin-top:8px">' +
      urls.length + ' photo' + (urls.length > 1 ? 's' : '') +
      ' uploaded. The team has been notified.</div>';
    if (label) label.textContent = '+ Upload Here';
    setTimeout(function() { loadPostsForClient(); }, 1000);
  } catch (err) {
    if (label) label.textContent = '+ Upload Here';
    showToast('Upload failed - try again', 'error');
  }
}

async function submitClientRequest() {
  console.log('[REQUEST] Client submit clicked');
  const brief = document.getElementById('req-topic')?.value.trim();
  if (!brief) {
    console.warn('[REQUEST] BLOCKED: missing brief');
    showToast('Please describe what you need', 'error');
    return;
  }
  var reqDateVal = (document.getElementById('req-date')||{}).value;
  if (reqDateVal) {
    var _today = new Date();
    _today.setHours(0,0,0,0);
    var _minAllowed = new Date(_today);
    _minAllowed.setDate(_minAllowed.getDate() + 2);
    var _selectedDate = new Date(reqDateVal + 'T00:00:00');
    if (_selectedDate < _minAllowed) {
      showToast(
        'Target date must be at least 2 days from today. ' +
        'Our system needs 48 hours to publish your request. This time also incorporates feedback and changes.',
        'error'
      );
      return;
    }
  }
  var btn       = document.getElementById('req-submit-btn');
  var files = (window._reqStoredFiles || []).filter(function(f) {
    return f !== null;
  });
  if (btn) {
    btn.disabled = true;
    btn.style.color = '#444';
    btn.style.borderColor = 'rgba(255,255,255,0.1)';
    btn.style.background = 'transparent';
    btn.style.boxShadow = 'none';
    btn.style.cursor = 'not-allowed';
    btn.innerHTML = 'Sending...';
  }
  try {
    const postId = 'REQ-' + Date.now();
    const email  = localStorage.getItem('hinglish_email') || 'Client';
    const reqDate = document.getElementById('req-date')?.value || null;
    var reqName = (document.getElementById('req-name') || {}).value || '';
    var now = new Date();
    var fallbackTitle = 'Request - ' +
      now.toLocaleDateString('en-IN', { day:'numeric', month:'short', timeZone:'Asia/Kolkata' }) +
      ' - ' +
      now.toLocaleTimeString('en-IN', { hour:'numeric', minute:'2-digit', timeZone:'Asia/Kolkata' });
    const payload = {
      post_id:     postId,
      title:       reqName.trim() || fallbackTitle,
      stage:       'brief',
      owner:       'Chitra',
      comments:    brief,
      target_date: reqDate,
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    };
    // Read selected content type chip
    var selectedChip = document.querySelector(
      '#req-overlay button[style*="rgb(200, 168, 75)"]'
    );
    if (selectedChip) {
      payload.comments = (payload.comments || '') +
        ' [Type: ' + selectedChip.textContent.trim() + ']';
    }
    // Read urgency
    var urgentBtn = document.getElementById('req-urgency-urgent');
    var isUrgent = urgentBtn &&
      urgentBtn.style.color === 'rgb(255, 75, 75)';
    if (isUrgent) {
      payload.comments = '[URGENT] ' + (payload.comments || '');
    }
    var imageUrls = [];
    if (files.length) {
      imageUrls = await Promise.all(
        files.map(function(f) { return uploadPostAsset(f, postId); })
      );
    }
    if (imageUrls.length) {
      payload.images = imageUrls;
    }
    console.log('[REQUEST] PAYLOAD:', payload);
    await apiFetch('/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log('[REQUEST] API SUCCESS');
    await logActivity({ post_id: postId, actor: email, actor_role: 'Client', action: 'New request: ' + brief.substring(0, 60) });
    var _reqTitle = (document.getElementById('req-name') || {}).value ||
      'New request';
    ['Servicing', 'Admin'].forEach(function(role) {
      apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_role: role,
          post_id:   postId,
          type:      'stage_change',
          message:   'Client submitted a brief -- ' + _reqTitle
        })
      }).catch(function(){});
    });
    const topicEl = document.getElementById('req-topic');
    if (topicEl) topicEl.value = '';
    var nameResetEl = document.getElementById('req-name');
    if (nameResetEl) nameResetEl.value = '';
    var fi = document.getElementById('req-file');
    if (fi) fi.value = '';
    if (btn) btn.disabled = false;
    var reqOverlay = document.getElementById('req-overlay');
    if (reqOverlay) reqOverlay.style.display = 'none';
    var navEl = document.getElementById('bottom-nav');
    if (navEl) navEl.style.display = '';
    showToast('Request sent - The team will be in touch.', 'success');
    var overlay = document.getElementById('req-overlay');
    if (overlay) {
      overlay.innerHTML =
        '<div style="position:fixed;inset:0;z-index:2001;background:#0a0a0f;' +
        'display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;gap:14px;">' +
        '<div style="font-size:32px;color:#C8A84B;line-height:1;">&#x2713;</div>' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-size:22px;' +
        'font-weight:600;color:#e8e2d9;letter-spacing:-0.01em;">Request sent.</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
        'letter-spacing:0.18em;text-transform:uppercase;color:#555;">' +
        'We\'ll get started shortly.</div>' +
        '</div>';
      overlay.style.display = 'flex';
      setTimeout(function() {
        if (typeof _closeReqForm === 'function') _closeReqForm();
      }, 2000);
    }
    if (typeof loadPosts === 'function') await loadPosts();
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

// -- Delete post (Admin only) ------------------
async function deletePost(postId) {
  var _delRole = (effectiveRole || '').toLowerCase();
  if (_delRole !== 'admin') {
    showToast('Only Admin can delete posts', 'error');
    return;
  }
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
function refreshSystemViews() {
  // Only render the active tab  -  no need to rebuild hidden containers
  const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'tasks';
  try {
    if (activeTab === 'tasks')    renderTasks();
    else if (activeTab === 'pipeline') renderPipeline();
  } catch(e) { console.error('refreshSystemViews:', e); }
}
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
