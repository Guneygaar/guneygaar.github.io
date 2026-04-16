/* ═══════════════════════════════════════════════════════════════
   pcs-claude-caption.js — Caption Claude Workspace
   Full-screen modal for AI caption editing with conversation
   memory, editable drafts, refinement chips, and live cost meter.
   ═══════════════════════════════════════════════════════════════ */
console.log('LOADED:', 'pcs-claude-caption.js');

window._captionWS = {
  isOpen: false,
  messages: [],
  sessionCost: 0,
  postId: null,
  mode: null,
  _rewriteComments: null,
  correctionsPrompt: ''
};

var _CW_USD_TO_INR = 100;

// ─── cost helpers ────────────────────────────────────────────

function _cwCalcINR(inputTokens, outputTokens) {
  var usd = (inputTokens * 3 / 1000000) + (outputTokens * 15 / 1000000);
  return usd * _CW_USD_TO_INR;
}

function _cwFormatINR(v) {
  if (v < 1) return '\u20B9' + v.toFixed(2);
  if (v < 1000) return '\u20B9' + Math.round(v);
  return '\u20B9' + Math.round(v).toLocaleString('en-IN');
}

// ─── open workspace ──────────────────────────────────────────

window.openCaptionWorkspace = async function(mode, context) {
  var overlay = document.getElementById('caption-workspace-overlay');
  if (!overlay) return;

  var ws = window._captionWS;
  var isResume = mode === 'resume' && ws.messages.length > 0;

  if (!isResume) {
    ws.messages = [];
    ws.sessionCost = 0;
    ws.postId = context.postId || null;
    ws.mode = mode;
    ws._rewriteComments = null;
  }
  ws.isOpen = true;

  overlay.style.display = 'flex';
  overlay.style.transform = 'translateY(100%)';
  overlay.offsetHeight; // force reflow
  overlay.style.transition = 'transform 280ms ease';
  overlay.style.transform = 'translateY(0)';

  var titleEl = document.getElementById('cw-context-title');
  if (titleEl) titleEl.textContent = context.title || 'Untitled post';

  _cwUpdateSessionMeter();
  _cwFetchCostTotals();
  if (!isResume) _cwLoadCorrections();
  _cwRenderThread();

  if (!isResume) {
    if (mode === 'rewrite') {
      ws._rewriteComments = (context.comments || []).map(function(c) {
        return { author: c.author || 'Unknown', role: (c.role || c.author_role || 'client').toLowerCase(), text: c.text || c.message || '' };
      });
      var commentList = ws._rewriteComments.map(function(c) {
        return c.author + ': ' + c.text;
      }).join('\n');
      var apiMsg = 'Current caption:\n' + (context.caption || '(empty)') +
        '\n\nHere are the comments on this post:\n' + (commentList || 'No comments yet.') +
        '\n\nRewrite the caption addressing the feedback. Return ONLY the revised caption.';
      var displayMsg = 'Rewrite the caption addressing the feedback above.';
      ws.messages.push({ role: 'user', content: apiMsg, _display: displayMsg });
      _cwRenderThread();
      _cwScrollToBottom();
      var thread = document.getElementById('cw-thread');
      if (thread) { thread.insertAdjacentHTML('beforeend', _cwTypingHtml()); _cwScrollToBottom(); }
      var featureTag = 'chat';
      var rwApiMsgs = ws.messages.map(function(m) { return { role: m.role, content: m.content }; });
      if (ws.correctionsPrompt && rwApiMsgs.length > 0) {
        rwApiMsgs[0] = { role: rwApiMsgs[0].role, content: rwApiMsgs[0].content + ws.correctionsPrompt };
      }
      var result = await _callSrtdAI(featureTag, rwApiMsgs, ws.postId);
      var typingEl = thread && thread.querySelector('.cw-typing');
      if (typingEl) typingEl.remove();
      if (result && result.success) {
        ws.messages.push({ role: 'assistant', content: result.content || '' });
        var inTok = result.input_tokens || (result.usage && result.usage.input) || 0;
        var outTok = result.output_tokens || (result.usage && result.usage.output) || 0;
        ws.sessionCost += _cwCalcINR(inTok, outTok);
        _cwUpdateSessionMeter();
      } else {
        ws.messages.push({ role: 'assistant', content: 'Error: ' + ((result && result.error) || 'Request failed. Try again.') });
      }
      _cwRenderThread();
      _cwScrollToBottom();
      return;
    } else if (mode === 'write') {
      var msg2 = 'Generate 3 alternative caption options for this post: ' +
        (context.title || '') + '.' +
        (context.caption ? '\nCurrent caption: ' + context.caption : '') +
        '\n\nReturn exactly 3 numbered options. No preamble.';
      window.sendCaptionMessage(msg2);
    } else if (mode === 'qc') {
      var msg3 = 'QC this LinkedIn caption against the brand guide. Caption:\n\n' +
        (context.caption || '(no caption)') +
        '\n\nReturn a structured verdict with PASS or FLAG for each check.';
      window.sendCaptionMessage(msg3);
    }
    // 'chat' mode: user types first message
  }
};

