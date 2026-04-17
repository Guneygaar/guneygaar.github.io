/* ═══════════════════════════════════════════════════════════════
   pcs-polish.js — Polish Reply half-modal
   Tap ✦ in the comment input bar to have Claude rewrite a draft
   comment professionally before sending.
   ═══════════════════════════════════════════════════════════════ */
console.log('LOADED:', 'pcs-polish.js');

window._polishState = {
  isOpen: false,
  rawText: '',
  polishedText: '',
  zone: null,
  replyTo: null,
  postId: null
};

// Scoped lookup for the notification thread drawer's reply input —
// it lives on `.notif-item.expanded .reply-input` (no unique ID, the
// expanded card is the scope). Returns null when no drawer is open.
function _polishFindNotifInput() {
  return document.querySelector('.notif-item.expanded .reply-input');
}
function _polishFindNotifExpandedItem() {
  return document.querySelector('.notif-item.expanded');
}

window.openPolishModal = async function(zone) {
  var st = window._polishState;
  var input;

  if (zone === 'notif') {
    // Defensive admin check — the button is only rendered for Admin
    // in `_buildItem`, but a cached page shouldn't let a downgraded
    // user trigger the modal either.
    var _role = window.AppState && window.AppState.user && window.AppState.user.effectiveRole;
    if (_role !== 'Admin') {
      console.warn('Polish requires admin role');
      return;
    }
    input = _polishFindNotifInput();
    if (!input || !input.value.trim()) {
      if (typeof window.showToast === 'function')
        window.showToast('Type a draft first, then tap \u2726', 'error');
      return;
    }
    var expandedItem = _polishFindNotifExpandedItem();
    var notifPostId = expandedItem ? expandedItem.getAttribute('data-post-id') : null;
    if (!notifPostId) {
      if (typeof window.showToast === 'function')
        window.showToast('Open a comment thread first', 'error');
      return;
    }
    st.rawText = input.value.trim();
    st.zone = 'notif';
    st.polishedText = '';
    st.isOpen = true;
    st.postId = notifPostId;
    st.replyTo = null;
  } else {
    var inputId = zone === 'notes' ? 'pcs-note-input' : 'pcs-comment-input';
    input = document.getElementById(inputId);
    if (!input || !input.value.trim()) return;

    st.rawText = input.value.trim();
    st.zone = zone;
    st.polishedText = '';
    st.isOpen = true;

    var postIdEl = document.getElementById('pcs-post-id');
    st.postId = postIdEl ? postIdEl.value : null;

    var replyTagId = zone === 'notes' ? 'pcs-note-reply-tag' : 'pcs-client-reply-tag';
    var replyNameId = zone === 'notes' ? 'pcs-note-reply-name' : 'pcs-client-reply-name';
    var replyTag = document.getElementById(replyTagId);
    var replyName = document.getElementById(replyNameId);
    st.replyTo = (replyTag && replyTag.style.display !== 'none' && replyName && replyName.textContent)
      ? { author: replyName.textContent }
      : null;
  }

  var overlay = document.getElementById('pcs-polish-overlay');
  if (!overlay) return;
  overlay.style.display = 'block';

  var rawEl = document.getElementById('polish-raw-text');
  if (rawEl) rawEl.textContent = st.rawText;

  var resultEl = document.getElementById('polish-result');
  if (resultEl) resultEl.textContent = '';

  var replyLabel = document.getElementById('polish-reply-label');
  if (replyLabel) replyLabel.textContent = st.replyTo ? 'Replying to ' + st.replyTo.author : '';

  var sendBtn = document.getElementById('polish-send');
  if (sendBtn) { sendBtn.textContent = 'Polishing\u2026'; sendBtn.style.opacity = '0.4'; sendBtn.style.pointerEvents = 'none'; }

  requestAnimationFrame(function() {
    overlay.classList.add('open');
  });

  var prompt = 'Rewrite this comment reply professionally. Keep the exact same meaning and intent. Be direct, constructive, and brief. Do not add pleasantries or filler. Return ONLY the rewritten text, nothing else.';
  if (st.replyTo) {
    var replyToItem = _polishFindReplyComment(zone);
    if (replyToItem) prompt += '\n\nComment being replied to: "' + replyToItem + '"';
  }
  prompt += '\n\nMy draft reply: "' + st.rawText + '"';

  var messages = [{ role: 'user', content: prompt }];
  var result = await _callSrtdAI('chat', messages, st.postId);

  if (result && result.success) {
    st.polishedText = (result.content || '').trim();
  } else {
    st.polishedText = st.rawText;
  }

  var resultEl2 = document.getElementById('polish-result');
  if (resultEl2) resultEl2.textContent = st.polishedText;

  var sendBtn2 = document.getElementById('polish-send');
  if (sendBtn2) { sendBtn2.innerHTML = '&#x2726; Send reply'; sendBtn2.style.opacity = '1'; sendBtn2.style.pointerEvents = ''; }
};

