/* ===============================================
   render/brief.js - Brief sheet overlay
   Extracted from 07-post-load.js (Phase 1)
=============================================== */
console.log("LOADED:", "render/brief.js");

function _generateWhatsAppPreview(postId, title, imageUrl) {
  fetch('https://srtd-og-inject.ksg-kumarshubhamgune.workers.dev/generate-preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Preview-Secret': 'srtd2026xK9mN3pQ'
    },
    body: JSON.stringify({
      post_id: postId,
      title: title,
      image_url: imageUrl || ''
    })
  }).catch(function() {});
}

// Share brief on WhatsApp. Uses location.href (not window.open) because iOS
// Safari's popup blocker drops window.open('_blank') handoffs to the
// whatsapp:// scheme. Mirrors actions/pcs.js _sharePostOnWhatsApp.
window._shareBriefOnWhatsApp = function(postId) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) {
    if (typeof showToast === 'function') showToast('Brief not found', 'error');
    return;
  }
  var title = (post.title || 'New Brief').replace(/'/g, '');
  var postIdRaw = post.post_id || post.id || postId || '';
  var shortId = postIdRaw.replace(/[^0-9]/g, '').slice(-4);
  if (!shortId) shortId = postIdRaw.slice(-4);
  var previewUrl = 'https://srtd.io/p/' + shortId;
  var message = 'Brief: ' + title + '\n\n' + previewUrl;
  location.href = 'https://wa.me/?text=' + encodeURIComponent(message);
};

// ===============================================
// Brief Discussion helpers
// ===============================================
function _briefRoleColor(role) {
  var r = (role || '').toLowerCase();
  if (r === 'admin')     return { bg:'#C8A84B40', border:'#C8A84B99', text:'#C8A84B' };
  if (r === 'client')    return { bg:'#FF4B4B40', border:'#FF4B4B99', text:'#FF4B4B' };
  if (r === 'servicing') return { bg:'#22D3EE40', border:'#22D3EE99', text:'#22D3EE' };
  if (r === 'creative')  return { bg:'#9b87f540', border:'#9b87f599', text:'#9b87f5' };
  return { bg:'#55556640', border:'#55556699', text:'#aeaeb2' };
}

function _briefAvatarHtml(author, role) {
  var photoUrl = null;
  try {
    if (typeof getAvatarUrl === 'function') photoUrl = getAvatarUrl(author);
  } catch (_) {}
  if (photoUrl) {
    return '<div style="width:30px;height:30px;border-radius:50%;overflow:hidden;' +
      'flex-shrink:0;">' +
      '<img src="' + photoUrl.replace(/"/g, '&quot;') + '" loading="lazy" ' +
      'width="30" height="30" style="width:100%;height:100%;object-fit:cover;' +
      'display:block;" alt="">' +
      '</div>';
  }
  var colors = _briefRoleColor(role);
  var displayName = '';
  try {
    if (typeof getDisplayName === 'function') displayName = getDisplayName(author);
  } catch (_) {}
  if (!displayName) displayName = author || '?';
  var initial = (displayName.charAt(0) || '?').toUpperCase();
  return '<div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;' +
    'background:' + colors.bg + ';border:1px solid ' + colors.border + ';' +
    'display:flex;align-items:center;justify-content:center;' +
    'font-family:\'DM Sans\',sans-serif;font-size:11px;font-weight:700;' +
    'color:' + colors.text + ';">' + esc(initial) + '</div>';
}

function _briefFormatCommentTime(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString('en-IN',
      {day:'numeric',month:'short',timeZone:'Asia/Kolkata'});
  } catch (_) { return ''; }
}

function _briefCommentRowHtml(c) {
  var author = c.author || 'Unknown';
  var role = c.author_role || '';
  var displayName = author;
  try {
    if (typeof getDisplayName === 'function') displayName = getDisplayName(author);
  } catch (_) {}
  var timeStr = _briefFormatCommentTime(c.created_at);
  return '<div class="brief-cmt-row" data-cmt-id="' + esc(c.id || '') + '" ' +
    'style="display:flex;gap:10px;padding:10px 0;' +
    'border-bottom:1px solid #1e1e2e;">' +
    _briefAvatarHtml(author, role) +
    '<div style="flex:1;min-width:0;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;' +
    'flex-wrap:wrap;">' +
    '<span style="font-family:\'DM Sans\',sans-serif;font-size:13px;' +
    'font-weight:700;color:#FFFFFF;">' + esc(displayName) + '</span>' +
    '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'color:#777788;letter-spacing:0.04em;">' + esc(timeStr) + '</span>' +
    '</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;' +
    'color:#E0E0EE;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;">' +
    esc(c.message || '') + '</div>' +
    '</div></div>';
}

function _briefBuildDiscussionHtml(postId, comments, sectionNumber) {
  var count = (comments || []).length;
  var badgeBg = count > 0 ? '#C8A84B' : '#1e1e2e';
  var badgeColor = count > 0 ? '#000000' : '#777788';
  var listHtml = '';
  if (count === 0) {
    listHtml =
      '<div id="brief-cmt-empty-' + postId + '" ' +
      'style="padding:18px 0 8px;display:flex;flex-direction:column;' +
      'align-items:center;text-align:center;gap:10px;">' +
      '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#555566" stroke-width="1.6" stroke-linecap="round" ' +
      'stroke-linejoin="round">' +
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
      '</svg>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;' +
      'color:#666677;line-height:1.5;max-width:280px;">' +
      'No comments yet. Discuss the brief before assigning.</div>' +
      '</div>';
  } else {
    listHtml = comments.map(_briefCommentRowHtml).join('');
  }
  return '<div style="padding:16px 20px;border-bottom:1px solid #1e1e2e;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'font-weight:600;letter-spacing:0.12em;text-transform:uppercase;' +
    'color:#C8A84B;margin-bottom:2px;">' + sectionNumber + '</div>' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
    'font-weight:700;color:#FFFFFF;">Discussion</div>' +
    '<div id="brief-cmt-count-' + postId + '" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'font-weight:700;padding:3px 8px;border-radius:10px;' +
    'background:' + badgeBg + ';color:' + badgeColor + ';">' +
    count + '</div>' +
    '</div>' +
    '<div id="brief-cmt-list-' + postId + '">' + listHtml + '</div>' +
    '<div style="display:flex;align-items:flex-end;gap:10px;' +
    'padding:12px 0 2px;margin-top:6px;' +
    'border-bottom:1.5px solid #444455;">' +
    '<textarea id="brief-cmt-input-' + postId + '" rows="1" ' +
    'placeholder="Ask a question or add context..." ' +
    'style="flex:1;background:transparent;border:none;outline:none;' +
    'resize:none;font-family:\'DM Sans\',sans-serif;font-size:14px;' +
    'color:#FFFFFF;line-height:1.5;padding:4px 0;caret-color:#C8A84B;"></textarea>' +
    '<button id="brief-cmt-send-' + postId + '" ' +
    'onclick="window._briefSubmitComment(\'' + esc(postId) + '\')" ' +
    'aria-label="Send comment" ' +
    'style="width:34px;height:34px;border-radius:50%;' +
    'background:#C8A84B;border:none;cursor:pointer;flex-shrink:0;' +
    'display:flex;align-items:center;justify-content:center;">' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" ' +
    'stroke="#0a0a0f" stroke-width="2.5" stroke-linecap="round" ' +
    'stroke-linejoin="round">' +
    '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>' +
    '</svg>' +
    '</button>' +
    '</div>' +
    '</div>';
}