// ─── close workspace ─────────────────────────────────────────

window.closeCaptionWorkspace = function() {
  var overlay = document.getElementById('caption-workspace-overlay');
  if (!overlay) return;
  overlay.style.transition = 'transform 280ms ease';
  overlay.style.transform = 'translateY(100%)';
  setTimeout(function() {
    overlay.style.display = 'none';
    overlay.style.transition = '';
  }, 290);
  window._captionWS.isOpen = false;
};

// ─── send message ────────────────────────────────────────────

window.sendCaptionMessage = async function(text) {
  if (!text || !text.trim()) return;
  var ws = window._captionWS;

  ws.messages.push({ role: 'user', content: text.trim() });
  _cwRenderThread();
  _cwScrollToBottom();

  var thread = document.getElementById('cw-thread');
  if (thread) {
    thread.insertAdjacentHTML('beforeend', _cwTypingHtml());
    _cwScrollToBottom();
  }

  var post = ws.postId ? (window.AppState.posts.all || []).find(function(p) {
    return (p.post_id || p.id) === ws.postId;
  }) : null;

  var systemCtx = '';
  if (post) {
    systemCtx = 'Post title: ' + (post.title || '') + '\n';
    if (post.caption) systemCtx += 'Current caption: ' + post.caption + '\n';
    if (post.content_pillar) systemCtx += 'Content pillar: ' + post.content_pillar + '\n';
  }

  var featureTag = ws.mode === 'qc' ? 'qc' : ws.mode === 'write' ? 'writer' : 'chat';

  var apiMessages = ws.messages.map(function(m) { return { role: m.role, content: m.content }; });
  if (ws.correctionsPrompt && apiMessages.length > 0) {
    apiMessages[0] = { role: apiMessages[0].role, content: apiMessages[0].content + ws.correctionsPrompt };
  }

  var result = await _callSrtdAI(featureTag, apiMessages, ws.postId);

  var typingEl = thread && thread.querySelector('.cw-typing');
  if (typingEl) typingEl.remove();

  if (result && result.success) {
    ws.messages.push({ role: 'assistant', content: result.content || '' });
    var inTok = result.input_tokens || (result.usage && result.usage.input) || 0;
    var outTok = result.output_tokens || (result.usage && result.usage.output) || 0;
    var costINR = _cwCalcINR(inTok, outTok);
    ws.sessionCost += costINR;
    _cwUpdateSessionMeter();
  } else {
    ws.messages.push({ role: 'assistant', content: 'Error: ' + ((result && result.error) || 'Request failed. Try again.') });
  }
  _cwRenderThread();
  _cwScrollToBottom();
};

// ─── render thread ───────────────────────────────────────────

