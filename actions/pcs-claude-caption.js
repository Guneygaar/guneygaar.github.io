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
  correctionsPrompt: '',
  memoryPrompt: '',
  caption: ''
};

var _CW_USD_TO_INR = 100;

function _cwBuildAiOpts() {
  var ws = window._captionWS;
  var mem = ws.memoryPrompt || '';
  var cap = ws.caption || '';
  var combined = mem + (cap ? (mem ? '\n\n' : '') + 'CURRENT CAPTION:\n' + cap : '');
  return combined ? { memory_context: combined } : undefined;
}

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
    ws.caption = context.caption || '';
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
  if (!isResume) _cwLoadMemory();
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
      var rwApiMsgs = ws.messages
        .filter(function(m) { return m.role === 'user' || m.role === 'assistant'; })
        .map(function(m) { return { role: m.role, content: m.content }; });
      if (ws.correctionsPrompt && rwApiMsgs.length > 0) {
        rwApiMsgs[0] = { role: rwApiMsgs[0].role, content: rwApiMsgs[0].content + ws.correctionsPrompt };
      }
      var rwAiOpts = _cwBuildAiOpts();
      var result = await _callSrtdAI(featureTag, rwApiMsgs, ws.postId, rwAiOpts);
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
        '\n\nReturn a structured verdict with PASS or FLAG for each check. ' +
        'If you are providing a corrected caption, wrap ONLY that corrected caption in <caption>...</caption> tags at the end.';
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

var _CW_MEMORY_REGEX = /^(memoris[ez]e|remember(?:\s+this)?|never\s+forget|always(?:\s+do)?|never(?:\s+do)?|from\s+now\s+on|henceforth|make\s+sure(?:\s+you)?|going\s+forward|(?:new\s+)?rule|note|important)\s*:\s*([\s\S]+)$/i;

