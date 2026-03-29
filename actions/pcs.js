/* ===============================================
   actions/pcs.js  -  Post Control Screen module
   Extracted from 08-post-actions.js
=============================================== */
console.log("LOADED:", "actions/pcs.js");

// -- PCS State Variables --
window._pcs = {
  postId:  null,
  listKey: null,
  list:    [],
  idx:     0,
};
window._pcsCloseTimer = null;
window._pcsEditingTarget = null;
window._pcsLbImages = [];
window._pcsLbIdx = 0;
window._modalOpen = window._modalOpen || false;

window.openPCS = function(postId, listKey) {
  // Cancel any deferred forcePCSReset from a previous closePCS()  - 
  // without this, a rapid close->open reopens the sheet, then the
  // stale timer fires 300ms later and nukes it back to hidden.
  if (window._pcsCloseTimer) { clearTimeout(window._pcsCloseTimer); window._pcsCloseTimer = null; }

  // Force-clean any stale PCS state from a previous session
  forcePCSReset();

  var list = (listKey && window._postLists && _postLists[listKey])
    ? _postLists[listKey]
    : allPosts;
  var idx = list.findIndex(function(p) { return getPostId(p) === postId; });
  window._pcs.listKey = listKey || '';
  window._pcs.list    = list;
  window._pcs.idx     = idx >= 0 ? idx : 0;
  window._pcs.postId  = postId;

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

window.closePCS = function() {
  forcePCSReset();
  // Safety: re-verify after animations settle (catches mobile compositor lag).
  // Store the timer so openPCS can cancel it if the user reopens quickly.
  if (window._pcsCloseTimer) clearTimeout(window._pcsCloseTimer);
  window._pcsCloseTimer = setTimeout(function() {
    window._pcsCloseTimer = null;
    forcePCSReset();
  }, 300);
}

// ===============================================
// forcePCSReset  -  single authoritative cleanup
// Tears down ALL PCS visual state, compositing layers,
// and event-capturing surfaces. Safe to call multiple times.
// ===============================================
window.forcePCSReset = function() {
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
  window._pcs.postId = null;

  // 7. Flush any deferred background renders
  _drainDeferredRender();
}

window._renderPCS = function(postId) {
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
  var _pcsRole = (effectiveRole || '').toLowerCase();
  var _isPranavPCS = _pcsRole === 'creative' ||
    _pcsRole === 'pranav' ||
    (window.currentUserEmail || '').toLowerCase().includes('pranav');
  const canEdit = _pcsRole !== 'client' && !_isPranavPCS;
  const canEditCreative = _isPranavPCS;
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

  // Hide delete button for non-Admin roles
  var _pcsDelBtn = document.querySelector('.pc-topbar .pc-icon-btn.danger');
  if (_pcsDelBtn) {
    var _isAdminDel = (_pcsRole === 'admin');
    _pcsDelBtn.style.display = _isAdminDel ? '' : 'none';
  }

  _updateSubtitle(post);
  if (elProgress) elProgress.innerHTML = _buildStageProgress(stageLC);

  // -- Photo strip --
  var imgs = Array.isArray(post.images) ? post.images : [];
  var showPhotoSection = (canEdit || canEditCreative) || imgs.length > 0;
  var photoStripHtml = '';
  if (showPhotoSection) {
    photoStripHtml =
      '<div id="pcs-photo-section" style="border-bottom:1px solid rgba(255,255,255,0.07);">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
      'padding:7px 18px;border-bottom:1px solid rgba(255,255,255,0.07);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#555;">' +
      'Photos <span style="color:' + (imgs.length ? '#777' : '#333') + ';">' +
      imgs.length + '</span></div>' +
      ((canEdit || canEditCreative) ?
        '<button onclick="_pcsAddPhotos(\'' + esc(id) + '\')" ' +
        'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
        'letter-spacing:0.1em;text-transform:uppercase;color:#F6A623;' +
        'background:transparent;border:1px solid rgba(246,166,35,0.3);' +
        'padding:4px 10px;cursor:pointer;">+ Add More</button>'
        : '') +
      '</div>' +
      (imgs.length > 0 ?
        '<div style="display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;">' +
        imgs.map(function(url, idx) {
          return '<div onclick="_pcsOpenLightbox(\'' + esc(id) + '\',' + idx + ')" ' +
            'style="flex-shrink:0;width:100px;height:100px;position:relative;' +
            'background:#1a1a1a;cursor:pointer;overflow:hidden;">' +
            '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover;display:block;">' +
            '<div style="position:absolute;bottom:3px;right:4px;font-family:' +
            '\'IBM Plex Mono\',monospace;font-size:7px;color:rgba(255,255,255,0.4);' +
            'background:rgba(0,0,0,0.5);padding:1px 4px;">' + (idx + 1) + '</div>' +
            ((canEdit || canEditCreative) ?
              '<button onclick="event.stopPropagation();_pcsRemovePhoto(\'' +
              esc(id) + '\',' + idx + ')" ' +
              'style="position:absolute;top:4px;right:4px;width:28px;height:28px;' +
              'border-radius:50%;background:rgba(0,0,0,0.85);border:none;' +
              'color:#e8e2d9;font-size:14px;cursor:pointer;display:flex;' +
              'align-items:center;justify-content:center;line-height:1;">x</button>'
              : '') +
            '</div>';
        }).join('') +
        ((canEdit || canEditCreative) ?
          '<div onclick="_pcsAddPhotos(\'' + esc(id) + '\')" ' +
          'style="flex-shrink:0;width:100px;height:100px;' +
          'border:1px dashed rgba(246,166,35,0.2);display:flex;' +
          'flex-direction:column;align-items:center;justify-content:center;' +
          'cursor:pointer;gap:5px;">' +
          '<div style="font-size:22px;color:rgba(246,166,35,0.35);">+</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:6px;' +
          'letter-spacing:0.1em;text-transform:uppercase;color:#333;' +
          'text-align:center;line-height:1.5;">Upload<br>Photos</div>' +
          '</div>'
          : '') +
        '</div>'
        :
        ((canEdit || canEditCreative) ?
          '<div onclick="_pcsAddPhotos(\'' + esc(id) + '\')" ' +
          'style="margin:10px 18px 12px;border:1px dashed rgba(255,255,255,0.07);' +
          'padding:20px;display:flex;flex-direction:column;align-items:center;' +
          'gap:8px;cursor:pointer;">' +
          '<div style="font-size:20px;color:rgba(246,166,35,0.3);">+</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
          'letter-spacing:0.12em;text-transform:uppercase;color:#F6A623;">Upload Photos</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
          'color:#333;letter-spacing:0.06em;">JPG / PNG -- stored in Supabase, original quality</div>' +
          '</div>'
          : '')
      ) +
      ((canEdit || canEditCreative) ?
        '<input type="file" id="pcs-photo-input" accept="image/*" ' +
        'multiple style="display:none;" ' +
        'onchange="_pcsHandlePhotoInput(\'' + esc(id) + '\',this)">'
        : '') +
      '</div>';
  }

  // -- LinkedIn link (published posts) --
  var stageForLi = (post.stage || stageLC || '').toLowerCase();
  var liHtml = '';

  if (stageForLi === 'published') {
    if (post.linkedinUrl) {
      liHtml =
        '<div style="padding:12px 18px;border-bottom:1px solid' +
        ' rgba(255,255,255,0.07);background:rgba(10,102,194,0.04);' +
        'border-top:1px solid rgba(10,102,194,0.1);">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
        'letter-spacing:0.18em;text-transform:uppercase;color:#0a66c2;' +
        'margin-bottom:8px;display:flex;align-items:center;gap:6px;">' +
        '<div style="width:6px;height:6px;border-radius:50%;' +
        'background:#0a66c2;flex-shrink:0;"></div>Live on LinkedIn</div>' +
        '<button onclick="window.open(\'' + esc(post.linkedinUrl) +
        '\',\'_blank\')" ' +
        'style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:8px;letter-spacing:0.12em;text-transform:uppercase;' +
        'color:#0a66c2;background:transparent;' +
        'border:1px solid rgba(10,102,194,0.3);' +
        'padding:11px 0;cursor:pointer;display:flex;align-items:center;' +
        'justify-content:center;gap:8px;">' +
        '<span style="font-size:14px;font-weight:600;">in</span>' +
        'View Live Post &rarr;</button>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
        'color:#2a2a2a;letter-spacing:0.04em;margin-top:6px;overflow:hidden;' +
        'text-overflow:ellipsis;white-space:nowrap;">' +
        esc(post.linkedinUrl.replace('https://', '')) + '</div>' +
        '</div>';
    } else {
      liHtml =
        '<div style="padding:12px 18px;border-bottom:1px solid' +
        ' rgba(255,255,255,0.07);border-top:1px solid rgba(246,166,35,0.1);' +
        'background:rgba(246,166,35,0.03);">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
        'letter-spacing:0.18em;text-transform:uppercase;color:#444;' +
        'margin-bottom:8px;">Live Post URL</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<input id="pcs-li-inline-input" type="url" ' +
        'placeholder="Paste LinkedIn post URL..." ' +
        'style="flex:1;background:rgba(255,255,255,0.02);border:none;' +
        'border-bottom:1px solid rgba(255,255,255,0.1);color:#e8e2d9;' +
        'font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
        'padding:8px 0;outline:none;letter-spacing:0.02em;">' +
        '<button onclick="_saveLiUrlInline(\'' + esc(id) + '\')" ' +
        'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
        'letter-spacing:0.12em;text-transform:uppercase;color:#3ECF8E;' +
        'background:transparent;border:1px solid rgba(62,207,142,0.3);' +
        'padding:7px 12px;cursor:pointer;flex-shrink:0;">Save</button>' +
        '</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
        'color:#2a2a2a;letter-spacing:0.06em;margin-top:6px;">' +
        'Add so the team can track impressions</div>' +
        '</div>';
    }
  }
  if (elDesign) elDesign.innerHTML = photoStripHtml;

  var captionHtml = '';
  if (post.caption || canEdit || canEditCreative) {
    captionHtml = '<div id="pcs-caption-section" style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.07);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.18em;text-transform:uppercase;color:#555;' +
      'margin-bottom:8px;display:flex;align-items:center;' +
      'justify-content:space-between;">' +
      '<span>Copy / Caption</span>' +
      ((canEdit || canEditCreative) ?
        '<button onclick="_startCaptionEdit(\'' + esc(id) + '\')" ' +
        'id="pcs-caption-edit-btn" ' +
        'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
        'letter-spacing:0.1em;text-transform:uppercase;color:#F6A623;' +
        'background:transparent;border:none;cursor:pointer;">Edit</button>'
        : '') +
      '</div>' +
      (post.caption ?
        '<div id="pcs-caption-text" data-raw="' + esc(post.caption) + '" style="font-family:\'DM Sans\',sans-serif;' +
        'font-size:13px;color:#888;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;' +
        'overflow-wrap:break-word;word-break:break-word;max-width:100%;' +
        'max-height:62px;overflow:hidden;' +
        '-webkit-mask-image:linear-gradient(to bottom,black 30px,transparent 60px);' +
        'mask-image:linear-gradient(to bottom,black 30px,transparent 60px);">' +
        esc(post.caption) + '</div>' +
        '<button id="pcs-caption-see-more" onclick="(function(){' +
        'var t=document.getElementById(\'pcs-caption-text\');' +
        'var b=document.getElementById(\'pcs-caption-see-more\');' +
        'if(t.style.maxHeight===\'62px\'){t.style.maxHeight=\'none\';t.style.webkitMaskImage=\'none\';t.style.maskImage=\'none\';t.style.overflow=\'visible\';b.textContent=\'See Less\';}' +
        'else{t.style.maxHeight=\'62px\';t.style.overflow=\'hidden\';t.style.webkitMaskImage=\'linear-gradient(to bottom,black 30px,transparent 60px)\';t.style.maskImage=\'linear-gradient(to bottom,black 30px,transparent 60px)\';b.textContent=\'See More\';}' +
        '})()" style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;' +
        'text-transform:uppercase;color:#F6A623;background:transparent;border:none;cursor:pointer;' +
        'padding:6px 0 0 0;">See More</button>'
        :
        '<div id="pcs-caption-text" style="font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:9px;color:#333;letter-spacing:0.06em;">No copy yet</div>'
      ) +
      '</div>';
  }

  var whatsappHtml = '';
  var showWA = post.caption && (
    (effectiveRole || '').toLowerCase() === 'client' ||
    stageLC === 'awaiting_approval'
  );

  if (showWA) {
    whatsappHtml = '<div style="padding:10px 18px 12px;' +
      'background:rgba(37,211,102,0.04);' +
      'border-top:1px solid rgba(37,211,102,0.1);' +
      'border-bottom:1px solid rgba(255,255,255,0.07);">' +
      '<button onclick="_sharePostOnWhatsApp(\'' + esc(id) + '\')" ' +
      'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#25D366;' +
      'background:transparent;border:1px solid rgba(37,211,102,0.25);' +
      'padding:11px 0;cursor:pointer;">Share on WhatsApp</button>' +
      (function(){
        var _isDesktop = window.innerWidth > 768 && !('ontouchstart' in window);
        var _copyHtml = _isDesktop ?
          '<button onclick="(function(){' +
          'var post=(typeof getPostById===\'function\')?getPostById(\'' + postId + '\'):null;' +
          'if(!post)return;' +
          'var pid=(post.post_id||post.id||\'\');' +
          'var sid=pid.replace(/[^0-9]/g,\'\').slice(-4);' +
          'if(!sid)sid=pid.slice(-4);' +
          'var msg=(post.title||\'\')+\' -- Awaiting your approval.\\n\\nhttps://srtd.io/p/\'+sid;' +
          'navigator.clipboard.writeText(msg).then(function(){' +
          'var b=document.getElementById(\'pcs-copy-btn\');' +
          'if(b){b.textContent=\'Copied\';' +
          'setTimeout(function(){b.textContent=\'Copy to Share\';},2000);}' +
          '});' +
          '})()" id="pcs-copy-btn" ' +
          'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
          'letter-spacing:0.14em;text-transform:uppercase;color:#888;' +
          'background:transparent;border:1px solid rgba(255,255,255,0.12);' +
          'padding:10px 0;cursor:pointer;margin-top:6px;">' +
          'Copy to Share</button>'
          : '';
        return _copyHtml;
      })() +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'color:#333;letter-spacing:0.06em;margin-top:6px;text-align:center;">' +
      'Sends copy + approval link to client</div>' +
      '</div>';
  }

  if (elFields)   elFields.innerHTML = captionHtml + whatsappHtml + _buildInfoGrid(post, canEdit, canEditCreative, id) + _buildNotes(post, canEdit, id) + liHtml + '<input type="hidden" id="pcs-post-id" value="' + esc(id) + '">';

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

  // Load comments
  var _pcsPostIdEl = document.getElementById('pcs-post-id');
  var _pcsPostId = _pcsPostIdEl ? _pcsPostIdEl.value : id;
  if (typeof loadPcsComments === 'function') {
    loadPcsComments(_pcsPostId);
  }

  var notesSection = document.getElementById('pcs-notes-section');
  if (notesSection) {
    var _r = (window.effectiveRole||'').toLowerCase();
    notesSection.style.display = _r === 'client' ? 'none' : 'block';
  }
}

// -- Subtitle sync (single source of truth) --------------
window._updateSubtitle = function(post) {
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
window._pcsTitleEdit = function(el, postId) {
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
window.changeStage = function(newStage) {
  const postId = window._pcs.postId;
  if (!postId) return;
  if (newStage === 'published') {
    _showPublishSheet(postId);
    return;
  }
  const post = getPostById(postId);
  if (!post) return;
  const current = post.stage || '';
  if (current === newStage) return; // same stage

  _showStageConfirm(postId, newStage);
}

window._showPublishSheet = function(postId) {
  var existing = document.getElementById('pcs-publish-sheet');
  if (existing) existing.remove();

  var sheet = document.createElement('div');
  sheet.id = 'pcs-publish-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9600;' +
    'background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;' +
    'justify-content:center;';
  sheet.innerHTML =
    '<div style="width:100%;max-width:390px;background:#141414;' +
    'border-top:1px solid rgba(255,255,255,0.1);' +
    'padding:20px 18px 44px;">' +

    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.2em;text-transform:uppercase;color:#3ECF8E;' +
    'margin-bottom:6px;">Mark as Published</div>' +

    '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;' +
    'color:#666;line-height:1.5;margin-bottom:20px;">' +
    'Paste the LinkedIn post URL so the team can track impressions. ' +
    'You can skip this and add it later.</div>' +

    '<input id="pcs-li-url-input" type="url" ' +
    'placeholder="https://linkedin.com/posts/..." ' +
    'style="width:100%;background:rgba(255,255,255,0.02);border:none;' +
    'border-bottom:1px solid rgba(255,255,255,0.15);color:#e8e2d9;' +
    'font-family:\'IBM Plex Mono\',monospace;font-size:11px;' +
    'padding:10px 0;outline:none;margin-bottom:16px;' +
    'letter-spacing:0.02em;">' +

    '<div style="display:flex;gap:10px;">' +
    '<button onclick="_confirmPublish(\'' + postId + '\')" ' +
    'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.14em;text-transform:uppercase;color:#3ECF8E;' +
    'background:transparent;border:1px solid rgba(62,207,142,0.4);' +
    'padding:13px 0;cursor:pointer;">Publish + Save URL</button>' +
    '<button onclick="_skipPublish(\'' + postId + '\')" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.14em;text-transform:uppercase;color:#333;' +
    'background:transparent;border:1px solid rgba(255,255,255,0.06);' +
    'padding:13px 16px;cursor:pointer;">Skip</button>' +
    '</div></div>';

  document.body.appendChild(sheet);
  setTimeout(function() {
    var inp = document.getElementById('pcs-li-url-input');
    if (inp) inp.focus();
  }, 100);
}

window._removePublishSheet = function() {
  var sheet = document.getElementById('pcs-publish-sheet');
  if (sheet) sheet.remove();
}

window._saveLiUrlInline = function(postId) {
  var input = document.getElementById('li-url-input-' + postId)
    || document.getElementById('pcs-li-inline-input')
    || document.querySelector('.pcs-li-url-input');
  if (!input) return;
  var url = (input.value || '').trim();
  if (!url) {
    showToast('Please enter a URL', 'error');
    return;
  }

  var _liPost = (allPosts||[]).find(function(p) {
    return p.post_id === postId ||
           (p.id && p.id === postId);
  });
  var _liPostId = _liPost ? _liPost.post_id : postId;

  var btn = document.getElementById('li-save-btn-' + postId);
  if (btn) {
    btn.textContent = 'Saving...';
    btn.disabled = true;
  }

  apiFetch('/posts?post_id=eq.' + encodeURIComponent(_liPostId), {
    method: 'PATCH',
    body: JSON.stringify({ linkedin_link: url })
  }).then(function() {
    var idx = (allPosts || []).findIndex(function(p) {
      return p.post_id === _liPostId;
    });
    if (idx !== -1) {
      allPosts[idx].linkedin_link = url;
      allPosts[idx].linkedinUrl = url;
    }
    showToast('LinkedIn link saved', 'success');
    if (typeof openPCS === 'function') openPCS(postId, '');
    loadPosts();
  }).catch(function(err) {
    console.error('LinkedIn save failed:', err);
    showToast('Save failed - try again', 'error');
    if (btn) {
      btn.textContent = 'Save';
      btn.disabled = false;
    }
  });
}

// -- PCS Comments --------------------------------------------------
window.loadPcsComments = async function(postId) {
  var section = document.getElementById('pcs-comments-section');
  var list = document.getElementById('pcs-comments-list');
  var notesList = document.getElementById('pcs-notes-list');
  if (!section || !list) return;

  var _role = (window.effectiveRole || 'Admin');
  var _roleLower = _role.toLowerCase();
  var _name = window.currentUserName || '';

  try {
    var rows = await apiFetch(
      '/post_comments?post_id=eq.' +
      encodeURIComponent(postId) +
      '&order=created_at.asc&limit=100'
    );
    if (!Array.isArray(rows)) rows = [];

    var clientRows = rows.filter(function(c) {
      return c.visibility === 'all' || !c.visibility;
    });

    var internalRows = rows.filter(function(c) {
      if (c.visibility === 'all' || !c.visibility) return false;
      if (_roleLower === 'admin') return true;
      if (_roleLower === 'servicing' || _roleLower === 'chitra') {
        if (c.visibility === 'all' || c.visibility === 'servicing') return true;
        var _mu = Array.isArray(c.mentioned_users) ? c.mentioned_users : [];
        return _mu.indexOf(_name) !== -1;
      }
      if (_roleLower === 'creative' || _roleLower === 'pranav') {
        if (c.visibility === 'all' || c.visibility === 'creative') return true;
        var _mu = Array.isArray(c.mentioned_users) ? c.mentioned_users : [];
        return _mu.indexOf(_name) !== -1;
      }
      return false;
    });

    section.style.display = 'block';

    function _formatTs(c) {
      if (!c.created_at) return '';
      var _d = new Date((c.created_at||'')
        .replace(' ','T')
        .replace('+00:00','Z')
        .replace('+00','Z'));
      if (isNaN(_d.getTime())) return '';
      return _d.toLocaleDateString('en-IN',{
        day:'numeric',month:'short',
        timeZone:'Asia/Kolkata'}) +
        ' \xB7 ' +
        _d.toLocaleTimeString('en-IN',{
        hour:'numeric',minute:'2-digit',
        hour12:true,timeZone:'Asia/Kolkata'});
    }

    function _avatarClass(c) {
      var _r = (c.author_role||'').toLowerCase();
      if (_r==='client') return 'pcs-avatar av-client';
      if (_r==='servicing'||_r==='chitra') return 'pcs-avatar av-servicing';
      if (_r==='creative'||_r==='pranav') return 'pcs-avatar av-creative';
      return 'pcs-avatar av-admin';
    }

    function _renderClientThread(threadRows, isEmpty) {
      if (!threadRows.length) return isEmpty;
      return threadRows.map(function(c) {
        var _initial = (c.author||'?').charAt(0).toUpperCase();
        return '<div class="pcs-comment-item">' +
          (!c.read ? '<div class="pcs-unread-dot"></div>' : '') +
          '<div class="' + _avatarClass(c) + '">' + esc(_initial) + '</div>' +
          '<div class="pcs-comment-body">' +
            '<div class="pcs-comment-meta">' +
              '<span class="pcs-comment-author">' + esc(c.author) + '</span>' +
              '<span class="pcs-comment-time">' + _formatTs(c) + '</span>' +
            '</div>' +
            '<div class="pcs-comment-text">' + esc(c.message) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function _renderNoteThread(threadRows, isEmpty) {
      if (!threadRows.length) return isEmpty;
      return threadRows.map(function(c) {
        var _initial = (c.author||'?').charAt(0).toUpperCase();
        var _mu = Array.isArray(c.mentioned_users) ? c.mentioned_users : [];
        var _mentionBadge = _mu.length
          ? '<span class="pcs-mention-badge">@' + esc(_mu.join(', @')) + '</span>'
          : '';
        var _vis = (c.visibility||'all').toUpperCase();
        if (_vis === 'SERVICING') _vis = 'SERV';
        var _visTag = '<span class="pcs-vis-tag">' + _vis + '</span>';

        return '<div class="pcs-note-item' +
          (c.resolved ? ' pcs-resolved' : '') + '">' +
          (!c.read ? '<div class="pcs-unread-dot"></div>' : '') +
          '<div class="' + _avatarClass(c) + '">' + esc(_initial) + '</div>' +
          '<div class="pcs-comment-body">' +
            '<div class="pcs-comment-meta">' +
              '<span class="pcs-comment-author">' + esc(c.author) + '</span>' +
              '<span class="pcs-comment-time">' + _formatTs(c) + '</span>' +
              _mentionBadge +
              _visTag +
            '</div>' +
            '<div class="pcs-comment-text">' + esc(c.message) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    var emptyClient =
      '<div class="pcs-empty-thread">' +
      '<div class="pcs-empty-icon">&#x1F4AC;</div>' +
      '<div class="pcs-empty-text">No client comments yet.<br>Client and team see this thread.</div>' +
      '</div>';

    list.innerHTML = _renderClientThread(clientRows, emptyClient);

    var countEl = document.getElementById('pcs-comments-count');
    if (countEl) {
      if (clientRows.length) {
        countEl.textContent = clientRows.length;
        countEl.style.display = 'inline';
      } else {
        countEl.style.display = 'none';
      }
    }

    if (notesList && _roleLower !== 'client') {
      var _activeVis = window._pcsNoteVisibility || 'all';
      var filteredNotes = internalRows.filter(function(c) {
        return (c.visibility || 'all') === _activeVis;
      });
      var resolvedRows = filteredNotes.filter(function(c) { return c.resolved; });
      var activeRows = filteredNotes.filter(function(c) { return !c.resolved; });

      var emptyNotes =
        '<div class="pcs-empty-thread">' +
        '<div class="pcs-empty-icon">&#x1F512;</div>' +
        '<div class="pcs-empty-text">No internal notes yet.</div></div>';

      var notesHtml = _renderNoteThread(activeRows, emptyNotes);

      if (resolvedRows.length) {
        notesHtml +=
          '<details class="pcs-resolved-wrap">' +
          '<summary class="pcs-resolved-summary">' +
          '\u21B3 ' + resolvedRows.length +
          ' Resolved Note' +
          (resolvedRows.length > 1 ? 's' : '') +
          ' (click to expand)</summary>' +
          _renderNoteThread(resolvedRows, '') +
          '</details>';
      }

      notesList.innerHTML = notesHtml;

      var notesCountEl = document.getElementById('pcs-notes-count');
      if (notesCountEl) {
        if (filteredNotes.length) {
          notesCountEl.textContent = activeRows.length;
          notesCountEl.style.display = 'inline';
        } else {
          notesCountEl.style.display = 'none';
        }
      }

      // Per-chip counts
      var allCount = internalRows.filter(function(r) { return (r.visibility||'all')==='all'; }).length;
      var adminCount = internalRows.filter(function(r) { return r.visibility==='admin'; }).length;
      var servCount = internalRows.filter(function(r) { return r.visibility==='servicing'; }).length;
      var creativeCount = internalRows.filter(function(r) { return r.visibility==='creative'; }).length;
      var chips = document.querySelectorAll('.pcs-vis-chip');
      chips.forEach(function(chip) {
        var v = chip.getAttribute('data-vis');
        var cnt = 0;
        if (v === 'all') cnt = allCount;
        else if (v === 'admin') cnt = adminCount;
        else if (v === 'servicing') cnt = servCount;
        else if (v === 'creative') cnt = creativeCount;
        var label = v === 'all' ? 'ALL' : v === 'admin' ? 'ADMIN' : v === 'servicing' ? 'SERV' : 'CREATIVE';
        chip.textContent = cnt > 0 ? label + ' (' + cnt + ')' : label;
      });
    }

    list.scrollTop = list.scrollHeight;
    if (notesList) notesList.scrollTop = notesList.scrollHeight;

  } catch(e) {
    console.error('loadPcsComments failed:', e);
  }
}

window._showStageConfirm = function(postId, newStage) {
  _removePcsConfirm();
  // Close any open attach editor  -  only one interactive layer at a time
  if (window._pcs.postId) pcsCloseAttach(window._pcs.postId);
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

window._buildStageProgress = function(stageLC) {
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

window._buildInlineActions = function(canvaUrl, linkedinUrl, isPublished, canEdit, postId, stageLC) {
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

window._pcsEditLink = function(postId, target) {
  window._pcsEditingTarget = target; // 'canva' or 'linkedin'
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

window.pcsCloseAttach = function(postId) {
  window._pcsEditingTarget = null;
  const row = document.getElementById(`pcs-attach-row-${postId}`);
  const cancel = document.getElementById(`pcs-attach-cancel-${postId}`);
  if (row) row.style.display = 'none';
  if (cancel) cancel.style.display = 'none';
}

window.pcsSaveAttach = async function(postId) {
  const input = document.getElementById(`pcs-attach-input-${postId}`);
  const url = (input?.value || '').trim();
  if (!url || !url.startsWith('http')) { showToast('Enter a valid URL', 'error'); return; }
  // Save to the field that matches the editing target  -  never infer from stage
  const field = window._pcsEditingTarget === 'linkedin' ? 'linkedinUrl' : 'postLink';
  await updatePost(postId, field, url);
  // Clear editing state and hide attach row (auto-disappear)
  window._pcsEditingTarget = null;
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

window._loadPCSActivity = function(postId, bodyEl) {
  // READ from activity_log removed - activity_log contains system noise.
  // Use notifications table for user-facing messages instead.
  bodyEl.innerHTML = '<div class="pcs-activity-empty">No activity yet.</div>';
}

window._buildInfoGrid = function(post, canEdit, canEditCreative, id) {
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
    cell('Pillar', (canEdit || canEditCreative) ? mkSel('contentPillar', PILLARS_DB, post.contentPillar||'', 'contentPillar', PILLAR_DISPLAY) : mkRo(formatPillarDisplay(post.contentPillar) || ' - ')) +
    cell('Location', (canEdit || canEditCreative) ? mkSel('location', LOCS, post.location||'', 'location') : mkRo(post.location)) +
    cell('Format', (canEdit || canEditCreative) ? mkSel('format', FORMATS, post.format||'', 'format') : mkRo(post.format)) +
    cell(dateLabel, dateInput, dateColorCls) +
  '</div></div>';
}

window._buildNotes = function() {
  return '';
}

// -- Stage advance button (FIX 7) --
window._ADVANCE_SEQ = ['in_production', 'ready', 'awaiting_approval', 'scheduled', 'published'];
window._ADVANCE_LABELS = {
  'ready': 'Move to Ready',
  'awaiting_approval': 'Send for Approval',
  'scheduled': 'Mark Scheduled',
  'published': 'Mark Published'
};
window._ADVANCE_CLS = {
  'ready': 'to-ready',
  'awaiting_approval': 'to-approval',
  'scheduled': 'to-scheduled',
  'published': 'to-published'
};

window._renderAdvanceButton = function(stageLC) {
  var _advRole = (effectiveRole || '').toLowerCase();
  var _isPranavAdv = _advRole === 'creative' ||
    _advRole === 'pranav' ||
    (window.currentUserEmail||'').toLowerCase().includes('pranav');
  if (_advRole === 'client' || _isPranavAdv) return '';
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

  var idx = window._ADVANCE_SEQ.indexOf(stageLC);
  if (idx < 0 || idx >= window._ADVANCE_SEQ.length - 1) {
    block.style.display = 'none';
    return;
  }

  var nextStage = window._ADVANCE_SEQ[idx + 1];
  label.textContent = window._ADVANCE_LABELS[nextStage] || ('Move to ' + nextStage);

  // Remove old color classes
  btn.className = 'pc-advance-btn';
  var cls = window._ADVANCE_CLS[nextStage];
  if (cls) btn.classList.add(cls);

  btn.onclick = function() { changeStage(nextStage); };
  block.style.display = '';
}

// -- Activity count (FIX 9) --
window._renderActivityCount = function(postId) {
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

window._removePcsConfirm = function() {
  document.querySelectorAll('.pcs-confirm-overlay').forEach(el => el.remove());
}

window.pcsConfirmDelete = function() {
  // Guard: don't create if PCS is already closed (handles race with delayed click after close)
  const pcsOpen = document.getElementById('pcs-overlay')?.classList.contains('open');
  if (!pcsOpen || !window._pcs.postId) return;
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

window.pcsDoDelete = async function() {
  var _delRole = (effectiveRole || '').toLowerCase();
  if (_delRole !== 'admin') {
    showToast('Only Admin can delete posts', 'error');
    return;
  }
  _removePcsConfirm();
  const id = window._pcs.postId;
  if (!id) return;
  try {
    await apiFetch(`/posts?post_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    logActivity({
      post_id: id,
      actor: window.currentUserName || 'Admin',
      actor_role: 'Admin',
      action: 'deleted post'
    });
    showToast('Post deleted');
    closePCS();
    await loadPosts();
  } catch(e) { showToast('Delete failed', 'error'); }
}

window._pcsAddPhotos = function(postId) {
  var input = document.getElementById('pcs-photo-input');
  if (input) input.click();
}

window._pcsHandlePhotoInput = async function(postId, input) {
  var files = Array.from(input.files || []);
  if (!files.length) return;
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;
  var currentImages = Array.isArray(post.images) ? post.images.slice() : [];
  var uploaded = [];
  var progressWrap = document.createElement('div');
  progressWrap.id = 'pcs-upload-progress';
  progressWrap.style.cssText = 'padding:8px 18px;border-bottom:' +
    '1px solid rgba(255,255,255,0.07);';
  progressWrap.innerHTML =
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.14em;text-transform:uppercase;color:#555;' +
    'margin-bottom:6px;" id="pcs-upload-label">Uploading 0 of ' +
    files.length + '...</div>' +
    '<div style="height:2px;background:rgba(255,255,255,0.06);width:100%;">' +
    '<div id="pcs-upload-bar" style="height:2px;background:#F6A623;' +
    'width:0%;transition:width 0.2s ease;"></div></div>';
  var photoSection = document.getElementById('pcs-photo-section');
  if (photoSection) photoSection.parentNode.insertBefore(
    progressWrap, photoSection);
  for (var fi = 0; fi < files.length; fi++) {
    if (currentImages.length + uploaded.length >= 20) break;
    try {
      var url = await uploadPostAsset(files[fi], postId);
      if (url) uploaded.push(url);
    } catch(e) {
      console.warn('[PCS] Photo upload failed:', e);
    }
    var pct = Math.round(((fi + 1) / files.length) * 100);
    var bar = document.getElementById('pcs-upload-bar');
    var lbl = document.getElementById('pcs-upload-label');
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = 'Uploading ' + (fi + 1) +
      ' of ' + files.length + '...' +
      (pct === 100 ? ' Done.' : '');
  }
  if (!uploaded.length) return;
  var newImages = currentImages.concat(uploaded);
  try {
    await apiFetch('/posts?post_id=eq.' + postId, {
      method: 'PATCH',
      body: JSON.stringify({ images: newImages })
    });
    if (window.allPosts && Array.isArray(window.allPosts)) {
      var idx = window.allPosts.findIndex(function(p) {
        return p.post_id === postId || p.id === postId;
      });
      if (idx !== -1) window.allPosts[idx].images = newImages;
    }
    var section = document.getElementById('pcs-photo-section');
    if (section && post) {
      post.images = newImages;
      if (typeof openPCS === 'function') openPCS(postId, '');
    }
    var pw = document.getElementById('pcs-upload-progress');
    if (pw) pw.remove();
  } catch(e) {
    alert('Failed to save photos. Please try again.');
  }
}

window._pcsRemovePhoto = async function(postId, idx) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;
  var imgs = Array.isArray(post.images) ? post.images.slice() : [];
  imgs.splice(idx, 1);
  try {
    await apiFetch('/posts?post_id=eq.' + postId, {
      method: 'PATCH',
      body: JSON.stringify({ images: imgs })
    });
    if (window.allPosts && Array.isArray(window.allPosts)) {
      var i2 = window.allPosts.findIndex(function(p) {
        return p.post_id === postId || p.id === postId;
      });
      if (i2 !== -1) window.allPosts[i2].images = imgs;
    }
    if (typeof openPCS === 'function') openPCS(postId, '');
  } catch(e) {
    alert('Failed to remove photo. Please try again.');
  }
}

window._pcsOpenLightbox = function(postId, idx) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  window._pcsLbImages = (post && Array.isArray(post.images)) ? post.images : [];
  window._pcsLbIdx = idx || 0;
  _pcsLbRender();
  var lb = document.getElementById('pcs-lightbox');
  if (lb) { lb.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

window._pcsLbRender = function() {
  var img = document.getElementById('pcs-lb-img');
  var counter = document.getElementById('pcs-lb-counter');
  var filename = document.getElementById('pcs-lb-filename');
  var dots = document.getElementById('pcs-lb-dots');
  if (!img) return;
  var url = window._pcsLbImages[window._pcsLbIdx] || '';
  img.src = url;
  if (counter) counter.textContent = (window._pcsLbIdx + 1) + ' / ' + window._pcsLbImages.length;
  if (filename) {
    var parts = url.split('/');
    filename.textContent = parts[parts.length - 1] || '';
  }
  if (dots) {
    dots.innerHTML = window._pcsLbImages.map(function(u, i) {
      return '<div style="width:5px;height:5px;border-radius:50%;background:' +
        (i === window._pcsLbIdx ? '#e8e2d9' : '#2a2a2a') + ';"></div>';
    }).join('');
  }
}

window._pcsLbNext = function() {
  window._pcsLbIdx = (window._pcsLbIdx + 1) % window._pcsLbImages.length;
  _pcsLbRender();
}

window._pcsLbPrev = function() {
  window._pcsLbIdx = (window._pcsLbIdx - 1 + window._pcsLbImages.length) % window._pcsLbImages.length;
  _pcsLbRender();
}

window._pcsLbClose = function() {
  var lb = document.getElementById('pcs-lightbox');
  if (lb) { lb.style.display = 'none'; document.body.style.overflow = ''; }
}

window._pcsLbDownload = function() {
  var url = window._pcsLbImages[window._pcsLbIdx];
  if (!url) return;
  var a = document.createElement('a');
  a.href = url;
  a.download = url.split('/').pop() || 'photo.jpg';
  a.target = '_blank';
  a.click();
};

(function() {
  var tx = 0;
  document.addEventListener('DOMContentLoaded', function() {
    var lb = document.getElementById('pcs-lightbox');
    if (!lb) return;
    lb.addEventListener('touchstart', function(e) {
      tx = e.touches[0].clientX;
    });
    lb.addEventListener('touchend', function(e) {
      var diff = tx - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        diff > 0 ? _pcsLbNext() : _pcsLbPrev();
      }
    });
  });
})();

window._startCaptionEdit = function(postId) {
  var textEl  = document.getElementById('pcs-caption-text');
  var editBtn = document.getElementById('pcs-caption-edit-btn');
  if (!textEl) return;

  var currentText = textEl.dataset.raw || textEl.textContent || '';

  textEl.style.display = 'none';
  if (editBtn) editBtn.style.display = 'none';

  var ta = document.createElement('textarea');
  ta.id = 'pcs-caption-textarea';
  ta.value = currentText;
  ta.style.cssText = [
    'width:100%',
    'background:transparent',
    'border:none',
    'border-bottom:1px solid rgba(200,168,75,0.3)',
    'color:#e8e2d9',
    'font-family:\'DM Sans\',sans-serif',
    'font-size:14px',
    'line-height:1.7',
    'padding:8px 0 10px',
    'outline:none',
    'resize:none',
    'overflow:hidden',
    'min-height:120px',
    'height:auto',
    'caret-color:#C8A84B'
  ].join(';');
  ta.oninput = function() { this.style.height='auto'; this.style.height=this.scrollHeight+'px'; };
  textEl.parentNode.insertBefore(ta, textEl.nextSibling);
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';

  var btnRow = document.createElement('div');
  btnRow.id = 'pcs-caption-btnrow';
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
  btnRow.innerHTML =
    '<button onclick="_saveCaptionEdit(\'' + postId + '\')" ' +
    'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.1em;text-transform:uppercase;color:#3ECF8E;' +
    'background:transparent;border:1px solid rgba(62,207,142,0.3);' +
    'padding:9px 0;cursor:pointer;">Save</button>' +
    '<button onclick="_cancelCaptionEdit()" ' +
    'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.1em;text-transform:uppercase;color:#555;' +
    'background:transparent;border:1px solid rgba(255,255,255,0.07);' +
    'padding:9px 0;cursor:pointer;">Cancel</button>';
  ta.parentNode.insertBefore(btnRow, ta.nextSibling);
  ta.focus();
}

window._cancelCaptionEdit = function() {
  var textEl  = document.getElementById('pcs-caption-text');
  var editBtn = document.getElementById('pcs-caption-edit-btn');
  var ta      = document.getElementById('pcs-caption-textarea');
  var btnRow  = document.getElementById('pcs-caption-btnrow');
  if (textEl)  textEl.style.display = '';
  if (editBtn) editBtn.style.display = '';
  if (ta)      ta.remove();
  if (btnRow)  btnRow.remove();
}

window._saveCaptionEdit = async function(postId) {
  var ta      = document.getElementById('pcs-caption-textarea');
  var textEl  = document.getElementById('pcs-caption-text');
  var editBtn = document.getElementById('pcs-caption-edit-btn');
  var btnRow  = document.getElementById('pcs-caption-btnrow');
  if (!ta) return;

  var newCaption = ta.value.trim();
  var oldCaption = (textEl && (textEl.dataset.raw || textEl.textContent)) || '';

  try {
    await apiFetch('/posts?post_id=eq.' + postId, {
      method: 'PATCH',
      body: JSON.stringify({ caption: newCaption })
    });

    await apiFetch('/audit_log', {
      method: 'POST',
      body: JSON.stringify({
        post_id:    postId,
        action:     'caption_updated',
        old_value:  oldCaption.slice(0, 1000),
        new_value:  newCaption.slice(0, 1000),
        changed_by: (window.currentUserName || window.currentUserEmail || 'team'),
        changed_at: new Date().toISOString()
      })
    });

    // Update allPosts in memory so reopening the card shows the new caption
    if (window.allPosts && Array.isArray(window.allPosts)) {
      var matchIdx = window.allPosts.findIndex(function(p) {
        return p.post_id === postId || p.id === postId || p.postId === postId;
      });
      if (matchIdx !== -1) {
        window.allPosts[matchIdx].caption = newCaption;
      }
    }

    if (textEl) {
      textEl.textContent  = newCaption || 'No copy yet';
      textEl.dataset.raw  = newCaption;
      if (newCaption) {
        textEl.style.fontFamily    = "'DM Sans',sans-serif";
        textEl.style.fontSize      = '13px';
        textEl.style.color         = '#888';
        textEl.style.lineHeight    = '1.6';
        textEl.style.whiteSpace    = 'pre-wrap';
        textEl.style.letterSpacing = '';
      } else {
        textEl.style.fontFamily    = "'IBM Plex Mono',monospace";
        textEl.style.fontSize      = '9px';
        textEl.style.color         = '#333';
        textEl.style.letterSpacing = '0.06em';
        textEl.style.whiteSpace    = '';
      }
      textEl.style.display = '';
    }
    if (editBtn) editBtn.style.display = '';
    if (ta)      ta.remove();
    if (btnRow)  btnRow.remove();

  } catch (err) {
    alert('Failed to save caption. Please try again.');
    console.error('[CAPTION] Save error:', err);
  }
}

window._sharePostOnWhatsApp = function(postId) {
  var post = (typeof getPostById === 'function')
    ? getPostById(postId) : null;
  if (!post) {
    if (typeof showToast === 'function')
      showToast('Post not found', 'error');
    return;
  }

  var title = post.title || 'New Post';
  var postIdRaw = post.post_id || post.id || '';
  var shortId = postIdRaw.replace(/[^0-9]/g, '')
    .slice(-4);
  if (!shortId) shortId = postIdRaw.slice(-4);
  var previewUrl = 'https://srtd.io/p/' + shortId;

  var message = title
    + ' -- Awaiting your approval.\n\n'
    + previewUrl;

  location.href = 'https://wa.me/?text='
    + encodeURIComponent(message);
};

window.submitPcsComment = async function(postId, message, visibility) {
  visibility = visibility || 'all';

  if (!postId || !message || !(message = message.trim())) return;

  var _post = (allPosts||[]).find(function(p) {
    return p.post_id === postId || p.id === postId;
  });
  var _realPostId = _post ? _post.post_id : postId;
  var _title = _post ? (_post.title || postId) : postId;
  var _author = window.currentUserName || 'Team';
  var _role = (window.effectiveRole || 'Admin');
  var _roleLower = _role.toLowerCase();

  var _mentionMatches = message.match(/@([a-zA-Z0-9_]+)/g) || [];
  var _mentioned = _mentionMatches.map(function(m) {
    return m.slice(1);
  });

  if (visibility === 'all' && _roleLower !== 'client') {
    window._pendingComment = {
      postId: _realPostId,
      message: message,
      visibility: visibility,
      mentioned: _mentioned,
      author: _author,
      role: _role,
      title: _title
    };
    var confirmEl = document.getElementById('pcs-comment-confirm');
    var previewEl = document.getElementById('pcs-comment-confirm-preview');
    if (confirmEl && previewEl) {
      previewEl.textContent = '"' + message + '"';
      confirmEl.style.display = 'flex';
    }
    return;
  }

  await window._doSubmitComment({
    postId: _realPostId,
    message: message,
    visibility: visibility,
    mentioned: _mentioned,
    author: _author,
    role: _role,
    title: _title
  });
};

window._doSubmitComment = async function(opts) {
  var _roleLower = (opts.role||'').toLowerCase();
  var _normalRole = opts.role.charAt(0).toUpperCase() +
    opts.role.slice(1).toLowerCase();

  try {
    await apiFetch('/post_comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: opts.postId,
        author: opts.author,
        author_role: _normalRole,
        message: opts.message,
        visibility: opts.visibility,
        mentioned_users: opts.mentioned
      })
    });

    logActivity({
      post_id: opts.postId,
      actor: opts.author,
      actor_role: _normalRole,
      action: 'Commented: ' + opts.message
    });

    var _targets = [];
    if (opts.visibility === 'all') {
      if (_roleLower === 'client') {
        _targets = ['Servicing', 'Admin', 'Creative'];
      } else {
        _targets = ['Client'];
      }
    } else if (opts.visibility === 'admin') {
      _targets = ['Admin'];
    } else if (opts.visibility === 'servicing') {
      _targets = ['Servicing'];
    } else if (opts.visibility === 'creative') {
      _targets = ['Creative'];
    } else {
      if (opts.mentioned && opts.mentioned.length) {
        _targets = opts.mentioned;
      }
    }

    _targets.forEach(function(role) {
      apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_role: role,
          post_id: opts.postId,
          type: 'comment',
          message: opts.author + ' commented on ' + opts.title
        })
      }).catch(function(){});
    });

    if (typeof loadPcsComments === 'function') {
      loadPcsComments(opts.postId);
    }

    var inputEl = document.getElementById('pcs-comment-input');
    var noteEl = document.getElementById('pcs-note-input');
    if (inputEl) {
      inputEl.value = '';
      inputEl.style.height = 'auto';
    }
    if (noteEl) {
      noteEl.value = '';
      noteEl.style.height = 'auto';
    }

  } catch(e) {
    console.error('_doSubmitComment failed:', e);
    showToast('Failed to send. Try again.', 'error');
  }
};