function _cwRenderThread() {
  var thread = document.getElementById('cw-thread');
  if (!thread) return;
  var ws = window._captionWS;
  var html = '';
  var draftNum = 0;

  var post = ws.postId ? (window.AppState.posts.all || []).find(function(p) { return (p.post_id || p.id) === ws.postId; }) : null;
  var captionText = post ? post.caption : '';
  html += '<div class="cw-caption-block">' +
    '<div class="cw-caption-lbl">Current caption</div>' +
    (captionText
      ? '<div class="cw-caption-text">' + _cwEsc(captionText) + '</div>'
      : '<div class="cw-caption-text empty">No caption yet</div>') +
  '</div>';

  var commentsRendered = false;
  for (var i = 0; i < ws.messages.length; i++) {
    var m = ws.messages[i];
    if (m.role === 'user') {
      if (!commentsRendered && ws._rewriteComments && ws._rewriteComments.length > 0 && i === 0) {
        html += _cwBuildCommentsBlock(ws._rewriteComments);
        commentsRendered = true;
      }
      var displayText = m._display || m.content;
      html += '<div class="cw-msg cw-msg-user"><div class="cw-msg-bubble">' +
        _cwEsc(displayText).replace(/\n/g, '<br>') + '</div></div>';
    } else if (m.role === 'assistant') {
      draftNum++;
      var isLatest = (i === ws.messages.length - 1);
      var costLabel = '';
      html += '<div class="cw-msg cw-msg-claude">' +
        '<div class="cw-draft">' +
          '<div class="cw-draft-header">' +
            '<span class="cw-draft-label">\u2726 Claude \u00B7 Draft ' + draftNum + '</span>' +
            costLabel +
          '</div>' +
          '<div class="cw-draft-body" ' + (isLatest ? 'contenteditable="true"' : '') +
            ' data-draft="' + draftNum + '"' +
            ' data-original="' + _cwEsc(m.content).replace(/"/g, '&quot;') + '">' +
            _cwEsc(m.content).replace(/\n/g, '<br>') +
          '</div>' +
          (isLatest
            ? '<div class="cw-draft-hint">Tap to edit before using</div>'
            : '') +
          '<div class="cw-chips">' +
            _cwChipHtml('shorter', draftNum, isLatest) +
            _cwChipHtml('warmer', draftNum, isLatest) +
            _cwChipHtml('sharper', draftNum, isLatest) +
            (isLatest ? '<button class="cw-chip cw-chip-use" onclick="window._cwHandleChip(\'use\',' + draftNum + ')">\u2713 Use this</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }
  }

  if (!ws.messages.length) {
    html = '<div class="cw-empty">' +
      '<div class="cw-empty-icon">\u2726</div>' +
      '<div class="cw-empty-text">Ask anything about this caption, or let Claude write one for you.</div>' +
    '</div>';
  }

  thread.innerHTML = html;
}

function _cwChipHtml(type, draftNum, isLatest) {
  var labels = { shorter: 'Shorter', warmer: 'Warmer', sharper: 'Sharper' };
  return '<button class="cw-chip' + (isLatest ? '' : ' cw-chip-dim') + '" ' +
    (isLatest ? 'onclick="window._cwHandleChip(\'' + type + '\',' + draftNum + ')"' : 'disabled') +
    '>' + labels[type] + '</button>';
}

function _cwTypingHtml() {
  return '<div class="cw-typing"><span class="cw-typing-dot"></span><span class="cw-typing-dot"></span><span class="cw-typing-dot"></span></div>';
}

function _cwEsc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _cwScrollToBottom() {
  var thread = document.getElementById('cw-thread');
  if (thread) setTimeout(function() { thread.scrollTop = thread.scrollHeight; }, 50);
}

// ─── comment block builder ───────────────────────────────────

function _cwBuildCommentsBlock(comments) {
  var SHOW = 4;
  var roleMap = { client: 'client', servicing: 'servicing', admin: 'admin', creative: 'creative' };
  var html = '<div class="cw-comments-block">' +
    '<div class="cw-comments-header">\u2726 ' + comments.length + ' COMMENT' + (comments.length === 1 ? '' : 'S') + ' LOADED</div>';
  for (var i = 0; i < comments.length; i++) {
    var c = comments[i];
    var cls = roleMap[c.role] || 'client';
    var label = (c.role || 'client').charAt(0).toUpperCase() + (c.role || 'client').slice(1);
    html += '<div class="cw-cmt-item' + (i >= SHOW ? ' cw-cmt-hidden' : '') + '">' +
      '<span class="cw-cmt-author cw-cmt-' + cls + '">' + _cwEsc(label) + '</span>' +
      '<span class="cw-cmt-text">' + _cwEsc(c.text) + '</span>' +
    '</div>';
  }
  if (comments.length > SHOW) {
    html += '<button class="cw-cmt-more" onclick="this.parentNode.querySelectorAll(\'.cw-cmt-hidden\').forEach(function(e){e.classList.remove(\'cw-cmt-hidden\')});this.remove()">Show ' + (comments.length - SHOW) + ' more \u2193</button>';
  }
  html += '</div>';
  return html;
}

// ─── chip handler ────────────────────────────────────────────

window._cwHandleChip = function(chipType, draftNum) {
  if (chipType === 'use') {
    var draftEl = document.querySelector('.cw-draft-body[data-draft="' + draftNum + '"][contenteditable="true"]');
    if (!draftEl) {
      var allDrafts = document.querySelectorAll('.cw-draft-body[data-draft="' + draftNum + '"]');
      draftEl = allDrafts.length ? allDrafts[allDrafts.length - 1] : null;
    }
    var text = draftEl ? draftEl.innerText.trim() : '';
    if (!text) return;
    var original = draftEl ? (draftEl.getAttribute('data-original') || '') : '';
    _cwCaptureCorrection(original, text);
    window._cwApplyDraft(text);
    return;
  }
  var label = chipType.charAt(0).toUpperCase() + chipType.slice(1);
  window.sendCaptionMessage('Make draft ' + draftNum + ' ' + label.toLowerCase() + '. Keep the same structure. Return ONLY the revised caption.');
};

// ─── apply draft to caption ──────────────────────────────────

window._cwApplyDraft = async function(text) {
  var ws = window._captionWS;
  var post = (window.AppState.posts.all || []).find(function(p) {
    return (p.post_id || p.id) === ws.postId;
  });
  if (!post) {
    if (typeof showToast === 'function') showToast('Post not found', 'error');
    return;
  }
  var postId = post.post_id || post.id;

  post._isSaving = true;
  if (typeof _startSaveTimeout === 'function') _startSaveTimeout(post, postId);

  try {
    await apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        caption: text,
        updated_at: new Date().toISOString(),
        updated_by: window.AppState.user.email || ''
      })
    });
    Object.assign(post, { caption: text, updated_at: new Date().toISOString() });
    if (typeof _clearSaveTimeout === 'function') _clearSaveTimeout(post);
    post._isSaving = false;
    window.closeCaptionWorkspace();
    if (typeof _renderPCS === 'function') _renderPCS(postId);
    if (typeof showToast === 'function') showToast('Caption updated', 'success');
  } catch (err) {
    if (typeof _clearSaveTimeout === 'function') _clearSaveTimeout(post);
    post._isSaving = false;
    window.logError && window.logError(err && err.message, err && err.stack, 'cw-apply-draft');
    if (typeof showToast === 'function') showToast('Failed to update caption', 'error');
  }
};

