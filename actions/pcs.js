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
window._pcsLbImages = [];
window._pcsLbIdx = 0;
window._pcsClientImgs = [];
window._pcsNoteImgs = [];
window._pcsReplyTo = null;
window._pcsReplyToAuthor = null;
window._pcsActiveTab = 'caption';
window.AppState.pcs.activeMenu = null;
window.AppState.ui.modalOpen = window.AppState.ui.modalOpen || false;

document.addEventListener('click', function(e) {
  var menu = window.AppState && window.AppState.pcs && window.AppState.pcs.activeMenu;
  if (!menu) return;
  if (e.target.closest('.pcs-confirm-overlay')) return;
  if (menu.querySelector('input[type="date"]')) return;
  if (!menu.contains(e.target)) {
    menu.remove();
    window.AppState.pcs.activeMenu = null;
  }
});

window.openPCS = function(postId, listKey) {
  // Cancel any deferred forcePCSReset from a previous closePCS()  - 
  // without this, a rapid close->open reopens the sheet, then the
  // stale timer fires 300ms later and nukes it back to hidden.
  if (window._pcsCloseTimer) { clearTimeout(window._pcsCloseTimer); window._pcsCloseTimer = null; }

  // Force-clean any stale PCS state from a previous session
  forcePCSReset();

  var list = (listKey && window._postLists && _postLists[listKey])
    ? _postLists[listKey]
    : window.AppState.posts.all;
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

  window.AppState.ui.modalOpen = true;
  window.AppState.pcs.open = true;
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
  var returnToNotif = !!window._notifOpenedPCS;
  window._notifOpenedPCS = false;
  // Restore ✕ close button if it was hidden for ← NOTIFS
  var pcsCloseX = document.querySelector('#pcs-overlay .pc-topbar [aria-label="Close"]');
  if (pcsCloseX) pcsCloseX.style.display = '';
  forcePCSReset();
  // Safety: re-verify after animations settle (catches mobile compositor lag).
  // Store the timer so openPCS can cancel it if the user reopens quickly.
  if (window._pcsCloseTimer) clearTimeout(window._pcsCloseTimer);
  window._pcsCloseTimer = setTimeout(function() {
    window._pcsCloseTimer = null;
    forcePCSReset();
  }, 300);
  // If PCS was opened from the notification panel, return there
  if (returnToNotif) {
    setTimeout(function() {
      if (typeof openNotifications === 'function') openNotifications();
    }, 150);
  }
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
  window.AppState.ui.modalOpen = false;
  window.AppState.pcs.open = false;

  // 6. Clear PCS context
  window._pcs.postId = null;
  window.AppState.pcs.openedFrom = null;

  // 7. Flush any deferred background renders
  _drainDeferredRender();
}

