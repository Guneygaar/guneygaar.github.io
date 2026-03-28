/* ===============================================
   render/brief.js - Brief sheet overlay
   Extracted from 07-post-load.js (Phase 1)
=============================================== */
console.log("LOADED:", "render/brief.js");

// ===============================================
// Brief Sheet - full-screen overlay for brief/REQ posts
// ===============================================
window._openBriefSheet = function(postId) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;

  var existing = document.getElementById('brief-sheet-overlay');
  if (existing) existing.remove();

  var _role = (window.effectiveRole || '').toLowerCase();
  var _isClient = _role === 'client';
  var _isPranav = _role === 'creative' ||
    _role === 'pranav' ||
    (window.currentUserEmail || '').toLowerCase().includes('pranav');
  var _isChitra = !_isClient && !_isPranav;
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

  var rawComments = post.comments || '';
  var contentType = '';
  var typeMatch = rawComments.match(/\[Type:\s*([^\]]+)\]/);
  if (typeMatch) {
    contentType = typeMatch[1].trim();
    rawComments = rawComments.replace(/\s*\[Type:[^\]]+\]/, '').trim();
  }
  var briefText = rawComments;
  briefText = briefText.replace(/^\[URGENT\]\s*/, '').trim();

  var chitraNote = '';
  var chitraMatch = briefText.match(/\[CHITRA NOTE\]([\s\S]*)/i);
  if (chitraMatch) {
    chitraNote = chitraMatch[1].trim();
    briefText = briefText.replace(/\[CHITRA NOTE\][\s\S]*/i, '').trim();
  }

  var _isAssignedToPranav =
    (post.owner || '').toLowerCase() === 'pranav' &&
    !_isBriefDone;
  var _hasLinkedPost = !!(post.linked_post_id);
  var linkedPost = null;
  if (_hasLinkedPost) {
    linkedPost = (allPosts || []).find(function(p) {
      return p.post_id === post.linked_post_id;
    });
  }

  var overlay = document.createElement('div');
  overlay.id = 'brief-sheet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;' +
    'background:#0a0a0f;overflow-y:auto;-webkit-overflow-scrolling:touch;';

  overlay.innerHTML =
    // Topbar
    '<div style="position:sticky;top:0;z-index:10;' +
    'background:rgba(10,10,15,0.95);backdrop-filter:blur(8px);' +
    'display:flex;align-items:center;justify-content:space-between;' +
    'padding:14px 18px;border-bottom:1px solid rgba(200,168,75,0.15);">' +
    '<button onclick="document.getElementById(\'brief-sheet-overlay\').remove();' +
    'document.body.style.overflow=\'\';" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.5);' +
    'background:transparent;border:none;cursor:pointer;">&#x2190; Back</button>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.18em;text-transform:uppercase;color:#C8A84B;">Brief</div>' +
    '<div style="width:60px;"></div>' +
    '</div>' +

    // Title + meta
    '<div style="padding:28px 18px 0;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);' +
    'margin-bottom:8px;">Brief Title</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:24px;' +
    'font-weight:700;color:#e8e2d9;line-height:1.2;margin-bottom:10px;">' +
    esc(post.title || '') + '</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.04em;color:rgba(255,255,255,0.4);">' +
    esc(sentTime) + '</div>' +
    '</div>' +

    // Brief Done status banner
    (_isBriefDone ?
      '<div style="padding:8px 18px;background:rgba(200,168,75,0.08);' +
      'border-left:3px solid #C8A84B;margin:0 0 4px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#C8A84B;">' +
      'Brief Closed</div>' +
      '</div>'
      : '') +

    // Linked post info (if linked)
    (_hasLinkedPost && linkedPost ?
      '<div style="padding:12px 18px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.2em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.4);margin-bottom:8px;">Linked Post</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
      'padding:12px 14px;border:1px dashed rgba(200,168,75,0.25);">' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'font-weight:600;color:#e8e2d9;">' + esc(linkedPost.title) + '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);">' +
      esc((linkedPost.stage || '').replace(/_/g,' ')) + '</div>' +
      '</div></div>'
      : '') +

    // Divider
    '<div style="height:1px;background:rgba(200,168,75,0.12);margin:0 18px;"></div>' +

    // Content type (extracted from comments)
    (contentType ?
      '<div style="padding:16px 18px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.2em;text-transform:uppercase;' +
      'color:#C8A84B;margin-bottom:10px;display:block;">Content Type</div>' +
      '<div style="display:inline-flex;align-items:center;' +
      'border:1px dashed rgba(200,168,75,0.3);padding:5px 10px;">' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
      'letter-spacing:0.1em;text-transform:uppercase;' +
      'color:#e8e2d9;font-weight:500;">' + esc(contentType) + '</span>' +
      '</div></div>' +
      '<div style="height:1px;background:rgba(200,168,75,0.12);margin:0 18px;"></div>'
      : '') +

    // Brief text
    '<div style="padding:0 18px 24px;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.18em;text-transform:uppercase;' +
    'color:#C8A84B;margin-bottom:10px;">The Brief</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
    'color:#e8e2d9;line-height:1.7;white-space:pre-wrap;">' +
    esc(briefText || 'No brief text provided.') + '</div>' +
    '</div>' +

    // Chitra Note section (hidden from client - internal creative direction)
    (!_isClient && chitraNote ?
      '<div style="height:1px;background:rgba(200,168,75,0.12);margin:0 18px;"></div>' +
      '<div style="padding:16px 18px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.2em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:8px;">Direction from Chitra</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'color:rgba(255,255,255,0.75);line-height:1.65;font-style:italic;">' +
      esc(chitraNote) + '</div>' +
      '</div>'
      : '') +

    // Reference photos
    (Array.isArray(post.images) && post.images.length ?
      '<div style="padding:0 18px 24px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.18em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.4);margin-bottom:10px;">Reference Photos</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;">' +
      post.images.map(function(url, i) {
        return '<img src="' + url + '" loading="lazy" ' +
        'onclick="_edOpenLightbox(\'' + postId + '\',' + i + ')" ' +
        'style="aspect-ratio:1/1;width:100%;object-fit:cover;' +
        'display:block;cursor:pointer;">';
      }).join('') +
      '</div></div>'
      : '') +

    // Role-based bottom action (state machine)
    (function() {
      var _viewPostBtn = (_hasLinkedPost && linkedPost) ?
        '<div style="padding:0 18px 32px;">' +
        (_isClient ?
        '<button data-action="clientViewPost" data-id="' + esc(linkedPost.post_id) + '" ' +
        'style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
        'color:#3ECF8E;background:rgba(62,207,142,0.06);' +
        'border:1px solid #3ECF8E;padding:16px 0;cursor:pointer;">' +
        '&#x2192; View Post</button>'
        :
        '<button onclick="(function(){' +
        'var o=document.getElementById(\'brief-sheet-overlay\');' +
        'if(o)o.remove();' +
        'document.body.style.overflow=\'\';' +
        'setTimeout(function(){openPCS(\'' +
        esc(linkedPost.post_id) + '\',\'\');},150);' +
        '})()" ' +
        'style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
        'color:#3ECF8E;background:rgba(62,207,142,0.06);' +
        'border:1px solid #3ECF8E;padding:16px 0;cursor:pointer;">' +
        '&#x2192; View Post</button>') +
        '</div>' : '';
      var _reopenBtn =
        '<div style="padding:0 18px 32px;">' +
        '<button onclick="_reopenBrief(\'' + postId + '\')" ' +
        'style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.4);background:transparent;' +
        'border:1px solid rgba(255,255,255,0.12);' +
        'padding:14px 0;cursor:pointer;">&#x21BA; Reopen Brief</button>' +
        '</div>';
      var _closeBtn =
        '<div style="padding:12px 18px 0;">' +
        '<button onclick="_closeBriefConfirm(\'' + postId + '\')" ' +
        'style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.4);background:transparent;' +
        'border:1px solid rgba(255,255,255,0.12);' +
        'padding:14px 0;cursor:pointer;">&#x2715; Close Brief</button>' +
        '</div>';
      var _readOnly =
        '<div style="padding:0 18px 32px;">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
        'letter-spacing:0.12em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.35);text-align:center;">' +
        'The team is working on this</div>' +
        '</div>';

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
      // STATE: assigned to Pranav, no linked post yet
      if (_isAssignedToPranav) {
        if (_isChitra) {
          return '<div style="padding:0 18px 32px;">' +
            '<div style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
            'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
            'color:rgba(255,255,255,0.4);background:transparent;' +
            'border:1px solid rgba(255,255,255,0.1);' +
            'padding:14px 0;text-align:center;">' +
            '&#x2713; Assigned to Pranav</div>' +
            '</div>' + _closeBtn;
        }
        if (_isPranav) {
          return '<div style="padding:0 18px 32px;">' +
            '<button onclick="_createPostFromBrief(\'' + postId + '\')" ' +
            'style="width:100%;font-family:\'IBM Plex Mono\',monospace;' +
            'font-size:9px;letter-spacing:0.2em;text-transform:uppercase;' +
            'color:#C8A84B;background:rgba(200,168,75,0.06);' +
            'border:1px solid #C8A84B;padding:16px 0;cursor:pointer;' +
            'box-shadow:0 0 14px rgba(200,168,75,0.12);">&#x2192; Create Post</button>' +
            '</div>' + _closeBtn;
        }
        return _readOnly;
      }
      // STATE: unassigned (owner=Chitra)
      if (_isChitra) {
        return '<div style="padding:0 18px 24px;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
          'letter-spacing:0.18em;text-transform:uppercase;' +
          'color:#C8A84B;margin-bottom:10px;">Your Direction for Pranav</div>' +
          '<textarea id="brief-direction-' + postId + '" rows="4" ' +
          'placeholder="Add your creative direction, angle, key message..." ' +
          'style="width:100%;background:transparent;border:none;' +
          'border-bottom:1px solid rgba(200,168,75,0.3);color:#e8e2d9;' +
          'font-family:\'DM Sans\',sans-serif;font-size:14px;' +
          'padding:8px 0 10px;outline:none;resize:none;line-height:1.7;' +
          'caret-color:#C8A84B;"></textarea>' +
          '</div>' +
          '<div style="padding:0 18px 32px;">' +
          '<button onclick="_assignBriefToPranav(\'' + postId + '\')" ' +
          'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
          'letter-spacing:0.2em;text-transform:uppercase;color:#C8A84B;' +
          'background:rgba(200,168,75,0.06);border:1px solid #C8A84B;' +
          'padding:16px 0;cursor:pointer;' +
          'box-shadow:0 0 14px rgba(200,168,75,0.12);">&#x2192; Assign to Pranav</button>' +
          '</div>' + _closeBtn;
      }
      return _readOnly;
    }());

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