function _polishFindReplyComment(zone) {
  var listId = zone === 'notes' ? 'pcs-notes-list' : 'pcs-comments-list';
  var list = document.getElementById(listId);
  if (!list) return '';
  var highlighted = list.querySelector('.pcs-comment-replying-to');
  if (highlighted) {
    var textEl = highlighted.querySelector('.pcs-comment-text');
    if (textEl) return textEl.textContent.trim();
  }
  return '';
}

window.closePolishModal = function() {
  var overlay = document.getElementById('pcs-polish-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  setTimeout(function() {
    overlay.style.display = 'none';
  }, 260);
  window._polishState.isOpen = false;
};

window.undoPolish = function() {
  window.closePolishModal();
};

window.sendPolished = function() {
  var st = window._polishState;
  var resultEl = document.getElementById('polish-result');
  var finalText = resultEl ? resultEl.innerText.trim() : st.polishedText;
  if (!finalText) return;

  // Notification-zone flow is scoped to the currently-expanded
  // `.notif-item` — the textarea has no unique ID, so we pump the
  // polished text into the class-scoped input and click its own
  // `.reply-send` button, which runs `_notifSubmitReply` (10-ui.js)
  // and POSTs to `/post_comments` instead of the PCS submission path.
  if (st.zone === 'notif') {
    var notifInput = _polishFindNotifInput();
    if (!notifInput) return;
    notifInput.value = finalText;
    // Fire `input` so `_notifReplyInputResize` enables `.reply-send.active`.
    notifInput.dispatchEvent(new Event('input', { bubbles: true }));
    window.closePolishModal();
    setTimeout(function() {
      var sendBtn = document.querySelector('.notif-item.expanded .reply-send');
      if (sendBtn) sendBtn.click();
    }, 100);
    return;
  }

  var inputId = st.zone === 'notes' ? 'pcs-note-input' : 'pcs-comment-input';
  var input = document.getElementById(inputId);
  if (input) input.value = finalText;

  window.closePolishModal();

  setTimeout(function() {
    var sendId = st.zone === 'notes' ? 'pcs-send-btn-note' : 'pcs-send-btn-client';
    var sendBtn = document.getElementById(sendId);
    if (sendBtn) sendBtn.click();
  }, 100);
};

(function _polishWireEvents() {
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('pcs-ibar-polish')) {
      e.preventDefault();
      e.stopPropagation();
      window.openPolishModal(e.target.dataset.zone || 'client');
      return;
    }
    if (e.target && e.target.id === 'polish-undo') {
      window.undoPolish();
      return;
    }
    if (e.target && e.target.id === 'polish-send') {
      window.sendPolished();
      return;
    }
    if (e.target && (e.target.id === 'pcs-polish-backdrop' || e.target.dataset.action === 'polish-close')) {
      window.closePolishModal();
      return;
    }
  });
})();
