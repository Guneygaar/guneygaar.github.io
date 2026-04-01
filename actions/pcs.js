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
window._pcsClientImgs = [];
window._pcsNoteImgs = [];
window._pcsReplyTo = null;
window._pcsReplyToAuthor = null;
window._pcsActiveTab = 'caption';
window.AppState.pcs.activeMenu = null;
window.AppState.ui.modalOpen = window.AppState.ui.modalOpen || false;

document.addEventListener('click', function(e) {
  if (!window.AppState.pcs.activeMenu) return;
  if (e.target.closest('.pcs-confirm-overlay')) return;
  if (!window.AppState.pcs.activeMenu.contains(e.target)) {
    window.AppState.pcs.activeMenu.remove();
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
  window.AppState.ui.modalOpen = false;

  // 6. Clear PCS context
  window._pcs.postId = null;

  // 7. Flush any deferred background renders
  _drainDeferredRender();
}

window._renderPCS = function(postId) {
  _removePcsConfirm();

  // 1. Fetch post
  var post = getPostById(postId);
  if (!post) { closePCS(); return; }

  // 2. Compute derived state
  var id          = getPostId(post);
  var title       = getTitle(post);
  var stageLC     = post.stage || '';
  console.log('[PCS] _renderPCS READING:', id, 'stage=' + post.stage, 'stageLC=' + stageLC, Date.now());
  var isPublished = stageLC === 'published';
  var canvaUrl    = post.postLink || '';
  var linkedinUrl = post.linkedinUrl || '';
  var _pcsRole = (window.AppState.user.effectiveRole || '').toLowerCase();
  var _isPranavPCS = _pcsRole === 'creative' ||
    _pcsRole === 'pranav' ||
    (window.AppState.user.email || '').toLowerCase().includes('pranav');
  var canEdit = _pcsRole !== 'client' && !_isPranavPCS;
  var canEditCreative = _isPranavPCS;
  var dateValue   = post.targetDate || '';
  var isAdmin = _pcsRole === 'admin';

  // 3. Title
  var elTitle = document.getElementById('pcs-topbar-title');
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

  // 4. Stage pill + overdue pill in topbar right
  var topbarRight = document.getElementById('pcs-topbar-right');
  if (topbarRight) {
    var _stageLabel = (typeof STAGE_DISPLAY !== 'undefined' && STAGE_DISPLAY[stageLC]) || stageLC || 'Unknown';
    var _stageColor = '#AEAEB2';
    if (stageLC === 'in_production' || stageLC === 'awaiting_brand_input') _stageColor = '#F6A623';
    else if (stageLC === 'ready') _stageColor = '#3ECF8E';
    else if (stageLC === 'awaiting_approval') _stageColor = '#FF4B4B';
    else if (stageLC === 'scheduled') _stageColor = '#22D3EE';
    else if (stageLC === 'published') _stageColor = '#8E8E93';
    else if (stageLC === 'parked') _stageColor = '#F6A623';
    else if (stageLC === 'rejected') _stageColor = '#FF4B4B';
    var _pillHtml = '<span class="pcs-stage-pill' + (isAdmin ? ' editable pcs-chip--interactive' : '') + '" style="color:' + _stageColor + ';border-color:' + _stageColor + ';"' +
      (isAdmin ? ' onclick="window._pcsChipDrop(this,\'stage\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(_stageLabel) + '</span>';
    // Overdue pill
    var _noOverdue = ['published','parked','rejected'];
    if (_noOverdue.indexOf(stageLC) === -1 && dateValue) {
      var _td = typeof parseDate === 'function' ? parseDate(dateValue) : null;
      var _now = new Date(); _now.setHours(0,0,0,0);
      if (_td && _td < _now) {
        _pillHtml += ' <span class="pc-overdue-badge">Overdue</span>';
      }
    }
    topbarRight.innerHTML = _pillHtml;
  }

  // 7. Photo grid
  var elDesign = document.getElementById('pcs-action-btn-wrap');
  var imgs = Array.isArray(post.images) ? post.images : [];
  var showPhotoSection = (canEdit || canEditCreative) || imgs.length > 0;
  if (elDesign) {
    elDesign.innerHTML = showPhotoSection
      ? _buildPhotoGrid(imgs, canEdit, canEditCreative, isAdmin, id)
      : '';
  }

  // 8. Meta chips
  var chipsEl = document.getElementById('pcs-meta-chips');
  if (chipsEl) chipsEl.innerHTML = _buildMetaChips(post, canEdit, canEditCreative, id);

  // 9. Caption + LinkedIn into pcs-fields, advance rendered inline, then WA
  var elFields = document.getElementById('pcs-fields');
  var captionHtml = _buildCaptionHtml(post, canEdit, canEditCreative, id);
  var liHtml = _buildLinkedInHtml(post, id, stageLC);
  var waHtml = _buildWAHtml(post, id, postId, stageLC);
  if (elFields) {
    elFields.innerHTML = captionHtml + liHtml +
      '<input type="hidden" id="pcs-post-id" value="' + esc(id) + '">';
  }

  // 10. Stage advance button (renders into static pc-advance-block, which is between fields and WA)
  _renderAdvanceButton(stageLC);

  // 10b. WA button goes into a container after advance block
  var waContainer = document.getElementById('pcs-wa-container');
  if (waContainer) waContainer.innerHTML = waHtml;

  // 11. Activity count
  _renderActivityCount(id);

  // 12. Hide activity trigger
  var actTrigger = document.getElementById('pc-activity-trigger');
  if (actTrigger) actTrigger.style.display = 'none';

  // 13. Load activity async
  var elActivity = document.getElementById('pcs-activity-body');
  if (elActivity) {
    if (elActivity.dataset.loadedFor !== id) {
      elActivity.dataset.loadedFor = id;
      elActivity.innerHTML = '<div class="pcs-activity-loading">Loading...</div>';
      _loadPCSActivity(id, elActivity);
    }
  }

  // 14. Show comments section container
  var commSection = document.getElementById('pcs-comments-section');
  if (commSection) commSection.style.display = 'block';

  // 15. Load comments
  var _pcsPostIdEl = document.getElementById('pcs-post-id');
  var _pcsPostId = _pcsPostIdEl ? _pcsPostIdEl.value : id;
  if (typeof loadPcsComments === 'function') {
    loadPcsComments(_pcsPostId);
  }

  // 16. Hide Internal tab for clients
  var internalTab = document.querySelector('[data-tab="internal"]');
  if (internalTab) internalTab.style.display = _pcsRole === 'client' ? 'none' : '';

  // 17. Notes section role guard
  var notesSection = document.getElementById('pcs-notes-section');
  if (notesSection) notesSection.style.display = _pcsRole === 'client' ? 'none' : '';

  // 18. Default to caption tab
  window._pcsActiveTab = 'caption';
  _pcsTabSwitch('caption');

  // 19. Mention dropup
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

  var headerHtml =
    '<div class="pcs-photo-header">' +
    '<div class="pcs-photo-label">Photos <span style="color:' +
    (count ? '#E8E8E8' : '#8E8E93') + ';">' + count + '</span></div>' +
    (canManage ?
      '<button onclick="window._pcsPhotoMenu(\'' + esc(id) + '\',event)" ' +
      'style="color:#8E8E93;background:transparent;border:none;' +
      'padding:8px 12px;cursor:pointer;font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:13px;height:36px;letter-spacing:0.2em;">...</button>' : '') +
    '</div>';

  function _cell(idx, extraStyle, overlayHtml) {
    return '<div class="pcs-photo-grid-cell" onclick="window._pcsOpenLightbox(\'' + esc(id) + '\',' + idx + ')"' +
      (extraStyle ? ' style="' + extraStyle + '"' : '') + '>' +
      '<img src="' + esc(imgs[idx]) + '">' +
      (isAdmin ? '<button class="pcs-photo-x" onclick="event.stopPropagation();window._pcsRemovePhoto(\'' + esc(id) + '\',' + idx + ')">x</button>' : '') +
      (overlayHtml || '') +
      '</div>';
  }

  var gridHtml = '';

  if (count === 0 && canManage) {
    // Empty upload box
    gridHtml = '<div class="pcs-photo-empty" onclick="window._pcsAddPhotos(\'' + esc(id) + '\')">' +
      '<div style="font-size:20px;color:rgba(246,166,35,0.3);">+</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:#F6A623;">Upload Photos</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;color:#333;letter-spacing:0.06em;">JPG / PNG -- stored in Supabase, original quality</div>' +
      '</div>';

  } else if (count === 1) {
    // Single full-width image
    gridHtml = '<div class="pcs-photo-grid pcs-photo-grid--single">' + _cell(0) + '</div>';

  } else if (count === 2) {
    // Two equal columns
    gridHtml = '<div class="pcs-photo-grid pcs-photo-grid--two">' + _cell(0) + _cell(1) + '</div>';

  } else if (count === 3) {
    // LinkedIn 62/38 — hero left, 2 stacked right
    gridHtml = '<div class="pcs-photo-grid pcs-photo-grid--three">' +
      '<div class="pcs-photo-grid-hero" onclick="window._pcsOpenLightbox(\'' + esc(id) + '\',0)">' +
      '<img src="' + esc(imgs[0]) + '">' +
      (isAdmin ? '<button class="pcs-photo-x" onclick="event.stopPropagation();window._pcsRemovePhoto(\'' + esc(id) + '\',0)">x</button>' : '') +
      '</div>' +
      _cell(1) + _cell(2) +
      '</div>';

  } else if (count === 4) {
    // 2x2 grid
    gridHtml = '<div class="pcs-photo-grid pcs-photo-grid--four">' +
      _cell(0) + _cell(1) + _cell(2) + _cell(3) +
      '</div>';

  } else if (count >= 5) {
    // LinkedIn 62/38 with +N overlay on bottom-right
    var extra = count - 3;
    var overlayHtml = '<div class="pcs-photo-grid-more">' +
      '<div class="pcs-photo-grid-more-num">+' + extra + '</div>' +
      '<div class="pcs-photo-grid-more-lbl">more</div></div>';
    gridHtml = '<div class="pcs-photo-grid pcs-photo-grid--three">' +
      '<div class="pcs-photo-grid-hero" onclick="window._pcsOpenLightbox(\'' + esc(id) + '\',0)">' +
      '<img src="' + esc(imgs[0]) + '">' +
      (isAdmin ? '<button class="pcs-photo-x" onclick="event.stopPropagation();window._pcsRemovePhoto(\'' + esc(id) + '\',0)">x</button>' : '') +
      '</div>' +
      _cell(1) +
      _cell(2, 'position:relative;', overlayHtml) +
      '</div>';
  }

  var inputHtml = canManage
    ? '<input type="file" id="pcs-photo-input" accept="image/*" multiple style="display:none;" onchange="window._pcsHandlePhotoInput(\'' + esc(id) + '\',this)">'
    : '';

  return '<div id="pcs-photo-section" class="pcs-photo-linkedin">' + headerHtml + gridHtml + inputHtml + '</div>';
}

// -- Meta chips builder (stage is in topbar, not here) --
function _buildMetaChips(post, canEdit, canEditCreative, id) {
  var stageLC = post.stage || '';
  var canManage = canEdit || canEditCreative;
  var chips = [];

  // Format chip
  if (post.format) {
    chips.push('<div class="pcs-chip' + (canManage ? ' pcs-chip--interactive' : '') + '" ' +
      (canManage ? 'onclick="window._pcsChipDrop(this,\'format\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(post.format) + '</div>');
  } else if (canManage) {
    chips.push('<div class="pcs-chip pcs-chip--empty pcs-chip--interactive" onclick="window._pcsChipDrop(this,\'format\',\'' + esc(id) + '\')">+ Format</div>');
  }

  // Pillar chip
  if (post.contentPillar) {
    var pillarVal = typeof formatPillarDisplay === 'function' ? formatPillarDisplay(post.contentPillar) : post.contentPillar;
    chips.push('<div class="pcs-chip' + (canManage ? ' pcs-chip--interactive' : '') + '" ' +
      (canManage ? 'onclick="window._pcsChipDrop(this,\'pillar\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(pillarVal) + '</div>');
  } else if (canManage) {
    chips.push('<div class="pcs-chip pcs-chip--empty pcs-chip--interactive" onclick="window._pcsChipDrop(this,\'pillar\',\'' + esc(id) + '\')">+ Pillar</div>');
  }

  // Location chip
  if (post.location) {
    chips.push('<div class="pcs-chip' + (canManage ? ' pcs-chip--interactive' : '') + '" ' +
      (canManage ? 'onclick="window._pcsChipDrop(this,\'location\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(post.location) + '</div>');
  } else if (canManage) {
    chips.push('<div class="pcs-chip pcs-chip--empty pcs-chip--interactive" onclick="window._pcsChipDrop(this,\'location\',\'' + esc(id) + '\')">+ Location</div>');
  }

  // Owner chip — skip if empty
  if (post.owner) {
    var ownerColor = '';
    var ownerLC = (post.owner || '').toLowerCase();
    if (ownerLC === 'chitra') ownerColor = ' chip-cyan';
    else if (ownerLC === 'pranav') ownerColor = ' chip-purple';
    else if (ownerLC === 'client') ownerColor = ' chip-amber';
    chips.push('<div class="pcs-chip' + ownerColor + (canEdit ? ' pcs-chip--interactive' : '') + '" ' +
      (canEdit ? 'onclick="window._pcsChipDrop(this,\'owner\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(typeof formatOwner === 'function' ? formatOwner(post.owner) : post.owner) + '</div>');
  }

  // Date chip — skip if empty
  var dateValue = post.targetDate || '';
  if (dateValue) {
    var dateDisplay = '';
    try {
      var _dp = new Date(dateValue + 'T00:00:00');
      if (!isNaN(_dp.getTime())) {
        dateDisplay = _dp.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
      }
    } catch(e) {}
    if (dateDisplay) {
      var dateColor = '';
      if (stageLC !== 'published' && stageLC !== 'parked' && stageLC !== 'rejected') {
        var _td = typeof parseDate === 'function' ? parseDate(dateValue) : new Date(dateValue);
        var _now = new Date(); _now.setHours(0,0,0,0);
        if (_td && _td < _now) dateColor = ' chip-red';
      }
      chips.push('<div class="pcs-chip' + dateColor + (canEdit ? ' pcs-chip--interactive' : '') + '" ' +
        (canEdit ? 'onclick="window._pcsChipDrop(this,\'date\',\'' + esc(id) + '\')"' : '') +
        '>' + esc(dateDisplay) + '</div>');
    }
  }

  return chips.join('');
}

// -- Chip dropdown handler (body-appended, getBoundingClientRect positioned) --
window._pcsChipDrop = function(chipEl, field, postId) {
  // Close any existing dropdown
  if (window.AppState.pcs.activeMenu) {
    window.AppState.pcs.activeMenu.remove();
    window.AppState.pcs.activeMenu = null;
  }

  var post = typeof getPostById === 'function' ? getPostById(postId) : null;

  // DATE: use hidden native date picker
  if (field === 'date') {
    var dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = post ? (post.targetDate || '') : '';
    dateInput.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;pointer-events:none;';
    document.body.appendChild(dateInput);
    dateInput.onchange = function() {
      if (typeof updatePost === 'function') updatePost(postId, 'targetDate', dateInput.value);
      dateInput.remove();
      if (typeof openPCS === 'function') openPCS(postId, '');
    };
    dateInput.onblur = function() { setTimeout(function() { if (dateInput.parentNode) dateInput.remove(); }, 200); };
    // showPicker() supported in modern browsers, click() as fallback
    try { dateInput.showPicker(); } catch(e) { dateInput.click(); }
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
    items = typeof ALLOWED_OWNERS !== 'undefined' ? ALLOWED_OWNERS : ['Pranav','Chitra','Client'];
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
  window.AppState.pcs.activeMenu = drop;
}

// -- Caption section builder --
function _buildCaptionHtml(post, canEdit, canEditCreative, id) {
  if (!post.caption && !canEdit && !canEditCreative) return '';
  return '<div id="pcs-caption-section" style="padding:12px 14px 8px;border-bottom:1px solid #1a1a2a;">' +
    ((canEdit || canEditCreative) ?
      '<div style="display:flex;justify-content:flex-end;margin-bottom:4px;">' +
      '<button onclick="window._pcsCaptionMenu(\'' + esc(id) + '\',event)" ' +
      'id="pcs-caption-edit-btn" ' +
      'style="color:#8E8E93;background:transparent;border:none;padding:8px 12px;cursor:pointer;' +
      'font-family:\'IBM Plex Mono\',monospace;font-size:13px;height:36px;letter-spacing:0.2em;">...</button>' +
      '</div>'
      : '') +
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
    return '<div style="padding:12px 18px;border-bottom:1px solid #1a1a2a;background:rgba(10,102,194,0.04);border-top:1px solid rgba(10,102,194,0.1);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;letter-spacing:0.18em;text-transform:uppercase;color:#0a66c2;margin-bottom:8px;display:flex;align-items:center;gap:6px;">' +
      '<div style="width:6px;height:6px;border-radius:50%;background:#0a66c2;flex-shrink:0;"></div>Live on LinkedIn</div>' +
      '<button onclick="window.open(\'' + esc(post.linkedinUrl) + '\',\'_blank\')" ' +
      'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;' +
      'color:#0a66c2;background:transparent;border:1px solid rgba(10,102,194,0.3);padding:11px 0;cursor:pointer;' +
      'display:flex;align-items:center;justify-content:center;gap:8px;">' +
      '<span style="font-size:14px;font-weight:600;">in</span>View Live Post &rarr;</button>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;color:#2a2a2a;letter-spacing:0.04em;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
      esc(post.linkedinUrl.replace('https://','')) + '</div></div>';
  }
  return '<div style="padding:12px 18px;border-bottom:1px solid #1a1a2a;border-top:1px solid rgba(246,166,35,0.1);background:rgba(246,166,35,0.03);">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;letter-spacing:0.18em;text-transform:uppercase;color:#444;margin-bottom:8px;">Live Post URL</div>' +
    '<div style="display:flex;gap:8px;align-items:center;">' +
    '<input id="pcs-li-inline-input" type="url" placeholder="Paste LinkedIn post URL..." ' +
    'style="flex:1;background:rgba(255,255,255,0.02);border:none;border-bottom:1px solid rgba(255,255,255,0.1);color:#e8e2d9;' +
    'font-family:\'IBM Plex Mono\',monospace;font-size:10px;padding:8px 0;outline:none;letter-spacing:0.02em;">' +
    '<button onclick="window._saveLiUrlInline(\'' + esc(id) + '\')" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;letter-spacing:0.12em;text-transform:uppercase;color:#3ECF8E;' +
    'background:transparent;border:1px solid rgba(62,207,142,0.3);padding:7px 12px;cursor:pointer;flex-shrink:0;">Save</button>' +
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
    'color:#888;background:transparent;border:1px solid rgba(255,255,255,0.12);padding:10px 0;cursor:pointer;margin-top:6px;">Copy to Share</button>'
    : '';
  return '<div style="padding:10px 18px 12px;">' +
    '<button class="pcs-wa-btn" onclick="window._sharePostOnWhatsApp(\'' + esc(id) + '\')">Share on WhatsApp</button>' +
    copyBtn +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;color:#333;letter-spacing:0.06em;margin-top:6px;text-align:center;">Sends copy + approval link to client</div>' +
    '</div>';
}

// -- Subtitle sync — now shows stage pill + owner + date summary --
window._updateSubtitle = function(post) {
  var el = document.getElementById('pcs-subtitle');
  if (!el || !post) return;
  var stLC = post.stage || '';
  var stageLabel = (typeof STAGE_DISPLAY !== 'undefined' && STAGE_DISPLAY[stLC]) || stLC || '';
  var stageColor = '#AEAEB2';
  if (stLC === 'in_production' || stLC === 'awaiting_brand_input') stageColor = '#F6A623';
  else if (stLC === 'ready') stageColor = '#3ECF8E';
  else if (stLC === 'awaiting_approval') stageColor = '#FF4B4B';
  else if (stLC === 'scheduled') stageColor = '#22D3EE';
  else if (stLC === 'published') stageColor = '#8E8E93';

  var pLabel = post.contentPillar ? (typeof getPillarShort === 'function' ? getPillarShort(post.contentPillar) : post.contentPillar) : '';
  var dVal = post.targetDate || '';
  var dDisp = (typeof formatDate === 'function' ? formatDate(dVal) : dVal) || '';
  var ownerDisp = typeof formatOwner === 'function' ? formatOwner(post.owner) : (post.owner || '');

  var parts = [];
  if (pLabel) parts.push(esc(pLabel));
  if (ownerDisp && ownerDisp !== '--') parts.push(esc(ownerDisp));
  if (dDisp) parts.push(esc(dDisp));
  var html = '<span class="pcs-stage-pill" style="color:' + stageColor + ';border-color:' + stageColor + ';">' + esc(stageLabel) + '</span>';
  if (parts.length) html += '<span class="pc-sub-dot"></span>' + parts.join('<span class="pc-sub-dot"></span>');

  // Overdue badge
  var _noOverdue = ['published', 'parked', 'rejected'];
  if (_noOverdue.indexOf(stLC) === -1 && dVal) {
    var td = typeof parseDate === 'function' ? parseDate(dVal) : null;
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

  var _liPost = (window.AppState.posts.all||[]).find(function(p) {
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
        '<span style="color:#9b87f5;background:rgba(155,135,245,0.1);padding:0 3px;font-weight:500;">@$1</span>');
    }

    function _parseTask(c) {
      try {
        var _att = typeof c.attachments === 'string' ? JSON.parse(c.attachments) : (c.attachments || []);
        if (_att && _att.type === 'task') return _att;
      } catch(e) {}
      return null;
    }

    function _renderClientThread(threadRows, isEmpty) {
      if (!threadRows.length) return isEmpty;
      return threadRows.map(function(c) {
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
            '" onclick="toggleTaskResolve(\'' + (c.id||'') + '\',\'' + postId + '\')">' +
            (c.resolved ? '&#x2611;' : '&#x2610;') + '</span> '
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
        return '<div class="pcs-comment-item' +
          (c.reply_to ? ' pcs-comment-reply' : '') + '" data-comment-id="' + esc(c.id) + '">' +
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
            '<div class="pcs-comment-actions">' +
            (_roleLower === 'admin' ?
              '<span class="pcs-comment-action pcs-comment-delete-btn" ' +
              'onclick="window._pcsConfirmDeleteComment(\'' +
              esc(c.id) + '\',\'' + esc(postId) + '\')">DELETE</span>'
              : '') +
            '<span class="pcs-comment-action" ' +
              'onclick="window._pcsSetReply(\'client\',\'' +
              esc(c.id) + '\',\'' + esc(c.author) + '\',\'' +
              esc(c.message) + '\')">REPLY</span>' +
            '<span class="pcs-comment-action" ' +
              'onclick="window._pcsCopyComment(\'' +
              esc(c.message) + '\')">COPY</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function _renderNoteThread(threadRows, isEmpty) {
      if (!threadRows.length) return isEmpty;
      return threadRows.map(function(c) {
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
            '" onclick="toggleTaskResolve(\'' + (c.id||'') + '\',\'' + postId + '\')">' +
            (c.resolved ? '&#x2611;' : '&#x2610;') + '</span> '
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
        return '<div class="pcs-note-item' +
          (c.reply_to ? ' pcs-comment-reply' : '') +
          (c.resolved ? ' pcs-resolved' : '') + '" data-comment-id="' + esc(c.id) + '">' +
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
            '<div class="pcs-comment-actions">' +
            (_roleLower === 'admin' ?
              '<span class="pcs-comment-action pcs-comment-delete-btn" ' +
              'onclick="window._pcsConfirmDeleteComment(\'' +
              esc(c.id) + '\',\'' + esc(postId) + '\',true)">DELETE</span>'
              : '') +
            '<span class="pcs-comment-action" ' +
              'onclick="window._pcsSetReply(\'note\',\'' +
              esc(c.id) + '\',\'' + esc(c.author) + '\',\'' +
              esc(c.message) + '\')">REPLY</span>' +
            '<span class="pcs-comment-action" ' +
              'onclick="window._pcsCopyComment(\'' +
              esc(c.message) + '\')">COPY</span>' +
            '</div>' +
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

    // Update tab count badge
    var tabClientCount = document.getElementById('pcs-tab-client-count');
    if (tabClientCount) {
      tabClientCount.textContent = clientRows.length > 0 ? clientRows.length : '';
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
        '<div class="pcs-empty-icon" style="font-family:var(--mono);font-size:9px;letter-spacing:0.12em;color:rgba(255,255,255,0.15);opacity:1;">PRIVATE</div>' +
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

      // Update tab count badge
      var tabNotesCount = document.getElementById('pcs-tab-notes-count');
      if (tabNotesCount) {
        tabNotesCount.textContent = internalRows.length > 0 ? internalRows.length : '';
      }

      // Per-chip counts  dynamic builder
      var chipsHtml = [
        {val:'all', label:'ALL'},
        {val:'admin', label:'ADMIN'},
        {val:'servicing', label:'SERV'},
        {val:'creative', label:'CREATIVE'}
      ].map(function(chip) {
        var count = internalRows.filter(function(r) {
          return r.visibility === chip.val ||
            (!r.visibility && chip.val === 'all');
        }).length;
        var isActive = (window._pcsNoteVisibility || 'all') === chip.val;
        return '<button class="pcs-vis-chip' +
          (isActive ? ' active' : '') +
          '" data-vis="' + chip.val + '" ' +
          'onclick="window._pcsNoteVisibility=\'' + chip.val +
          '\';loadPcsComments(\'' + postId + '\')">' +
          chip.label + ' (' + count + ')</button>';
      }).join('');
      var chipsContainer = document.getElementById('pcs-vis-selector');
      if (chipsContainer) chipsContainer.innerHTML = chipsHtml;
    }

    list.scrollTop = list.scrollHeight;
    if (notesList) notesList.scrollTop = notesList.scrollHeight;

  } catch(e) {
    console.error('loadPcsComments failed:', e);
    window.logError && window.logError(e && e.message, e && e.stack, 'load-pcs-comments');
    showToast && showToast('Failed to load comments', 'error');
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
  setTimeout(function() { overlay.classList.add('open'); }, 10);
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
  try {
  // Save to the field that matches the editing target  -  never infer from stage
  const field = window._pcsEditingTarget === 'linkedin' ? 'linkedinUrl' : 'postLink';
  await updatePost(postId, field, url);
  // Clear editing state and hide attach row (auto-disappear)
  window._pcsEditingTarget = null;
  pcsCloseAttach(postId);
  // Re-render photo grid (not the old inline actions layout)
  var _attachPost = (window.AppState.posts.all || []).find(function(p) {
    return p.post_id === postId || (p.id && p.id === postId);
  });
  if (_attachPost) {
    var _attachImgs = Array.isArray(_attachPost.images) ? _attachPost.images : [];
    var _attachRole = (window.AppState.user.effectiveRole || '').toLowerCase();
    var _attachIsPranav = _attachRole === 'creative' || _attachRole === 'pranav' ||
      (window.AppState.user.email || '').toLowerCase().includes('pranav');
    var _attachCanEdit = _attachRole !== 'client' && !_attachIsPranav;
    var _attachCanEditCreative = _attachIsPranav;
    var _attachIsAdmin = _attachRole === 'admin';
    var _attachWrap = document.getElementById('pcs-action-btn-wrap');
    if (_attachWrap) {
      _attachWrap.innerHTML = _buildPhotoGrid(_attachImgs, _attachCanEdit, _attachCanEditCreative, _attachIsAdmin, postId);
    }
  }
  } catch(err) {
    console.error('[pcs] save attachment failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'pcs-save-attach');
    showToast && showToast('Failed to save attachment', 'error');
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
  // Advance button removed from redesign — stage changes via topbar pill dropdown only.
  // Keep function signature intact (called from _renderPCS), just always hide the block.
  var block = document.getElementById('pc-advance-block');
  if (block) block.style.display = 'none';
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
  setTimeout(function() { overlay.classList.add('open'); }, 10);
}

window.pcsDoDelete = async function() {
  var _delRole = (window.AppState.user.effectiveRole || '').toLowerCase();
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
      actor: window.AppState.user.name || 'Admin',
      actor_role: 'Admin',
      action: 'deleted post'
    });
    showToast('Post deleted');
    closePCS();
    await loadPosts();
  } catch(e) { console.error('[pcs] delete post failed', e); window.logError && window.logError(e && e.message, e && e.stack, 'pcs-delete-post'); showToast('Delete failed', 'error'); }
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
  menu.id = 'pcs-photo-menu-drop';
  menu.className = 'pcs-chip-drop';
  menu.style.cssText = 'position:fixed;top:' + (rect.bottom + 4) + 'px;right:' +
    (window.innerWidth - rect.right) + 'px;z-index:9700;min-width:150px;';
  var post = (window.AppState.posts.all||[]).find(function(p) {
    return p.post_id === postId;
  });
  var imgs = (post && post.images) ? post.images : [];
  var _menuRole = (window.AppState.user.effectiveRole || '').toLowerCase();
  function _closeMenu() { if (window.AppState.pcs.activeMenu) { window.AppState.pcs.activeMenu.remove(); window.AppState.pcs.activeMenu = null; } }
  menu.innerHTML =
    '<div class="pcs-chip-drop-item" onclick="window._pcsAddPhotos(\'' + postId + '\');' +
      'if(window.AppState.pcs.activeMenu){window.AppState.pcs.activeMenu.remove();window.AppState.pcs.activeMenu=null;}">' +
      '＋ Add More</div>' +
    (imgs.length > 0
      ? '<div class="pcs-chip-drop-item" onclick="window._pcsSaveAllPhotos(\'' + postId + '\');' +
          'if(window.AppState.pcs.activeMenu){window.AppState.pcs.activeMenu.remove();window.AppState.pcs.activeMenu=null;}">' +
          '↓ Save All</div>'
      : '') +
    (_menuRole === 'admin'
      ? '<div class="pcs-chip-drop-item" style="color:#FF4B4B;" onclick="if(window.AppState.pcs.activeMenu){window.AppState.pcs.activeMenu.remove();window.AppState.pcs.activeMenu=null;}window.pcsConfirmDelete();">' +
        '🗑 Delete Post</div>'
      : '');
  document.body.appendChild(menu);
  window.AppState.pcs.activeMenu = menu;
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

window._pcsCaptionMenu = function(postId, e) {
  if (e) e.stopPropagation();
  if (window.AppState.pcs.activeMenu) {
    window.AppState.pcs.activeMenu.remove();
    window.AppState.pcs.activeMenu = null;
    return;
  }
  var menu = document.createElement('div');
  menu.id = 'pcs-caption-menu-drop';
  menu.style.cssText = 'position:absolute;right:18px;' +
    'background:#1e1e26;border:1px solid #2a2a36;' +
    'z-index:200;min-width:140px;overflow:hidden;';
  menu.innerHTML =
    '<div class="pcs-menu-item" onclick="window._pcsCopyCaption(\'' +
      postId + '\');if(window.AppState.pcs.activeMenu){window.AppState.pcs.activeMenu.remove();window.AppState.pcs.activeMenu=null;}">' +
      'Copy</div>' +
    '<div class="pcs-menu-item" onclick="_startCaptionEdit(\'' +
      postId + '\');if(window.AppState.pcs.activeMenu){window.AppState.pcs.activeMenu.remove();window.AppState.pcs.activeMenu=null;}">' +
      'Edit</div>' +
    '<div class="pcs-menu-item pcs-menu-item-danger" ' +
      'onclick="if(window.AppState.pcs.activeMenu){window.AppState.pcs.activeMenu.remove();window.AppState.pcs.activeMenu=null;}window._pcsConfirmReplace(\'' +
      postId + '\');">' +
      'Replace</div>';
  var section = document.getElementById('pcs-caption-section');
  if (section) {
    section.style.position = 'relative';
    section.appendChild(menu);
    window.AppState.pcs.activeMenu = menu;
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
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'color:#3ECF8E;border:1px dotted rgba(62,207,142,0.4);' +
    'background:transparent;padding:6px 12px;cursor:pointer;">SAVE</button>' +
    '<button onclick="_cancelCaptionEdit()" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'color:#8E8E93;border:1px dotted rgba(255,255,255,0.15);' +
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
        changed_by: (window.AppState.user.name || window.AppState.user.email || 'team'),
        changed_at: new Date().toISOString()
      })
    });

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

  } catch (err) {
    console.error('[pcs] save caption failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'pcs-save-caption');
    showToast && showToast('Failed to save caption — try again', 'error');
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

window.submitPcsComment = async function(postId, message, visibility, isTask, isInternal) {
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
          actor: (window.AppState.user.name || window.currentUserName || 'Unknown')
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
            actor: (window.AppState.user.name || window.currentUserName || 'Unknown')
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

window.toggleTaskResolve = function(commentId, postId) {
  apiFetch('/post_comments?id=eq.' + commentId, {
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
  });
};

// -- @mention dropup system --
var _AGENCY_MEMBERS = [
  { name: 'Shubham', role: 'Admin' },
  { name: 'Pranav', role: 'Creative' },
  { name: 'Chitra', role: 'Servicing' }
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
  dropup.innerHTML = _AGENCY_MEMBERS.map(function(m) {
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

window._pcsSetReply = function(zone, commentId, author, message) {
  window._pcsReplyTo = commentId;
  window._pcsReplyToAuthor = author;
  var inputId = zone === 'client'
    ? 'pcs-comment-input'
    : 'pcs-note-input';
  var input = document.getElementById(inputId);
  var indicator = document.getElementById(
    zone === 'client'
      ? 'pcs-client-reply-indicator'
      : 'pcs-note-reply-indicator'
  );
  if (indicator) {
    indicator.innerHTML =
      '<span>Replying to ' + author + '</span>';
    indicator.style.display = 'flex';
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
  var indicator = document.getElementById(
    zone === 'client'
      ? 'pcs-client-reply-indicator'
      : 'pcs-note-reply-indicator'
  );
  if (indicator) {
    indicator.style.display = 'none';
    indicator.textContent = '';
  }
  document.querySelectorAll('.pcs-comment-replying-to')
    .forEach(function(el) {
      el.classList.remove('pcs-comment-replying-to');
    });
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
};