// ─── AI memory: edit correction capture ─────────────────

function _cwNormalize(s) {
  return (s || '').trim().replace(/\s+/g, ' ');
}

function _cwCharDiff(a, b) {
  var count = 0;
  var len = Math.max(a.length, b.length);
  for (var i = 0; i < len; i++) {
    if (a.charAt(i) !== b.charAt(i)) count++;
  }
  return count + Math.abs(a.length - b.length);
}

function _cwCaptureCorrection(original, edited) {
  try {
    var normOrig = _cwNormalize(original);
    var normEdit = _cwNormalize(edited);
    if (normOrig === normEdit) return;
    if (normEdit.length < 10) return;
    if (_cwCharDiff(normOrig, normEdit) < 5) return;

    var payload = {
      workspace_id: 'default',
      type: 'edit_correction',
      content: JSON.stringify({
        original: original.slice(0, 500),
        edited: edited.slice(0, 500)
      }),
      post_id: window._captionWS.postId || null
    };

    apiFetch('/ai_memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(payload)
    }).catch(function(err) {
      console.warn('[cw] correction save failed:', err && err.message);
    });
  } catch (e) {
    console.warn('[cw] correction capture error:', e && e.message);
  }
}

// ─── AI memory: load corrections into prompt ────────────

async function _cwLoadCorrections() {
  try {
    var rows = await apiFetch(
      '/ai_memory?type=eq.edit_correction&workspace_id=eq.default&order=created_at.desc&limit=10&select=content'
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      window._captionWS.correctionsPrompt = '';
      return;
    }
    var lines = [];
    rows.forEach(function(r) {
      try {
        var c = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
        if (c && c.original && c.edited) {
          var origPreview = c.original.length > 100 ? c.original.slice(0, 100) + '...' : c.original;
          var editPreview = c.edited.length > 100 ? c.edited.slice(0, 100) + '...' : c.edited;
          lines.push('- User changed: "' + origPreview + '" \u2192 "' + editPreview + '"');
        }
      } catch (_) {}
    });
    if (lines.length > 0) {
      window._captionWS.correctionsPrompt =
        '\n\nSTYLE CORRECTIONS FROM THIS USER (apply these patterns to all future drafts):\n' +
        lines.join('\n');
    } else {
      window._captionWS.correctionsPrompt = '';
    }
  } catch (e) {
    window._captionWS.correctionsPrompt = '';
  }
}

