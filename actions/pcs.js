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

  // 8. Remove every AI section node so they can never accumulate across
  //    post opens. PR 2's per-post-id idempotency guard did not cover the
  //    cross-post case because #pcs-ai-section-<old> was never torn down,
  //    so opening post B after post A left the old section wedged in the
  //    caption pane and the new guard-miss injected a second one.
  document.querySelectorAll('[id^="pcs-ai-section-"]').forEach(function(el) {
    el.parentNode && el.parentNode.removeChild(el);
  });
}

// ═══════════════════════════════════════════════════════════════
// AI helpers (PR 2 — Sorted AI PCS Writer + QC + Chat, Admin only)
//
// _callSrtdAI() is the single POST helper every AI feature in PCS
// uses to talk to the srtd-ai Cloudflare Worker. All four AI UI
// entry points (writer / qc / chat, plus the option picker) are
// gated per-feature at render time on
//   isAdmin && AppState.workspace.ai_* === true
// so non-Admin roles and disabled workspaces never see a button.
// Every handler also returns early at the top on a missing
// window.AI_CONFIG so this file remains safe to load even if the
// PR-1 ai-config.js script failed to ship.
// ═══════════════════════════════════════════════════════════════

async function _callSrtdAI(feature, messages, postId) {
  var cfg = window.AI_CONFIG;
  if (!cfg || !cfg.workerUrl) return { success: false, error: 'AI not configured' };
  try {
    var res = await fetch(cfg.workerUrl + '/ai/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Secret': cfg.secret
      },
      body: JSON.stringify({
        feature: feature,
        messages: messages,
        post_id: postId || null,
        workspace_id: 'default',
        created_by: (window.AppState.user.email || '')
      })
    });
    var data = await res.json();
    return data;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

window._pcsAiWrite = async function(id) {
  var post = (window.AppState.posts.all || []).find(function(p) { return p.post_id === id; });
  if (!post) return;
  if (typeof openCaptionWorkspace === 'function') {
    openCaptionWorkspace('write', { postId: id, caption: post.caption, title: post.title });
  }
};

// --- Legacy PR 2 option picker (kept for any external caller) ---
window._pcsPickAiOpt = function(el, id) {
  document.querySelectorAll('#pcs-ai-opts-' + id + ' .pcs-ai-opt').forEach(function(o) {
    o.classList.remove('pcs-ai-opt--sel');
    var tag = o.querySelector('.pcs-ai-opt-tag');
    if (tag) tag.textContent = 'Tap to select';
  });
  el.classList.add('pcs-ai-opt--sel');
  var elTag = el.querySelector('.pcs-ai-opt-tag');
  if (elTag) elTag.textContent = 'Selected';
};

window._pcsRunQC = async function(id, btn) {
  var post = (window.AppState.posts.all || []).find(function(p) { return p.post_id === id; });
  if (!post || !post.caption) {
    if (btn) { var subNoCap = btn.querySelector('.pcs-qc-sub'); if (subNoCap) subNoCap.textContent = 'No caption to check'; }
    return;
  }
  if (typeof openCaptionWorkspace === 'function') {
    openCaptionWorkspace('qc', { postId: id, caption: post.caption, title: post.title });
  }
};

window._pcsAiChat = async function(id) {
  var post = (window.AppState.posts.all || []).find(function(p) { return p.post_id === id; });
  if (typeof openCaptionWorkspace === 'function') {
    openCaptionWorkspace('chat', { postId: id, caption: post ? post.caption : '', title: post ? post.title : '' });
  }
};

// ═══════════════════════════════════════════════════════════════
// Zone 1 builder + handlers (PR 3)
// ═══════════════════════════════════════════════════════════════

function _pcsBuildAiZoneHtml(rawId, commentCount) {
  var id = esc(rawId);
  var showQC = !!(window.AppState.workspace && window.AppState.workspace.ai_qc);
  var showChat = !!(window.AppState.workspace && window.AppState.workspace.ai_chat);

  var ICON_QC = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  var ICON_CHAT = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_SPARK = '<svg viewBox="0 0 24 24" stroke-linejoin="round" stroke-linecap="round"><path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/></svg>';

  var dotsMenuHtml = '';
  if (showQC) {
    dotsMenuHtml += '<div class="pcs-dots-menu-item" onclick="window._pcsOpenQcSheet(\'' + id + '\')">' +
      ICON_QC +
      '<span class="pcs-dots-menu-item-lbl">QC Brand Guide</span>' +
    '</div>';
  }
  if (showChat) {
    dotsMenuHtml += '<div class="pcs-dots-menu-item" onclick="window._pcsOpenChatSheet(\'' + id + '\')">' +
      ICON_CHAT +
      '<span class="pcs-dots-menu-item-lbl">Ask Claude</span>' +
    '</div>';
  }

  return '<div class="pcs-zone-ai" id="pcs-zone-ai-' + id + '">' +
    // Header row
    '<div class="pcs-zone-ai-header">' +
      '<span class="pcs-zone-ai-label">\u2726 AI</span>' +
      '<div class="pcs-zone-ai-dots-wrap">' +
        '<button class="pcs-zone-ai-dots" onclick="window._pcsToggleDotsMenu(\'' + id + '\')" aria-label="AI menu">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
        '<div class="pcs-dots-menu" id="pcs-dots-menu-' + id + '">' +
          dotsMenuHtml +
        '</div>' +
      '</div>' +
    '</div>' +
    // QC sheet (hidden by default; slides in from dots menu)
    (showQC ?
      '<div class="pcs-qc-sheet" id="pcs-qc-sheet-' + id + '">' +
        '<div class="pcs-qc-sheet-row">' +
          '<button class="pcs-qc-sheet-btn" onclick="window._pcsRunQC(\'' + id + '\', this)">' +
            '<div class="pcs-qc-sheet-text">' +
              '<div class="pcs-qc-lbl">QC against Brand Guide</div>' +
              '<div class="pcs-qc-sub">Check tone, voice and brand language</div>' +
            '</div>' +
            '<span class="pcs-qc-arr">\u2192</span>' +
          '</button>' +
          '<button class="pcs-qc-sheet-close" onclick="window._pcsCloseQcSheet(\'' + id + '\')" aria-label="Close">\u2715</button>' +
        '</div>' +
        '<div class="pcs-qc-result" id="pcs-qc-result-' + id + '" style="display:none"></div>' +
      '</div>'
    : '') +
    // Chat sheet (hidden by default; slides in from dots menu)
    (showChat ?
      '<div class="pcs-chat-sheet" id="pcs-chat-sheet-' + id + '">' +
        '<div class="pcs-chat-thread" id="pcs-chat-thread-' + id + '"></div>' +
        '<div class="pcs-chat-row">' +
          '<input class="pcs-chat-input" id="pcs-chat-input-' + id + '" type="text" placeholder="Rewrite, shorten, add a hook...">' +
          '<button class="pcs-chat-send" onclick="window._pcsAiChat(\'' + id + '\')">Send</button>' +
          '<button class="pcs-chat-sheet-close" onclick="window._pcsCloseChatSheet(\'' + id + '\')" aria-label="Close">\u2715</button>' +
        '</div>' +
      '</div>'
    : '') +
    // Single "Edit with Claude" / "Continue conversation" entry point
    (function() {
      var _ws = window._captionWS;
      var _hasSession = _ws && _ws.messages && _ws.messages.length > 0 && _ws.postId === rawId;
      if (_hasSession) {
        var _draftCount = _ws.messages.filter(function(m) { return m.role === 'assistant'; }).length;
        var _lastDraft = '';
        for (var _mi = _ws.messages.length - 1; _mi >= 0; _mi--) {
          if (_ws.messages[_mi].role === 'assistant') { _lastDraft = _ws.messages[_mi].content || ''; break; }
        }
        var _preview = _lastDraft.length > 30 ? _lastDraft.slice(0, 30) + '\u2026' : _lastDraft;
        return '<div class="pcs-claude-entry" onclick="window.openCaptionWorkspace(\'resume\',{postId:\'' + id + '\',title:getTitle(getPostById(\'' + id + '\'))})">' +
          '<div class="pcs-ce-icon">\u2726</div>' +
          '<div class="pcs-ce-text">' +
            '<div class="pcs-ce-title">Continue conversation</div>' +
            '<div class="pcs-ce-sub">Draft ' + _draftCount + ' \u00B7 ' + esc(_preview) + '</div>' +
          '</div>' +
          '<span class="pcs-ce-arr">\u2192</span>' +
        '</div>';
      }
      return '<div class="pcs-claude-entry" onclick="window.openCaptionWorkspace(\'chat\',{postId:\'' + id + '\',caption:(getPostById(\'' + id + '\')||{}).caption||\'\',title:getTitle(getPostById(\'' + id + '\'))})">' +
        '<div class="pcs-ce-icon">\u2726</div>' +
        '<div class="pcs-ce-text">' +
          '<div class="pcs-ce-title">Edit with Claude</div>' +
          '<div class="pcs-ce-sub">Open workspace with this caption</div>' +
        '</div>' +
        '<span class="pcs-ce-arr">\u2192</span>' +
      '</div>';
    })() +
  '</div>';
}

