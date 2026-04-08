/* ===============================================
   actions/pcs-longpress.js  -  Long-press menu for PCS comments
   Visual redesign Part 2A — no new DB calls
=============================================== */
console.log("LOADED:", "actions/pcs-longpress.js");

(function() {
  var _lpTimer = null;
  var _lpTarget = null;
  var _lpStartX = 0;
  var _lpStartY = 0;
  var _MOVE_THRESHOLD = 10;
  var _LP_DELAY = 500;

  // Elements we should NOT trigger long-press on
  var _SKIP_SELECTORS = '.pcs-comment-react, .pcs-comment-reply-btn, .pcs-task-check, .pcs-expand-link, .pcs-comment-img-thumb, a, button, input, textarea';

  function _findCommentItem(el) {
    return el.closest('.pcs-comment-item, .pcs-note-item');
  }

  function _getZone(item) {
    if (!item) return 'client';
    if (item.closest('#pcs-notes-list')) return 'note';
    return 'client';
  }

  function _getPostId() {
    var el = document.getElementById('pcs-post-id');
    return el ? el.value : '';
  }

  function _isTask(item) {
    return item && !!item.querySelector('.pcs-task-check');
  }

  function _showMenu(item) {
    // Remove existing menu
    _removeMenu();

    var zone = _getZone(item);
    var commentId = item.getAttribute('data-comment-id') || '';
    var author = item.getAttribute('data-author') || '';
    var postId = _getPostId();
    var isInternalNote = zone === 'note';
    var hasTask = _isTask(item);
    var textEl = item.querySelector('.pcs-comment-text');
    var message = textEl ? textEl.textContent : '';

    // Check delete permission: author match or admin
    var _name = (window.AppState && window.AppState.user && window.AppState.user.name) || '';
    var _roleLower = ((window.AppState && window.AppState.user && window.AppState.user.effectiveRole) || 'Admin').toLowerCase();
    var canDelete = (author === _name || _roleLower === 'admin');

    // Check if deleted comment
    if (item.querySelector('.pcs-deleted-msg')) return;

    var backdrop = document.createElement('div');
    backdrop.id = 'pcs-longpress-backdrop';
    backdrop.className = 'pcs-lp-backdrop';

    var menu = document.createElement('div');
    menu.id = 'pcs-longpress-menu';
    menu.className = 'pcs-lp-menu';

    var html = '';

    // Resolve task button (only for task comments)
    if (hasTask) {
      html += '<button class="pcs-lp-item pcs-lp-resolve" id="pcs-lp-resolve">Resolve task</button>';
    }

    html += '<button class="pcs-lp-item" id="pcs-lp-copy">Copy text</button>';
    html += '<button class="pcs-lp-item" id="pcs-lp-reply">Reply</button>';

    if (canDelete) {
      html += '<button class="pcs-lp-item pcs-lp-delete" id="pcs-lp-delete">Delete</button>';
    }

    html += '<button class="pcs-lp-cancel" id="pcs-lp-cancel">Cancel</button>';
    menu.innerHTML = html;

    backdrop.appendChild(menu);
    var overlay = document.getElementById('pcs-overlay');
    if (overlay) {
      overlay.appendChild(backdrop);
    } else {
      document.body.appendChild(backdrop);
    }

    // Wire handlers
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) _removeMenu();
    });

    var cancelBtn = document.getElementById('pcs-lp-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', _removeMenu);

    var copyBtn = document.getElementById('pcs-lp-copy');
    if (copyBtn) copyBtn.addEventListener('click', function() {
      _removeMenu();
      if (typeof window._pcsCopyComment === 'function') {
        window._pcsCopyComment(message);
      }
    });

    var replyBtn = document.getElementById('pcs-lp-reply');
    if (replyBtn) replyBtn.addEventListener('click', function() {
      _removeMenu();
      if (typeof window._pcsSetReply === 'function') {
        window._pcsSetReply(zone, commentId, author, message);
      }
    });

    var deleteBtn = document.getElementById('pcs-lp-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', function() {
      _removeMenu();
      if (typeof window._pcsConfirmDeleteComment === 'function') {
        window._pcsConfirmDeleteComment(commentId, postId, isInternalNote);
      }
    });

    var resolveBtn = document.getElementById('pcs-lp-resolve');
    if (resolveBtn) resolveBtn.addEventListener('click', function() {
      _removeMenu();
      if (typeof window.toggleTaskResolve === 'function') {
        window.toggleTaskResolve(commentId, postId);
      }
    });
  }

  function _removeMenu() {
    var existing = document.getElementById('pcs-longpress-backdrop');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  function _cancelTimer() {
    if (_lpTimer) {
      clearTimeout(_lpTimer);
      _lpTimer = null;
    }
    _lpTarget = null;
  }

  function _onTouchStart(e) {
    var target = e.target;
    // Skip interactive elements
    if (target.closest && target.closest(_SKIP_SELECTORS)) return;

    var item = _findCommentItem(target);
    if (!item) return;

    _lpStartX = e.touches[0].clientX;
    _lpStartY = e.touches[0].clientY;
    _lpTarget = item;

    _lpTimer = setTimeout(function() {
      if (_lpTarget) {
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(12);
        _showMenu(_lpTarget);
        _lpTarget = null;
      }
    }, _LP_DELAY);
  }

  function _onTouchMove(e) {
    if (!_lpTimer) return;
    var dx = Math.abs(e.touches[0].clientX - _lpStartX);
    var dy = Math.abs(e.touches[0].clientY - _lpStartY);
    if (dx > _MOVE_THRESHOLD || dy > _MOVE_THRESHOLD) {
      _cancelTimer();
    }
  }

  function _onTouchEnd() {
    _cancelTimer();
  }

  // Desktop: right-click on comment items
  function _onContextMenu(e) {
    var target = e.target;
    if (target.closest && target.closest(_SKIP_SELECTORS)) return;
    var item = _findCommentItem(target);
    if (!item) return;
    e.preventDefault();
    _showMenu(item);
  }

  // Attach listeners to #pcs-overlay once it exists
  function _wireListeners() {
    var overlay = document.getElementById('pcs-overlay');
    if (!overlay) return;
    if (overlay._lpWired) return;
    overlay._lpWired = true;

    overlay.addEventListener('touchstart', _onTouchStart, { passive: true });
    overlay.addEventListener('touchmove', _onTouchMove, { passive: true });
    overlay.addEventListener('touchend', _onTouchEnd, { passive: true });
    overlay.addEventListener('touchcancel', _onTouchEnd, { passive: true });
    overlay.addEventListener('contextmenu', _onContextMenu);
  }

  // Wire on DOMContentLoaded and also when PCS opens
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wireListeners);
  } else {
    _wireListeners();
  }

  // Re-wire on each openPCS (overlay may be re-created)
  var _origOpenPCS = window.openPCS;
  if (_origOpenPCS) {
    window.openPCS = function() {
      _origOpenPCS.apply(this, arguments);
      _wireListeners();
    };
  }

  // Expose remove for cleanup
  window._pcsLongpressRemoveMenu = _removeMenu;
})();