// ─── cost totals ─────────────────────────────────────────────

function _cwUpdateSessionMeter() {
  var el = document.getElementById('cw-session-cost');
  if (el) el.textContent = _cwFormatINR(window._captionWS.sessionCost);
}

async function _cwFetchCostTotals() {
  try {
    var now = new Date();
    var todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    var todayRows = await apiFetch(
      '/ai_usage?select=cost_usd&created_at=gte.' + todayMidnight
    );
    var monthRows = await apiFetch(
      '/ai_usage?select=cost_usd&created_at=gte.' + monthStart
    );

    var todayUSD = 0;
    var monthUSD = 0;
    if (Array.isArray(todayRows)) todayRows.forEach(function(r) { todayUSD += (r.cost_usd || 0); });
    if (Array.isArray(monthRows)) monthRows.forEach(function(r) { monthUSD += (r.cost_usd || 0); });

    var todayEl = document.getElementById('cw-today-cost');
    var monthEl = document.getElementById('cw-month-cost');
    if (todayEl) todayEl.textContent = _cwFormatINR(todayUSD * _CW_USD_TO_INR);
    if (monthEl) monthEl.textContent = _cwFormatINR(monthUSD * _CW_USD_TO_INR);
  } catch (e) {
    // non-critical
  }
}

// ─── input handling ──────────────────────────────────────────

(function _cwWireInput() {
  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'cw-send') {
      var input = document.getElementById('cw-input');
      if (input && input.value.trim()) {
        window.sendCaptionMessage(input.value);
        input.value = '';
        input.style.height = 'auto';
      }
    }
    if (e.target && e.target.id === 'cw-back') {
      window.closeCaptionWorkspace();
    }
    if (e.target && e.target.dataset && e.target.dataset.action === 'cw-qc') {
      var ws = window._captionWS;
      var post = ws.postId ? (window.AppState.posts.all || []).find(function(p) { return (p.post_id || p.id) === ws.postId; }) : null;
      var cap = post ? post.caption : '';
      if (!cap) { if (typeof showToast === 'function') showToast('No caption to QC', 'error'); return; }
      window.sendCaptionMessage('QC this LinkedIn caption against the brand guide. Caption:\n\n' + cap + '\n\nReturn a structured verdict with PASS or FLAG for each check.');
    }
    if (e.target && e.target.dataset && e.target.dataset.action === 'cw-ask') {
      var cwInput = document.getElementById('cw-input');
      if (cwInput) cwInput.focus();
    }
  });
  document.addEventListener('keydown', function(e) {
    if (e.target && e.target.id === 'cw-input' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      var input = e.target;
      if (input.value.trim()) {
        window.sendCaptionMessage(input.value);
        input.value = '';
        input.style.height = 'auto';
      }
    }
  });
  document.addEventListener('input', function(e) {
    if (e.target && e.target.id === 'cw-input') {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
      var btn = document.getElementById('cw-send');
      if (btn) btn.style.opacity = e.target.value.trim() ? '1' : '0.55';
    }
  });
})();