// --- Dots menu (open/close + outside-click) ---
window._pcsToggleDotsMenu = function(id) {
  var menu = document.getElementById('pcs-dots-menu-' + id);
  if (!menu) return;
  var isOpen = menu.classList.contains('open');
  // Always close any open menus first
  document.querySelectorAll('.pcs-dots-menu.open').forEach(function(m) { m.classList.remove('open'); });
  if (!isOpen) {
    menu.classList.add('open');
    // Install a one-shot outside-click handler (deferred so the click
    // that opened the menu does not immediately close it)
    setTimeout(function() {
      var handler = function(e) {
        if (!menu.contains(e.target) && !e.target.closest('.pcs-zone-ai-dots')) {
          menu.classList.remove('open');
          document.removeEventListener('click', handler, true);
        }
      };
      document.addEventListener('click', handler, true);
    }, 0);
  }
};

// --- QC / Chat sheet mutex: only one open at a time ---
window._pcsOpenQcSheet = function(id) {
  var qc = document.getElementById('pcs-qc-sheet-' + id);
  var ch = document.getElementById('pcs-chat-sheet-' + id);
  if (ch) ch.style.display = 'none';
  if (qc) qc.style.display = 'block';
  var menu = document.getElementById('pcs-dots-menu-' + id);
  if (menu) menu.classList.remove('open');
};

window._pcsCloseQcSheet = function(id) {
  var qc = document.getElementById('pcs-qc-sheet-' + id);
  if (qc) qc.style.display = 'none';
  var result = document.getElementById('pcs-qc-result-' + id);
  if (result) result.style.display = 'none';
};

window._pcsOpenChatSheet = function(id) {
  var qc = document.getElementById('pcs-qc-sheet-' + id);
  var ch = document.getElementById('pcs-chat-sheet-' + id);
  if (qc) qc.style.display = 'none';
  if (ch) ch.style.display = 'block';
  var menu = document.getElementById('pcs-dots-menu-' + id);
  if (menu) menu.classList.remove('open');
  var input = document.getElementById('pcs-chat-input-' + id);
  if (input) { try { input.focus(); } catch (_) {} }
};

window._pcsCloseChatSheet = function(id) {
  var ch = document.getElementById('pcs-chat-sheet-' + id);
  if (ch) ch.style.display = 'none';
};

// --- Manual zone dim/undim mutex ---
function _pcsDimManualZone(on) {
  var z = document.querySelector('.pcs-zone-manual');
  if (!z) return;
  if (on) z.classList.add('pcs-zone-manual--dim');
  else z.classList.remove('pcs-zone-manual--dim');
}

// --- Rewrite result controls ---
window._pcsApplyRewrite = function(id) {
  var result = document.getElementById('pcs-rewrite-result-' + id);
  if (!result) return;
  var newCaption = result.dataset.newCaption || '';
  if (!newCaption) { window._pcsDismissRewrite(id); return; }

  var post = (window.AppState.posts.all || []).find(function(p) { return p.post_id === id; });
  if (!post) { window._pcsDismissRewrite(id); return; }

  // Persist the new caption through the existing API surface
  (async function() {
    try {
      await apiFetch('/posts?post_id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ caption: newCaption, updated_at: new Date().toISOString() })
      });
      post.caption = newCaption;
      window._pcsDismissRewrite(id);
      if (typeof _renderPCS === 'function') _renderPCS(id);
      if (typeof showToast === 'function') showToast('Caption updated', 'success');
    } catch (err) {
      window.logError && window.logError(err && err.message, err && err.stack, 'pcs-apply-rewrite');
      if (typeof showToast === 'function') showToast('Failed to apply caption', 'error');
    }
  })();
};

window._pcsDismissRewrite = function(id) {
  var result = document.getElementById('pcs-rewrite-result-' + id);
  if (result) {
    result.style.display = 'none';
    result.dataset.newCaption = '';
    var flags = result.querySelector('.pcs-rwr-flags'); if (flags) flags.innerHTML = '';
    var capEl = result.querySelector('.pcs-rwr-caption'); if (capEl) capEl.textContent = '';
  }
  var refine = document.getElementById('pcs-refine-wrap-' + id);
  if (refine) refine.style.display = 'none';
  // Reset the rewrite button label
  var rewriteBtn = document.getElementById('pcs-rewrite-btn-' + id);
  if (rewriteBtn) {
    var title = rewriteBtn.querySelector('.pcs-rw-title');
    if (title) title.textContent = '\u2726 Rewrite from comments';
  }
  _pcsDimManualZone(false);
};

window._pcsOpenRefine = function(id) {
  var refine = document.getElementById('pcs-refine-wrap-' + id);
  if (!refine) return;
  refine.style.display = 'block';
  var input = document.getElementById('pcs-refine-input-' + id);
  if (input) { try { input.focus(); } catch (_) {} }
};

window._pcsRefineCancel = function(id) {
  var refine = document.getElementById('pcs-refine-wrap-' + id);
  if (refine) refine.style.display = 'none';
  var input = document.getElementById('pcs-refine-input-' + id);
  if (input) input.value = '';
};

window._pcsRefineSend = async function(id) {
  var post = (window.AppState.posts.all || []).find(function(p) { return p.post_id === id; });
  if (typeof openCaptionWorkspace === 'function') {
    openCaptionWorkspace('chat', { postId: id, caption: post ? post.caption : '', title: post ? post.title : '' });
  }
};

window._pcsRewriteFromComments = async function(id) {
  var post = (window.AppState.posts.all || []).find(function(p) { return p.post_id === id; });
  if (!post) return;

  var commentEls = document.querySelectorAll('#pcs-pane-client .pcs-comment-text');
  var comments = [];
  commentEls.forEach(function(el) {
    var text = el.textContent.trim();
    if (text && text !== 'This message was deleted.') {
      var item = el.closest('.pcs-comment-item');
      var authorEl = item && item.querySelector('.pcs-comment-author');
      comments.push({ author: authorEl ? authorEl.textContent : 'Unknown', text: text });
    }
  });

  if (typeof openCaptionWorkspace === 'function') {
    openCaptionWorkspace('rewrite', { postId: id, caption: post.caption, title: post.title, comments: comments });
  }
};

// --- Write fresh options (Zone 1 version) ---
window._pcsPickWriteOpt = function(el, id) {
  document.querySelectorAll('#pcs-write-opts-' + id + ' .pcs-write-opt').forEach(function(o) {
    o.classList.remove('pcs-write-opt--sel');
    var tag = o.querySelector('.pcs-ai-opt-tag');
    if (tag) tag.textContent = 'Tap to select';
  });
  el.classList.add('pcs-write-opt--sel');
  var elTag = el.querySelector('.pcs-ai-opt-tag');
  if (elTag) elTag.textContent = 'Selected';
};

window._pcsCollapseWrite = function(id) {
  var wrap = document.getElementById('pcs-write-opts-' + id);
  if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; }
  _pcsDimManualZone(false);
};