window._renderPCS = function(postId) {
  _removePcsConfirm();

  // Show/hide back arrow based on whether PCS was opened from a sheet
  var backBtn = document.getElementById('pcs-back-btn');
  if (backBtn) {
    backBtn.style.display = (window.AppState.pcs.openedFrom === 'sheet') ? 'block' : 'none';
  }

  // Back-to-notifications button (shows when PCS opened from notif panel)
  var existingNb = document.querySelector('.pcs-back-notif-btn');
  if (existingNb && existingNb.parentNode) existingNb.parentNode.removeChild(existingNb);
  // Restore close button visibility (may have been hidden on previous notif open)
  var pcsCloseX = document.querySelector('#pcs-overlay .pc-topbar [aria-label="Close"]');
  if (pcsCloseX) pcsCloseX.style.display = '';
  if (window._notifOpenedPCS) {
    // Hide the ✕ close button — ← NOTIFS replaces it
    if (pcsCloseX) pcsCloseX.style.display = 'none';
    var nbBtn = document.createElement('button');
    nbBtn.className = 'pcs-back-notif-btn';
    nbBtn.textContent = '\u2190 NOTIFS';
    nbBtn.onclick = function() {
      if (typeof closePCS === 'function') closePCS();
    };
    var pcsTopbar = document.querySelector('#pcs-overlay .pc-topbar') ||
                    document.getElementById('pcs-topbar');
    if (pcsTopbar) pcsTopbar.prepend(nbBtn);
  }

  // 1. Fetch post
  var post = getPostById(postId);
  if (!post) { closePCS(); return; }

  // 2. Compute derived state
  var id          = getPostId(post);
  var title       = getTitle(post);
  var stageLC     = post.stage || '';
  console.log('[PCS] _renderPCS READING:', id, 'stage=' + post.stage, 'stageLC=' + stageLC, Date.now());
  var isPublished = stageLC === 'published';
  var _pcsRole = (window.AppState.user.effectiveRole || '').toLowerCase();
  var _isPranavPCS = _pcsRole === 'creative' ||
    _pcsRole === 'pranav' ||
    (window.AppState.user.email || '').toLowerCase().includes('pranav');
  var canEdit = _pcsRole !== 'client' && !_isPranavPCS;
  var canEditCreative = _isPranavPCS;
  var dateValue   = post.targetDate || '';
  var isAdmin = _pcsRole === 'admin';
  var canManage = canEdit || canEditCreative;

  // a) WhatsApp icon in topbar right (same condition as _buildWAHtml)
  var topbarRight = document.getElementById('pcs-topbar-right');
  if (topbarRight) {
    var _showTopWA = post.caption && (
      _pcsRole === 'client' || stageLC === 'awaiting_approval'
    );
    topbarRight.innerHTML = _showTopWA
      ? '<button class="pcs-topbar-wa" onclick="window._sharePostOnWhatsApp(\'' + esc(id) + '\')">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="#1a8a4a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.106-1.138l-.294-.176-2.866.852.852-2.866-.176-.294A7.963 7.963 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/></svg>' +
        '</button>'
      : '';
  }

  // b) Photo section
  var imgs = Array.isArray(post.images) ? post.images : [];
  var photoHeader = document.getElementById('pcs-photo-header-row');
  var photoGridWrap = document.getElementById('pcs-photo-grid-wrap');
  if (photoHeader) {
    photoHeader.style.display = (canManage || imgs.length > 0) ? 'flex' : 'none';
    // Left side: stage pill + overdue
    var _stageLabel = (typeof STAGE_DISPLAY !== 'undefined' && STAGE_DISPLAY[stageLC]) || stageLC || 'Unknown';
    var _leftHtml = '<div class="pcs-photo-left">' +
      '<span class="pcs-stage-pill" id="pcs-stage-pill"' +
      (isAdmin ? ' onclick="event.stopPropagation();window._pcsChipDrop(this,\'stage\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(_stageLabel) +
      (isAdmin ? ' <span class="pcs-pill-arr">&#x25BE;</span>' : '') +
      '</span>';
    var _noOverdue = ['published','parked','rejected','scheduled'];
    if (_noOverdue.indexOf(stageLC) === -1 && dateValue) {
      var _td = typeof parseDate === 'function' ? parseDate(dateValue) : null;
      var _now = new Date(); _now.setHours(0,0,0,0);
      if (_td && _td < _now) {
        _leftHtml += '<span class="pcs-hdr-dot">\u00B7</span>' +
          '<span class="pcs-od-pill" id="pcs-od-pill"><span class="pcs-od-dot"></span>Overdue</span>';
      }
    }
    _leftHtml += '</div>';
    // Right side: ADD / EDIT / SAVE (canManage only)
    var _rightHtml = '';
    if (canManage) {
      _rightHtml = '<div class="pcs-photo-actions">' +
        '<button class="pcs-photo-act" onclick="window._pcsAddPhotos(\'' + esc(id) + '\')">ADD</button>' +
        (imgs.length > 0 ? '<button class="pcs-photo-act" onclick="window._pcsEnterEditMode(\'' + esc(id) + '\')">EDIT</button>' : '') +
        (imgs.length > 0 ? '<button class="pcs-photo-act" onclick="window._pcsSaveAllPhotos(\'' + esc(id) + '\')">SAVE</button>' : '') +
        '</div>';
    }
    photoHeader.innerHTML = _leftHtml + _rightHtml;
  }
  if (photoGridWrap) photoGridWrap.innerHTML = _buildPhotoGrid(imgs, canEdit, canEditCreative, isAdmin, id);

  // b2) Drive link card
  var driveLinkWrap = document.getElementById('pcs-drive-link-wrap');
  if (driveLinkWrap) {
    var driveUrl = post.drive_link || post.driveLink || null;
    if (driveUrl) {
      driveLinkWrap.style.display = 'block';
      driveLinkWrap.innerHTML = _buildDriveLinkCard(driveUrl, canManage, post.post_id || post.id);
    } else {
      driveLinkWrap.style.display = 'none';
    }
  }

  // c) Title
  var elTitle = document.getElementById('pcs-topbar-title');
  if (elTitle) {
    elTitle.textContent = title;
    if (canEdit) {
      elTitle.style.cursor = 'text';
      elTitle.onclick = function() { _pcsTitleEdit(elTitle, id); };
    } else {
      elTitle.style.cursor = '';
      elTitle.onclick = null;
    }
  }

  // d) Meta chips
  var chipsEl = document.getElementById('pcs-chips-row');
  if (chipsEl) chipsEl.innerHTML = _buildChipsRow(post, canEdit, canEditCreative, id);

  // e) Caption + LinkedIn into pcs-fields
  var elFields = document.getElementById('pcs-fields');
  var captionHtml = _buildCaptionHtml(post, canEdit, canEditCreative, id);
  var liHtml = _buildLinkedInHtml(post, id, stageLC);
  if (elFields) {
    elFields.innerHTML = captionHtml + liHtml +
      '<input type="hidden" id="pcs-post-id" value="' + esc(id) + '">';
  }

  // f) WA button removed from caption pane (topbar icon stays)
  var waContainer = document.getElementById('pcs-wa-container');
  if (waContainer) waContainer.innerHTML = '';

  // f2) Caption action buttons (canManage only)
  var capActionsContainer = document.getElementById('pcs-cap-actions-container');
  if (capActionsContainer) {
    if (canManage) {
      capActionsContainer.innerHTML =
        '<div class="pcs-cap-actions">' +
        '<button class="pcs-cap-btn" onclick="window._startCaptionEdit(\'' + esc(id) + '\')">Edit</button>' +
        '<button class="pcs-cap-btn pcs-cap-btn--bright" onclick="window._pcsCopyCaption(\'' + esc(id) + '\')">Copy</button>' +
        (post.caption ? '<button class="pcs-cap-btn pcs-cap-btn--danger" onclick="window._pcsConfirmClearCaption(\'' + esc(id) + '\')">Clear</button>' : '') +
        '</div>';
    } else {
      capActionsContainer.innerHTML = '';
    }
  }

  // g) Show comments section (compatibility)
  var commSection = document.getElementById('pcs-comments-section');
  if (commSection) commSection.style.display = 'block';

  // h) Load comments
  var _pcsPostIdEl = document.getElementById('pcs-post-id');
  var _pcsPostId = _pcsPostIdEl ? _pcsPostIdEl.value : id;
  if (typeof loadPcsComments === 'function') {
    loadPcsComments(_pcsPostId);
  }

  // i) Hide Internal tab for clients
  var internalTab = document.querySelector('[data-tab="internal"]');
  if (internalTab) internalTab.style.display = _pcsRole === 'client' ? 'none' : '';

  // j) Notes section role guard
  var notesSection = document.getElementById('pcs-notes-section');
  if (notesSection) notesSection.style.display = _pcsRole === 'client' ? 'none' : '';

  // k) Default to caption tab
  window._pcsActiveTab = 'caption';
  _pcsTabSwitch('caption');

  // l) Mention dropup
  if (typeof window._initMentionDropup === 'function') {
    window._initMentionDropup();
  }
}

// -- Tab switching --
window._pcsTabSwitch = function(tab) {
  window._pcsActiveTab = tab;
  // Update tab bar buttons
  var tabs = document.querySelectorAll('.pcs-tab');
  tabs.forEach(function(t) {
    t.classList.remove('active', 'amber');
    if (t.getAttribute('data-tab') === tab) {
      t.classList.add('active');
      if (tab === 'internal') t.classList.add('amber');
    }
  });
  // Toggle panes
  var pCaption = document.getElementById('pcs-pane-caption');
  var pClient = document.getElementById('pcs-pane-client');
  var pInternal = document.getElementById('pcs-pane-internal');
  if (pCaption) pCaption.style.display = tab === 'caption' ? '' : 'none';
  if (pClient) pClient.style.display = tab === 'client' ? '' : 'none';
  if (pInternal) pInternal.style.display = tab === 'internal' ? '' : 'none';
}

// -- Photo grid builder (LinkedIn style, responsive to count) --
function _buildPhotoGrid(imgs, canEdit, canEditCreative, isAdmin, id) {
  var canManage = canEdit || canEditCreative;
  var count = imgs.length;
  var _id = esc(id);
  var gridHtml = '';

  if (count === 0) {
    if (canManage) {
      gridHtml = '<div class="pcs-photo-empty" onclick="window._pcsAddPhotos(\'' + _id + '\')">' +
        '<div style="font-size:22px;color:#C8A84B">+</div>' +
        '<div style="font-family:\'Courier New\',monospace;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#F6A623">Upload Photos</div>' +
        '<div style="font-family:\'Courier New\',monospace;font-size:7px;color:#333;letter-spacing:.06em">JPG / PNG</div>' +
        '</div>';
    }
  } else if (count === 1) {
    gridHtml = '<div class="pcs-pg-1" onclick="window._pcsOpenLightbox(\'' + _id + '\',0)">' +
      '<img src="' + esc(imgs[0]) + '" alt="">' +
      '</div>';
  } else if (count === 2) {
    gridHtml = '<div class="pcs-pg-2"><div class="pcs-pg-2-inner">' +
      '<div class="pcs-pg-2-cell" onclick="window._pcsOpenLightbox(\'' + _id + '\',0)"><img src="' + esc(imgs[0]) + '" alt=""></div>' +
      '<div class="pcs-pg-2-cell" onclick="window._pcsOpenLightbox(\'' + _id + '\',1)"><img src="' + esc(imgs[1]) + '" alt=""></div>' +
      '</div></div>';
  } else if (count === 3) {
    gridHtml = '<div class="pcs-pg-3"><div class="pcs-pg-inner">' +
      '<div class="pcs-pg-hero" onclick="window._pcsOpenLightbox(\'' + _id + '\',0)"><img src="' + esc(imgs[0]) + '" alt=""></div>' +
      '<div class="pcs-pg-col">' +
        '<div class="pcs-pg-sm" onclick="window._pcsOpenLightbox(\'' + _id + '\',1)"><img src="' + esc(imgs[1]) + '" alt=""></div>' +
        '<div class="pcs-pg-sm" onclick="window._pcsOpenLightbox(\'' + _id + '\',2)"><img src="' + esc(imgs[2]) + '" alt=""></div>' +
      '</div>' +
      '</div></div>';
  } else {
    var extra = count - 3;
    gridHtml = '<div class="pcs-pg-3plus"><div class="pcs-pg-inner">' +
      '<div class="pcs-pg-hero" onclick="window._pcsOpenLightbox(\'' + _id + '\',0)"><img src="' + esc(imgs[0]) + '" alt=""></div>' +
      '<div class="pcs-pg-col">' +
        '<div class="pcs-pg-sm" onclick="window._pcsOpenLightbox(\'' + _id + '\',1)"><img src="' + esc(imgs[1]) + '" alt=""></div>' +
        '<div class="pcs-pg-sm" onclick="window._pcsOpenLightbox(\'' + _id + '\',2)">' +
          '<img src="' + esc(imgs[2]) + '" alt="">' +
          '<div class="pcs-more-ov"><div class="pcs-more-n">+' + extra + '</div><div class="pcs-more-l">more</div></div>' +
        '</div>' +
      '</div>' +
      '</div></div>';
  }

  var inputHtml = canManage
    ? '<input type="file" id="pcs-photo-input" accept="image/*" multiple style="display:none" onchange="window._pcsHandlePhotoInput(\'' + _id + '\',this)">'
    : '';

  return gridHtml + inputHtml;
}

// -- Drive link card builder --
function _buildDriveLinkCard(driveUrl, canManage, postId) {
  if (driveUrl) {
    return '<div style="padding:10px 16px 0 16px;">' +
      '<div style="background:#0d1117;border:1px solid #1a1f27;border-radius:8px;overflow:hidden;">' +
        '<a href="' + esc(driveUrl) + '" target="_blank" rel="noopener" ' +
          'style="display:flex;align-items:center;gap:10px;padding:12px 14px;text-decoration:none;">' +
          '<div style="width:40px;height:40px;border-radius:6px;background:#1a1a0a;border:1px solid #3d2e0a;' +
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F6A623" stroke-width="1.5">' +
              '<path d="M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>' +
            '</svg>' +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:12px;font-weight:600;color:#e8eaed;margin-bottom:2px;">View on Drive</div>' +
            '<div style="font-size:10px;color:#556070;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              esc(driveUrl) +
            '</div>' +
          '</div>' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#556070" stroke-width="2">' +
            '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>' +
            '<polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>' +
          '</svg>' +
        '</a>' +
        (canManage ?
          '<div style="padding:0 14px 10px;display:flex;gap:8px;">' +
            '<button data-action="pcs-edit-drive-link" data-id="' + esc(postId) + '" ' +
              'style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.1em;' +
              'text-transform:uppercase;color:#556070;background:none;border:none;padding:0;cursor:pointer;">' +
              'Edit link' +
            '</button>' +
            '<button data-action="pcs-clear-drive-link" data-id="' + esc(postId) + '" ' +
              'style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.1em;' +
              'text-transform:uppercase;color:#FF4B4B;background:none;border:none;padding:0;cursor:pointer;">' +
              'Remove' +
            '</button>' +
          '</div>'
        : '') +
      '</div>' +
    '</div>';
  } else if (canManage) {
    return '<div style="padding:10px 16px 0 16px;">' +
      '<button data-action="pcs-edit-drive-link" data-id="' + esc(postId) + '" ' +
        'style="width:100%;background:none;border:1px dashed #1a1f27;border-radius:8px;' +
        'padding:12px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
        'letter-spacing:0.1em;text-transform:uppercase;color:#556070;cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;gap:6px;">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#556070" stroke-width="2">' +
          '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>' +
          '<path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>' +
        '</svg>' +
        '+ Add drive link' +
      '</button>' +
    '</div>';
  }
  return '';
}
window._buildDriveLinkCard = _buildDriveLinkCard;

// -- Metadata row builder (dot-separated text values) --
// Order: Owner → Date → Format → Pillar → Location
function _buildChipsRow(post, canEdit, canEditCreative, id) {
  var stageLC = post.stage || '';
  var canManage = canEdit || canEditCreative;
  var _dot = '<span class="pcs-dot">\u00B7</span>';
  var items = [];

  // 1. Owner (always render if present)
  if (post.owner) {
    var ownerColor = '';
    var ownerLC = (post.owner || '').toLowerCase();
    if (ownerLC === 'servicing') ownerColor = ' pcs-mv--cyan';
    else if (ownerLC === 'creative') ownerColor = ' pcs-mv--purple';
    else if (ownerLC === 'client') ownerColor = ' pcs-mv--red';
    items.push('<span class="pcs-mv' + ownerColor + '"' +
      (canEdit ? ' onclick="event.stopPropagation();window._pcsChipDrop(this,\'owner\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(typeof formatOwner === 'function' ? formatOwner(post.owner) : post.owner) +
      (canEdit ? ' &#9662;' : '') + '</span>');
  }

  // 2. Date (ALWAYS render — never skip)
  var rawDate = post.targetDate || post.target_date || null;
  var dateDisplay = 'Add Date';
  if (rawDate) {
    try {
      var _dp = new Date(rawDate + 'T00:00:00');
      if (!isNaN(_dp.getTime())) {
        dateDisplay = _dp.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
      }
    } catch(e) {}
  }
  var terminalStages = ['published','parked','rejected'];
  var isOverdue = rawDate && terminalStages.indexOf(stageLC) === -1 && new Date(rawDate) < new Date();
  var dateCls = isOverdue ? ' pcs-mv--red' : rawDate ? ' pcs-mv--bright' : '';
  items.push('<span class="pcs-mv' + dateCls + '"' +
    (canEdit ? ' onclick="event.stopPropagation();window._pcsChipDrop(this,\'date\',\'' + esc(id) + '\')"' : '') +
    '>' + esc(dateDisplay) +
    (canEdit ? ' &#9662;' : '') + '</span>');

  // 3. Format
  if (post.format) {
    items.push('<span class="pcs-mv"' +
      (canManage ? ' onclick="event.stopPropagation();window._pcsChipDrop(this,\'format\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(post.format) +
      (canManage ? ' &#9662;' : '') + '</span>');
  } else if (canManage) {
    items.push('<span class="pcs-mv" onclick="event.stopPropagation();window._pcsChipDrop(this,\'format\',\'' + esc(id) + '\')">+ Format &#9662;</span>');
  }

  // 4. Pillar
  if (post.contentPillar) {
    var pillarVal = typeof formatPillarDisplay === 'function' ? formatPillarDisplay(post.contentPillar) : post.contentPillar;
    items.push('<span class="pcs-mv"' +
      (canManage ? ' onclick="event.stopPropagation();window._pcsChipDrop(this,\'pillar\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(pillarVal) +
      (canManage ? ' &#9662;' : '') + '</span>');
  } else if (canManage) {
    items.push('<span class="pcs-mv" onclick="event.stopPropagation();window._pcsChipDrop(this,\'pillar\',\'' + esc(id) + '\')">+ Pillar &#9662;</span>');
  }

  // 5. Location
  if (post.location) {
    items.push('<span class="pcs-mv"' +
      (canManage ? ' onclick="event.stopPropagation();window._pcsChipDrop(this,\'location\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(post.location) +
      (canManage ? ' &#9662;' : '') + '</span>');
  } else if (canManage) {
    items.push('<span class="pcs-mv" onclick="event.stopPropagation();window._pcsChipDrop(this,\'location\',\'' + esc(id) + '\')">+ Location &#9662;</span>');
  }

  return items.filter(function(s){return s;}).join(_dot);
}

// -- Chip dropdown handler (body-appended, getBoundingClientRect positioned) --
window._pcsChipDrop = function(chipEl, field, postId) {
  // Close any existing dropdown
  if (window.AppState.pcs.activeMenu) {
    window.AppState.pcs.activeMenu.remove();
    window.AppState.pcs.activeMenu = null;
  }

  var post = typeof getPostById === 'function' ? getPostById(postId) : null;

  // DATE: inline date input in dropdown
  if (field === 'date') {
    var rect = chipEl.getBoundingClientRect();
    var drop = document.createElement('div');
    drop.className = 'pcs-chip-drop';
    drop.style.cssText = 'position:fixed;top:' + (rect.bottom + 4) + 'px;left:' + rect.left + 'px;z-index:9700;';
    drop.innerHTML = '<div style="padding:12px 16px;background:#141420">' +
      '<input type="date" value="' + esc(post ? (post.targetDate || '') : '') + '" ' +
      'style="width:100%;padding:10px 12px;background:#0f0f1a;border:1px solid #1c1c26;color:#fff;font-size:14px;outline:none;color-scheme:dark;font-family:inherit" ' +
      'onchange="window._pcsDateChange(\'' + esc(postId) + '\',this.value)"/></div>';
    document.body.appendChild(drop);
    setTimeout(function() { window.AppState.pcs.activeMenu = drop; }, 0);
    var dateInp = drop.querySelector('input');
    if (dateInp) {
      dateInp.focus();
      try { dateInp.showPicker(); } catch(e) {}
    }
    return;
  }

  var items = [];
  var currentVal = '';
  if (field === 'format') {
    items = ['Creative','Photo','Carousel','Video','Text'];
    currentVal = post ? (post.format || '') : '';
  } else if (field === 'pillar') {
    items = typeof PILLARS_DB !== 'undefined' ? PILLARS_DB : [];
    currentVal = post ? (post.contentPillar || '') : '';
  } else if (field === 'location') {
    items = ['Mumbai','Sakarwadi','Sameerwadi','Other'];
    currentVal = post ? (post.location || '') : '';
  } else if (field === 'owner') {
    items = (typeof ALLOWED_OWNERS !== 'undefined' ? ALLOWED_OWNERS : ['Creative','Servicing','Client','Admin']).filter(function(o){return o.toLowerCase() !== 'admin';});
    currentVal = post ? (post.owner || '') : '';
  } else if (field === 'stage') {
    items = typeof STAGES_DB !== 'undefined' ? STAGES_DB : [];
    currentVal = post ? (post.stage || '') : '';
  }

  // Position dropdown below the chip using getBoundingClientRect
  var rect = chipEl.getBoundingClientRect();
  var drop = document.createElement('div');
  drop.className = 'pcs-chip-drop';
  drop.style.position = 'fixed';
  drop.style.top = rect.bottom + 4 + 'px';
  drop.style.left = rect.left + 'px';
  drop.style.zIndex = '9700';

  items.forEach(function(item) {
    var label = item;
    if (field === 'stage' && typeof STAGE_DISPLAY !== 'undefined' && STAGE_DISPLAY[item]) {
      label = STAGE_DISPLAY[item];
    } else if (field === 'pillar' && typeof PILLAR_DISPLAY !== 'undefined' && PILLAR_DISPLAY[item]) {
      label = PILLAR_DISPLAY[item];
    }
    var div = document.createElement('div');
    div.className = 'pcs-chip-drop-item' + (item === currentVal ? ' selected' : '');
    div.textContent = (item === currentVal ? '\u2713 ' : '') + label;
    div.onclick = function(e) {
      e.stopPropagation();
      if (field === 'stage') {
        if (typeof changeStage === 'function') changeStage(item);
      } else if (field === 'owner') {
        if (typeof handleOwnerChange === 'function') handleOwnerChange(postId, item);
      } else {
        var dbField = field === 'pillar' ? 'contentPillar' : field;
        if (typeof updatePost === 'function') updatePost(postId, dbField, item);
      }
      drop.remove();
      window.AppState.pcs.activeMenu = null;
      if (field !== 'stage') {
        if (typeof openPCS === 'function') openPCS(postId, '');
      }
    };
    drop.appendChild(div);
  });

  document.body.appendChild(drop);
  setTimeout(function() { window.AppState.pcs.activeMenu = drop; }, 0);
}

// -- Date change from inline date picker --
window._pcsDateChange = function(postId, dateValue) {
  if (window.AppState.pcs.activeMenu) {
    if (window.AppState.pcs.activeMenu.parentNode) {
      window.AppState.pcs.activeMenu.remove();
    }
    window.AppState.pcs.activeMenu = null;
  }
  if (window.AppState && window.AppState.pcs && window.AppState.pcs.open) {
    if (!dateValue) return;
    var _postObj = (window.AppState.posts.all || []).find(function(p) {
      return (p.post_id || p.id) === postId;
    });
    if (_postObj) _postObj._isSaving = false;
    if (typeof updatePost === 'function') updatePost(postId, 'targetDate', dateValue);
    setTimeout(function() { if (typeof openPCS === 'function') openPCS(postId, ''); }, 300);
  }
}

// -- Caption section builder --
function _buildCaptionHtml(post, canEdit, canEditCreative, id) {
  if (!post.caption && !canEdit && !canEditCreative) return '';
  return '<div id="pcs-caption-section" style="padding:12px 14px 8px;border-bottom:1px solid #323244;">' +
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
      'if(!t||!b)return;' +
      'if(t.style.maxHeight===\'62px\'){t.style.maxHeight=\'none\';t.style.webkitMaskImage=\'none\';t.style.maskImage=\'none\';t.style.overflow=\'visible\';b.textContent=\'See Less\';}' +
      'else{t.style.maxHeight=\'62px\';t.style.overflow=\'hidden\';t.style.webkitMaskImage=\'linear-gradient(to bottom,black 30px,transparent 60px)\';t.style.maskImage=\'linear-gradient(to bottom,black 30px,transparent 60px)\';b.textContent=\'See More\';}' +
      '})()" style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;' +
      'text-transform:uppercase;color:#F6A623;background:transparent;border:none;cursor:pointer;' +
      'padding:6px 0 0 0;">See More</button>'
      :
      '<div id="pcs-caption-text" style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#333;letter-spacing:0.06em;">No copy yet</div>'
    ) + '</div>';
}

// -- LinkedIn section builder --
function _buildLinkedInHtml(post, id, stageLC) {
  var stageForLi = (post.stage || stageLC || '').toLowerCase();
  if (stageForLi !== 'published') return '';
  if (post.linkedinUrl) {
    return '<div style="padding:12px 18px;border-bottom:1px solid #323244;background:#0A66C20A;border-top:1px solid #0A66C21A;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;letter-spacing:0.18em;text-transform:uppercase;color:#0a66c2;margin-bottom:8px;display:flex;align-items:center;gap:6px;">' +
      '<div style="width:6px;height:6px;border-radius:50%;background:#0a66c2;flex-shrink:0;"></div>Live on LinkedIn</div>' +
      '<button onclick="window.open(\'' + esc(post.linkedinUrl) + '\',\'_blank\')" ' +
      'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;' +
      'color:#0a66c2;background:transparent;border:1px solid #0A66C24D;padding:11px 0;cursor:pointer;' +
      'display:flex;align-items:center;justify-content:center;gap:8px;">' +
      '<span style="font-size:14px;font-weight:600;">in</span>View Live Post &rarr;</button>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;color:#2a2a2a;letter-spacing:0.04em;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
      esc(post.linkedinUrl.replace('https://','')) + '</div></div>';
  }
  return '<div style="padding:12px 18px;border-bottom:1px solid #323244;border-top:1px solid #F6A6231A;background:#F6A62308;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;letter-spacing:0.18em;text-transform:uppercase;color:#444;margin-bottom:8px;">Live Post URL</div>' +
    '<div style="display:flex;gap:8px;align-items:center;">' +
    '<input id="pcs-li-inline-input" type="url" placeholder="Paste LinkedIn post URL..." ' +
    'style="flex:1;background:#FFFFFF05;border:none;border-bottom:1px solid #FFFFFF1A;color:#e8e2d9;' +
    'font-family:\'IBM Plex Mono\',monospace;font-size:10px;padding:8px 0;outline:none;letter-spacing:0.02em;">' +
    '<button onclick="window._saveLiUrlInline(\'' + esc(id) + '\')" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;letter-spacing:0.12em;text-transform:uppercase;color:#3ECF8E;' +
    'background:transparent;border:1px solid #3ECF8E4D;padding:7px 12px;cursor:pointer;flex-shrink:0;">Save</button>' +
    '</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;color:#2a2a2a;letter-spacing:0.06em;margin-top:6px;">Add so the team can track impressions</div></div>';
}

// -- WhatsApp section builder --
function _buildWAHtml(post, id, postId, stageLC) {
  var showWA = post.caption && (
    (window.AppState.user.effectiveRole || '').toLowerCase() === 'client' ||
    stageLC === 'awaiting_approval'
  );
  if (!showWA) return '';
  var _isDesktop = window.innerWidth > 768 && !('ontouchstart' in window);
  var copyBtn = _isDesktop ?
    '<button onclick="(function(){' +
    'var post=(typeof getPostById===\'function\')?getPostById(\'' + postId + '\'):null;' +
    'if(!post)return;' +
    'var pid=(post.post_id||post.id||\'\');' +
    'var sid=pid.replace(/[^0-9]/g,\'\').slice(-4);' +
    'if(!sid)sid=pid.slice(-4);' +
    'var msg=(post.title||\'\')+\' -- Awaiting your approval.\\n\\nhttps://srtd.io/p/\'+sid;' +
    'navigator.clipboard.writeText(msg).then(function(){' +
    'var b=document.getElementById(\'pcs-copy-btn\');' +
    'if(b){b.textContent=\'Copied\';setTimeout(function(){b.textContent=\'Copy to Share\';},2000);}' +
    '});' +
    '})()" id="pcs-copy-btn" ' +
    'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.14em;text-transform:uppercase;' +
    'color:#888;background:transparent;border:1px solid #FFFFFF1F;padding:10px 0;cursor:pointer;margin-top:6px;">Copy to Share</button>'
    : '';
  return '<div style="padding:10px 18px 12px;">' +
    '<button class="pcs-wa-btn" onclick="window._sharePostOnWhatsApp(\'' + esc(id) + '\')">Share on WhatsApp</button>' +
    copyBtn +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;color:#333;letter-spacing:0.06em;margin-top:6px;text-align:center;">Sends copy + approval link to client</div>' +
    '</div>';
}

// -- Inline title editing --------------
window._pcsTitleEdit = function(el, postId) {
  if (el.querySelector('input')) return; // already editing
  // Close other interactive layers  -  only one at a time
  _removePcsConfirm();
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
    'background:#000000BF;display:flex;align-items:flex-end;' +
    'justify-content:center;';
  sheet.innerHTML =
    '<div style="width:100%;max-width:390px;background:#141414;' +
    'border-top:1px solid #FFFFFF1A;' +
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
    'style="width:100%;background:#FFFFFF05;border:none;' +
    'border-bottom:1px solid #FFFFFF26;color:#e8e2d9;' +
    'font-family:\'IBM Plex Mono\',monospace;font-size:11px;' +
    'padding:10px 0;outline:none;margin-bottom:16px;' +
    'letter-spacing:0.02em;">' +

    '<div style="display:flex;gap:10px;">' +
    '<button id="confirm-publish-btn-' + postId + '" onclick="_confirmPublish(\'' + postId + '\')" ' +
    'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.14em;text-transform:uppercase;color:#3ECF8E;' +
    'background:transparent;border:1px solid #3ECF8E66;' +
    'padding:13px 0;cursor:pointer;">Publish + Save URL</button>' +
    '<button id="skip-publish-btn-' + postId + '" onclick="_skipPublish(\'' + postId + '\')" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.14em;text-transform:uppercase;color:#333;' +
    'background:transparent;border:1px solid #FFFFFF0F;' +
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

  var _liPost = (window.AppState.posts.all||[]).find(function(p) {
    return p.post_id === postId ||
           (p.id && p.id === postId);
  });
  var _liPostId = _liPost ? _liPost.post_id : postId;
  if (!_liPostId) {
    console.warn('_saveLiUrlInline: missing postId, aborting');
    return;
  }

  var btn = document.getElementById('li-save-btn-' + postId);
  if (btn) {
    btn.textContent = 'Saving...';
    btn.disabled = true;
  }

  apiFetch('/posts?post_id=eq.' + encodeURIComponent(_liPostId), {
    method: 'PATCH',
    body: JSON.stringify({ linkedin_link: url })
  }).then(function() {
    var _found_615 = false;
    var _next_615 = window.AppState.posts.all.map(function(p) {
      if (getPostId(p) === postId) {
        _found_615 = true;
        return Object.assign({}, p, {
          linkedin_link: url,
          linkedinUrl: url
        });
      }
      return p;
    });
    if (!_found_615 && window._appStateDevMode) {
      console.warn('[AppState] Post not found', postId);
    }
    window.AppState.posts.setAll(_next_615);
    showToast('LinkedIn link saved', 'success');
    if (typeof openPCS === 'function') openPCS(postId, '');
    loadPosts();
  }).catch(function(err) {
    console.error('LinkedIn save failed:', err);
    window.logError && window.logError(err&&err.message, err&&err.stack, 'linkedin-save');
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

  if (window._pcsCommentsLoading) return;
  window._pcsCommentsLoading = true;

  var _role = (window.AppState.user.effectiveRole || 'Admin');
  var _roleLower = _role.toLowerCase();
  var _name = window.AppState.user.name || '';

  try {
    var rows = await apiFetch(
      '/post_comments?post_id=eq.' +
      encodeURIComponent(postId) +
      '&order=created_at.asc&limit=100'
    );
    if (!Array.isArray(rows)) rows = [];

    var internalData = await apiFetch(
      '/internal_notes?post_id=eq.' +
      encodeURIComponent(postId) +
      '&order=created_at.asc&limit=100'
    );
    if (!Array.isArray(internalData)) internalData = [];

    // Fetch reactions for this post
    var _reactData = [];
    try {
      var _reactRes = await apiFetch(
        '/post_comment_reactions?post_id=eq.' +
        encodeURIComponent(postId) +
        '&select=*'
      );
      if (Array.isArray(_reactRes)) _reactData = _reactRes;
    } catch(e) {
      console.warn('[pcs] reactions fetch failed, continuing:', e);
    }
    window._pcsReactions = {};
    _reactData.forEach(function(r) {
      if (!window._pcsReactions[r.comment_id]) window._pcsReactions[r.comment_id] = [];
      window._pcsReactions[r.comment_id].push(r);
    });

    var _allRows = rows.concat(internalData);
    var _commentMap = {};
    _allRows.forEach(function(c) {
      _commentMap[c.id] = c.author;
    });
    _allRows.forEach(function(c) {
      if (c.reply_to && _commentMap[c.reply_to]) {
        c.reply_to_author = _commentMap[c.reply_to];
      }
    });

    var _unreadIds = rows
      .filter(function(r) { return !r.read; })
      .map(function(r) { return r.id; });
    if (_unreadIds.length > 0) {
      _unreadIds.forEach(function(id) {
        apiFetch('/post_comments?id=eq.' + id, {
          method: 'PATCH',
          headers: {'Prefer': 'return=minimal'},
          body: JSON.stringify({ read: true })
        }).catch(function(err){ console.error('[pcs] notification', err); window.logError && window.logError(err&&err.message, err&&err.stack, 'pcs-notification'); });
      });
    }

    var clientRows = rows;

    var internalRows = internalData.filter(function(c) {
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

    function _highlightMentions(text) {
      return text.replace(/@([a-zA-Z0-9_]+)/g,
        '<span style="color:#9b87f5;background:#9B87F51A;padding:0 3px;font-weight:500;">@$1</span>');
    }

    function _parseTask(c) {
      try {
        var _att = typeof c.attachments === 'string' ? JSON.parse(c.attachments) : (c.attachments || []);
        if (_att && _att.type === 'task') return _att;
      } catch(e) {}
      return null;
    }

    function _renderSingleClient(c) {
      if (c.deleted) {
        return '<div class="pcs-comment-item">' +
          '<div class="pcs-avatar av-muted">?</div>' +
          '<div class="pcs-comment-body">' +
          '<div class="pcs-deleted-msg">This message was deleted.</div>' +
          '</div></div>';
      }
      var _initial = (c.author||'?').charAt(0).toUpperCase();
      var _taskObj = _parseTask(c);
      var _isTask = !!_taskObj;
      var _taskPrefix = _isTask
        ? '<span class="pcs-task-check' + (c.resolved ? ' pcs-task-done' : '') +
          '" onclick="toggleTaskResolve(\'' + (c.id||'') + '\',\'' + postId + '\',false)">' +
          (c.resolved
            ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>'
            : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>') +
          '</span> '
        : '';
      var _att = (function() {
        try {
          return typeof c.attachments === 'string'
            ? JSON.parse(c.attachments)
            : c.attachments;
        } catch(e) { return null; }
      })();
      var _imgHtml = '';
      if (_att && _att.type === 'images' && _att.urls) {
        _imgHtml = '<div class="pcs-comment-imgs">' +
          _att.urls.map(function(u) {
            return '<img src="' + esc(u) + '" class="pcs-comment-img-thumb" ' +
              'onclick="window._pcsOpenLightbox(\'' + esc(postId) + '\',[' +
              _att.urls.map(function(x){ return '\'' + esc(x) + '\''; }).join(',') +
              '],' + _att.urls.indexOf(u) + ')">';
          }).join('') +
        '</div>';
      }
      var _resolvedLabel = (_isTask && c.resolved && c.resolved_by)
        ? '<div class="pcs-resolved-label">Resolved by ' + esc(c.resolved_by) + '</div>'
        : '';
      var _escapedMsg = esc(c.message).replace(/'/g, '&#39;');
      // Build reaction display
      var _cReactions = (window._pcsReactions && window._pcsReactions[c.id]) || [];
      var _myReact = _cReactions.find(function(r) { return r.author === _name; });
      var _reactCount = _cReactions.length;
      var _reactInner = _myReact
        ? '<span class="pcs-react-icon pcs-react-emoji">' + esc(_myReact.emoji) + '</span>'
        : '<span class="pcs-react-icon"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></span>';
      _reactInner += _reactCount > 0
        ? '<span class="pcs-react-count">' + _reactCount + '</span>'
        : '';
      return '<div class="pcs-comment-item' +
        (c.reply_to ? ' pcs-comment-reply' : '') + '" data-comment-id="' + esc(c.id) + '" data-author="' + esc(c.author) + '">' +
        (!c.read ? '<div class="pcs-unread-dot"></div>' : '') +
        '<div class="' + _avatarClass(c) + '">' + esc(_initial) + '</div>' +
        '<div class="pcs-comment-body">' +
          '<div class="pcs-comment-meta">' +
            '<span class="pcs-comment-author">' + esc(c.author) + '</span>' +
            '<span class="pcs-comment-time">' + _formatTs(c) + '</span>' +
          '</div>' +
          (c.reply_to && c.reply_to_author ?
            '<div class="pcs-reply-indicator">' +
            '&#8629; ' + esc(c.reply_to_author) + '</div>'
            : '') +
          '<div class="pcs-comment-text' + (_isTask ? ' pcs-task-text' : '') +
          ((_isTask && c.resolved) ? ' pcs-task-done' : '') + '">' +
          _taskPrefix + _highlightMentions(esc(c.message)) + '</div>' +
          _imgHtml +
          _resolvedLabel +
          '<div class="pcs-comment-reply-btn" ' +
            'onclick="window._pcsSetReply(\'client\',\'' +
            esc(c.id) + '\',\'' + esc(c.author) + '\',\'' +
            _escapedMsg + '\')">Reply</div>' +
        '</div>' +
        '<div class="pcs-comment-react' + (_myReact ? ' pcs-reacted' : '') + '" data-comment-id="' + esc(c.id) + '" onclick="window._pcsShowEmojiPicker(this)">' +
          _reactInner +
        '</div>' +
      '</div>';
    }

    function _renderClientThread(threadRows, isEmpty) {
      if (!threadRows.length) return isEmpty;
      // Build thread groups: top-level comments + their replies
      var _topLevel = [];
      var _replyMap = {};
      threadRows.forEach(function(c) {
        if (!c.reply_to) {
          _topLevel.push(c);
        } else {
          if (!_replyMap[c.reply_to]) _replyMap[c.reply_to] = [];
          _replyMap[c.reply_to].push(c);
        }
      });
      // Orphaned replies (parent not in this batch) become top-level
      Object.keys(_replyMap).forEach(function(pid) {
        var parentExists = threadRows.some(function(c) { return c.id === pid; });
        if (!parentExists) {
          _replyMap[pid].forEach(function(c) { _topLevel.push(c); });
          delete _replyMap[pid];
        }
      });
      return _topLevel.map(function(parent) {
        var replies = _replyMap[parent.id] || [];
        var groupHtml = '<div class="pcs-thread-group">';
        groupHtml += _renderSingleClient(parent);
        if (replies.length === 1) {
          groupHtml += _renderSingleClient(replies[0]);
        } else if (replies.length > 1) {
          var middle = replies.slice(0, replies.length - 1);
          var last = replies[replies.length - 1];
          groupHtml += '<div class="pcs-expand-link" onclick="this.nextElementSibling.style.display=\'block\';this.style.display=\'none\'">' +
            '<span class="pcs-expand-line"></span>' +
            '<span class="pcs-expand-text">View ' + middle.length + ' more repl' + (middle.length === 1 ? 'y' : 'ies') + '</span>' +
            '</div>';
          groupHtml += '<div class="pcs-hidden-replies" style="display:none">';
          middle.forEach(function(r) { groupHtml += _renderSingleClient(r); });
          groupHtml += '</div>';
          groupHtml += _renderSingleClient(last);
        }
        groupHtml += '</div>';
        return groupHtml;
      }).join('');
    }

    function _renderSingleNote(c) {
      if (c.deleted) {
        return '<div class="pcs-note-item">' +
          '<div class="pcs-avatar av-muted">?</div>' +
          '<div class="pcs-comment-body">' +
          '<div class="pcs-deleted-msg">This message was deleted.</div>' +
          '</div></div>';
      }
      var _initial = (c.author||'?').charAt(0).toUpperCase();
      var _mu = Array.isArray(c.mentioned_users) ? c.mentioned_users : [];
      var _mentionBadge = _mu.length
        ? '<span class="pcs-mention-badge">@' + esc(_mu.join(', @')) + '</span>'
        : '';
      var _vis = (c.visibility||'all').toUpperCase();
      if (_vis === 'SERVICING') _vis = 'SERV';
      var _visTag = '<span class="pcs-vis-tag">' + _vis + '</span>';
      var _taskObj = _parseTask(c);
      var _isTask = !!_taskObj;
      var _assignedTo = (_taskObj && _taskObj.assigned_to) ? _taskObj.assigned_to : null;
      var _assignedLabel = _assignedTo
        ? '<span class="pcs-task-assignee">@' + esc(_assignedTo) + '</span> '
        : '';
      var _taskPrefix = _isTask
        ? '<span class="pcs-task-check' + (c.resolved ? ' pcs-task-done' : '') +
          '" onclick="toggleTaskResolve(\'' + (c.id||'') + '\',\'' + postId + '\',true)">' +
          (c.resolved
            ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>'
            : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>') +
          '</span> '
          + _assignedLabel
        : '';

      var _att = (function() {
        try {
          return typeof c.attachments === 'string'
            ? JSON.parse(c.attachments)
            : c.attachments;
        } catch(e) { return null; }
      })();
      var _imgHtml = '';
      if (_att && _att.type === 'images' && _att.urls) {
        _imgHtml = '<div class="pcs-comment-imgs">' +
          _att.urls.map(function(u) {
            return '<img src="' + esc(u) + '" class="pcs-comment-img-thumb" ' +
              'onclick="window._pcsOpenLightbox(\'' + esc(postId) + '\',[' +
              _att.urls.map(function(x){ return '\'' + esc(x) + '\''; }).join(',') +
              '],' + _att.urls.indexOf(u) + ')">';
          }).join('') +
        '</div>';
      }
      var _resolvedLabel = (_isTask && c.resolved && c.resolved_by)
        ? '<div class="pcs-resolved-label">Resolved by ' + esc(c.resolved_by) + '</div>'
        : '';
      var _escapedMsg = esc(c.message).replace(/'/g, '&#39;');
      // Build reaction display
      var _cReactions = (window._pcsReactions && window._pcsReactions[c.id]) || [];
      var _myReact = _cReactions.find(function(r) { return r.author === _name; });
      var _reactCount = _cReactions.length;
      var _reactInner = _myReact
        ? '<span class="pcs-react-icon pcs-react-emoji">' + esc(_myReact.emoji) + '</span>'
        : '<span class="pcs-react-icon"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></span>';
      _reactInner += _reactCount > 0
        ? '<span class="pcs-react-count">' + _reactCount + '</span>'
        : '';
      return '<div class="pcs-note-item' +
        (c.reply_to ? ' pcs-comment-reply' : '') +
        (c.resolved ? ' pcs-resolved' : '') + '" data-comment-id="' + esc(c.id) + '" data-author="' + esc(c.author) + '">' +
        (!c.read ? '<div class="pcs-unread-dot"></div>' : '') +
        '<div class="' + _avatarClass(c) + '">' + esc(_initial) + '</div>' +
        '<div class="pcs-comment-body">' +
          '<div class="pcs-comment-meta">' +
            '<span class="pcs-comment-author">' + esc(c.author) + '</span>' +
            '<span class="pcs-comment-time">' + _formatTs(c) + '</span>' +
            _mentionBadge +
            _visTag +
          '</div>' +
          (c.reply_to && c.reply_to_author ?
            '<div class="pcs-reply-indicator">' +
            '&#8629; ' + esc(c.reply_to_author) + '</div>'
            : '') +
          '<div class="pcs-comment-text' + (_isTask ? ' pcs-task-text' : '') +
          ((_isTask && c.resolved) ? ' pcs-task-done' : '') + '">' +
          _taskPrefix + _highlightMentions(esc(c.message)) + '</div>' +
          _imgHtml +
          _resolvedLabel +
          '<div class="pcs-comment-reply-btn" ' +
            'onclick="window._pcsSetReply(\'note\',\'' +
            esc(c.id) + '\',\'' + esc(c.author) + '\',\'' +
            _escapedMsg + '\')">Reply</div>' +
        '</div>' +
        '<div class="pcs-comment-react' + (_myReact ? ' pcs-reacted' : '') + '" data-comment-id="' + esc(c.id) + '" onclick="window._pcsShowEmojiPicker(this)">' +
          _reactInner +
        '</div>' +
      '</div>';
    }

    function _renderNoteThread(threadRows, isEmpty) {
      if (!threadRows.length) return isEmpty;
      // Build thread groups: top-level notes + their replies
      var _topLevel = [];
      var _replyMap = {};
      threadRows.forEach(function(c) {
        if (!c.reply_to) {
          _topLevel.push(c);
        } else {
          if (!_replyMap[c.reply_to]) _replyMap[c.reply_to] = [];
          _replyMap[c.reply_to].push(c);
        }
      });
      // Orphaned replies become top-level
      Object.keys(_replyMap).forEach(function(pid) {
        var parentExists = threadRows.some(function(c) { return c.id === pid; });
        if (!parentExists) {
          _replyMap[pid].forEach(function(c) { _topLevel.push(c); });
          delete _replyMap[pid];
        }
      });
      return _topLevel.map(function(parent) {
        var replies = _replyMap[parent.id] || [];
        var groupHtml = '<div class="pcs-thread-group">';
        groupHtml += _renderSingleNote(parent);
        if (replies.length === 1) {
          groupHtml += _renderSingleNote(replies[0]);
        } else if (replies.length > 1) {
          var middle = replies.slice(0, replies.length - 1);
          var last = replies[replies.length - 1];
          groupHtml += '<div class="pcs-expand-link" onclick="this.nextElementSibling.style.display=\'block\';this.style.display=\'none\'">' +
            '<span class="pcs-expand-line"></span>' +
            '<span class="pcs-expand-text">View ' + middle.length + ' more repl' + (middle.length === 1 ? 'y' : 'ies') + '</span>' +
            '</div>';
          groupHtml += '<div class="pcs-hidden-replies" style="display:none">';
          middle.forEach(function(r) { groupHtml += _renderSingleNote(r); });
          groupHtml += '</div>';
          groupHtml += _renderSingleNote(last);
        }
        groupHtml += '</div>';
        return groupHtml;
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
      countEl.textContent = clientRows.length;
    }

    // Update tab count badge
    var tabClientCount = document.getElementById('pcs-tab-client-count');
    if (tabClientCount) {
      tabClientCount.textContent = clientRows.length > 0 ? clientRows.length : '';
    }

    if (notesList && _roleLower !== 'client') {
      var _activeVis = window._pcsNoteVisibility || 'all';
      var filteredNotes = _activeVis === 'all'
        ? internalRows
        : internalRows.filter(function(c) {
            return (c.visibility || 'all') === _activeVis;
          });
      var resolvedRows = filteredNotes.filter(function(c) { return c.resolved; });
      var activeRows = filteredNotes.filter(function(c) { return !c.resolved; });

      var emptyNotes =
        '<div class="pcs-empty-thread">' +
        '<div class="pcs-empty-icon" style="font-family:var(--mono);font-size:9px;letter-spacing:0.12em;color:#FFFFFF26;opacity:1;">PRIVATE</div>' +
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
        notesCountEl.textContent = activeRows.length;
      }

      // Update tab count badge
      var tabNotesCount = document.getElementById('pcs-tab-notes-count');
      if (tabNotesCount) {
        tabNotesCount.textContent = internalRows.length > 0 ? internalRows.length : '';
      }

      // Vis chips: keep static HTML, do not rebuild with counts
    }

    list.scrollTop = list.scrollHeight;
    if (notesList) notesList.scrollTop = notesList.scrollHeight;

  } catch(e) {
    console.error('loadPcsComments failed:', e);
    window.logError && window.logError(e && e.message, e && e.stack, 'load-pcs-comments');
    showToast && showToast('Failed to load comments', 'error');
  } finally {
    window._pcsCommentsLoading = false;
  }
}

window._showStageConfirm = function(postId, newStage) {
  _removePcsConfirm();
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
  setTimeout(function() { overlay.classList.add('open'); }, 10);
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
  setTimeout(function() { overlay.classList.add('open'); }, 10);
}

window.pcsDoDelete = async function() {
  var _delRole = (window.AppState.user.effectiveRole || '').toLowerCase();
  if (_delRole !== 'admin') {
    showToast('Only Admin can delete posts', 'error');
    return;
  }
  const id = window._pcs.postId;
  if (!id) return;
  return window.guardAction('pcs-delete-post-' + id, async function() {
    _removePcsConfirm();
    try {
      await apiFetch(`/posts?post_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      logActivity({
        post_id: id,
        actor: window.AppState.user.name || 'Admin',
        actor_role: 'Admin',
        action: 'deleted post'
      });
      showToast('Post deleted');
      closePCS();
      await loadPosts();
    } catch(e) { console.error('[pcs] delete post failed', e); window.logError && window.logError(e && e.message, e && e.stack, 'pcs-delete-post'); showToast('Delete failed', 'error'); }
  });
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
    '1px solid #FFFFFF12;';
  progressWrap.innerHTML =
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.14em;text-transform:uppercase;color:#555;' +
    'margin-bottom:6px;" id="pcs-upload-label">Uploading 0 of ' +
    files.length + '...</div>' +
    '<div style="height:2px;background:#FFFFFF0F;width:100%;">' +
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
    var _found_1379 = false;
    var _next_1379 = window.AppState.posts.all.map(function(p) {
      if (getPostId(p) === postId) {
        _found_1379 = true;
        return Object.assign({}, p, { images: newImages });
      }
      return p;
    });
    if (!_found_1379 && window._appStateDevMode) {
      console.warn('[AppState] Post not found', postId);
    }
    window.AppState.posts.setAll(_next_1379);
    var section = document.getElementById('pcs-photo-section');
    if (section && post) {
      post.images = newImages;
      if (typeof openPCS === 'function') openPCS(postId, '');
    }
    var pw = document.getElementById('pcs-upload-progress');
    if (pw) pw.remove();
  } catch(e) {
    console.error('[pcs] photo upload failed', e);
    window.logError && window.logError(e && e.message, e && e.stack, 'pcs-photo-upload');
    showToast && showToast('Failed to save photos — try again', 'error');
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
    var _found_1407 = false;
    var _next_1407 = window.AppState.posts.all.map(function(p) {
      if (getPostId(p) === postId) {
        _found_1407 = true;
        return Object.assign({}, p, { images: imgs });
      }
      return p;
    });
    if (!_found_1407 && window._appStateDevMode) {
      console.warn('[AppState] Post not found', postId);
    }
    window.AppState.posts.setAll(_next_1407);
    if (typeof openPCS === 'function') openPCS(postId, '');
  } catch(e) {
    console.error('[pcs] remove photo failed', e);
    window.logError && window.logError(e && e.message, e && e.stack, 'pcs-remove-photo');
    showToast && showToast('Failed to remove photo — try again', 'error');
  }
}

// -- Edit mode state --
window._pcsEditMode = false;

window._pcsPhotoMenu = function(postId, e) {
  if (e) e.stopPropagation();
  if (window.AppState.pcs.activeMenu) {
    window.AppState.pcs.activeMenu.remove();
    window.AppState.pcs.activeMenu = null;
    return;
  }
  var btnEl = e ? e.currentTarget : null;
  var rect = btnEl ? btnEl.getBoundingClientRect() : { right: 40, bottom: 60 };
  var menu = document.createElement('div');
  menu.id = 'pcs-unified-menu';
  menu.className = 'pcs-unified-drop';
  menu.style.cssText = 'position:fixed;top:' + (rect.bottom + 4) + 'px;right:' +
    (window.innerWidth - rect.right) + 'px;z-index:9700;';

  var post = (window.AppState.posts.all||[]).find(function(p) {
    return p.post_id === postId;
  });
  var imgs = (post && post.images) ? post.images : [];
  var hasCaption = !!(post && post.caption);

  menu.innerHTML =
    '<div class="pcs-udrop-label">PHOTOS</div>' +
    '<div class="pcs-udrop-item" onclick="window._pcsAddPhotos(\'' + esc(postId) + '\');window._pcsCloseUnifiedMenu()">Add Photos</div>' +
    (imgs.length > 0
      ? '<div class="pcs-udrop-item" onclick="window._pcsCloseUnifiedMenu();window._pcsEnterEditMode(\'' + esc(postId) + '\')">Edit Photos</div>'
      : '') +
    (imgs.length > 0
      ? '<div class="pcs-udrop-item" onclick="window._pcsSaveAllPhotos(\'' + esc(postId) + '\');window._pcsCloseUnifiedMenu()">Save Photos</div>'
      : '') +
    '<div class="pcs-udrop-label" style="margin-top:4px">CAPTION</div>' +
    '<div class="pcs-udrop-item" onclick="window._pcsCopyCaption(\'' + esc(postId) + '\');window._pcsCloseUnifiedMenu()">Copy Caption</div>' +
    '<div class="pcs-udrop-item" onclick="window._pcsCloseUnifiedMenu();window._startCaptionEdit(\'' + esc(postId) + '\')">Edit Caption</div>' +
    (hasCaption
      ? '<div class="pcs-udrop-item" onclick="window._pcsCloseUnifiedMenu();window._pcsConfirmClearCaption(\'' + esc(postId) + '\')">Clear Caption</div>'
      : '');

  document.body.appendChild(menu);
  window.AppState.pcs.activeMenu = menu;
};

window._pcsCloseUnifiedMenu = function() {
  if (window.AppState.pcs.activeMenu) {
    window.AppState.pcs.activeMenu.remove();
    window.AppState.pcs.activeMenu = null;
  }
};

// -- Edit mode (Step C) --
window._pcsEnterEditMode = function(postId) {
  window._pcsEditMode = true;
  var menuBtn = document.getElementById('pcs-photo-menu-btn');
  if (menuBtn) menuBtn.style.display = 'none';
  var doneBtn = document.getElementById('pcs-edit-done-btn');
  if (!doneBtn) {
    doneBtn = document.createElement('button');
    doneBtn.id = 'pcs-edit-done-btn';
    doneBtn.className = 'pcs-edit-done';
    doneBtn.textContent = 'DONE';
    doneBtn.onclick = function() { window._pcsExitEditMode(postId); };
    var header = document.getElementById('pcs-photo-header-row');
    if (header) header.appendChild(doneBtn);
  } else {
    doneBtn.style.display = '';
  }
  // Add X overlays to photos
  var wrap = document.getElementById('pcs-photo-grid-wrap');
  if (!wrap) return;
  var cells = wrap.querySelectorAll('.pcs-pg-1, .pcs-pg-2-cell, .pcs-pg-hero, .pcs-pg-sm');
  cells.forEach(function(cell, idx) {
    if (cell.querySelector('.pcs-edit-x')) return;
    var xBtn = document.createElement('button');
    xBtn.className = 'pcs-edit-x';
    xBtn.innerHTML = '&#x2715;';
    xBtn.onclick = function(ev) {
      ev.stopPropagation();
      window._pcsConfirmRemovePhoto(postId, idx);
    };
    cell.style.position = 'relative';
    cell.appendChild(xBtn);
  });
};

window._pcsExitEditMode = function(postId) {
  window._pcsEditMode = false;
  var menuBtn = document.getElementById('pcs-photo-menu-btn');
  if (menuBtn) menuBtn.style.display = '';
  var doneBtn = document.getElementById('pcs-edit-done-btn');
  if (doneBtn) doneBtn.remove();
  var wrap = document.getElementById('pcs-photo-grid-wrap');
  if (wrap) {
    wrap.querySelectorAll('.pcs-edit-x').forEach(function(x) { x.remove(); });
  }
};

// -- Confirm remove photo (Step D) --
window._pcsConfirmRemovePhoto = function(postId, idx) {
  _removePcsConfirm();
  var overlay = document.createElement('div');
  overlay.className = 'pcs-confirm-overlay';
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
  overlay.innerHTML =
    '<div class="pcs-bottom-confirm">' +
    '<div class="pcs-bc-title">Remove this photo?</div>' +
    '<div class="pcs-bc-sub">This action cannot be undone.</div>' +
    '<div class="pcs-bc-btns">' +
    '<button class="pcs-bc-cancel" onclick="this.closest(\'.pcs-confirm-overlay\').remove()">Cancel</button>' +
    '<button class="pcs-bc-action" onclick="window._pcsDoRemovePhotoEdit(\'' + esc(postId) + '\',' + idx + ')">Remove</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  setTimeout(function() { overlay.classList.add('open'); }, 10);
};

window._pcsDoRemovePhotoEdit = async function(postId, idx) {
  _removePcsConfirm();
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;
  var imgs = Array.isArray(post.images) ? post.images.slice() : [];
  imgs.splice(idx, 1);
  try {
    await apiFetch('/posts?post_id=eq.' + postId, {
      method: 'PATCH',
      body: JSON.stringify({ images: imgs })
    });
    var _next = window.AppState.posts.all.map(function(p) {
      if (getPostId(p) === postId) {
        return Object.assign({}, p, { images: imgs });
      }
      return p;
    });
    window.AppState.posts.setAll(_next);
    // Re-render and re-enter edit mode if photos remain
    if (typeof openPCS === 'function') openPCS(postId, '');
    if (imgs.length > 0) {
      setTimeout(function() { window._pcsEnterEditMode(postId); }, 50);
    }
  } catch(e) {
    console.error('[pcs] edit-mode remove photo failed', e);
    window.logError && window.logError(e && e.message, e && e.stack, 'pcs-edit-remove-photo');
    showToast && showToast('Failed to remove photo', 'error');
  }
};

// -- Confirm clear caption (Step D) --
window._pcsConfirmClearCaption = function(postId) {
  _removePcsConfirm();
  var overlay = document.createElement('div');
  overlay.className = 'pcs-confirm-overlay';
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
  overlay.innerHTML =
    '<div class="pcs-bottom-confirm">' +
    '<div class="pcs-bc-title">Clear caption?</div>' +
    '<div class="pcs-bc-sub">This cannot be undone.</div>' +
    '<div class="pcs-bc-btns">' +
    '<button class="pcs-bc-cancel" onclick="this.closest(\'.pcs-confirm-overlay\').remove()">Cancel</button>' +
    '<button class="pcs-bc-action" onclick="window._pcsDoClearing(\'' + esc(postId) + '\')">Clear</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  setTimeout(function() { overlay.classList.add('open'); }, 10);
};

window._pcsDoClearing = async function(postId) {
  _removePcsConfirm();
  try {
    await apiFetch('/posts?post_id=eq.' + postId, {
      method: 'PATCH',
      body: JSON.stringify({ caption: '' })
    });
    var _next = window.AppState.posts.all.map(function(p) {
      if (getPostId(p) === postId) {
        return Object.assign({}, p, { caption: '' });
      }
      return p;
    });
    window.AppState.posts.setAll(_next);
    showToast && showToast('Caption cleared', 'success');
    if (typeof openPCS === 'function') openPCS(postId, '');
  } catch(e) {
    console.error('[pcs] clear caption failed', e);
    window.logError && window.logError(e && e.message, e && e.stack, 'pcs-clear-caption');
    showToast && showToast('Failed to clear caption', 'error');
  }
};

window._pcsSaveAllPhotos = async function(postId) {
  var post = (window.AppState.posts.all||[]).find(function(p) {
    return p.post_id === postId;
  });
  var imgs = (post && post.images) ? post.images : [];
  if (!imgs.length) {
    showToast('No images to save.', 'error');
    return;
  }
  showToast('Downloading ' + imgs.length + ' images...', 'success');
  var R2_BASE = 'https://pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev/';
  var WORKER = 'https://srtd-r2-upload.ksg-kumarshubhamgune.workers.dev/download?key=';
  for (var i = 0; i < imgs.length; i++) {
    var url = typeof imgs[i] === 'string' ? imgs[i] : (imgs[i].url || imgs[i]);
    var key = url.replace(R2_BASE, '');
    var downloadUrl = WORKER + encodeURIComponent(key);
    var a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'image-' + (i + 1) + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    await new Promise(function(resolve) { setTimeout(resolve, 300); });
  }
};

window._pcsCopyCaption = function(postId) {
  var el = document.getElementById('pcs-caption-text');
  var text = el ? (el.dataset.raw || el.textContent || '') : '';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      showToast('Caption copied.', 'success');
    }).catch(function(){ showToast('Failed to copy caption', 'error'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Caption copied.', 'success');
  }
};

window._pcsConfirmReplace = function(postId) {
  _removePcsConfirm();
  var overlay = document.createElement('div');
  overlay.className = 'pcs-confirm-overlay';
  overlay.addEventListener('click', function(e) {
    e.stopPropagation();
    if (e.target === overlay) _removePcsConfirm();
  });
  overlay.innerHTML =
    '<div class="pcs-confirm-sheet">' +
    '<div class="pcs-confirm-msg">This will clear the entire ' +
      'caption. Paste your new copy to replace it.</div>' +
    '<div class="pcs-confirm-btns">' +
    '<button class="pcs-confirm-cancel" ' +
      'onclick="_removePcsConfirm()">CANCEL</button>' +
    '<button class="pcs-confirm-stage" ' +
      'onclick="window._pcsDoReplace(\'' + postId + '\')">REPLACE</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  setTimeout(function() { overlay.classList.add('open'); }, 10);
};

window._pcsDoReplace = function(postId) {
  _removePcsConfirm();
  var textEl = document.getElementById('pcs-caption-text');
  var editBtn = document.getElementById('pcs-caption-edit-btn');
  if (!textEl) return;
  textEl.style.display = 'none';
  if (editBtn) editBtn.style.display = 'none';
  var ta = document.createElement('textarea');
  ta.id = 'pcs-caption-textarea';
  ta.value = '';
  ta.placeholder = 'Paste new caption here...';
  ta.style.cssText = 'width:100%;min-height:80px;background:#111116;' +
    'border:1px solid #3a3a4a;color:#FFFFFF;' +
    'font-family:\'DM Sans\',sans-serif;font-size:13px;' +
    'padding:12px;resize:vertical;';
  var btnRow = document.createElement('div');
  btnRow.id = 'pcs-caption-btnrow';
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
  btnRow.innerHTML =
    '<button onclick="_saveCaptionEdit(\'' + postId + '\')" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
      'color:#3ECF8E;border:1px solid #3ECF8E;' +
      'background:transparent;padding:6px 12px;cursor:pointer;">SAVE</button>' +
    '<button onclick="_cancelCaptionEdit()" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
      'color:#8E8E93;border:1px solid #4a4a5a;' +
      'background:transparent;padding:6px 12px;cursor:pointer;' +
      'margin-left:6px;">CANCEL</button>';
  textEl.parentNode.insertBefore(ta, textEl.nextSibling);
  textEl.parentNode.insertBefore(btnRow, ta.nextSibling);
  ta.focus();
};

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
    'border-bottom:1px solid #C8A84B4D',
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
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'color:#3ECF8E;border:1px dotted #3ECF8E66;' +
    'background:transparent;padding:6px 12px;cursor:pointer;">SAVE</button>' +
    '<button onclick="_cancelCaptionEdit()" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'color:#8E8E93;border:1px dotted #FFFFFF26;' +
    'background:transparent;padding:6px 12px;cursor:pointer;' +
    'margin-left:6px;">CANCEL</button>';
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

  return window.guardAction('save-caption-' + postId, async function() {

  try {
    await apiFetch('/posts?post_id=eq.' + postId, {
      method: 'PATCH',
      body: JSON.stringify({ caption: newCaption })
    });
  } catch (err) {
    console.error('[pcs] save caption failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'pcs-save-caption');
    showToast && showToast('Failed to save caption — try again', 'error');
    return;
  }

  try {
    await apiFetch('/audit_log', {
      method: 'POST',
      body: JSON.stringify({
        post_id:    postId,
        action:     'caption_updated',
        old_value:  oldCaption.slice(0, 1000),
        new_value:  newCaption.slice(0, 1000),
        changed_by: (window.AppState.user.name || window.AppState.user.email || 'team'),
        changed_at: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error('[pcs] audit_log write failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'pcs-audit-log');
  }

  // Update posts in memory so reopening the card shows the new caption
  var _found_1746 = false;
  var _next_1746 = window.AppState.posts.all.map(function(p) {
    if (getPostId(p) === postId) {
      _found_1746 = true;
      return Object.assign({}, p, { caption: newCaption });
    }
    return p;
  });
  if (!_found_1746 && window._appStateDevMode) {
    console.warn('[AppState] Post not found', postId);
  }
  window.AppState.posts.setAll(_next_1746);

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
  });
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

  var message = title + '\n\n' + previewUrl;

  location.href = 'https://wa.me/?text='
    + encodeURIComponent(message);
};

window.submitPcsComment = async function(postId, message, visibility, isTask, isInternal) {
  return window.guardAction('submit-pcs-comment-' + postId, async function() {
  try {
  isTask = isTask || false;
  visibility = visibility || 'all';

  if (!postId || !message || !(message = message.trim())) return;

  var _post = (window.AppState.posts.all||[]).find(function(p) {
    return p.post_id === postId || p.id === postId;
  });
  var _realPostId = _post ? _post.post_id : postId;
  var _title = _post ? (_post.title || postId) : postId;
  var _author = window.AppState.user.name || 'Team';
  var _role = (window.AppState.user.effectiveRole || 'Admin');
  var _roleLower = _role.toLowerCase();

  var _mentionMatches = message.match(/@([a-zA-Z0-9_]+)/g) || [];
  var _mentioned = _mentionMatches.map(function(m) {
    return m.slice(1);
  });

  var _imgs = (visibility === 'all' && !isTask)
    ? window._pcsClientImgs.slice()
    : window._pcsNoteImgs.slice();

  window._pcsClientImgs = [];
  window._pcsNoteImgs = [];
  _pcsRenderImgPreviews('client');
  _pcsRenderImgPreviews('note');

  var _replyTo = window._pcsReplyTo || null;
  var _replyToAuthor = window._pcsReplyToAuthor || null;
  window._pcsReplyTo = null;
  window._pcsReplyToAuthor = null;
  window._pcsClearReply('client');
  window._pcsClearReply('note');

  var _isInternal = isInternal === true;

  if (visibility === 'all' && _roleLower !== 'client') {
    window._pendingComment = {
      postId: _realPostId,
      message: message,
      visibility: visibility,
      mentioned: _mentioned,
      author: _author,
      role: _role,
      title: _title,
      isTask: isTask,
      isInternal: false,
      images: _imgs,
      reply_to: _replyTo,
      reply_to_author: _replyToAuthor
    };
    var confirmEl = document.getElementById('pcs-comment-confirm');
    if (!confirmEl) {
      await window._doSubmitComment({ postId:_realPostId, message:message,
        visibility:visibility, mentioned:_mentioned, author:_author,
        role:_role, title:_title, isTask:isTask, isInternal:false, images:_imgs,
        reply_to:_replyTo, reply_to_author:_replyToAuthor });
      return;
    }
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
    title: _title,
    isTask: isTask,
    isInternal: _isInternal,
    images: _imgs,
    reply_to: _replyTo,
    reply_to_author: _replyToAuthor
  });
  } catch(e) {
    console.error('submitPcsComment failed:', e);
    window.logError && window.logError(e && e.message, e && e.stack, 'submit-pcs-comment');
    showToast('Failed to send. Try again.', 'error');
  }
  });
};

async function _lookupMentionEmails(names) {
  if (!names || !names.length) return [];
  try {
    var results = [];
    for (var i = 0; i < names.length; i++) {
      var rows = await apiFetch(
        '/user_roles?name=eq.' +
        encodeURIComponent(names[i]) +
        '&select=email,name&limit=1'
      );
      if (Array.isArray(rows) && rows[0] && rows[0].email) {
        results.push({ name: rows[0].name, email: rows[0].email });
      }
    }
    return results;
  } catch(e) {
    console.error('_lookupMentionEmails failed:', e);
    return [];
  }
}

window._doSubmitComment = async function(opts) {
  var _roleLower = (opts.role||'').toLowerCase();
  var _normalRole = opts.role.charAt(0).toUpperCase() +
    opts.role.slice(1).toLowerCase();

  try {
    var _sendBtn = document.getElementById('pcs-send-btn-client');
    var _noteBtn = document.getElementById('pcs-send-btn-note');
    if (_sendBtn) { _sendBtn.textContent = 'SENDING...'; _sendBtn.style.opacity = '0.5'; _sendBtn.disabled = true; }
    if (_noteBtn) { _noteBtn.textContent = 'SAVING...'; _noteBtn.style.opacity = '0.5'; _noteBtn.disabled = true; }

    var _submitEndpoint = opts.isInternal
      ? '/internal_notes'
      : '/post_comments';
    await apiFetch(_submitEndpoint, {
      method: 'POST',
      body: JSON.stringify({
        post_id: opts.postId,
        post_title: opts.title || null,
        author: opts.author,
        author_role: _normalRole,
        message: opts.message,
        visibility: opts.visibility,
        mentioned_users: opts.mentioned,
        reply_to: opts.reply_to || null,
        resolved: false,
        resolved_by: null,
        attachments: opts.isTask
          ? JSON.stringify({type:'task', assigned_to: (opts.mentioned && opts.mentioned[0]) || null})
          : (opts.images && opts.images.length
              ? JSON.stringify({type:'images', urls: opts.images})
              : '[]')
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
    }

    _targets.forEach(function(role) {
      apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_role: role,
          post_id: opts.postId,
          type: 'comment',
          message: opts.author + ' commented on ' + opts.title,
          actor: (window.AppState.user.name || window.currentUserName || 'Unknown'),
          read: false
        })
      }).catch(function(err){ console.error('[pcs] notification', err); window.logError && window.logError(err&&err.message, err&&err.stack, 'pcs-notification-2'); });
    });

    if (opts.mentioned && opts.mentioned.length > 0) {
      opts.mentioned.forEach(function(name) {
        var _member = _AGENCY_MEMBERS.find(function(m) {
          return m.name.toLowerCase() === name.toLowerCase();
        });
        if (!_member) return;
        if (_targets.indexOf(_member.role) !== -1) return;
        var _mentionMsg = opts.isInternal
          ? opts.author + ' mentioned you in a note on "' + opts.title + '"'
          : opts.author + ' mentioned you on "' + opts.title + '"';
        apiFetch('/notifications', {
          method: 'POST',
          body: JSON.stringify({
            user_role: _member.role,
            post_id: opts.postId,
            type: 'mention',
            message: _mentionMsg,
            actor: (window.AppState.user.name || window.currentUserName || 'Unknown'),
            read: false
          })
        }).catch(function(err){ console.error('[pcs] mention notification failed', err); window.logError && window.logError(err && err.message, err && err.stack, 'mention-notification'); });
      });
    }

    var _mentionContacts = await _lookupMentionEmails(opts.mentioned);
    window._lastMentionContacts = _mentionContacts;

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
    window.logError && window.logError(e && e.message, e && e.stack, 'do-submit-comment');
    showToast('Failed to send. Try again.', 'error');
  } finally {
    var _sendBtn2 = document.getElementById('pcs-send-btn-client');
    var _noteBtn2 = document.getElementById('pcs-send-btn-note');
    if (_sendBtn2) { _sendBtn2.textContent = 'SEND \u2192'; _sendBtn2.style.opacity = ''; _sendBtn2.disabled = false; }
    if (_noteBtn2) { _noteBtn2.textContent = 'NOTE'; _noteBtn2.style.opacity = ''; _noteBtn2.disabled = false; }
  }
};

window.toggleTaskResolve = function(commentId, postId, isInternalNote) {
  if (!commentId || typeof commentId !== 'string' || commentId.trim() === '') {
    console.warn('toggleTaskResolve: missing or invalid commentId, aborting');
    return;
  }
  var _endpoint = (isInternalNote ? '/internal_notes' : '/post_comments') + '?id=eq.' + commentId;
  apiFetch(_endpoint, {
    method: 'PATCH',
    headers: {'Prefer': 'return=minimal'},
    body: JSON.stringify({
      resolved: true,
      resolved_by: window.AppState.user.name || 'Admin'
    })
  }).then(function() {
    loadPcsComments(postId);
  }).catch(function(e) {
    console.error('toggleTaskResolve failed:', e);
    window.logError && window.logError(e&&e.message, e&&e.stack, 'toggle-task-resolve');
    showToast && showToast('Failed to update task', 'error');
  });
};

// -- @mention dropup system --
var _AGENCY_MEMBERS = [
  { name: 'Shubham', role: 'Admin' },
  { name: 'Pranav', role: 'Creative' },
  { name: 'Chitra', role: 'Servicing' },
  { name: 'Manisha', role: 'Client' },
  { name: 'Shivangini', role: 'Client' }
];

function _hideMentionDropup() {
  var dropup = document.getElementById('pcs-mention-dropup');
  if (dropup) dropup.style.display = 'none';
}

window._initMentionDropup = function() {
  var textarea = document.getElementById('pcs-note-input');
  if (!textarea) return;
  var dropup = document.getElementById('pcs-mention-dropup');
  if (!dropup) return;

  var _currentMentionStart = -1;

  textarea.addEventListener('input', function() {
    var val = textarea.value;
    var cursor = textarea.selectionStart;
    var textBeforeCursor = val.slice(0, cursor);
    var atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex === -1) { _hideMentionDropup(); return; }

    var query = textBeforeCursor.slice(atIndex + 1);
    if (/\s/.test(query)) { _hideMentionDropup(); return; }

    _currentMentionStart = atIndex;
    var filtered = _AGENCY_MEMBERS.filter(function(m) {
      return m.name.toLowerCase().startsWith(query.toLowerCase());
    });

    if (!filtered.length) { _hideMentionDropup(); return; }

    dropup.innerHTML = filtered.map(function(m) {
      return '<div class="pcs-mention-item" data-name="' + m.name + '">' +
        '<span class="pcs-mention-name">@' + m.name + '</span>' +
        '<span class="pcs-mention-role">' + m.role + '</span>' +
        '</div>';
    }).join('');

    dropup.style.display = 'block';

    dropup.querySelectorAll('.pcs-mention-item').forEach(function(item) {
      item.addEventListener('mousedown', function(e) {
        e.preventDefault();
        var name = item.getAttribute('data-name');
        var before = val.slice(0, _currentMentionStart);
        var after = val.slice(cursor);
        textarea.value = before + '@' + name + ' ' + after;
        textarea.dispatchEvent(new Event('input'));
        _hideMentionDropup();
        textarea.focus();
      });
    });
  });

  textarea.addEventListener('blur', function() {
    setTimeout(_hideMentionDropup, 150);
  });
};

// -- Task assignment dropup --
window._showTaskAssign = function(inputId, taskBtnId) {
  var existing = document.getElementById('pcs-task-assign-dropup');
  if (existing) { existing.remove(); return; }

  var btn = document.getElementById(taskBtnId);
  if (!btn) return;

  var dropup = document.createElement('div');
  dropup.id = 'pcs-task-assign-dropup';
  dropup.innerHTML = _AGENCY_MEMBERS.filter(function(m) {
    return m.role !== 'Client';
  }).map(function(m) {
    return '<div class="pcs-mention-item" data-name="' + m.name + '">' +
      '<span class="pcs-mention-name">@' + m.name + '</span>' +
      '<span class="pcs-mention-role">' + m.role + '</span>' +
      '</div>';
  }).join('');

  btn.parentNode.insertBefore(dropup, btn.parentNode.firstChild);

  dropup.querySelectorAll('.pcs-mention-item').forEach(function(item) {
    item.addEventListener('mousedown', function(e) {
      e.preventDefault();
      var name = item.getAttribute('data-name');
      var input = document.getElementById(inputId);
      if (input) {
        input.value = '@' + name + ' ';
        input.focus();
        input.dispatchEvent(new Event('input'));
      }
      dropup.remove();
      window.submitPcsTask(inputId, taskBtnId);
    });
  });

  setTimeout(function() {
    document.addEventListener('click', function _dismiss(e) {
      if (!dropup.contains(e.target) && e.target.id !== taskBtnId) {
        dropup.remove();
        document.removeEventListener('click', _dismiss);
      }
    });
  }, 10);
};

window.submitPcsTask = function(inputId, taskBtnId) {
  var postIdEl = document.getElementById('pcs-post-id');
  if (!postIdEl) return;
  var input = document.getElementById(inputId);
  var message = input ? input.value.trim() : '';
  if (!message) return;
  window.submitPcsComment(postIdEl.value, message, 'all', true);
};

window._pcsHandleCommentImg = async function(zone) {
  var inputId = zone === 'client'
    ? 'pcs-client-img-input'
    : 'pcs-note-img-input';
  var input = document.getElementById(inputId);
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  input.value = '';

  var postIdEl = document.getElementById('pcs-post-id');
  var postId = postIdEl ? postIdEl.value : 'comment';

  try {
    var btn = document.querySelector(
      zone === 'client'
        ? '#pcs-client-img-input + .pcs-img-btn'
        : '#pcs-note-img-input + .pcs-img-btn'
    );
    if (btn) { btn.textContent = '...'; btn.disabled = true; }

    var url = await uploadPostAsset(file, postId + '-comment');

    if (zone === 'client') {
      window._pcsClientImgs.push(url);
    } else {
      window._pcsNoteImgs.push(url);
    }

    if (btn) { btn.textContent = 'ATTACH'; btn.disabled = false; }

    _pcsRenderImgPreviews(zone);

  } catch(e) {
    console.error('Comment img upload failed:', e);
    showToast('Image upload failed. Try again.', 'error');
  }
};

window._pcsRenderImgPreviews = function(zone) {
  var imgs = zone === 'client'
    ? window._pcsClientImgs
    : window._pcsNoteImgs;
  var containerId = zone === 'client'
    ? 'pcs-client-img-previews'
    : 'pcs-note-img-previews';
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = imgs.map(function(url, i) {
    return '<div class="pcs-img-preview-wrap">' +
      '<img src="' + esc(url) + '" class="pcs-img-preview">' +
      '<span class="pcs-img-remove" onclick="window._pcsRemoveCommentImg(\'' +
        zone + '\',' + i + ')">x</span>' +
      '</div>';
  }).join('');
};

window._pcsRemoveCommentImg = function(zone, idx) {
  if (zone === 'client') {
    window._pcsClientImgs.splice(idx, 1);
  } else {
    window._pcsNoteImgs.splice(idx, 1);
  }
  _pcsRenderImgPreviews(zone);
};

// -- Emoji reactions --
var _PCS_EMOJIS = ['\u2764\uFE0F', '\uD83D\uDC4D', '\uD83C\uDFAF', '\uD83D\uDC40', '\u2705'];

window._pcsShowEmojiPicker = function(reactEl) {
  if (!reactEl) return;
  var commentId = reactEl.getAttribute('data-comment-id');
  if (!commentId) return;
  var _name = (window.AppState && window.AppState.user && window.AppState.user.name) || '';
  var _reactions = (window._pcsReactions && window._pcsReactions[commentId]) || [];
  var _mine = _reactions.find(function(r) { return r.author === _name; });

  // If already reacted, unreact
  if (_mine) {
    window._pcsRemoveReaction(commentId, reactEl);
    return;
  }

  // Remove existing picker
  var old = document.querySelector('.pcs-emoji-picker');
  if (old) old.remove();

  var picker = document.createElement('div');
  picker.className = 'pcs-emoji-picker';
  _PCS_EMOJIS.forEach(function(emoji) {
    var btn = document.createElement('button');
    btn.className = 'pcs-emoji-btn';
    btn.textContent = emoji;
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      picker.remove();
      window._pcsAddReaction(commentId, emoji, reactEl);
    });
    picker.appendChild(btn);
  });
  reactEl.style.position = 'relative';
  reactEl.appendChild(picker);

  // Close on outside click
  setTimeout(function() {
    document.addEventListener('click', function _dismiss(e) {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', _dismiss);
      }
    });
  }, 10);
};

window._pcsAddReaction = function(commentId, emoji, reactEl) {
  return window.guardAction('pcs-react-' + commentId, async function() {
    try {
      var _postIdEl = document.getElementById('pcs-post-id');
      var _postId = _postIdEl ? _postIdEl.value : '';
      var _name = (window.AppState.user.name || '');
      var _role = (window.AppState.user.effectiveRole || 'Admin');
      var _normalRole = _role.charAt(0).toUpperCase() + _role.slice(1).toLowerCase();

      var result = await apiFetch('/post_comment_reactions', {
        method: 'POST',
        body: JSON.stringify({
          comment_id: commentId,
          post_id: _postId,
          author: _name,
          author_role: _normalRole,
          emoji: emoji
        })
      });

      // Optimistic update
      var newReaction = {
        id: (Array.isArray(result) && result[0]) ? result[0].id : null,
        comment_id: commentId,
        post_id: _postId,
        author: _name,
        author_role: _normalRole,
        emoji: emoji
      };
      if (!window._pcsReactions) window._pcsReactions = {};
      if (!window._pcsReactions[commentId]) window._pcsReactions[commentId] = [];
      window._pcsReactions[commentId].push(newReaction);

      // Update DOM
      if (reactEl) {
        var count = window._pcsReactions[commentId].length;
        reactEl.classList.add('pcs-reacted');
        reactEl.innerHTML =
          '<span class="pcs-react-icon pcs-react-emoji">' + emoji + '</span>' +
          (count > 0 ? '<span class="pcs-react-count">' + count + '</span>' : '');
      }
    } catch(e) {
      console.error('[pcs] addReaction failed:', e);
      window.logError && window.logError(e && e.message, e && e.stack, 'pcs-add-reaction');
      showToast('Failed to react', 'error');
    }
  });
};

window._pcsRemoveReaction = function(commentId, reactEl) {
  return window.guardAction('pcs-unreact-' + commentId, async function() {
    try {
      var _name = (window.AppState.user.name || '');
      var _reactions = (window._pcsReactions && window._pcsReactions[commentId]) || [];
      var _mine = _reactions.find(function(r) { return r.author === _name; });
      if (!_mine || !_mine.id) return;

      await apiFetch('/post_comment_reactions?id=eq.' + _mine.id, {
        method: 'DELETE'
      });

      // Remove from local state
      window._pcsReactions[commentId] = _reactions.filter(function(r) { return r.id !== _mine.id; });

      // Update DOM
      if (reactEl) {
        var count = window._pcsReactions[commentId].length;
        reactEl.classList.remove('pcs-reacted');
        if (count > 0) {
          reactEl.innerHTML =
            '<span class="pcs-react-icon"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></span>' +
            '<span class="pcs-react-count">' + count + '</span>';
        } else {
          reactEl.innerHTML =
            '<span class="pcs-react-icon"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></span>';
        }
      }
    } catch(e) {
      console.error('[pcs] removeReaction failed:', e);
      window.logError && window.logError(e && e.message, e && e.stack, 'pcs-remove-reaction');
      showToast('Failed to remove reaction', 'error');
    }
  });
};

// -- Plus button menu (Task / Image) --
window._pcsTogglePlusMenu = function(btn, zone) {
  // Remove any existing plus menu
  var existing = document.querySelector('.pcs-plus-menu');
  if (existing) { existing.remove(); return; }

  var menu = document.createElement('div');
  menu.className = 'pcs-plus-menu';

  var taskBtn = document.createElement('button');
  taskBtn.className = 'pcs-plus-item';
  taskBtn.textContent = 'Task';
  taskBtn.addEventListener('click', function() {
    menu.remove();
    if (zone === 'client') {
      // Same flow as #pcs-task-btn-client onclick
      var pid = document.getElementById('pcs-post-id');
      var inp = document.getElementById('pcs-comment-input');
      if (pid && inp && inp.value.trim()) {
        window.submitPcsComment(pid.value, inp.value, 'all', true, false);
      }
    } else {
      // Same flow as #pcs-task-btn-note onclick
      if (typeof window._showTaskAssign === 'function') {
        window._showTaskAssign('pcs-note-input', 'pcs-task-btn-note');
      }
    }
  });

  var imgBtn = document.createElement('button');
  imgBtn.className = 'pcs-plus-item';
  imgBtn.textContent = 'Image';
  imgBtn.addEventListener('click', function() {
    menu.remove();
    // Same as original plus button — trigger file input
    var inputId = zone === 'client' ? 'pcs-client-img-input' : 'pcs-note-img-input';
    var fileInput = document.getElementById(inputId);
    if (fileInput) fileInput.click();
  });

  menu.appendChild(taskBtn);
  menu.appendChild(imgBtn);
  btn.parentNode.appendChild(menu);

  // Close on outside click
  setTimeout(function() {
    document.addEventListener('click', function _dismiss(e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('click', _dismiss);
      }
    });
  }, 10);
};

window._pcsSetReply = function(zone, commentId, author, message) {
  window._pcsReplyTo = commentId;
  window._pcsReplyToAuthor = author;
  var inputId = zone === 'client'
    ? 'pcs-comment-input'
    : 'pcs-note-input';
  var input = document.getElementById(inputId);

  // Show reply tag inside input pill
  var tagId = zone === 'client' ? 'pcs-client-reply-tag' : 'pcs-note-reply-tag';
  var nameId = zone === 'client' ? 'pcs-client-reply-name' : 'pcs-note-reply-name';
  var tag = document.getElementById(tagId);
  var nameEl = document.getElementById(nameId);
  if (tag && nameEl) {
    nameEl.textContent = author + ' \u00B7';
    tag.style.display = 'inline-flex';
  }

  document.querySelectorAll(
    '.pcs-comment-item, .pcs-note-item'
  ).forEach(function(el) {
    el.classList.remove('pcs-comment-replying-to');
  });
  var replyTarget = document.querySelector(
    '[data-comment-id="' + commentId + '"]'
  );
  if (replyTarget) {
    replyTarget.classList.add('pcs-comment-replying-to');
    replyTarget.scrollIntoView({
      behavior: 'smooth', block: 'nearest'
    });
  }
  if (input) {
    input.focus();
  }
};

window._pcsClearReply = function(zone) {
  window._pcsReplyTo = null;
  window._pcsReplyToAuthor = null;

  // Hide reply tag
  var tagId = zone === 'client' ? 'pcs-client-reply-tag' : 'pcs-note-reply-tag';
  var tag = document.getElementById(tagId);
  if (tag) {
    tag.style.display = 'none';
  }

  document.querySelectorAll('.pcs-comment-replying-to')
    .forEach(function(el) {
      el.classList.remove('pcs-comment-replying-to');
    });
  var inp = document.getElementById(zone === 'client' ? 'pcs-comment-input' : 'pcs-note-input');
  if (inp) inp.focus();
};

window._pcsCopyComment = function(message) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(message).then(function() {
      showToast('Copied.', 'success');
    }).catch(function(){ showToast('Failed to copy comment', 'error'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = message;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied.', 'success');
  }
};

window._pcsConfirmDeleteComment = function(commentId, postId, isInternalNote) {
  _removePcsConfirm();
  var overlay = document.createElement('div');
  overlay.className = 'pcs-confirm-overlay';
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _removePcsConfirm();
  });
  overlay.innerHTML =
    '<div class="pcs-confirm-sheet">' +
    '<div class="pcs-confirm-msg">Delete this comment? ' +
    'It will show as deleted to everyone.</div>' +
    '<div class="pcs-confirm-btns">' +
    '<button class="pcs-confirm-cancel" ' +
    'onclick="_removePcsConfirm()">CANCEL</button>' +
    '<button class="pcs-confirm-delete" ' +
    'onclick="window._pcsDoDeleteComment(\'' +
    commentId + '\',\'' + postId + '\',' + !!isInternalNote + ')">DELETE</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  setTimeout(function() { overlay.classList.add('open'); }, 10);
};

window._pcsDoDeleteComment = async function(commentId, postId, isInternalNote) {
  if (!commentId || typeof commentId !== 'string' || commentId.trim() === '') {
    console.warn('_pcsDoDeleteComment: missing or invalid commentId, aborting');
    return;
  }
  return window.guardAction('pcs-delete-comment-' + commentId, async function() {
    _removePcsConfirm();
    try {
      var _delEndpoint = isInternalNote
        ? '/internal_notes'
        : '/post_comments';
      await apiFetch(_delEndpoint + '?id=eq.' + commentId, {
        method: 'PATCH',
        body: JSON.stringify({ deleted: true })
      });
      loadPcsComments(postId);
    } catch(e) {
      console.error('[pcs] delete comment failed', e);
      window.logError && window.logError(e && e.message, e && e.stack, 'delete-pcs-comment');
      showToast('Failed to delete comment.', 'error');
    }
  });
};