// Resolve @name mentions in a brief comment to canonical user_roles
// emails using the brief team-member cache. notify-comment edge silently
// drops mentions whose role cannot be resolved, so we must send emails.
// Falls back to window._pcsRosterData when the brief cache is not yet
// populated (e.g. brief sheet opened before the assign dropdown was used).
function _resolveBriefMentionsToEmails(message) {
  if (!message) return [];
  var raw = message.match(/(?:^|[\s(])@([a-zA-Z0-9_]+)/g) || [];
  if (!raw.length) return [];
  var names = [];
  for (var n = 0; n < raw.length; n++) names.push(raw[n].replace(/^[\s(@]+/, ''));
  var roster = (Array.isArray(window._briefTeamMembersCache) && window._briefTeamMembersCache.length)
    ? window._briefTeamMembersCache
    : (Array.isArray(window._pcsRosterData) ? window._pcsRosterData : []);
  if (!roster.length) return [];
  var out = [];
  var seen = {};
  for (var i = 0; i < names.length; i++) {
    var lower = String(names[i] || '').toLowerCase();
    if (!lower) continue;
    for (var j = 0; j < roster.length; j++) {
      var u = roster[j];
      if (!u) continue;
      if ((u.email && u.email.toLowerCase() === lower) ||
          (u.name && u.name.toLowerCase() === lower)) {
        if (u.email && !seen[u.email]) {
          seen[u.email] = true;
          out.push(u.email);
        }
        break;
      }
    }
  }
  return out;
}

// Submit a brief comment — optimistic insert, rolls back on failure.
window._briefSubmitComment = function(postId) {
  var input = document.getElementById('brief-cmt-input-' + postId);
  if (!input) return;
  var text = (input.value || '').trim();
  if (!text) return;
  var authorName = (window.AppState.user && window.AppState.user.name) || 'Unknown';
  var authorEmail = (window.AppState && window.AppState.user && window.AppState.user.email) || '';
  if (!authorEmail) {
    if (typeof showToast === 'function') showToast('Session expired, please refresh', 'error');
    return;
  }
  var rawRole = (window.AppState.user && window.AppState.user.effectiveRole) || 'Admin';
  var normRole = (typeof normalizeRole === 'function') ?
    (normalizeRole(rawRole) || 'Admin') : rawRole;
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  var nowISO = new Date().toISOString();
  var optimistic = {
    id: '_optimistic_' + Date.now(),
    post_id: postId,
    author: authorName,
    author_role: normRole,
    message: text,
    post_title: (post && post.title) || '',
    created_at: nowISO
  };

  var listEl = document.getElementById('brief-cmt-list-' + postId);
  var emptyEl = document.getElementById('brief-cmt-empty-' + postId);
  if (emptyEl && emptyEl.parentNode) emptyEl.parentNode.removeChild(emptyEl);
  var rowWrap = document.createElement('div');
  rowWrap.innerHTML = _briefCommentRowHtml(optimistic);
  var optimisticNode = rowWrap.firstChild;
  if (listEl && optimisticNode) listEl.appendChild(optimisticNode);

  // Bump count badge
  var countEl = document.getElementById('brief-cmt-count-' + postId);
  var prevBadge = null;
  if (countEl) {
    prevBadge = {
      text: countEl.textContent,
      bg: countEl.style.background,
      color: countEl.style.color
    };
    var newCount = parseInt(countEl.textContent, 10) || 0;
    newCount += 1;
    countEl.textContent = newCount;
    countEl.style.background = '#C8A84B';
    countEl.style.color = '#000000';
  }

  input.value = '';
  input.style.height = '';

  apiFetch('/post_comments', {
    method: 'POST',
    body: JSON.stringify({
      post_id: postId,
      author: authorEmail,
      author_role: normRole,
      message: text,
      post_title: (post && post.title) || '',
      mentioned_users: _resolveBriefMentionsToEmails(text),
      created_at: nowISO
    })
  }).then(function() {
    // Notification fan-out removed — notify-comment edge function
    // now writes all brief-comment notification rows and sends emails.
  }).catch(function(err) {
    console.error('[brief] submit comment failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'brief-submit-comment');
    if (optimisticNode && optimisticNode.parentNode) {
      optimisticNode.parentNode.removeChild(optimisticNode);
    }
    if (countEl && prevBadge) {
      countEl.textContent = prevBadge.text;
      countEl.style.background = prevBadge.bg;
      countEl.style.color = prevBadge.color;
    }
    if (typeof showToast === 'function') showToast('Failed - try again', 'error');
  });
};

// ===============================================
// Brief Sheet - full-screen overlay for brief/REQ posts
// ===============================================
window._openBriefSheet = async function(postId) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) {
    try {
      var _fbRows = await apiFetch(
        '/requests?id=eq.' + encodeURIComponent(postId) +
        '&select=*&limit=1',
        {}, { allowLogout: false }
      );
      if (Array.isArray(_fbRows) && _fbRows[0]) {
        var _r = _fbRows[0];
        post = {
          post_id: _r.id,
          title: _r.title || '',
          stage: 'brief',
          owner: _r.assigned_to ? 'Creative' : 'Servicing',
          assigned_to: _r.assigned_to || null,
          _isRequest: true,
          _requestStatus: _r.status || 'pending',
          description: _r.description || '',
          client_feedback: _r.description || '',
          content_type: _r.content_type || '',
          target_date: _r.target_date || null,
          images: Array.isArray(_r.images) ? _r.images : [],
          drive_link: _r.drive_link || null,
          created_by: _r.created_by || '',
          created_at: _r.created_at || ''
        };
      }
    } catch (_fbErr) {}
    if (!post) return;
  }

  var existing = document.getElementById('brief-sheet-overlay');
  if (existing) existing.remove();

  // Fetch comments for this brief (non-deleted, chronological)
  var briefComments = [];
  try {
    briefComments = await apiFetch('/post_comments?post_id=eq.' +
      encodeURIComponent(postId) + '&deleted=eq.false&order=created_at.asc');
    if (!Array.isArray(briefComments)) briefComments = [];
  } catch (e) {
    briefComments = [];
  }

  // For request rows, the real assignment lives in the requests table
  // (requests.assigned_to + requests.status). 07-post-load.js does not
  // hydrate assigned_to into the merged stub, so pull it fresh here.
  // This is also the one round-trip that picks up assignments made in
  // another tab / session while the page was idle.
  if (post._isRequest) {
    try {
      var reqRows = await apiFetch('/requests?id=eq.' +
        encodeURIComponent(postId) + '&select=assigned_to,status');
      if (Array.isArray(reqRows) && reqRows[0]) {
        post.assigned_to = reqRows[0].assigned_to || '';
        post._requestStatus = reqRows[0].status || '';
      }
    } catch (e) {
      // Non-fatal — fall through with whatever is cached on the post,
      // but surface the failure so we can see when the refetch drops
      // (otherwise a silent 4xx leaves a stale assigned_to in memory).
      console.error('[brief] fetch assigned_to failed', e);
      if (window.logError) window.logError(e && e.message, e && e.stack, 'brief-fetch-assigned');
    }
  }

  var _role = (window.AppState.user.effectiveRole || '').toLowerCase();
  var _isClient = _role === 'client';
  var _isCreativeRole = _role === 'creative';
  var _canAssign = _role === 'admin' || _role === 'servicing';
  var _isBriefDone = false;
  var sentTime = '';
  if (post.status_changed_at && post.status_changed_at !== 'null') {
    var _d = new Date((post.status_changed_at || '') + 'Z');
    if (!isNaN(_d.getTime())) {
      var _date = _d.toLocaleDateString('en-IN',
        {day:'numeric',month:'short',timeZone:'Asia/Kolkata'});
      var _time = _d.toLocaleTimeString('en-IN',
        {hour:'numeric',minute:'2-digit',hour12:true,
        timeZone:'Asia/Kolkata'});
      sentTime = _date + ' ' + _time;
    }
  }

  var rawComments = post.client_feedback || post.description || '';
  var contentType = '';
  var briefDirectionNote = '';
  var briefText = '';

  if (post._isRequest) {
    // Request from requests table — fields are direct, no string parsing
    contentType = post.content_type || '';
    briefText = rawComments;
  } else {
    // Legacy post — parse [Type:], [URGENT], [CHITRA NOTE] from client_feedback
    var typeMatch = rawComments.match(/\[Type:\s*([^\]]+)\]/);
    if (typeMatch) {
      contentType = typeMatch[1].trim();
      rawComments = rawComments.replace(/\s*\[Type:[^\]]+\]/, '').trim();
    }
    briefText = rawComments;
    briefText = briefText.replace(/^\[URGENT\]\s*/, '').trim();

    var directionMatch = briefText.match(
      /\[(?:CHITRA NOTE|BRIEF NOTE)\]([\s\S]*)/i
    );
    if (directionMatch) {
      briefDirectionNote = directionMatch[1].trim();
      briefText = briefText.replace(
        /\[(?:CHITRA NOTE|BRIEF NOTE)\][\s\S]*/i, ''
      ).trim();
    }
  }

  // Assignment state — for request rows the source of truth is
  // `post.assigned_to` (hydrated from requests.assigned_to above);
  // for legacy brief-stage posts it falls back to post.assigned_to
  // set by _assignBrief after the PATCH, then to post.owner when the
  // owner is a creative role string (historical rows).
  var _assignedToName = (post.assigned_to || '').trim();
  var _ownerLower = (post.owner || '').toLowerCase();
  var _isAssigned = false;
  var _assigneeName = '';
  if (post._isRequest) {
    _isAssigned = !!_assignedToName && !_isBriefDone;
    _assigneeName = _isAssigned ? _assignedToName : '';
  } else {
    // Legacy brief posts — _assignedToName wins if set, else fall
    // back to the old post.owner heuristic so historical briefs
    // assigned before this PR still render as assigned.
    if (_assignedToName) {
      _isAssigned = !_isBriefDone;
      _assigneeName = _assignedToName;
    } else {
      _isAssigned =
        (_ownerLower !== '' && _ownerLower !== 'servicing' &&
         _ownerLower !== 'admin' && _ownerLower !== 'client') &&
        !_isBriefDone;
      _assigneeName = _isAssigned ? (post.owner || '') : '';
    }
  }
  // Check if the current user is the specific creative assigned
  // to THIS brief — compare effective ROLE against post.owner (both
  // canonical DB role strings). PR #843 moved posts.owner to the
  // Title-Case role so the DB CHECK constraint passes; comparing by
  // name broke the Create Post button for every creative. Comparing
  // by role scales to any current or future creative automatically.
  var _userRole = (window.AppState.user.effectiveRole || '').toLowerCase();
  var _assigneeRole = (post.owner || '').toLowerCase();
  var _isAssignedCreative = _isCreativeRole && _isAssigned &&
    _userRole === _assigneeRole;
  var _hasLinkedPost = !!(post.linked_post_id);
  var linkedPost = null;
  if (_hasLinkedPost) {
    linkedPost = (window.AppState.posts.all || []).find(function(p) {
      return p.post_id === post.linked_post_id;
    });
  }

  var overlay = document.createElement('div');
  overlay.id = 'brief-sheet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;' +
    'background:#0a0a0f;overflow-y:auto;font-family:\'DM Sans\',sans-serif;';

  // Campaign progress (multi-post briefs). The progress block only
  // renders when the brief has more than one slot or at least one
  // post has been created from it; single-post briefs stay clean.
  var _totalPosts = post.total_posts || 1;
  var _donePosts  = post.completed_posts || 0;
  var _progressHtml = '';
  if (_totalPosts > 1 || _donePosts > 0) {
    var _pct = Math.round((_donePosts / _totalPosts) * 100);
    _progressHtml =
      '<div class="brief-progress-wrap">' +
        '<div class="brief-progress-bar">' +
          '<div class="brief-progress-fill" style="width:' +
            _pct + '%"></div>' +
        '</div>' +
        '<div class="brief-progress-label">' +
          _donePosts + ' of ' + _totalPosts + ' posts created' +
          (_pct === 100 ? ' &middot; Complete' : ' &middot; ' + _pct + '%') +
        '</div>' +
      '</div>';
  }

  // --- Build action buttons for the sticky footer ---
  var _footerActions = (function() {
    var _viewPostBtn = (_hasLinkedPost && linkedPost) ?
      (_isClient ?
      '<button data-action="clientViewPost" data-id="' + esc(linkedPost.post_id) + '" ' +
      'style="display:flex;align-items:center;justify-content:center;gap:6px;' +
      'background:#0e0e0e;border:1px solid #3ECF8E;border-radius:10px;' +
      'padding:13px 20px;width:100%;font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;' +
      'color:#3ECF8E;cursor:pointer;">' +
      '&#x2192; View Post</button>'
      :
      '<button onclick="(function(){' +
      'var o=document.getElementById(\'brief-sheet-overlay\');' +
      'if(o)o.remove();' +
      'document.body.style.overflow=\'\';' +
      'setTimeout(function(){openPCS(\'' +
      esc(linkedPost.post_id) + '\',\'\');},150);' +
      '})()" ' +
      'style="display:flex;align-items:center;justify-content:center;gap:6px;' +
      'background:#0e0e0e;border:1px solid #3ECF8E;border-radius:10px;' +
      'padding:13px 20px;width:100%;font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;' +
      'color:#3ECF8E;cursor:pointer;">' +
      '&#x2192; View Post</button>') : '';
    var _reopenBtn =
      '<button onclick="_reopenBrief(\'' + postId + '\')" ' +
      'style="display:flex;align-items:center;justify-content:center;gap:6px;' +
      'background:#0e0e0e;border:1px solid #252535;border-radius:10px;' +
      'padding:13px 20px;width:100%;font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;' +
      'color:#555566;cursor:pointer;">' +
      '&#x21BA; Reopen Brief</button>';
    var _closeBtn =
      '<button onclick="_closeBriefConfirm(\'' + postId + '\')" ' +
      'style="display:flex;align-items:center;justify-content:center;gap:6px;' +
      'background:#0e0e0e;border:1px solid #252535;border-radius:10px;' +
      'padding:13px 20px;width:100%;font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;' +
      'color:#555566;cursor:pointer;">' +
      '&#x2715; Close Brief</button>';
    var _readOnly =
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.12em;text-transform:uppercase;' +
      'color:#555566;text-align:center;padding:8px 0;">' +
      'The team is working on this</div>';

    // STATE: has linked post (post already created). For multi-post
    // campaign briefs, expose a Create Another Post button until
    // completed_posts catches up to total_posts.
    if (_hasLinkedPost && linkedPost) {
      var _remaining = Math.max(0,
        (post.total_posts || 1) - (post.completed_posts || 0));
      var _html = _viewPostBtn;
      if (_remaining > 0 && _canAssign) {
        _html +=
          '<button class="brief-create-more-btn" ' +
          'onclick="window._createPostFromBrief(\'' +
          esc(postId) + '\')">' +
          '+ Create Post (' + _remaining + ' remaining)' +
          '</button>';
      }
      if (_canAssign) _html += _closeBtn;
      return _html;
    }
    // STATE: assigned, no linked post yet
    // Create Post button visibility (Fix C):
    //   • Creative whose name matches _assigneeName → show
    //   • Admin → always show
    //   • Servicing → always show
    //   • Other creatives → hide (read-only)
    //   • Other roles → hide (read-only)
    var _createPostBtn =
      '<button onclick="_createPostFromBrief(\'' + postId + '\')" ' +
      'data-brief-id="' + esc(postId) + '" ' +
      'style="display:flex;align-items:center;justify-content:center;gap:6px;' +
      'background:#0e0e0e;border:1px solid #C8A84B;border-radius:10px;' +
      'padding:13px 20px;width:100%;font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;' +
      'color:#C8A84B;cursor:pointer;margin-top:8px;">' +
      '&#x2192; Create Post</button>';
    if (_isAssigned) {
      if (_canAssign) {
        // Admin / Servicing: show the assignment summary, allow
        // reassign, and per Fix C also get the Create Post button.
        return '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
          'font-weight:600;letter-spacing:0.14em;text-transform:uppercase;' +
          'color:#555566;background:#0e0e0e;border:1px solid #252535;border-radius:10px;' +
          'padding:13px 20px;text-align:center;width:100%;">' +
          '&#x2713; Assigned to ' + esc(_assigneeName) + '</div>' +
          '<button id="brief-reassign-btn-' + postId + '" ' +
          'onclick="_briefShowAssignDropdown(\'' + postId + '\',true)" ' +
          'style="display:flex;align-items:center;justify-content:center;gap:6px;' +
          'background:transparent;border:1px solid #252535;border-radius:10px;' +
          'padding:11px 20px;width:100%;font-family:\'IBM Plex Mono\',monospace;' +
          'font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;' +
          'color:#555566;cursor:pointer;margin-top:8px;">' +
          '&#x21BA; Reassign</button>' +
          '<div id="brief-assign-dropdown-' + postId + '"></div>' +
          _createPostBtn +
          _closeBtn;
      }
      if (_isAssignedCreative) {
        return _createPostBtn + _closeBtn;
      }
      return _readOnly;
    }
    // STATE: unassigned — show assign dropdown for Admin/Servicing
    if (_canAssign) {
      return '<div style="margin-bottom:8px;">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
        'letter-spacing:0.12em;text-transform:uppercase;' +
        'color:#C8A84B;margin-bottom:6px;">Your Direction for Creative</div>' +
        '<textarea id="brief-direction-' + postId + '" rows="3" ' +
        'placeholder="Add your creative direction, angle, key message..." ' +
        'style="width:100%;background:transparent;border:none;' +
        'border-bottom:1px solid #3a3a3a;color:#E8E8E8;' +
        'font-family:\'DM Sans\',sans-serif;font-size:14px;' +
        'padding:8px 0 10px;outline:none;resize:none;line-height:1.7;' +
        'caret-color:#C8A84B;"></textarea>' +
        '</div>' +
        '<div class="brief-total-posts-wrap">' +
          '<div class="brief-field-label">Posts in this brief</div>' +
          '<div class="brief-total-posts-row">' +
            '<button class="brief-count-btn" onclick="window.' +
              '_briefAdjustTotal(\'' + esc(postId) + '\',-1)">&minus;</button>' +
            '<span class="brief-count-val" id="brief-total-val-' +
              esc(postId) + '">' + (post.total_posts || 1) + '</span>' +
            '<button class="brief-count-btn" onclick="window.' +
              '_briefAdjustTotal(\'' + esc(postId) + '\',1)">+</button>' +
          '</div>' +
        '</div>' +
        '<button id="brief-assign-trigger-' + postId + '" ' +
        'onclick="_briefShowAssignDropdown(\'' + postId + '\',false)" ' +
        'style="display:flex;align-items:center;justify-content:center;gap:6px;' +
        'background:#0e0e0e;border:1px solid #C8A84B;border-radius:10px;' +
        'padding:13px 20px;width:100%;font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;' +
        'color:#C8A84B;cursor:pointer;">' +
        '&#x2192; Assign to&hellip;</button>' +
        '<div id="brief-assign-dropdown-' + postId + '"></div>' + _closeBtn;
    }
    return _readOnly;
  }());

  overlay.innerHTML =
    // TOP NAV BAR
    '<div style="position:sticky;top:0;background:#0a0a0f;' +
    'border-bottom:1px solid #1e1e2e;padding:14px 20px 12px;' +
    'display:flex;align-items:center;justify-content:space-between;z-index:10;">' +
    '<button onclick="document.getElementById(\'brief-sheet-overlay\').remove();' +
    'document.body.style.overflow=\'\';" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:500;' +
    'letter-spacing:0.1em;text-transform:uppercase;color:#555566;' +
    'display:flex;align-items:center;gap:5px;' +
    'background:none;border:none;cursor:pointer;">&#x2190; BACK</button>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:600;' +
    'letter-spacing:0.16em;text-transform:uppercase;color:#C8A84B;">BRIEF</div>' +
    '<div onclick="window._shareBriefOnWhatsApp(\'' + esc(postId) + '\')" ' +
    'style="display:flex;align-items:center;gap:5px;background:#1a2e1a;' +
    'border:1px solid #25D366;border-radius:6px;padding:5px 10px;cursor:pointer;">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
    '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;font-weight:600;' +
    'letter-spacing:0.1em;text-transform:uppercase;color:#25D366;">SHARE</span>' +
    '</div>' +
    '</div>' +

    // TITLE BLOCK
    '<div style="padding:24px 20px 20px;border-bottom:1px solid #1e1e2e;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;font-weight:600;' +
    'letter-spacing:0.16em;text-transform:uppercase;color:#555566;margin-bottom:6px;">BRIEF TITLE</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:24px;font-weight:700;' +
    'color:#F0F0F2;line-height:1.2;letter-spacing:-0.01em;">' +
    esc(post.title || '') + '</div>' +
    '<div style="margin-top:10px;display:flex;align-items:center;gap:8px;">' +
    '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;font-weight:600;' +
    'letter-spacing:0.1em;text-transform:uppercase;color:#9b87f5;' +
    'background:#9b87f514;border:1px solid #9b87f533;border-radius:4px;padding:3px 7px;">BRIEF</span>' +
    '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;font-weight:500;' +
    'letter-spacing:0.08em;color:#555566;">' +
    (_isAssigned ? 'Assigned to <strong style="color:#9b87f5;font-weight:600;">' + esc(_assigneeName) + '</strong>' : 'Unassigned') +
    '</span>' +
    '</div>' +
    '</div>' +

    // Campaign progress (only when total_posts > 1 or any completed)
    _progressHtml +

    // Brief Done status banner
    (_isBriefDone ?
      '<div style="padding:10px 20px;background:#141008;' +
      'border-left:3px solid #C8A84B;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#C8A84B;">' +
      'Brief Closed</div>' +
      '</div>'
      : '') +

    // Linked post info (if linked)
    (_hasLinkedPost && linkedPost ?
      '<div style="padding:12px 20px;border-bottom:1px solid #1e1e2e;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;font-weight:600;' +
      'letter-spacing:0.16em;text-transform:uppercase;' +
      'color:#555566;margin-bottom:8px;">LINKED POST</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
      'padding:12px 14px;background:#141420;border:1px solid #252535;border-radius:8px;">' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'font-weight:600;color:#F0F0F2;">' + esc(linkedPost.title) + '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:#555566;">' +
      esc((linkedPost.stage || '').replace(/_/g,' ')) + '</div>' +
      '</div></div>'
      : '') +

    // SECTION 01 — THE BRIEF
    '<div style="padding:16px 20px;border-bottom:1px solid #1e1e2e;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;font-weight:600;' +
    'letter-spacing:0.12em;text-transform:uppercase;color:#C8A84B;margin-bottom:2px;">01</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;font-weight:600;' +
    'color:#E8E8E8;margin-bottom:10px;">The Brief</div>' +

    // Content type (if present, show as tag before brief text)
    (contentType ?
      '<div style="display:inline-flex;align-items:center;' +
      'border:1px solid #252535;border-radius:4px;padding:3px 8px;margin-bottom:10px;">' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.1em;text-transform:uppercase;' +
      'color:#AEAEB2;font-weight:500;">' + esc(contentType) + '</span>' +
      '</div>'
      : '') +

    '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;font-weight:400;' +
    'color:#9090A0;line-height:1.6;white-space:pre-wrap;">' +
    esc(briefText || 'No brief text provided.') + '</div>' +

    // Drive link pill
    (post.drive_link ?
      '<a href="' + esc(post.drive_link) + '" target="_blank" rel="noopener" ' +
      'style="display:flex;align-items:center;gap:8px;background:#141420;' +
      'border:1px solid #252535;border-radius:8px;padding:10px 12px;' +
      'text-decoration:none;margin-top:12px;">' +
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
      'letter-spacing:0.04em;color:#22D3EE;white-space:nowrap;overflow:hidden;' +
      'text-overflow:ellipsis;">' + esc(post.drive_link) + '</span>' +
      '</a>'
      : '') +

    // Direction note from Servicing (hidden from client)
    (!_isClient && briefDirectionNote ?
      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #1e1e2e;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;font-weight:600;' +
      'letter-spacing:0.12em;text-transform:uppercase;' +
      'color:#555566;margin-bottom:8px;">Direction from Servicing</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'color:#8E8E93;line-height:1.65;font-style:italic;">' +
      esc(briefDirectionNote) + '</div>' +
      '</div>'
      : '') +

    '</div>' +

    // SECTION 02 — DISCUSSION
    _briefBuildDiscussionHtml(postId, briefComments, '02') +

    // SECTION 03 — REFERENCE PHOTOS
    (Array.isArray(post.images) && post.images.length ?
      '<div style="padding:16px 20px;border-bottom:1px solid #1e1e2e;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;font-weight:600;' +
      'letter-spacing:0.12em;text-transform:uppercase;color:#C8A84B;margin-bottom:2px;">03</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;font-weight:600;' +
      'color:#E8E8E8;margin-bottom:4px;">Reference Photos</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:#555566;margin-bottom:10px;">' +
      post.images.length + ' FILES ATTACHED</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">' +
      post.images.map(function(url, i) {
        return '<img src="' + url + '" loading="lazy" ' +
        'onclick="window._pcsOpenLightbox(\'' + postId + '\',' + i + ')" ' +
        'style="aspect-ratio:1/1;width:100%;object-fit:cover;border-radius:6px;' +
        'cursor:pointer;display:block;">';
      }).join('') +
      '</div></div>'
      : '') +

    // SECTION 04 — ASSIGNED TO (dynamic)
    (_isAssigned ?
      '<div style="padding:16px 20px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;font-weight:600;' +
      'letter-spacing:0.12em;text-transform:uppercase;color:#C8A84B;margin-bottom:2px;">' +
      (Array.isArray(post.images) && post.images.length ? '04' : '03') + '</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;font-weight:600;' +
      'color:#E8E8E8;margin-bottom:10px;">Assigned To</div>' +
      '<div style="display:flex;align-items:center;gap:10px;background:#141420;' +
      'border:1px solid #252535;border-radius:8px;padding:11px 14px;">' +
      ((typeof renderAvatar === 'function') ? renderAvatar(_assigneeName, 'creative', 28) : '<div style="width:28px;height:28px;border-radius:50%;background:#9b87f526;border:1px solid #9b87f54d;display:flex;align-items:center;justify-content:center;font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:600;color:#9b87f5;">' + esc((_assigneeName || '?').charAt(0).toUpperCase()) + '</div>') +
      '<div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;font-weight:600;color:#F0F0F2;">' +
      esc(_assigneeName) + '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;color:#555566;' +
      'letter-spacing:0.06em;text-transform:uppercase;margin-top:1px;">Creative</div>' +
      '</div>' +
      '<div style="margin-left:auto;display:flex;align-items:center;gap:4px;">' +
      '<div style="width:6px;height:6px;border-radius:50%;background:#9b87f5;"></div>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;color:#555566;' +
      'letter-spacing:0.06em;">ASSIGNED</span>' +
      '</div>' +
      '</div></div>'
      : '') +

    // BOTTOM STICKY FOOTER
    '<div style="position:sticky;bottom:0;background:#0a0a0f;' +
    'border-top:1px solid #1e1e2e;padding:12px 20px 28px;">' +
    '<div style="display:flex;flex-direction:column;gap:8px;">' +
    _footerActions +
    '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Wire Enter-key submit (Shift+Enter = newline) for the comment textarea
  var _cmtInputEl = document.getElementById('brief-cmt-input-' + postId);
  if (_cmtInputEl) {
    _cmtInputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window._briefSubmitComment(postId);
      }
    });
  }

  overlay.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'clientViewPost') {
      var postId = btn.dataset.id;
      var sheet = document.getElementById('brief-sheet-overlay');
      if (sheet) sheet.remove();
      document.body.style.overflow = '';
      if (typeof window._openClientPostOverlay === 'function') {
        setTimeout(function() {
          window._openClientPostOverlay(postId);
        }, 150);
      }
    }
  });
}