window._assignBriefToPranav = function(postId) {
  var direction = (document.getElementById('brief-direction-' + postId) || {}).value || '';
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  var updatedComments = (post ? (post.comments || '') : '');
  if (direction.trim()) {
    updatedComments += '\n\n[CHITRA NOTE] ' + direction.trim();
  }
  apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
    method: 'PATCH',
    body: JSON.stringify({
      stage: 'brief',
      owner: 'Pranav',
      comments: updatedComments,
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  }).then(function() {
    logActivity({
      post_id: postId,
      actor: 'Chitra',
      actor_role: 'Servicing',
      action: 'Brief assigned to Pranav' +
        (direction.trim() ? ' with direction' : '')
    });
    document.getElementById('brief-sheet-overlay').remove();
    document.body.style.overflow = '';
    showToast('Assigned to Pranav', 'success');
    loadPosts();
  }).catch(function() {
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
    'background:rgba(0,0,0,0.75);display:flex;' +
    'align-items:center;justify-content:center;padding:24px;';

  overlay.innerHTML =
    '<div style="background:#0d0d14;border:1px solid rgba(200,168,75,0.2);' +
    'padding:28px 24px;max-width:340px;width:100%;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.18em;text-transform:uppercase;' +
    'color:#C8A84B;margin-bottom:12px;">Close This Brief?</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:16px;' +
    'font-weight:600;color:#e8e2d9;margin-bottom:8px;">' +
    esc(title) + '</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;' +
    'color:rgba(255,255,255,0.5);line-height:1.6;margin-bottom:24px;">' +
    'This marks the brief as delivered. It will move to Closed Briefs.' +
    '</div>' +
    '<div style="display:flex;gap:10px;">' +
    '<button onclick="document.getElementById(\'brief-confirm-overlay\').remove()" ' +
    'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.14em;text-transform:uppercase;' +
    'background:transparent;border:1px solid rgba(255,255,255,0.12);' +
    'color:rgba(255,255,255,0.5);padding:12px 0;cursor:pointer;">Cancel</button>' +
    '<button onclick="_closeBrief(\'' + postId + '\')" ' +
    'style="flex:2;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.14em;text-transform:uppercase;' +
    'background:rgba(200,168,75,0.1);border:1px solid #C8A84B;' +
    'color:#C8A84B;padding:12px 0;cursor:pointer;">' +
    'Close Brief &#x2192;</button>' +
    '</div></div>';

  document.body.appendChild(overlay);
}

window._closeBrief = function(postId) {
  document.getElementById('brief-confirm-overlay') &&
    document.getElementById('brief-confirm-overlay').remove();

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
  }).catch(function() {
    showToast('Failed - try again', 'error');
  });
}

window._reopenBrief = function(postId) {
  apiFetch('/posts?post_id=eq.' + encodeURIComponent(postId), {
    method: 'PATCH',
    body: JSON.stringify({
      stage: 'brief',
      owner: 'Chitra',
      updated_at: new Date().toISOString()
    })
  }).then(function() {
    var overlay = document.getElementById('brief-sheet-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    showToast('Brief reopened', 'success');
    loadPosts();
  }).catch(function() {
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
    if (captionEl && brief.comments) {
      // Strip [CHITRA NOTE] and [URGENT] from comments
      var cleanBrief = (brief.comments || '')
        .replace(/\[URGENT\]\s*/g, '')
        .replace(/\[CHITRA NOTE\][^]*/gi, '')
        .trim();
      captionEl.value = cleanBrief;
      captionEl.style.height = 'auto';
      captionEl.style.height = captionEl.scrollHeight + 'px';
    }
    if (ownerEl) {
      ownerEl.value = 'Pranav';
      ownerEl.dispatchEvent(new Event('change'));
    }

    // Trigger validation so Create Post button enables
    if (typeof _npsCheckValid === 'function') _npsCheckValid();

    // Store brief post ID so we can park it after creation
    window._activeBriefPostId = briefPostId;
  }, 150);
}