window.sendCaptionMessage = async function(text) {
  if (!text || !text.trim()) return;
  var ws = window._captionWS;

  var trimmed = text.trim();
  var match = trimmed.match(_CW_MEMORY_REGEX);
  if (match) {
    var trigger = match[1];
    var instruction = match[2].trim();
    if (instruction.length > 3) {
      _cwSaveMemory(trigger, instruction);
      return;
    }
  }

  ws.messages.push({ role: 'user', content: trimmed });
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

  var apiMessages = ws.messages
    .filter(function(m) { return m.role === 'user' || m.role === 'assistant'; })
    .map(function(m) { return { role: m.role, content: m.content }; });
  if (ws.correctionsPrompt && apiMessages.length > 0) {
    apiMessages[0] = { role: apiMessages[0].role, content: apiMessages[0].content + ws.correctionsPrompt };
  }

  var aiOpts = _cwBuildAiOpts();
  var result = await _callSrtdAI(featureTag, apiMessages, ws.postId, aiOpts);

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
    } else if (m.role === 'memory') {
      html += '<div class="cw-memorized">' + _cwEsc(m.content) + '</div>';
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
            ' data-raw="' + _cwEsc(m.content).replace(/"/g, '&quot;') + '"' +
            ' data-original="' + _cwEsc(m.content).replace(/"/g, '&quot;') + '">' +
            _cwFormatAssistantHtml(m.content) +
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
    html += '<div class="cw-empty">' +
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

function _cwFormatAssistantHtml(raw) {
  var src = raw || '';
  var hasTag = /<caption>[\s\S]*?<\/caption>/i.test(src);
  if (hasTag) {
    var out = '';
    var lastIdx = 0;
    var re = /<caption>([\s\S]*?)<\/caption>/gi;
    var mm;
    while ((mm = re.exec(src)) !== null) {
      out += _cwEsc(src.slice(lastIdx, mm.index)).replace(/\n/g, '<br>');
      out += '<div class="cw-caption-output">' + _cwEsc(mm[1]).replace(/\n/g, '<br>') + '</div>';
      lastIdx = mm.index + mm[0].length;
    }
    out += _cwEsc(src.slice(lastIdx)).replace(/\n/g, '<br>');
    return out;
  }
  return _cwEsc(src).replace(/\n/g, '<br>');
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

// ─── caption extraction (tag-based with legacy fallback) ────

function _cwExtractCaption(fullText) {
  var text = fullText || '';

  var tagRegex = /<caption>([\s\S]*?)<\/caption>/gi;
  var matches = [];
  var m;
  while ((m = tagRegex.exec(text)) !== null) {
    matches.push(m[1]);
  }

  if (matches.length > 0) {
    return matches[matches.length - 1].trim();
  }

  var sepIdx = text.lastIndexOf('\n---\n');
  if (sepIdx !== -1) {
    text = text.substring(sepIdx + 5);
  }

  text = text.replace(/^\s*\*{0,2}(REVISED|UPDATED|REWRITTEN|NEW|CORRECTED|HERE'S THE|HERE IS THE|FINAL)[\s\w]*:?\*{0,2}\s*\n/i, '');

  var footerPatterns = [
    /\n\s*\*{0,2}(Key improvements|Key changes|Changes made|What I changed|Summary of changes|Summary|Notes|Improvements|Changes|What changed|Edits made|Revisions)[\s:]*\*{0,2}\s*\n[\s\S]*/i,
    /\n\s*\*{0,2}(Here'?s? what I|I'?ve? made the following|The main changes|I'?ve? (?:updated|revised|changed|improved))[\s\S]*/i
  ];

  for (var i = 0; i < footerPatterns.length; i++) {
    text = text.replace(footerPatterns[i], '');
  }

  text = text.replace(/\*\*/g, '');

  return text.trim();
}

// ─── chip handler ────────────────────────────────────────────

window._cwHandleChip = function(chipType, draftNum) {
  if (chipType === 'use') {
    var draftEl = document.querySelector('.cw-draft-body[data-draft="' + draftNum + '"][contenteditable="true"]');
    if (!draftEl) {
      var allDrafts = document.querySelectorAll('.cw-draft-body[data-draft="' + draftNum + '"]');
      draftEl = allDrafts.length ? allDrafts[allDrafts.length - 1] : null;
    }
    var rawSource = draftEl ? (draftEl.getAttribute('data-raw') || '') : '';
    var rawText = rawSource || (draftEl ? draftEl.innerText : '');
    if (!rawText || !rawText.trim()) return;

    var hasTag = /<caption>[\s\S]*?<\/caption>/i.test(rawSource);
    if (!hasTag && draftEl) {
      var edited = draftEl.innerText;
      if (edited && edited.trim()) rawText = edited;
    }

    var text = _cwExtractCaption(rawText);
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
    ws.caption = text;
    if (typeof showToast === 'function') showToast('Caption updated', 'success');
    if (typeof _renderPCS === 'function') _renderPCS(postId);
    setTimeout(function() { window.closeCaptionWorkspace(); }, 500);
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

// ─── AI memory: explicit user instruction capture ──────

function _cwSaveMemory(trigger, instruction) {
  var ws = window._captionWS;

  ws.messages.push({ role: 'user', content: trigger + ': ' + instruction });
  ws.messages.push({ role: 'memory', content: '\u2726 Locked in. Claude will follow this rule in every future session.' });

  apiFetch('/ai_memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      workspace_id: 'default',
      type: 'user_instruction',
      content: instruction,
      post_id: ws.postId || null
    })
  }).catch(function(err) {
    console.warn('[cw] memory save failed:', err && err.message);
  });

  ws.memoryPrompt = 'USER INSTRUCTION (highest priority, NEVER violate): ' + instruction
    + (ws.memoryPrompt ? '\n\n' + ws.memoryPrompt : '');

  _cwRenderThread();
  _cwScrollToBottom();

  var input = document.getElementById('cw-input');
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }
  var btn = document.getElementById('cw-send');
  if (btn) btn.style.opacity = '0.55';
}

// ─── AI memory: load all memory types into prompt ───────

async function _cwLoadMemory() {
  try {
    var rows = await apiFetch(
      '/ai_memory?workspace_id=eq.default&order=created_at.desc&limit=50&select=type,content'
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      window._captionWS.memoryPrompt = '';
      window._captionWS.correctionsPrompt = '';
      return;
    }

    var instructions = [];
    var zeroTolerance = [];
    var brandSummary = [];
    var clientPattern = [];
    var clientPatternAuto = [];
    var styleDna = [];
    var companyIdentity = [];
    var productKnowledge = [];
    var corrections = [];

    function _str(c) { return typeof c === 'string' ? c : JSON.stringify(c); }

    rows.forEach(function(r) {
      try {
        var s = _str(r.content);
        if (r.type === 'user_instruction') {
          instructions.push('- ' + s);
        } else if (r.type === 'brand_guide_summary') {
          if (s.indexOf('ZERO TOLERANCE') !== -1) zeroTolerance.push(s);
          else brandSummary.push(s);
        } else if (r.type === 'client_pattern') {
          clientPattern.push(s);
        } else if (r.type === 'client_pattern_auto') {
          clientPatternAuto.push(s);
        } else if (r.type === 'style_dna') {
          styleDna.push(s);
        } else if (r.type === 'company_identity') {
          companyIdentity.push(s);
        } else if (r.type === 'product_knowledge') {
          productKnowledge.push(s);
        } else if (r.type === 'edit_correction') {
          var c = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
          if (c && c.original && c.edited) {
            var origP = c.original.length > 100 ? c.original.slice(0, 100) + '...' : c.original;
            var editP = c.edited.length > 100 ? c.edited.slice(0, 100) + '...' : c.edited;
            corrections.push('- Changed: "' + origP + '" \u2192 "' + editP + '"');
          }
        }
      } catch (_) {}
    });

    var blocks = [];
    if (instructions.length > 0) {
      blocks.push('USER INSTRUCTIONS \u2014 NEVER VIOLATE THESE. These are direct commands from the user.\n' + instructions.join('\n'));
    }
    if (zeroTolerance.length > 0) {
      blocks.push('ZERO TOLERANCE RULES:\n' + zeroTolerance.join('\n'));
    }
    if (brandSummary.length > 0) {
      blocks.push('BRAND GUIDE:\n' + brandSummary.join('\n'));
    }
    if (clientPattern.length > 0) {
      blocks.push('CLIENT FEEDBACK PATTERNS (never repeat these mistakes):\n' + clientPattern.join('\n'));
    }
    if (clientPatternAuto.length > 0) {
      blocks.push('CLIENT FEEDBACK PATTERNS (auto-detected):\n' + clientPatternAuto.join('\n'));
    }
    if (styleDna.length > 0) {
      blocks.push('WRITING STYLE FOR THIS BRAND:\n' + styleDna.join('\n'));
    }
    if (companyIdentity.length > 0) {
      blocks.push('COMPANY IDENTITY:\n' + companyIdentity.join('\n'));
    }
    if (productKnowledge.length > 0) {
      blocks.push('PRODUCT KNOWLEDGE:\n' + productKnowledge.join('\n'));
    }
    if (corrections.length > 0) {
      blocks.push('STYLE PREFERENCES (learned from user edits):\n' + corrections.join('\n'));
    }

    window._captionWS.memoryPrompt = blocks.length > 0 ? blocks.join('\n\n') : '';
    window._captionWS.correctionsPrompt = corrections.length > 0
      ? '\n\nSTYLE CORRECTIONS FROM THIS USER (apply these patterns to all future drafts):\n' + corrections.join('\n')
      : '';
  } catch (e) {
    window._captionWS.memoryPrompt = '';
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