// Adjust the in-DOM total_posts counter on the unassigned brief
// footer. Only mutates the <span> text — the DB write happens later
// in _assignBrief which reads the current span value at PATCH time.
window._briefAdjustTotal = function(postId, delta) {
  var el = document.getElementById('brief-total-val-' + postId);
  if (!el) return;
  var next = Math.max(1, (parseInt(el.textContent) || 1) + delta);
  el.textContent = next;
};

// Fetch team members (non-client roles) from user_roles and show
// assignment dropdown. Uses window._briefTeamMembersCache so the
// result is re-used across renders and re-opens within a session.
window._briefTeamMembersCache = null;

window._briefFetchTeamMembers = function() {
  if (Array.isArray(window._briefTeamMembersCache) && window._briefTeamMembersCache.length) {
    return Promise.resolve(window._briefTeamMembersCache);
  }
  // SELECT name, role FROM user_roles WHERE role != 'client' ORDER BY name
  return apiFetch('/user_roles?role=neq.Client&select=name,role,email&order=name.asc', { method: 'GET' })
    .then(function(rows) {
      var members = Array.isArray(rows) ? rows.filter(function(r) { return r && r.name; }) : [];
      // Merge profiles.display_name over user_roles.name so the dropdown
      // shows the human-friendly display name when present. Graceful
      // fallback: if the profiles fetch fails, we still resolve with the
      // user_roles names — the dropdown never blocks.
      return new Promise(function(resolve) {
        apiFetch('/profiles?select=email,display_name', { method: 'GET' })
          .then(function(profileRows) {
            if (!Array.isArray(profileRows)) return;
            var profileMap = {};
            profileRows.forEach(function(p) {
              if (p && p.email && p.display_name) {
                profileMap[p.email.toLowerCase()] = p.display_name;
              }
            });
            members.forEach(function(m) {
              if (m.email) {
                var dn = profileMap[m.email.toLowerCase()];
                if (dn) m.name = dn;
              }
            });
          })
          .catch(function() { /* graceful fallback */ })
          .finally(function() {
            window._briefTeamMembersCache = members;
            resolve(members);
          });
      });
    });
};