window._pcsUseWriteSelection = function(id) {
  var wrap = document.getElementById('pcs-write-opts-' + id);
  if (!wrap) return;
  var selected = wrap.querySelector('.pcs-write-opt--sel');
  if (!selected) {
    if (typeof showToast === 'function') showToast('Select an option first', 'error');
    return;
  }
  var txtEl = selected.querySelector('.pcs-ai-opt-txt');
  var newCaption = txtEl ? txtEl.textContent : '';
  if (!newCaption) return;

  var post = (window.AppState.posts.all || []).find(function(p) { return p.post_id === id; });
  if (!post) return;

  (async function() {
    try {
      await apiFetch('/posts?post_id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ caption: newCaption, updated_at: new Date().toISOString() })
      });
      post.caption = newCaption;
      window._pcsCollapseWrite(id);
      if (typeof _renderPCS === 'function') _renderPCS(id);
      if (typeof showToast === 'function') showToast('Caption updated', 'success');
    } catch (err) {
      window.logError && window.logError(err && err.message, err && err.stack, 'pcs-use-write');
      if (typeof showToast === 'function') showToast('Failed to update caption', 'error');
    }
  })();
};

window._renderPCS = function(postId) {
  _removePcsConfirm();

  // Show/hide back arrow based on whether PCS was opened from a sheet
  var backBtn = document.getElementById('pcs-back-btn');
  if (backBtn) {
    backBtn.style.display = (window.AppState.pcs.openedFrom === 'sheet') ? 'block' : 'none';
  }

  // Clean up any stale back-to-notifications button from previous open
  var existingNb = document.querySelector('.pcs-back-notif-btn');
  if (existingNb && existingNb.parentNode) existingNb.parentNode.removeChild(existingNb);
  // Always show X close button
  var pcsCloseX = document.querySelector('#pcs-overlay .pc-topbar [aria-label="Close"]');
  if (pcsCloseX) pcsCloseX.style.display = '';

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
  var _isCreativePCS = _pcsRole === 'creative';
  var canEdit = _pcsRole !== 'client' && !_isCreativePCS;
  var canEditCreative = _isCreativePCS;
  var dateValue   = post.targetDate || '';
  var isAdmin = _pcsRole === 'admin';
  var canManage = canEdit || canEditCreative;

  // a) WhatsApp icon in topbar right (same condition as _buildWAHtml)
  var topbarRight = document.getElementById('pcs-topbar-right');
  if (topbarRight) {
    var _showTopWA = post.caption && (
      _pcsRole === 'client' || stageLC === 'awaiting_approval' || stageLC === 'in_production' || stageLC === 'scheduled'
    );
    var _adminDeleteBtn = (_pcsRole === 'admin')
      ? '<button class="pcs-topbar-icon danger" onclick="window.pcsConfirmDelete()" aria-label="Delete post" title="Delete post">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
        '</button>'
      : '';
    topbarRight.innerHTML = _adminDeleteBtn + (_showTopWA
      ? '<button class="pcs-topbar-icon" onclick="window._sharePostOnWhatsApp(\'' + esc(id) + '\')">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="#1a8a4a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.106-1.138l-.294-.176-2.866.852.852-2.866-.176-.294A7.963 7.963 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/></svg>' +
        '</button>'
      : '');
  }

  // a2) Stage + overdue in topbar left
  var _stageLabel = (typeof STAGE_DISPLAY !== 'undefined' && STAGE_DISPLAY[stageLC]) || stageLC || 'Unknown';
  var topbarStage = document.getElementById('pcs-topbar-stage');
  if (topbarStage) {
    topbarStage.className = 'pcs-stage-pill';
    if (isAdmin) {
      topbarStage.onclick = function(e) { e.stopPropagation(); window._pcsChipDrop(topbarStage, 'stage', id); };
    } else {
      topbarStage.onclick = null;
    }
    topbarStage.innerHTML = esc(_stageLabel) +
      (isAdmin ? ' <span class="pcs-pill-arr">&#x25BE;</span>' : '');
  }
  var topbarOverdue = document.getElementById('pcs-topbar-overdue');
  if (topbarOverdue) {
    var _noOverdue = ['published','parked','rejected','scheduled'];
    var _isOd = false;
    if (_noOverdue.indexOf(stageLC) === -1 && dateValue) {
      var _td = typeof parseDate === 'function' ? parseDate(dateValue) : null;
      var _now = new Date(); _now.setHours(0,0,0,0);
      if (_td && _td < _now) _isOd = true;
    }
    topbarOverdue.className = 'pcs-topbar-od';
    topbarOverdue.textContent = _isOd ? 'OVERDUE' : '';
    topbarOverdue.style.display = _isOd ? '' : 'none';
  }

  // b) Photo section
  var imgs = Array.isArray(post.images) ? post.images : [];
  var photoGridWrap = document.getElementById('pcs-photo-grid-wrap');
  if (photoGridWrap) {
    if (imgs.length > 0) {
      photoGridWrap.innerHTML = _buildPhotoGrid(imgs, canEdit, canEditCreative, isAdmin, id);
    } else {
      photoGridWrap.innerHTML = '<div class="pcs-photos-empty" onclick="window._pcsAddPhotos(\'' + esc(id) + '\')">ADD PHOTOS</div>' +
        (canManage ? '<input type="file" id="pcs-photo-input" accept="image/*" multiple style="display:none" onchange="window._pcsHandlePhotoInput(\'' + esc(id) + '\',this)">' : '');
    }
  }

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

  // f2) Caption action buttons (canManage only). The AI \u2726 Write button
  //     that lived in this row in PR 2 has moved to Zone 1 in PR 3 (see
  //     the two-zone layout below), so cap-actions is back to the
  //     original Edit/Copy/Clear trio.
  var capActionsContainer = document.getElementById('pcs-cap-actions-container');
  if (capActionsContainer) {
    if (canManage) {
      capActionsContainer.innerHTML =
        '<div class="pcs-cap-actions">' +
        '<button class="pcs-cap-btn pcs-cap-btn--bright" onclick="window._startCaptionEdit(\'' + esc(id) + '\')">Edit</button>' +
        '<button class="pcs-cap-btn pcs-cap-btn--bright" onclick="window._pcsCopyCaption(\'' + esc(id) + '\')">Copy</button>' +
        (post.caption ? '<button class="pcs-cap-btn pcs-cap-btn--danger" onclick="window._pcsConfirmClearCaption(\'' + esc(id) + '\')">Clear</button>' : '') +
        '</div>';
    } else {
      capActionsContainer.innerHTML = '';
    }
  }

  // f3) Zone 1 (AI) — Admin + AppState.workspace.ai_enabled only.
  //     Injected into the dedicated #pcs-zone-ai-container (added to
  //     index.html in this PR) which sits inside the #pcs-caption-scroll
  //     wrapper, above the non-scrolling .pcs-zone-manual footer. The
  //     container's innerHTML is rewritten on every render so there is
  //     no per-post id-guard; cross-post accumulation is also handled
  //     defensively by forcePCSReset() stripping every
  //     [id^="pcs-ai-section-"] node on PCS close.
  var aiZoneContainer = document.getElementById('pcs-zone-ai-container');
  if (aiZoneContainer) {
    if (isAdmin && window.AppState.workspace && window.AppState.workspace.ai_enabled) {
      var _commentCount = Array.isArray(post.post_comments)
        ? post.post_comments.filter(function(c) { return c && !c.deleted; }).length
        : (typeof post._commentCount === 'number' ? post._commentCount : 0);
      aiZoneContainer.innerHTML = _pcsBuildAiZoneHtml(id, _commentCount);
    } else {
      aiZoneContainer.innerHTML = '';
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

  // l) Mention dropup (notes + client)
  //    Pre-load the roster from /user_roles so the dropup filter has data
  //    before the user starts typing. Fire-and-forget; internal cache.
  if (typeof _fetchPcsRoster === 'function') {
    try { _fetchPcsRoster(); } catch (e) {}
  }
  if (typeof window._initMentionDropup === 'function') {
    window._initMentionDropup('pcs-note-input', 'pcs-mention-dropup');
    window._initMentionDropup('pcs-comment-input', 'pcs-client-mention-dropup');
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
  if (tab === 'client' && typeof _updateSelectStripVisibility === 'function') _updateSelectStripVisibility();
  if (tab !== 'client' && typeof exitCommentSelectMode === 'function' && window._commentSelectMode && window._commentSelectMode.active) exitCommentSelectMode();
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
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#F6A623">Upload Photos</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;color:#333;letter-spacing:.06em">JPG / PNG</div>' +
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
function _ucFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
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
      '>' + esc(_ucFirst(post.format)) +
      (canManage ? ' &#9662;' : '') + '</span>');
  } else if (canManage) {
    items.push('<span class="pcs-mv" onclick="event.stopPropagation();window._pcsChipDrop(this,\'format\',\'' + esc(id) + '\')">+ Format &#9662;</span>');
  }

  // 4. Pillar
  if (post.contentPillar) {
    var pillarVal = typeof formatPillarDisplay === 'function' ? formatPillarDisplay(post.contentPillar) : post.contentPillar;
    items.push('<span class="pcs-mv"' +
      (canManage ? ' onclick="event.stopPropagation();window._pcsChipDrop(this,\'pillar\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(_ucFirst(pillarVal)) +
      (canManage ? ' &#9662;' : '') + '</span>');
  } else if (canManage) {
    items.push('<span class="pcs-mv" onclick="event.stopPropagation();window._pcsChipDrop(this,\'pillar\',\'' + esc(id) + '\')">+ Pillar &#9662;</span>');
  }

  // 5. Location
  if (post.location) {
    items.push('<span class="pcs-mv"' +
      (canManage ? ' onclick="event.stopPropagation();window._pcsChipDrop(this,\'location\',\'' + esc(id) + '\')"' : '') +
      '>' + esc(_ucFirst(post.location)) +
      (canManage ? ' &#9662;' : '') + '</span>');
  } else if (canManage) {
    items.push('<span class="pcs-mv" onclick="event.stopPropagation();window._pcsChipDrop(this,\'location\',\'' + esc(id) + '\')">+ Location &#9662;</span>');
  }

  return items.filter(function(s){return s;}).join(_dot);
}

// -- Chip dropdown handler (body-appended, getBoundingClientRect positioned) --
window._pcsChipDrop = function(chipEl, field, postId) {
  // Toggle: if same field's dropdown is already open, close it and return
  var existingMenu = window.AppState.pcs.activeMenu;
  if (existingMenu) {
    var wasField = existingMenu.getAttribute('data-pcs-field');
    existingMenu.remove();
    window.AppState.pcs.activeMenu = null;
    if (wasField === field) return;
  }

  var post = typeof getPostById === 'function' ? getPostById(postId) : null;

  // DATE: custom calendar dropdown
  if (field === 'date') {
    var rect = chipEl.getBoundingClientRect();
    var drop = document.createElement('div');
    drop.className = 'pcs-chip-drop';
    drop.setAttribute('data-pcs-field', 'date');
    drop.style.cssText = 'position:fixed;top:' + (rect.bottom + 4) + 'px;left:' + rect.left + 'px;z-index:9700;';

    var _curDate = post ? (post.targetDate || post.target_date || '') : '';
    var _viewDate = _curDate ? new Date(_curDate + 'T00:00:00') : new Date();
    if (isNaN(_viewDate.getTime())) _viewDate = new Date();

    function _renderCal() {
      var yr = _viewDate.getFullYear();
      var mo = _viewDate.getMonth();
      var today = new Date(); today.setHours(0,0,0,0);
      var sel = _curDate ? new Date(_curDate + 'T00:00:00') : null;
      var first = new Date(yr, mo, 1);
      var startDay = first.getDay();
      var daysInMonth = new Date(yr, mo + 1, 0).getDate();
      var prevDays = new Date(yr, mo, 0).getDate();
      var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

      var html = '<div class="pcs-cal">';
      html += '<div class="pcs-cal-hdr">';
      html += '<button data-cal-nav="prev">&#8249;</button>';
      html += '<span>' + months[mo] + ' ' + yr + '</span>';
      html += '<button data-cal-nav="next">&#8250;</button>';
      html += '</div>';
      html += '<div class="pcs-cal-days">';
      var dayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];
      for (var d = 0; d < 7; d++) html += '<span>' + dayLabels[d] + '</span>';

      for (var p = startDay - 1; p >= 0; p--) {
        html += '<button class="other-month" data-cal-day="">' + (prevDays - p) + '</button>';
      }
      for (var i = 1; i <= daysInMonth; i++) {
        var dd = new Date(yr, mo, i);
        var cls = '';
        if (dd.getTime() === today.getTime()) cls += ' today';
        if (sel && dd.getTime() === sel.getTime()) cls += ' selected';
        var iso = yr + '-' + String(mo + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
        html += '<button class="' + cls.trim() + '" data-cal-day="' + iso + '">' + i + '</button>';
      }
      var totalCells = startDay + daysInMonth;
      var remaining = (7 - (totalCells % 7)) % 7;
      for (var r = 1; r <= remaining; r++) {
        html += '<button class="other-month" data-cal-day="">' + r + '</button>';
      }
      html += '</div></div>';
      drop.innerHTML = html;

      drop.querySelector('[data-cal-nav="prev"]').onclick = function(e) {
        e.stopPropagation();
        _viewDate.setMonth(_viewDate.getMonth() - 1);
        _renderCal();
      };
      drop.querySelector('[data-cal-nav="next"]').onclick = function(e) {
        e.stopPropagation();
        _viewDate.setMonth(_viewDate.getMonth() + 1);
        _renderCal();
      };
      drop.querySelectorAll('[data-cal-day]').forEach(function(btn) {
        var val = btn.getAttribute('data-cal-day');
        if (!val) return;
        btn.onclick = function(e) {
          e.stopPropagation();
          window._pcsDateChange(postId, val);
        };
      });
    }

    _renderCal();
    document.body.appendChild(drop);
    setTimeout(function() { window.AppState.pcs.activeMenu = drop; }, 0);
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
  drop.setAttribute('data-pcs-field', field);
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
      'font-size:13px;color:#B8B8C0;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;' +
      'overflow-wrap:break-word;word-break:break-word;max-width:100%;' +
      'max-height:200px;overflow:hidden;' +
      '-webkit-mask-image:linear-gradient(to bottom,black 160px,transparent 198px);' +
      'mask-image:linear-gradient(to bottom,black 160px,transparent 198px);">' +
      esc(post.caption) + '</div>' +
      '<button id="pcs-caption-see-more" onclick="(function(){' +
      'var t=document.getElementById(\'pcs-caption-text\');' +
      'var b=document.getElementById(\'pcs-caption-see-more\');' +
      'if(!t||!b)return;' +
      'if(t.style.maxHeight===\'200px\'){t.style.maxHeight=\'none\';t.style.webkitMaskImage=\'none\';t.style.maskImage=\'none\';t.style.overflow=\'visible\';b.textContent=\'See Less\';}' +
      'else{t.style.maxHeight=\'200px\';t.style.overflow=\'hidden\';t.style.webkitMaskImage=\'linear-gradient(to bottom,black 160px,transparent 198px)\';t.style.maskImage=\'linear-gradient(to bottom,black 160px,transparent 198px)\';b.textContent=\'See More\';}' +
      '})()" style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;' +
      'text-transform:uppercase;color:#F6A623;background:transparent;border:none;cursor:pointer;' +
      'padding:6px 0 0 0;">See More</button>'
      :
      '<div id="pcs-caption-text" style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#4A4A5A;letter-spacing:0.06em;">No copy yet</div>'
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
    stageLC === 'awaiting_approval' || stageLC === 'in_production' || stageLC === 'scheduled'
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
  var postId = window._pcs.postId;
  if (!postId) {
    var el = document.getElementById('pcs-post-id');
    if (el) postId = el.value;
  }
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
    body: JSON.stringify({ linkedin_link: url, updated_by: resolveActor() })
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
      var _role = (typeof getRoleFor === 'function') ? (getRoleFor(c.author_role) || getRoleFor(c.author)) : '';
      if (!_role) {
        var _r = (c.author_role||'').toLowerCase();
        if (_r==='client') _role = 'client';
        else if (_r==='servicing'||_r==='chitra') _role = 'servicing';
        else if (_r==='creative'||_r==='pranav') _role = 'creative';
        else _role = 'admin';
      }
      if (_role==='client')    return 'pcs-avatar av-client';
      if (_role==='servicing') return 'pcs-avatar av-servicing';
      if (_role==='creative')  return 'pcs-avatar av-creative';
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
          '<div class="pcs-cmt-av"><div class="pcs-avatar av-muted">?</div></div>' +
          '<div class="pcs-cmt-mid">' +
          '<div class="pcs-deleted-msg">This message was deleted.</div>' +
          '</div><div class="pcs-cmt-rt"></div></div>';
      }
      var _authorDisplay = (typeof getDisplayName === 'function') ? getDisplayName(c.author) : (c.author||'?');
      var _initial = _authorDisplay.charAt(0).toUpperCase();
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
      var _resolvedSvg = '<svg width="12" height="12" viewBox="0 0 18 18" style="vertical-align:middle;margin-right:3px"><circle cx="9" cy="9" r="7" fill="none" stroke="#3ECF8E" stroke-width="1.5"/><polyline points="6,9 8.5,11.5 12.5,6.5" fill="none" stroke="#3ECF8E" stroke-width="1.5"/></svg>';
      var _resolvedLabel = (c.resolved && c.resolved_by)
        ? '<div class="pcs-resolved-label">' + _resolvedSvg + 'Resolved by ' + esc(c.resolved_by) + '</div>'
        : '';
      var _escapedMsg = esc(c.message).replace(/'/g, '&#39;');
      var _cReactions = (window._pcsReactions && window._pcsReactions[c.id]) || [];
      var _myReact = _cReactions.find(function(r) { return r.author === _name; });
      var _reactCount = _cReactions.length;
      var _reactInner = _myReact
        ? '<span class="pcs-react-emoji">' + esc(_myReact.emoji) + '</span>'
        : '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
      _reactInner += _reactCount > 0
        ? '<span class="pcs-react-count">' + _reactCount + '</span>'
        : '';
      var _resolveBtnLabel = c.resolved ? 'Unresolve' : 'Resolve';
      return '<div class="pcs-comment-item" data-comment-id="' + esc(c.id) + '" data-author="' + esc(c.author) + '">' +
        '<div class="pcs-cmt-av">' + ((typeof renderAvatar === 'function') ? renderAvatar(c.author, c.author_role, 28, { classes: 'pcs-avatar', fontSize: '9px', fontFamily: "'IBM Plex Mono', monospace" }) : '<div class="' + _avatarClass(c) + '">' + esc(_initial) + '</div>') + '</div>' +
        '<div class="pcs-cmt-mid">' +
          (c.reply_to && c.reply_to_author ?
            '<div class="pcs-cmt-reply-tag">&#8629; <span class="pcs-reply-name">' + esc(c.reply_to_author) + '</span></div>'
            : '') +
          '<div class="pcs-comment-meta">' +
            '<span class="pcs-comment-author">' + esc(_authorDisplay) + '</span>' +
            '<span class="pcs-comment-time">' + _formatTs(c) + '</span>' +
          '</div>' +
          '<div class="pcs-comment-text' + (_isTask ? ' pcs-task-text' : '') +
          ((_isTask && c.resolved) ? ' pcs-task-done' : '') + '">' +
          _taskPrefix + _highlightMentions(esc(c.message)) + '</div>' +
          _imgHtml +
          _resolvedLabel +
          '<div class="pcs-comment-actions">' +
            '<span class="pcs-comment-reply-btn" ' +
              'onclick="window._pcsSetReply(\'client\',\'' +
              esc(c.id) + '\',\'' + esc(c.author) + '\',\'' +
              _escapedMsg + '\')">Reply</span>' +
            '<span class="pcs-comment-resolve-btn" ' +
              'onclick="toggleTaskResolve(\'' + esc(c.id) + '\',\'' + esc(postId) + '\',false)">' +
              _resolveBtnLabel + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="pcs-cmt-rt pcs-comment-react' + (_myReact ? ' pcs-reacted' : '') + '" data-comment-id="' + esc(c.id) + '" onclick="window._pcsShowEmojiPicker(this)">' +
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
          '<div class="pcs-cmt-av"><div class="pcs-avatar av-muted">?</div></div>' +
          '<div class="pcs-cmt-mid">' +
          '<div class="pcs-deleted-msg">This message was deleted.</div>' +
          '</div><div class="pcs-cmt-rt"></div></div>';
      }
      var _authorDisplay = (typeof getDisplayName === 'function') ? getDisplayName(c.author) : (c.author||'?');
      var _initial = _authorDisplay.charAt(0).toUpperCase();
      var _vis = (c.visibility||'all').toUpperCase();
      if (_vis === 'SERVICING') _vis = 'SERV';
      if (_vis === 'CREATIVE') _vis = 'CREAT';
      var _visCls = 'pcs-vis-tag';
      var _visLC = (c.visibility||'all').toLowerCase();
      if (_visLC === 'admin') _visCls += ' pcs-vis--admin';
      else if (_visLC === 'servicing') _visCls += ' pcs-vis--serv';
      else if (_visLC === 'creative') _visCls += ' pcs-vis--creat';
      var _visTag = '<span class="' + _visCls + '">' + _vis + '</span>';
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
      var _resolvedSvg = '<svg width="12" height="12" viewBox="0 0 18 18" style="vertical-align:middle;margin-right:3px"><circle cx="9" cy="9" r="7" fill="none" stroke="#3ECF8E" stroke-width="1.5"/><polyline points="6,9 8.5,11.5 12.5,6.5" fill="none" stroke="#3ECF8E" stroke-width="1.5"/></svg>';
      var _resolvedLabel = (c.resolved && c.resolved_by)
        ? '<div class="pcs-resolved-label">' + _resolvedSvg + 'Resolved by ' + esc(c.resolved_by) + '</div>'
        : '';
      var _escapedMsg = esc(c.message).replace(/'/g, '&#39;');
      var _cReactions = (window._pcsReactions && window._pcsReactions[c.id]) || [];
      var _myReact = _cReactions.find(function(r) { return r.author === _name; });
      var _reactCount = _cReactions.length;
      var _reactInner = _myReact
        ? '<span class="pcs-react-emoji">' + esc(_myReact.emoji) + '</span>'
        : '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
      _reactInner += _reactCount > 0
        ? '<span class="pcs-react-count">' + _reactCount + '</span>'
        : '';
      var _resolveBtnLabel = c.resolved ? 'Unresolve' : 'Resolve';
      return '<div class="pcs-note-item' +
        (c.resolved ? ' pcs-resolved' : '') + '" data-comment-id="' + esc(c.id) + '" data-author="' + esc(c.author) + '">' +
        '<div class="pcs-cmt-av">' + ((typeof renderAvatar === 'function') ? renderAvatar(c.author, c.author_role, 28, { classes: 'pcs-avatar', fontSize: '9px', fontFamily: "'IBM Plex Mono', monospace" }) : '<div class="' + _avatarClass(c) + '">' + esc(_initial) + '</div>') + '</div>' +
        '<div class="pcs-cmt-mid">' +
          (c.reply_to && c.reply_to_author ?
            '<div class="pcs-cmt-reply-tag">&#8629; <span class="pcs-reply-name">' + esc(c.reply_to_author) + '</span></div>'
            : '') +
          '<div class="pcs-comment-meta">' +
            '<span class="pcs-comment-author">' + esc(_authorDisplay) + '</span>' +
            '<span class="pcs-comment-time">' + _formatTs(c) + '</span>' +
            _visTag +
          '</div>' +
          '<div class="pcs-comment-text' + (_isTask ? ' pcs-task-text' : '') +
          ((_isTask && c.resolved) ? ' pcs-task-done' : '') + '">' +
          _taskPrefix + _highlightMentions(esc(c.message)) + '</div>' +
          _imgHtml +
          _resolvedLabel +
          '<div class="pcs-comment-actions">' +
            '<span class="pcs-comment-reply-btn" ' +
              'onclick="window._pcsSetReply(\'note\',\'' +
              esc(c.id) + '\',\'' + esc(c.author) + '\',\'' +
              _escapedMsg + '\')">Reply</span>' +
            '<span class="pcs-comment-resolve-btn" ' +
              'onclick="toggleTaskResolve(\'' + esc(c.id) + '\',\'' + esc(postId) + '\',true)">' +
              _resolveBtnLabel + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="pcs-cmt-rt pcs-comment-react' + (_myReact ? ' pcs-reacted' : '') + '" data-comment-id="' + esc(c.id) + '" onclick="window._pcsShowEmojiPicker(this)">' +
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

    var resolvedClientRows = clientRows.filter(function(c) { return c.resolved; });
    var activeClientRows = clientRows.filter(function(c) { return !c.resolved; });

    var clientHtml = _renderClientThread(activeClientRows, emptyClient);

    if (resolvedClientRows.length) {
      clientHtml +=
        '<details class="pcs-resolved-wrap">' +
        '<summary class="pcs-resolved-summary">' +
        '\u21B3 ' + resolvedClientRows.length +
        ' Resolved Comment' +
        (resolvedClientRows.length > 1 ? 's' : '') +
        ' (click to expand)</summary>' +
        _renderClientThread(resolvedClientRows, '') +
        '</details>';
    }

    list.innerHTML = clientHtml;

    var countEl = document.getElementById('pcs-comments-count');
    if (countEl) {
      countEl.textContent = activeClientRows.length;
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
        actor: window.AppState.user.email || 'Admin',
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
  progressWrap.style.position = 'relative';
  progressWrap.style.zIndex = '9700';
  progressWrap.innerHTML =
    '<div style="width:100%;height:3px;background:#1a1a22;overflow:hidden;position:relative;">' +
    '<div id="pcs-upload-bar" style="height:100%;background:#C8A84B;width:0%;transition:width 0.3s ease;"></div></div>' +
    '<div id="pcs-upload-label" style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:.06em;color:#808090;padding:4px 16px;text-transform:uppercase;">' +
    'UPLOADING 0 OF ' + files.length + '...</div>';
  var _lb = document.getElementById('pcs-lightbox');
  var _isLbOpen = _lb && (_lb.style.display === 'flex' || _lb.style.display === 'block');
  var _wasLbOpen = _isLbOpen;
  var _wasEditMode = window._pcsLbEditMode;
  if (_isLbOpen) {
    _lb.insertBefore(progressWrap, _lb.firstChild);
  } else {
    var photoGrid = document.getElementById('pcs-photo-grid-wrap');
    if (photoGrid && photoGrid.parentNode) photoGrid.parentNode.insertBefore(progressWrap, photoGrid);
  }
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
    if (bar) {
      bar.style.width = pct + '%';
      if (pct === 100) bar.style.background = '#3ECF8E';
    }
    if (lbl) lbl.textContent = pct === 100
      ? 'DONE'
      : 'UPLOADING ' + (fi + 1) + ' OF ' + files.length + '...';
  }
  if (!uploaded.length) return;
  var newImages = currentImages.concat(uploaded);
  try {
    await apiFetch('/posts?post_id=eq.' + postId, {
      method: 'PATCH',
      body: JSON.stringify({ images: newImages, updated_by: resolveActor() })
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
    post.images = newImages;
    showToast && showToast(uploaded.length + ' photo' + (uploaded.length > 1 ? 's' : '') + ' uploaded', 'success');
    if (typeof openPCS === 'function') openPCS(postId, '');
    var pw = document.getElementById('pcs-upload-progress');
    if (pw) pw.remove();
    if (_wasLbOpen) {
      setTimeout(function() {
        var p = (typeof getPostById === 'function') ? getPostById(postId) : null;
        if (p && p.images && p.images.length > 0) {
          if (_wasEditMode) {
            _pcsOpenLightbox(postId, 0);
            window._pcsLbEditMode = true;
            _pcsLbRender();
          } else {
            _pcsOpenLightbox(postId, p.images.length - 1);
          }
        }
      }, 200);
    }
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
      body: JSON.stringify({ images: imgs, updated_by: resolveActor() })
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
window._pcsLbEditMode = false;

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
window._pcsEnterEditMode = function() {
  window._pcsLbEditMode = true;
  _pcsLbRender();
};

window._pcsExitEditMode = function() {
  window._pcsLbEditMode = false;
  window._pcsLbIdx = 0;
  _pcsLbRender();
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
      body: JSON.stringify({ images: imgs, updated_by: resolveActor() })
    });
    var _next = window.AppState.posts.all.map(function(p) {
      if (getPostId(p) === postId) {
        return Object.assign({}, p, { images: imgs });
      }
      return p;
    });
    window.AppState.posts.setAll(_next);

    // Case 1: zero photos left
    if (imgs.length === 0) {
      _pcsLbClose();
      window._pcsLbEditMode = false;
      if (typeof openPCS === 'function') openPCS(postId, '');
      return;
    }

    // Case 2: in edit mode — refresh grid
    if (window._pcsLbEditMode) {
      window._pcsLbImages = imgs;
      if (typeof openPCS === 'function') openPCS(postId, '');
      setTimeout(function() {
        _pcsOpenLightbox(postId, 0);
        window._pcsLbEditMode = true;
        _pcsLbRender();
      }, 150);
      return;
    }

    // Case 3: normal mode — stay on adjacent photo
    var newIdx = Math.min(idx, imgs.length - 1);
    if (newIdx < 0) newIdx = 0;
    window._pcsLbImages = imgs;
    window._pcsLbIdx = newIdx;
    if (typeof openPCS === 'function') openPCS(postId, '');
    setTimeout(function() {
      _pcsOpenLightbox(postId, newIdx);
    }, 150);
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
      body: JSON.stringify({ caption: '', updated_by: resolveActor() })
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
  var IMAGES_BASE = 'https://images.srtd.io/';
  var WORKER = 'https://srtd-r2-upload.ksg-kumarshubhamgune.workers.dev/download?key=';
  for (var i = 0; i < imgs.length; i++) {
    var url = typeof imgs[i] === 'string' ? imgs[i] : (imgs[i].url || imgs[i]);
    var key = url.replace(R2_BASE, '').replace(IMAGES_BASE, '');
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

window._pcsOpenLightbox = function(postId, arg2, arg3) {
  var externalImgs = Array.isArray(arg2) ? arg2 : null;
  var idx = externalImgs ? (arg3 || 0) : (arg2 || 0);
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  window._pcsLbImages = externalImgs
    ? externalImgs
    : ((post && Array.isArray(post.images)) ? post.images : []);
  window._pcsLbIdx = idx;
  window._pcsLbReadonly = !!externalImgs;
  _pcsLbRender();
  var lb = document.getElementById('pcs-lightbox');
  if (lb) { lb.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  var actionBar = document.getElementById('pcs-lb-action-bar');
  if (actionBar) {
    var _r = (window.AppState.user.effectiveRole || '').toLowerCase();
    var _canManageLb = _r !== 'client' && !window._pcsLbReadonly;
    actionBar.style.display = _canManageLb ? 'flex' : 'none';
  }
};

window._pcsLbRender = function() {
  if (window._pcsLbEditMode) {
    _pcsLbRenderGrid();
    return;
  }
  // Normal single-photo mode
  var photoArea = document.getElementById('pcs-lb-photo-area');
  var img = document.getElementById('pcs-lb-img');
  // Restore single img if grid was shown previously
  if (photoArea && !img) {
    photoArea.innerHTML = '<img id="pcs-lb-img" src="" alt="" style="max-width:100%;max-height:100%;object-fit:contain;display:block;">';
    img = document.getElementById('pcs-lb-img');
  }
  if (photoArea) photoArea.style.padding = '60px 0 80px';
  var counter = document.getElementById('pcs-lb-counter');
  var filename = document.getElementById('pcs-lb-filename');
  var dots = document.getElementById('pcs-lb-dots');
  var nav = document.getElementById('pcs-lb-nav');
  var actionBar = document.getElementById('pcs-lb-action-bar');
  if (!img) return;
  var url = window._pcsLbImages[window._pcsLbIdx] || '';
  if (typeof url === 'object') url = url.url || url.src || '';
  img.src = url;
  if (counter) counter.textContent = (window._pcsLbIdx + 1) + ' / ' + window._pcsLbImages.length;
  if (filename) {
    var parts = url.split('/');
    filename.textContent = parts[parts.length - 1] || '';
  }
  if (dots) {
    dots.style.display = 'flex';
    dots.innerHTML = window._pcsLbImages.map(function(u, i) {
      return '<div style="width:5px;height:5px;border-radius:50%;background:' +
        (i === window._pcsLbIdx ? '#e8e2d9' : '#2a2a2a') + ';"></div>';
    }).join('');
  }
  if (nav) nav.style.display = 'flex';
  // Restore normal action bar
  if (actionBar) {
    var _r = (window.AppState.user.effectiveRole || '').toLowerCase();
    if (_r !== 'client') {
      actionBar.innerHTML =
        '<button class="pcs-lb-act" onclick="window._pcsAddPhotos&&window._pcsAddPhotos(window._pcs&&window._pcs.postId||\'\')">ADD</button>' +
        '<button class="pcs-lb-act" onclick="window._pcsEnterEditMode&&window._pcsEnterEditMode()">EDIT</button>' +
        '<button class="pcs-lb-act" onclick="window._pcsSaveAllPhotos&&window._pcsSaveAllPhotos(window._pcs&&window._pcs.postId||\'\')">SAVE</button>' +
        '<button class="pcs-lb-act" onclick="window._pcsLbDownload&&window._pcsLbDownload()">DOWNLOAD</button>' +
        '<button class="pcs-lb-act pcs-lb-act--remove" onclick="window._pcsConfirmRemovePhoto&&window._pcsConfirmRemovePhoto(window._pcs&&window._pcs.postId||\'\',window._pcsLbIdx)">REMOVE</button>';
      actionBar.style.display = 'flex';
    }
  }
}

function _pcsLbRenderGrid() {
  var photoArea = document.getElementById('pcs-lb-photo-area');
  var counter = document.getElementById('pcs-lb-counter');
  var dots = document.getElementById('pcs-lb-dots');
  var nav = document.getElementById('pcs-lb-nav');
  var actionBar = document.getElementById('pcs-lb-action-bar');
  var postId = (window._pcs && window._pcs.postId) || '';

  // Header: edit mode label
  if (counter) counter.textContent = 'EDIT \u00B7 ' + window._pcsLbImages.length + ' PHOTOS';
  // Hide dots and nav
  if (dots) dots.style.display = 'none';
  if (nav) nav.style.display = 'none';

  // Build grid
  if (photoArea) {
    photoArea.style.padding = '52px 0 60px';
    var html = '<div id="pcs-lb-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;padding:8px;overflow-y:auto;flex:1;align-content:start;width:100%">';
    for (var i = 0; i < window._pcsLbImages.length; i++) {
      var url = window._pcsLbImages[i];
      if (typeof url === 'object') url = url.url || url.src || '';
      html += '<div style="position:relative;aspect-ratio:1;overflow:hidden;background:#0c0c11">';
      html += '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover;display:block">';
      html += '<button onclick="window._pcsConfirmRemovePhoto(\'' + esc(postId) + '\',' + i + ')" style="position:absolute;top:6px;right:6px;width:26px;height:26px;background:#000000BF;border:1px solid #FF4B4B4D;border-radius:50%;color:#FF4B4B;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:300">\u00D7</button>';
      html += '<span style="position:absolute;bottom:6px;left:6px;font-family:\'IBM Plex Mono\',monospace;font-size:8px;color:#FFFFFF99;background:#00000099;padding:2px 6px;letter-spacing:.04em">' + (i + 1) + '</span>';
      html += '</div>';
    }
    // Add photo slot (if under 20)
    if (window._pcsLbImages.length < 20) {
      html += '<div onclick="window._pcsAddPhotos&&window._pcsAddPhotos(\'' + esc(postId) + '\')" style="aspect-ratio:1;background:#0c0c11;border:1px dashed #2e2e3a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer">';
      html += '<span style="font-size:24px;color:#505060;line-height:1">+</span>';
      html += '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;letter-spacing:.1em;text-transform:uppercase;color:#505060">Add</span>';
      html += '</div>';
    }
    html += '</div>';
    photoArea.innerHTML = html;
  }

  // Action bar: DONE only
  if (actionBar) {
    actionBar.innerHTML = '<button onclick="window._pcsExitEditMode&&window._pcsExitEditMode()" style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:#C8A84B;background:none;border:none;padding:12px 20px;cursor:pointer;font-weight:600">DONE</button>';
    actionBar.style.display = 'flex';
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
  window._pcsLbEditMode = false;
  var lb = document.getElementById('pcs-lightbox');
  if (lb) { lb.style.display = 'none'; document.body.style.overflow = ''; }
  var actionBar = document.getElementById('pcs-lb-action-bar');
  if (actionBar) actionBar.style.display = 'none';
}

window._pcsLbDownload = function() {
  var url = window._pcsLbImages[window._pcsLbIdx];
  if (!url) return;
  if (typeof url === 'object') url = url.url || url.src || '';
  if (!url) return;
  var R2_BASE = 'https://pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev/';
  var IMAGES_BASE = 'https://images.srtd.io/';
  var WORKER = 'https://srtd-r2-upload.ksg-kumarshubhamgune.workers.dev/download?key=';
  var key = url.replace(R2_BASE, '').replace(IMAGES_BASE, '');
  var a = document.createElement('a');
  a.href = WORKER + encodeURIComponent(key);
  a.download = 'sorted-photo-' + (window._pcsLbIdx + 1) + '.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast && showToast('Downloading...', 'info');
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

  var post = (typeof getPostById === 'function')
    ? getPostById(postId)
    : window.AppState.posts.all.find(function(p) {
        return (typeof getPostId === 'function'
          ? getPostId(p)
          : p.post_id) === postId;
      });
  if (!post) return;
  if (post._isSaving) return;

  var newCaption = ta.value.trim();
  var oldCaption = (textEl && (textEl.dataset.raw || textEl.textContent)) || '';

  return window.guardAction('save-caption-' + postId, async function() {

  post._isSaving = true;
  if (typeof _startSaveTimeout === 'function') {
    _startSaveTimeout(post, postId);
  }

  try {
    await apiFetch('/posts?post_id=eq.' + postId, {
      method: 'PATCH',
      body: JSON.stringify({ caption: newCaption, updated_by: resolveActor(), updated_at: new Date().toISOString() })
    });
  } catch (err) {
    console.error('[pcs] save caption failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'pcs-save-caption');
    showToast && showToast('Failed to save caption — try again', 'error');
    if (typeof _clearSaveTimeout === 'function') {
      _clearSaveTimeout(post);
    }
    post._isSaving = false;
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
        changed_by: (window.AppState.user.email || window.AppState.user.name || 'team'),
        changed_at: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error('[pcs] audit_log write failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'pcs-audit-log');
  }

  if (typeof _clearSaveTimeout === 'function') {
    _clearSaveTimeout(post);
  }
  post._isSaving = false;

  // Update post in memory — in-place mutation keeps AppState.pcs.post in sync
  Object.assign(post, {
    caption: newCaption,
    updated_at: new Date().toISOString()
  });

  if (typeof showToast === 'function') {
    showToast('Caption saved', 'success');
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
  // Check task flag from + menu pre-fill
  var _clientInp = document.getElementById('pcs-comment-input');
  if (!isTask && _clientInp && _clientInp.dataset.isTask === 'true') {
    isTask = true;
    delete _clientInp.dataset.isTask;
    _clientInp.placeholder = 'Reply to client...';
  }
  isTask = isTask || false;
  visibility = visibility || 'all';

  if (!postId || !message || !(message = message.trim())) return;

  var _post = (window.AppState.posts.all||[]).find(function(p) {
    return p.post_id === postId || p.id === postId;
  });
  var _realPostId = _post ? _post.post_id : postId;
  var _title = _post ? (_post.title || postId) : postId;
  var _author = window.AppState.user.email || window.AppState.user.name || 'Team';
  var _role = (window.AppState.user.effectiveRole || 'Admin');
  var _roleLower = _role.toLowerCase();

  // Roster-aware mention extraction: match against known roster names
  // first so multi-word or dot-containing names resolve correctly.
  // Falls back to regex for manually-typed @mentions not from the picker.
  var _mentioned = [];
  if (_pcsRoster && _pcsRoster.length) {
    var _lowerMsg = message.toLowerCase();
    _pcsRoster.forEach(function(m) {
      if (!m.name) return;
      var _atName = '@' + m.name.toLowerCase();
      if (_lowerMsg.indexOf(_atName) !== -1) {
        _mentioned.push(m.name);
      }
    });
  }
  if (_mentioned.length === 0) {
    var _mentionMatches = message.match(/@([a-zA-Z0-9_]+)/g) || [];
    _mentioned = _mentionMatches.map(function(m) {
      return m.slice(1);
    });
  }

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

    // Notification fan-out removed — notify-comment edge function now
    // writes all comment + mention notification rows and sends emails.
    // JS-side fan-out caused duplicate notifications.

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
  var _table = isInternalNote ? '/internal_notes' : '/post_comments';
  var _endpoint = _table + '?id=eq.' + commentId;
  apiFetch(_table + '?id=eq.' + commentId + '&select=resolved').then(function(rows) {
    var _isResolved = !!(rows && rows[0] && rows[0].resolved);
    var _payload = _isResolved
      ? { resolved: false, resolved_by: null, resolved_at: null }
      : { resolved: true, resolved_by: window.AppState.user.email || window.AppState.user.name || 'Admin', resolved_at: new Date().toISOString() };
    return apiFetch(_endpoint, {
      method: 'PATCH',
      headers: {'Prefer': 'return=minimal'},
      body: JSON.stringify(_payload)
    });
  }).then(function() {
    loadPcsComments(postId);
  }).catch(function(e) {
    console.error('toggleTaskResolve failed:', e);
    window.logError && window.logError(e&&e.message, e&&e.stack, 'toggle-task-resolve');
    showToast && showToast('Failed to update task', 'error');
  });
};

// -- @mention dropup system --
var _pcsRoster = null;
var _pcsRosterPromise = null;

function _fetchPcsRoster() {
  if (_pcsRoster && _pcsRoster._ts &&
      (Date.now() - _pcsRoster._ts) < 300000) {
    return Promise.resolve(_pcsRoster);
  }
  if (_pcsRosterPromise) return _pcsRosterPromise;
  _pcsRosterPromise = window.apiFetch(
    '/user_roles?select=name,role,email&order=name.asc',
    { method: 'GET' }
  ).then(function(rows) {
    _pcsRoster = Array.isArray(rows)
      ? rows.filter(function(r) { return r && (r.name || r.email); })
          .map(function(r) {
            var safeRole = r.role
              ? String(r.role) : 'client';
            var _rosterName = (r.name && r.name.trim()) ? r.name.trim() : '';
            if (!_rosterName && r.email && typeof getDisplayName === 'function') {
              var _dn = getDisplayName(r.email);
              if (_dn && _dn !== r.email && _dn !== 'Unknown') _rosterName = _dn;
            }
            if (!_rosterName && r.email) {
              _rosterName = r.email.split('@')[0]
                .split(/[._-]/)
                .filter(Boolean)
                .map(function(p) {
                  return p.charAt(0).toUpperCase() +
                         p.slice(1).toLowerCase();
                }).join(' ');
            }
            return {
              name: _rosterName || '?',
              role: safeRole.charAt(0).toUpperCase() +
                    safeRole.slice(1).toLowerCase(),
              email: r.email || ''
            };
          })
      : [];
    _pcsRoster._ts = Date.now();
    window._pcsRosterData = _pcsRoster;
    _pcsRosterPromise = null;
    return _pcsRoster;
  }).catch(function() {
    _pcsRoster = [];
    _pcsRosterPromise = null;
    return [];
  });
  return _pcsRosterPromise;
}
window._fetchPcsRoster = _fetchPcsRoster;

function _hideMentionDropup(dropupId) {
  var id = dropupId || 'pcs-mention-dropup';
  var dropup = document.getElementById(id);
  if (dropup) dropup.style.display = 'none';
}

window._initMentionDropup = function(inputId, dropupId) {
  var textareaId = inputId || 'pcs-note-input';
  var dropId = dropupId || 'pcs-mention-dropup';
  var textarea = document.getElementById(textareaId);
  if (!textarea) return;
  var dropup = document.getElementById(dropId);
  if (!dropup) return;

  var _currentMentionStart = -1;

  textarea.addEventListener('input', function() {
    var val = textarea.value;
    var cursor = textarea.selectionStart;
    var textBeforeCursor = val.slice(0, cursor);
    var atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex === -1) { _hideMentionDropup(dropId); return; }

    var query = textBeforeCursor.slice(atIndex + 1);
    if (/\s/.test(query)) { _hideMentionDropup(dropId); return; }

    _currentMentionStart = atIndex;
    var _isInternal = (textareaId === 'pcs-note-input');
    var filtered = (_pcsRoster || []).filter(function(m) {
      if (_isInternal && m.role && m.role.toLowerCase() === 'client') return false;
      return true;
    }).filter(function(m) {
      return m.name.toLowerCase().startsWith(query.toLowerCase());
    });

    if (!filtered.length) { _hideMentionDropup(dropId); return; }

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
        _hideMentionDropup(dropId);
        textarea.focus();
      });
    });
  });

  textarea.addEventListener('blur', function() {
    setTimeout(function() { _hideMentionDropup(dropId); }, 150);
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
  dropup.innerHTML = (_pcsRoster || []).filter(function(m) {
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
var _PCS_EMOJIS = ['\u2764\uFE0F', '\uD83D\uDC4D', '\uD83C\uDFAF', '\uD83D\uDC40', '\u2705', '\uD83C\uDD97'];

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
  var _rect = reactEl.getBoundingClientRect();
  var _PICKER_W = 220; // approx: 6 btns * 32 + 5 gaps * 2 + padding + border
  picker.style.position = 'fixed';
  picker.style.top = (_rect.top - 40) + 'px';
  picker.style.bottom = 'auto';
  // Right-anchor by default (correct for PCS .pcs-cmt-rt column).
  // If right-anchoring would push the picker off the left edge,
  // switch to left-anchoring so it stays on-screen (client view
  // Like span is left-aligned and triggers this branch).
  if (_rect.right - _PICKER_W < 8) {
    picker.style.left = Math.max(8, _rect.left) + 'px';
    picker.style.right = 'auto';
  } else {
    picker.style.right = (window.innerWidth - _rect.right) + 'px';
    picker.style.left = 'auto';
  }
  document.body.appendChild(picker);

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
      var _name = (window.AppState.user.email || window.AppState.user.name || '');
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
          '<span class="pcs-react-emoji">' + emoji + '</span>' +
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
            '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>' +
            '<span class="pcs-react-count">' + count + '</span>';
        } else {
          reactEl.innerHTML =
            '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
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
      var inp = document.getElementById('pcs-comment-input');
      if (inp) {
        inp.value = 'Task: ';
        inp.placeholder = 'Describe the task...';
        inp.dataset.isTask = 'true';
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
        inp.dispatchEvent(new Event('input'));
      }
      return;
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
    input.value = '@' + author + ' ';
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
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
  if (inp) {
    inp.value = '';
    inp.focus();
  }
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

