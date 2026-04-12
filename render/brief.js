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

// ===============================================
// Brief Sheet - full-screen overlay for brief/REQ posts
// ===============================================
window._openBriefSheet = function(postId) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;

  var existing = document.getElementById('brief-sheet-overlay');
  if (existing) existing.remove();

  var _role = (window.AppState.user.effectiveRole || '').toLowerCase();
  var _isClient = _role === 'client';
  var _isCreativeRole = _role === 'creative' || _role === 'pranav';
  var _canAssign = _role === 'admin' || _role === 'servicing' || _role === 'chitra' || _role === 'shubham';
  var _isBriefDone = (post.stage || '') === 'brief_done';
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
  var chitraNote = '';
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

    var chitraMatch = briefText.match(/\[CHITRA NOTE\]([\s\S]*)/i);
    if (chitraMatch) {
      chitraNote = chitraMatch[1].trim();
      briefText = briefText.replace(/\[CHITRA NOTE\][\s\S]*/i, '').trim();
    }
  }

  // Check if brief is assigned to any creative (not just Pranav)
  var _ownerLower = (post.owner || '').toLowerCase();
  var _isAssigned =
    (_ownerLower !== '' && _ownerLower !== 'servicing' && _ownerLower !== 'chitra' &&
     _ownerLower !== 'admin' && _ownerLower !== 'shubham' && _ownerLower !== 'client') &&
    !_isBriefDone;
  // Check if current user is the creative assigned to THIS brief
  var _userName = (window.AppState.user.name || '').toLowerCase();
  var _isAssignedCreative = _isCreativeRole && _isAssigned &&
    (_ownerLower === _userName || _ownerLower === 'creative');
  var _assigneeName = _isAssigned ? (post.owner || '') : '';
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

    // STATE: brief_done
    if (_isBriefDone) {
      return _viewPostBtn +
        (_isChitra ? _reopenBtn : '');
    }
    // STATE: has linked post (post already created)
    if (_hasLinkedPost && linkedPost) {
      return _viewPostBtn +
        (_isChitra ? _closeBtn : '');
    }
    // STATE: assigned to creative, no linked post yet
    if (_isAssigned) {
      if (_canAssign) {
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
          '<div id="brief-assign-dropdown-' + postId + '"></div>' + _closeBtn;
      }
      if (_isAssignedCreative) {
        return '<button onclick="_createPostFromBrief(\'' + postId + '\')" ' +
          'style="display:flex;align-items:center;justify-content:center;gap:6px;' +
          'background:#0e0e0e;border:1px solid #C8A84B;border-radius:10px;' +
          'padding:13px 20px;width:100%;font-family:\'IBM Plex Mono\',monospace;' +
          'font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;' +
          'color:#C8A84B;cursor:pointer;">' +
          '&#x2192; Create Post</button>' + _closeBtn;
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
    '<div onclick="window.open(\'https://wa.me/?text=\' + encodeURIComponent(\'Brief: ' +
    esc((post.title || '').replace(/'/g, '')) +
    '\\n\\nhttps://srtd.io/?open=' + esc(postId) + '\'), \'_blank\')" ' +
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

    // Chitra Note (hidden from client)
    (!_isClient && chitraNote ?
      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #1e1e2e;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;font-weight:600;' +
      'letter-spacing:0.12em;text-transform:uppercase;' +
      'color:#555566;margin-bottom:8px;">Direction from Chitra</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'color:#8E8E93;line-height:1.65;font-style:italic;">' +
      esc(chitraNote) + '</div>' +
      '</div>'
      : '') +

    '</div>' +

    // SECTION 02 — REFERENCE PHOTOS
    (Array.isArray(post.images) && post.images.length ?
      '<div style="padding:16px 20px;border-bottom:1px solid #1e1e2e;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;font-weight:600;' +
      'letter-spacing:0.12em;text-transform:uppercase;color:#C8A84B;margin-bottom:2px;">02</div>' +
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

    // SECTION 03 — ASSIGNED TO (dynamic)
    (_isAssigned ?
      '<div style="padding:16px 20px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;font-weight:600;' +
      'letter-spacing:0.12em;text-transform:uppercase;color:#C8A84B;margin-bottom:2px;">' +
      (Array.isArray(post.images) && post.images.length ? '03' : '02') + '</div>' +
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
    '<button onclick="document.getElementById(\'brief-sheet-overlay\').remove();' +
    'document.body.style.overflow=\'\';" ' +
    'style="display:flex;align-items:center;justify-content:center;gap:6px;' +
    'background:transparent;border:1px solid #252535;border-radius:10px;' +
    'padding:11px 20px;cursor:pointer;width:100%;margin-top:8px;">' +
    '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:500;' +
    'letter-spacing:0.1em;text-transform:uppercase;color:#555566;">&#x2715;   CLOSE BRIEF</span>' +
    '</button>' +
    '</div>';

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

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

// Fetch creative members from user_roles and show assignment dropdown
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
  apiFetch('/user_roles?role=eq.creative&select=name,email', { method: 'GET' })
    .then(function(members) {
      if (!Array.isArray(members) || !members.length) {
        container.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
          'color:#FF4B4B;padding:10px 0;">No creative members found</div>';
        return;
      }
      var html = '<div style="margin-top:8px;border:1px solid #252535;border-radius:8px;overflow:hidden;">';
      members.forEach(function(m) {
        var name = m.name || m.email || '';
        var initial = (name.charAt(0) || '?').toUpperCase();
        html += '<button onclick="_assignBrief(\'' + esc(postId) + '\',\'' + esc(name) + '\',' + isReassign + ')" ' +
          'style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;' +
          'background:#0d0d12;border:none;border-bottom:1px solid #191924;cursor:pointer;">' +
          ((typeof renderAvatar === 'function') ? renderAvatar(m.email || name, 'creative', 28) : '<div style="width:28px;height:28px;border-radius:50%;background:#9b87f526;border:1px solid #9b87f54d;display:flex;align-items:center;justify-content:center;font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:600;color:#9b87f5;">' + esc(initial) + '</div>') +
          '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;font-weight:600;color:#F0F0F2;">' +
          esc(name) + '</div>' +
          '</button>';
      });
      html += '</div>';
      container.innerHTML = html;
    })
    .catch(function(err) {
      console.error('[brief] fetch creative members failed', err);
      window.logError && window.logError(err && err.message, err && err.stack, 'brief-fetch-creatives');
      container.innerHTML = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
        'color:#FF4B4B;padding:10px 0;">Failed to load — try again</div>';
    });
}

// Assign or reassign brief to a specific creative member
window._assignBrief = function(postId, ownerName, isReassign) {
  var direction = (document.getElementById('brief-direction-' + postId) || {}).value || '';
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;

  var actorName = window.AppState.user.email || window.AppState.user.name || 'Unknown';
  var actorRole = window.AppState.user.effectiveRole || 'Admin';
  var actionLabel = (isReassign ? 'Brief reassigned to ' : 'Brief assigned to ') + ownerName;
  var toastMsg = (isReassign ? 'Reassigned to ' : 'Assigned to ') + ownerName;

  if (post._isRequest) {
    // Request from requests table: mark assigned, then create a new post
    var nowISO = new Date().toISOString();
    var updatedFeedback = (post.client_feedback || '');
    if (direction.trim()) {
      updatedFeedback += '\n\n[CHITRA NOTE] ' + direction.trim();
    }
    var newPostId = 'POST-' + Date.now();
    // 1. PATCH request status to assigned
    apiFetch('/requests?id=eq.' + encodeURIComponent(postId), {
      method: 'PATCH',
      body: JSON.stringify({ status: 'assigned' })
    }).then(function() {
      // 2. Create new post linked to this request
      return apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify({
          post_id: newPostId,
          title: post.title || '',
          stage: 'brief',
          owner: ownerName,
          client_feedback: updatedFeedback,
          target_date: post.target_date || null,
          images: post.images || [],
          linked_post_id: post.post_id,
          created_at: nowISO,
          updated_at: nowISO
        })
      });
    }).then(function() {
      var _briefPostTitle = post.title || '';
      var _briefPostImage = (Array.isArray(post.images) && post.images.length) ? post.images[0] : '';
      _generateWhatsAppPreview(newPostId, _briefPostTitle, _briefPostImage);

      logActivity({
        post_id: newPostId,
        actor: actorName,
        actor_role: actorRole,
        action: actionLabel +
          (direction.trim() ? ' with direction' : '')
      });
      // Update AppState: remove request entry, add new post
      var filtered = (window.AppState.posts.all || []).filter(function(p) {
        return (p.post_id || p.id) !== postId;
      });
      filtered.push({
        post_id: newPostId,
        id: newPostId,
        title: post.title || '',
        stage: 'brief',
        owner: ownerName,
        client_feedback: updatedFeedback,
        target_date: post.target_date || null,
        images: post.images || [],
        linked_post_id: post.post_id,
        created_at: nowISO,
        updated_at: nowISO
      });
      window.AppState.posts.setAll(filtered);
      document.getElementById('brief-sheet-overlay').remove();
      document.body.style.overflow = '';
      showToast(toastMsg, 'success');
      if (typeof scheduleRender === 'function') scheduleRender();
    }).catch(function(err) {
      console.error('[brief] assign request failed', err);
      window.logError && window.logError(err && err.message, err && err.stack, 'assign-request');
      showToast('Failed - try again', 'error');
    });
    return;
  }

  // Existing posts flow — PATCH the post directly
  var updatedFeedback = (post.client_feedback || '');
  if (direction.trim()) {
    updatedFeedback += '\n\n[CHITRA NOTE] ' + direction.trim();
  }
  apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
    method: 'PATCH',
    body: JSON.stringify({
      stage: 'brief',
      owner: ownerName,
      client_feedback: updatedFeedback,
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  }).then(function() {
    logActivity({
      post_id: postId,
      actor: actorName,
      actor_role: actorRole,
      action: actionLabel +
        (direction.trim() ? ' with direction' : '')
    });
    document.getElementById('brief-sheet-overlay').remove();
    document.body.style.overflow = '';
    showToast(toastMsg, 'success');
    loadPosts();
  }).catch(function(err) {
    console.error('[brief] assign brief failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'assign-brief');
    showToast('Failed - try again', 'error');
  });
}

// Keep backward compat — old callers still reference _assignBriefToPranav
window._assignBriefToPranav = function(postId) {
  window._assignBrief(postId, 'Pranav', false);
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
      // Update AppState — change stage to brief_done
      var updated = (window.AppState.posts.all || []).map(function(p) {
        if ((p.post_id || p.id) === postId) {
          return Object.assign({}, p, { stage: 'brief_done' });
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
      stage: 'brief_done',
      updated_at: new Date().toISOString()
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
      updated_at: new Date().toISOString()
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

  // Open new post form
  if (typeof openNewPostModal === 'function') {
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
      // Strip [CHITRA NOTE] and [URGENT] from brief text
      var cleanBrief = (brief.client_feedback || brief.description || '')
        .replace(/\[URGENT\]\s*/g, '')
        .replace(/\[CHITRA NOTE\][^]*/gi, '')
        .trim();
      captionEl.value = cleanBrief;
      captionEl.style.height = 'auto';
      captionEl.style.height = captionEl.scrollHeight + 'px';
    }
    if (ownerEl) {
      ownerEl.value = 'Creative';
      ownerEl.dispatchEvent(new Event('change'));
    }

    // Trigger validation so Create Post button enables
    if (typeof _npsCheckValid === 'function') _npsCheckValid();

    // Store brief post ID so we can park it after creation
    window._activeBriefPostId = briefPostId;
  }, 150);
}