window._briefShowAssignDropdown = function(postId, isReassign) {
  var container = document.getElementById('brief-assign-dropdown-' + postId);
  if (!container) return;
  // Toggle: if already open, close it
  if (container.innerHTML.trim()) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'color:#555566;padding:10px 0;">Loading&hellip;</div>';
  window._briefFetchTeamMembers()
    .then(function(members) {
      if (!Array.isArray(members) || !members.length) {
        container.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
          'color:#FF4B4B;padding:10px 0;">No team members found</div>';
        return;
      }
      var html = '<div style="margin-top:8px;border:1px solid #252535;border-radius:8px;overflow:hidden;">';
      members.forEach(function(m) {
        var name = m.name || m.email || '';
        var memberRole = (m.role || '').toLowerCase();
        var initial = (name.charAt(0) || '?').toUpperCase();
        html += '<button onclick="_assignBrief(\'' + esc(postId) + '\',\'' + esc(m.role || '') + '\',\'' + esc(m.name || m.email || '') + '\',' + isReassign + ')" ' +
          'style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;' +
          'background:#0d0d12;border:none;border-bottom:1px solid #191924;cursor:pointer;">' +
          ((typeof renderAvatar === 'function') ? renderAvatar(m.email || name, memberRole || 'creative', 28) : '<div style="width:28px;height:28px;border-radius:50%;background:#9b87f526;border:1px solid #9b87f54d;display:flex;align-items:center;justify-content:center;font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:600;color:#9b87f5;">' + esc(initial) + '</div>') +
          '<div style="flex:1;text-align:left;">' +
          '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;font-weight:600;color:#F0F0F2;">' +
          esc(name) + '</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.08em;text-transform:uppercase;color:#555566;margin-top:1px;">' +
          esc(m.role || '') + '</div>' +
          '</div>' +
          '</button>';
      });
      html += '</div>';
      container.innerHTML = html;
    })
    .catch(function(err) {
      console.error('[brief] fetch team members failed', err);
      window.logError && window.logError(err && err.message, err && err.stack, 'brief-fetch-team');
      container.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
        'color:#FF4B4B;padding:10px 0;">Failed to load — try again</div>';
    });
}

