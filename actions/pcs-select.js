/* ═══════════════════════════════════════════════════════════════
   pcs-select.js — Comment selection mode for rewrite-with-context
   Lets the user pick specific comments on the Client tab, then
   opens the caption workspace in rewrite mode with those comments.
   ═══════════════════════════════════════════════════════════════ */
console.log('LOADED:', 'pcs-select.js');

window._commentSelectMode = {
  active: false,
  selected: new Set()
};

window.enterCommentSelectMode = function() {
  var st = window._commentSelectMode;
  if (st.active) return;
  st.active = true;
  st.selected.clear();

  var strip = document.getElementById('pcs-select-strip');
  if (strip) {
    strip.classList.add('pcs-ss-active');
    var textEl = strip.querySelector('.pcs-ss-text');
    if (textEl) {
      var total = document.querySelectorAll('#pcs-comments-list .pcs-comment-item').length;
      textEl.innerHTML = '<em>0</em> of ' + total + ' selected';
    }
  }

  document.querySelectorAll('#pcs-comments-list .pcs-comment-item').forEach(function(item) {
    if (item.querySelector('.pcs-sel-check')) return;
    var check = document.createElement('div');
    check.className = 'pcs-sel-check';
    item.insertBefore(check, item.firstChild);
    item.classList.add('pcs-sel-off');
  });

  var ibar = document.querySelector('#pcs-pane-client .pcs-ibar-wrap.client');
  if (ibar) ibar.style.display = 'none';

  var rwBar = document.getElementById('pcs-rewrite-bar');
  if (rwBar) rwBar.style.display = 'block';
};

window.exitCommentSelectMode = function() {
  var st = window._commentSelectMode;
  st.active = false;
  st.selected.clear();

  var strip = document.getElementById('pcs-select-strip');
  if (strip) {
    strip.classList.remove('pcs-ss-active');
    var textEl = strip.querySelector('.pcs-ss-text');
    if (textEl) textEl.textContent = 'Select comments to rewrite caption';
  }

  document.querySelectorAll('#pcs-comments-list .pcs-sel-check').forEach(function(el) {
    el.remove();
  });
  document.querySelectorAll('#pcs-comments-list .pcs-comment-item').forEach(function(item) {
    item.classList.remove('pcs-sel-on', 'pcs-sel-off');
  });

  var rwBar = document.getElementById('pcs-rewrite-bar');
  if (rwBar) rwBar.style.display = 'none';

  var ibar = document.querySelector('#pcs-pane-client .pcs-ibar-wrap.client');
  if (ibar) ibar.style.display = '';

  var sendBtn = document.getElementById('pcs-rewrite-send');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '&#x2726; Select comments first'; }
};

window.toggleCommentSelection = function(commentId) {
  var st = window._commentSelectMode;
  if (!st.active) return;

  if (st.selected.has(commentId)) {
    st.selected.delete(commentId);
  } else {
    st.selected.add(commentId);
  }

  document.querySelectorAll('#pcs-comments-list .pcs-comment-item').forEach(function(item) {
    var cid = item.getAttribute('data-comment-id');
    if (st.selected.has(cid)) {
      item.classList.add('pcs-sel-on');
      item.classList.remove('pcs-sel-off');
    } else {
      item.classList.remove('pcs-sel-on');
      item.classList.add('pcs-sel-off');
    }
  });

  window._updateSelectionCount();
};

window._updateSelectionCount = function() {
  var st = window._commentSelectMode;
  var count = st.selected.size;

  var strip = document.getElementById('pcs-select-strip');
  if (strip) {
    var textEl = strip.querySelector('.pcs-ss-text');
    if (textEl) {
      var total = document.querySelectorAll('#pcs-comments-list .pcs-comment-item').length;
      textEl.innerHTML = '<em>' + count + '</em> of ' + total + ' selected';
    }
  }

  var sendBtn = document.getElementById('pcs-rewrite-send');
  if (sendBtn) {
    if (count > 0) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '&#x2726; Rewrite with ' + count + ' comment' + (count === 1 ? '' : 's');
    } else {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '&#x2726; Select comments first';
    }
  }
};

window.submitSelectedComments = function() {
  var st = window._commentSelectMode;
  if (st.selected.size === 0) return;

  var post = window.AppState.pcs.post;
  if (!post) return;

  var allComments = post.post_comments || post._comments || [];
  var selectedComments = [];
  st.selected.forEach(function(cid) {
    var c = allComments.find(function(x) { return x.id === cid; });
    if (c) {
      selectedComments.push({
        author: c.author || 'Unknown',
        role: c.author_role || 'client',
        text: c.message || '',
        created_at: c.created_at || ''
      });
    }
  });

  if (!selectedComments.length) {
    document.querySelectorAll('#pcs-comments-list .pcs-comment-item').forEach(function(item) {
      if (!st.selected.has(item.getAttribute('data-comment-id'))) return;
      var textEl = item.querySelector('.pcs-comment-text');
      var authorEl = item.querySelector('.pcs-comment-author');
      if (textEl) {
        selectedComments.push({
          author: authorEl ? authorEl.textContent : 'Unknown',
          role: 'client',
          text: textEl.textContent.trim()
        });
      }
    });
  }

  window.exitCommentSelectMode();

  if (typeof openCaptionWorkspace === 'function') {
    openCaptionWorkspace('rewrite', {
      postId: post.post_id || post.id,
      caption: post.caption,
      title: post.title || '',
      comments: selectedComments
    });
  }
};

// ─── strip visibility on tab switch / render ─────────────────

window._updateSelectStripVisibility = function() {
  var strip = document.getElementById('pcs-select-strip');
  if (!strip) return;
  var role = (window.AppState.user.effectiveRole || '').toLowerCase();
  var aiEnabled = !!(window.AppState.workspace && window.AppState.workspace.ai_chat);
  strip.style.display = (role === 'admin' || aiEnabled) ? 'flex' : 'none';
};

// ─── event wiring ────────────────────────────────────────────

(function _selectWireEvents() {
  document.addEventListener('click', function(e) {
    var target = e.target;

    if (target.closest && target.closest('[data-action="pcs-exit-select"]')) {
      e.stopPropagation();
      window.exitCommentSelectMode();
      return;
    }

    if (target.closest && target.closest('[data-action="pcs-enter-select"]')) {
      if (window._commentSelectMode.active) return;
      e.stopPropagation();
      window.enterCommentSelectMode();
      return;
    }

    if (target.id === 'pcs-rewrite-send') {
      e.stopPropagation();
      window.submitSelectedComments();
      return;
    }

    if (window._commentSelectMode.active) {
      var commentItem = target.closest && target.closest('.pcs-comment-item');
      if (commentItem && commentItem.closest('#pcs-comments-list')) {
        e.stopPropagation();
        e.preventDefault();
        var cid = commentItem.getAttribute('data-comment-id');
        if (cid) window.toggleCommentSelection(cid);
        return;
      }
    }
  }, true);
})();