// Assign or reassign a brief to a specific team member by name.
// - Request rows: PATCH requests { assigned_to, status:'assigned' }
//   (no posts row is created here — Create Post creates it later).
// - Legacy brief-stage posts: PATCH posts { owner: <role> } where
//   <role> is the canonical DB role (Creative/Servicing/...) so the
//   posts_owner_check constraint passes. The person's name is kept
//   only for display (toast, logActivity, notification message).
// On success an in-app notification row is inserted with
// user_role='Creative' and the person's name embedded in the message.
window._assignBrief = function(postId, ownerRole, displayName, isReassign) {
  var direction = (document.getElementById('brief-direction-' + postId) || {}).value || '';
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;

  var _emailKey = window.AppState.user.email || '';
  var actorName = (typeof getDisplayName === 'function' && _emailKey)
    ? getDisplayName(_emailKey)
    : (window.AppState.user.name || _emailKey || 'Unknown');
  var actorRole = window.AppState.user.effectiveRole || 'Admin';
  var _labelWho = displayName || ownerRole;
  var actionLabel = (isReassign ? 'Brief reassigned to ' : 'Brief assigned to ') + _labelWho;
  var toastMsg = (isReassign ? 'Reassigned to ' : 'Assigned to ') + _labelWho;
  var nowISO = new Date().toISOString();

  // Assign notification is handled by the notify-stage edge function
  // (brief stage writes trigger it). The JS-side _postAssignNotification
  // helper was removed to eliminate duplicate notification rows.

  function _reopenBriefAfterAssign() {
    document.body.style.overflow = '';
    showToast(toastMsg, 'success');
    // Re-render the brief panel so it shows the new assigned state.
    if (typeof window._openBriefSheet === 'function') {
      window._openBriefSheet(postId);
    }
    if (typeof scheduleRender === 'function') scheduleRender();
  }

  if (post._isRequest) {
    // Request from the requests table — store the selected person's
    // name in requests.assigned_to and flip status to 'assigned'. Do
    // NOT create a posts row here and do NOT touch posts.owner. The
    // posts row is created later when the creative (or admin) taps
    // Create Post and fills out the new post form.
    // NOTE: requests table has no updated_at column — do not include it.
    // Read the in-DOM total_posts counter (set by _briefAdjustTotal
    // before the user tapped Assign) and persist it on the request so
    // the brief becomes a campaign container for N posts.
    var _totalEl = document.getElementById('brief-total-val-' + postId);
    var _totalPosts = _totalEl
      ? (parseInt(_totalEl.textContent) || 1)
      : (post.total_posts || 1);
    apiFetch('/requests?id=eq.' + encodeURIComponent(postId), {
      method: 'PATCH',
      body: JSON.stringify({
        assigned_to: displayName || ownerRole,
        status: 'assigned',
        total_posts: _totalPosts
      })
    }).then(function() {
      // Mutate the in-memory request stub so the brief sheet reopen
      // reflects the new assignee without waiting for a poll.
      post.assigned_to = displayName || ownerRole;
      post._requestStatus = 'assigned';
      post.total_posts = _totalPosts;
      logActivity({
        post_id: postId,
        actor: actorName,
        actor_role: actorRole,
        action: actionLabel + (direction.trim() ? ' with direction' : '')
      });
      // Assign PATCH targets /requests, so notify-stage does NOT fire.
      // Write the assign notification directly here so the assignee
      // actually hears about it. notify-stage cannot handle this path.
      var _assigneeRole = (typeof normalizeRole === 'function')
        ? (normalizeRole(ownerRole) || 'Creative') : 'Creative';
      var _notifActor = (typeof getCanonicalActor === 'function')
        ? getCanonicalActor(_emailKey) : '';
      window.apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_role: _assigneeRole,
          post_id:   postId,
          type:      'assign',
          message:   _notifActor +
                     ' assigned you a brief: "' +
                     (post.title || 'Untitled') + '"',
          actor:     _notifActor,
          read:      false
        })
      }).catch(function(err) {
        window.logError && window.logError(
          err && err.message, err && err.stack,
          'assign-brief-notif'
        );
      });
      _reopenBriefAfterAssign();
    }).catch(function(err) {
      console.error('[brief] assign request failed', err);
      window.logError && window.logError(err && err.message, err && err.stack, 'assign-request');
      showToast('Failed - try again', 'error');
    });
    return;
  }

  // Legacy brief-stage post flow — posts.owner stays a ROLE string
  // (posts_owner_check only allows Creative/Servicing/Client/Admin).
  // The person's name is preserved only for display + notification.
  var dbOwner = (typeof normalizeRole === 'function') ? (normalizeRole(ownerRole) || 'Creative') : 'Creative';
  var _validOwners = ['Creative','Servicing','Admin','Client'];
  if (_validOwners.indexOf(dbOwner) === -1) {
    window.logError && window.logError(
      'assign-brief: invalid dbOwner: ' + dbOwner,
      null, 'assign-brief-owner-guard'
    );
    return;
  }
  var updatedFeedback = (post.client_feedback || '');
  if (direction.trim()) {
    updatedFeedback += '\n\n[BRIEF NOTE] ' + direction.trim();
  }
  apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
    method: 'PATCH',
    body: JSON.stringify({
      stage: 'brief',
      owner: dbOwner,
      client_feedback: updatedFeedback,
      status_changed_at: nowISO,
      updated_at: nowISO,
      updated_by: resolveActor()
    })
  }).then(function() {
    // Persist the display name on the in-memory row so the reopen
    // shows the individual (dbOwner only carries the role).
    post.owner = dbOwner;
    post.assigned_to = displayName || ownerRole;
    post.client_feedback = updatedFeedback;
    logActivity({
      post_id: postId,
      actor: actorName,
      actor_role: actorRole,
      action: actionLabel + (direction.trim() ? ' with direction' : '')
    });
    // Write the assign notification directly. The _postAssignNotification
    // helper was removed in PR #844 on the assumption notify-stage would
    // handle it, but the assignee needs a reliable notif on this path too.
    var _assigneeRole = (typeof normalizeRole === 'function')
      ? (normalizeRole(ownerRole) || 'Creative') : 'Creative';
    var _notifActor = (typeof getCanonicalActor === 'function')
      ? getCanonicalActor(_emailKey) : '';
    window.apiFetch('/notifications', {
      method: 'POST',
      body: JSON.stringify({
        user_role: _assigneeRole,
        post_id:   postId,
        type:      'assign',
        message:   _notifActor +
                   ' assigned you a brief: "' +
                   (post.title || 'Untitled') + '"',
        actor:     _notifActor,
        read:      false
      })
    }).catch(function(err) {
      window.logError && window.logError(
        err && err.message, err && err.stack,
        'assign-brief-notif'
      );
    });
    _reopenBriefAfterAssign();
  }).catch(function(err) {
    console.error('[brief] assign brief failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'assign-brief');
    showToast('Failed - try again', 'error');
  });
}

window._closeBriefConfirm = function(postId) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  var title = post ? (post.title || postId) : postId;

  var existing = document.getElementById('brief-confirm-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'brief-confirm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9600;' +
    'background:#000000BF;display:flex;' +
    'align-items:center;justify-content:center;padding:24px;';

  overlay.innerHTML =
    '<div style="background:#0d0d14;border:1px solid #C8A84B33;' +
    'padding:28px 24px;max-width:340px;width:100%;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.18em;text-transform:uppercase;' +
    'color:#C8A84B;margin-bottom:12px;">Close This Brief?</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:16px;' +
    'font-weight:600;color:#e8e2d9;margin-bottom:8px;">' +
    esc(title) + '</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;' +
    'color:#FFFFFF80;line-height:1.6;margin-bottom:24px;">' +
    'This marks the brief as delivered. It will move to Closed Briefs.' +
    '</div>' +
    '<div style="display:flex;gap:10px;">' +
    '<button onclick="document.getElementById(\'brief-confirm-overlay\').remove()" ' +
    'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.14em;text-transform:uppercase;' +
    'background:transparent;border:1px solid #FFFFFF1F;' +
    'color:#FFFFFF80;padding:12px 0;cursor:pointer;">Cancel</button>' +
    '<button onclick="_closeBrief(\'' + postId + '\')" ' +
    'style="flex:2;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.14em;text-transform:uppercase;' +
    'background:#C8A84B1A;border:1px solid #C8A84B;' +
    'color:#C8A84B;padding:12px 0;cursor:pointer;">' +
    'Close Brief &#x2192;</button>' +
    '</div></div>';

  document.body.appendChild(overlay);
}

window._closeBrief = function(postId) {
  if (!postId) {
    console.warn('_closeBrief: missing postId, aborting');
    return;
  }
  document.getElementById('brief-confirm-overlay') &&
    document.getElementById('brief-confirm-overlay').remove();

  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;

  if (post && post._isRequest) {
    // Request from requests table — PATCH status to closed
    apiFetch('/requests?id=eq.' + encodeURIComponent(postId), {
      method: 'PATCH',
      body: JSON.stringify({ status: 'closed' })
    }).then(function() {
      // Update AppState — request status is now 'closed'; no stage change.
      var updated = (window.AppState.posts.all || []).map(function(p) {
        if ((p.post_id || p.id) === postId) {
          return Object.assign({}, p, { _requestStatus: 'closed' });
        }
        return p;
      });
      window.AppState.posts.setAll(updated);
      var overlay = document.getElementById('brief-sheet-overlay');
      if (overlay) overlay.remove();
      document.body.style.overflow = '';
      showToast('Brief closed', 'success');
      if (typeof scheduleRender === 'function') scheduleRender();
    }).catch(function(err) {
      console.error('[brief] close request failed', err);
      window.logError && window.logError(err && err.message, err && err.stack, 'close-request');
      showToast('Failed - try again', 'error');
    });
    return;
  }

  apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
    method: 'PATCH',
    body: JSON.stringify({
      stage: 'parked',
      updated_at: new Date().toISOString(),
      updated_by: resolveActor()
    })
  }).then(function() {
    var overlay = document.getElementById('brief-sheet-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    showToast('Brief closed', 'success');
    loadPosts();
  }).catch(function(err) {
    console.error('[brief] close brief failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'close-brief');
    showToast('Failed - try again', 'error');
  });
}

window._reopenBrief = function(postId) {
  if (!postId) {
    console.warn('_reopenBrief: missing postId, aborting');
    return;
  }
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;

  if (post && post._isRequest) {
    // Request from requests table — PATCH status back to pending
    apiFetch('/requests?id=eq.' + encodeURIComponent(postId), {
      method: 'PATCH',
      body: JSON.stringify({ status: 'pending' })
    }).then(function() {
      // Update AppState — change stage back to brief
      var updated = (window.AppState.posts.all || []).map(function(p) {
        if ((p.post_id || p.id) === postId) {
          return Object.assign({}, p, { stage: 'brief' });
        }
        return p;
      });
      window.AppState.posts.setAll(updated);
      var overlay = document.getElementById('brief-sheet-overlay');
      if (overlay) overlay.remove();
      document.body.style.overflow = '';
      showToast('Brief reopened', 'success');
      if (typeof scheduleRender === 'function') scheduleRender();
    }).catch(function(err) {
      console.error('[brief] reopen request failed', err);
      window.logError && window.logError(err && err.message, err && err.stack, 'reopen-request');
      showToast('Failed - try again', 'error');
    });
    return;
  }

  apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
    method: 'PATCH',
    body: JSON.stringify({
      stage: 'brief',
      owner: 'Servicing',
      updated_at: new Date().toISOString(),
      updated_by: resolveActor()
    })
  }).then(function() {
    var overlay = document.getElementById('brief-sheet-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    showToast('Brief reopened', 'success');
    loadPosts();
  }).catch(function(err) {
    console.error('[brief] reopen brief failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'reopen-brief');
    showToast('Failed - try again', 'error');
  });
}

window._createPostFromBrief = function(briefPostId) {
  var brief = (typeof getPostById === 'function')
    ? getPostById(briefPostId) : null;
  if (!brief) return;

  // Close brief sheet
  var overlay = document.getElementById('brief-sheet-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';

  // Open new post form. React strangler-fig: route to React Create
  // Post when the flag is true and the flow is mounted; fall back
  // to vanilla openNewPostModal() otherwise.
  if (window.ENABLE_REACT_NEW_POST === true
      && window.SortedReact
      && window.SortedReact.flows
      && window.SortedReact.flows.createPost
      && typeof window.SortedReact.flows.createPost.open === 'function') {
    window.SortedReact.flows.createPost.open();
  } else if (typeof openNewPostModal === 'function') {
    openNewPostModal();
  }

  // Pre-fill after short delay to let form render
  setTimeout(function() {
    var titleEl = document.getElementById('new-post-title');
    var captionEl = document.getElementById('new-post-caption');
    var ownerEl = document.getElementById('new-post-owner');

    if (titleEl) {
      titleEl.value = brief.title || '';
      titleEl.dispatchEvent(new Event('input'));
    }
    if (captionEl && (brief.client_feedback || brief.description)) {
      // Strip [BRIEF NOTE]/[CHITRA NOTE] and [URGENT] from brief text
      var cleanBrief = (brief.client_feedback || brief.description || '')
        .replace(/\[URGENT\]\s*/g, '')
        .replace(/\[(?:CHITRA NOTE|BRIEF NOTE)\][^]*/gi, '')
        .trim();
      captionEl.value = cleanBrief;
      captionEl.style.height = 'auto';
      captionEl.style.height = captionEl.scrollHeight + 'px';
    }
    if (ownerEl) {
      ownerEl.value = 'Creative';
      ownerEl.dispatchEvent(new Event('change'));
    }

    // Transfer brief reference images to the new post form
    if (Array.isArray(brief.images) && brief.images.length > 0) {
      try {
        window._newPostAssetFiles = window._newPostAssetFiles || [];
        // Store the existing image URLs so the submit handler
        // can include them in payload.images without re-upload.
        // We inject them as a special property the submit handler
        // already reads.
        window._briefImportedImages = brief.images.slice();

        // Show a visual indicator in the form that images are
        // pre-loaded from the brief.
        var _previewWrap = document.getElementById('new-post-asset-preview');
        if (_previewWrap) {
          _previewWrap.innerHTML = '';
          brief.images.forEach(function(url) {
            if (!url) return;
            var _thumb = document.createElement('div');
            _thumb.style.cssText = 'position:relative;display:inline-block;margin:4px';
            _thumb.innerHTML = '<img src="' + url + '" style="width:56px;height:56px;object-fit:cover;border:1px solid #323244">' +
              '<span style="position:absolute;top:2px;left:2px;background:#1a1a24;font-family:IBM Plex Mono,monospace;font-size:6px;color:#9b87f5;padding:1px 3px;letter-spacing:.06em;text-transform:uppercase">brief</span>';
            _previewWrap.appendChild(_thumb);
          });
        }
      } catch (_imgErr) {}
    } else {
      window._briefImportedImages = null;
    }

    // Trigger validation so Create Post button enables
    if (typeof _npsCheckValid === 'function') _npsCheckValid();

    // Store brief post ID so we can park it after creation
    window._activeBriefPostId = briefPostId;
  }, 150);
}
