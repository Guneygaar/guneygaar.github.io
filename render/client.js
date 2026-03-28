/* render/client.js -- Client portal feed (Pass 1 of 3) */
(function () {
  'use strict';

  /* ---- helpers ---- */

  var SUPABASE_URL = window.SUPABASE_URL || '';

  function _esc(s) { return typeof esc === 'function' ? esc(s) : String(s || ''); }

  function _fmtDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (_) { return ''; }
  }

  function _truncate(text, max) {
    if (!text || text.length <= max) return null;
    return text.slice(0, max);
  }

  function _hashtagHtml(text) {
    return _esc(text).replace(/(#\w[\w]*)/g, '<span style="color:#378fe9;">$1</span>');
  }

  /* SVG icons */
  var ICON_BELL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  var ICON_DOTS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
  var ICON_GLOBE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/></svg>';
  var ICON_CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  var ICON_EYE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICON_FEED = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>';
  var ICON_REQ = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>';
  var ICON_ALERTS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

  /* ---- bucket helpers ---- */

  function _bucket(posts) {
    var approval = [];
    var input = [];
    var published = [];
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      if (p.stage === 'awaiting_approval') approval.push(p);
      else if (p.stage === 'awaiting_brand_input') input.push(p);
      else if (p.stage === 'published') published.push(p);
    }
    return { approval: approval, input: input, published: published };
  }

  /* ---- avatar ---- */

  function _avatarHtml(post) {
    var imgs = post.images;
    if (imgs && imgs.length && imgs[0]) {
      return '<img src="' + _esc(imgs[0]) + '" alt="" style="width:46px;height:46px;border-radius:50%;object-fit:cover;display:block;">';
    }
    if (post.stage === 'awaiting_brand_input') {
      return '<div style="width:46px;height:46px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;">' + ICON_EYE + '</div>';
    }
    var initial = (post.title || '?').charAt(0).toUpperCase();
    return '<div style="width:46px;height:46px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-family:\'DM Sans\',sans-serif;font-weight:700;font-size:18px;color:#C8A84B;">' + _esc(initial) + '</div>';
  }

  /* ---- status badge ---- */

  function _badgeHtml(stage) {
    if (stage === 'awaiting_approval') {
      return '<span style="display:inline-flex;align-items:center;gap:5px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.04em;color:#f59e0b;">' +
        '<span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;animation:clientPulse 2s infinite;"></span>' +
        'Awaiting Approval</span>';
    }
    if (stage === 'awaiting_brand_input') {
      return '<span style="display:inline-flex;align-items:center;gap:5px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.04em;color:#06b6d4;">' +
        '<span style="width:7px;height:7px;border-radius:50%;background:#06b6d4;animation:clientPulse 2s infinite;"></span>' +
        'Needs Your Input</span>';
    }
    if (stage === 'published') {
      return '<span style="display:inline-flex;align-items:center;gap:5px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.04em;color:#22c55e;">' +
        ICON_CHECK + ' Published</span>';
    }
    return '';
  }

  /* ---- pulse keyframes (injected once) ---- */

  function _ensurePulseStyle() {
    if (document.getElementById('client-pulse-style')) return;
    var style = document.createElement('style');
    style.id = 'client-pulse-style';
    style.textContent = '@keyframes clientPulse{0%,100%{opacity:1;}50%{opacity:0.35;}}';
    document.head.appendChild(style);
  }

  /* ---- caption ---- */

  function _captionHtml(post) {
    var text = post.caption || '';
    if (!text) return '';
    var noTruncate = post.stage === 'awaiting_brand_input';
    var limit = 210;
    var short = noTruncate ? null : _truncate(text, limit);
    var id = 'cap-' + (post.post_id || post.id || '');

    if (short) {
      return '<div id="' + _esc(id) + '" style="font-family:\'DM Sans\',sans-serif;font-size:13px;line-height:1.55;color:#ccc;padding:0 14px;margin-top:8px;">' +
        _hashtagHtml(short) +
        '<span data-action="expand-caption" data-id="' + _esc(id) + '" style="color:#378fe9;cursor:pointer;font-size:12px;">...more</span>' +
        '<span style="display:none;" data-full>' + _hashtagHtml(text) + '</span>' +
        '</div>';
    }
    return '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;line-height:1.55;color:#ccc;padding:0 14px;margin-top:8px;">' + _hashtagHtml(text) + '</div>';
  }

  /* ---- image grid ---- */

  function _imgGridHtml(images) {
    if (!images || !images.length) return '';
    var imgs = images.filter(function (u) { return !!u; });
    var n = imgs.length;
    if (n === 0) return '';

    var wrap = function (src, css, overlay) {
      return '<div style="' + css + 'overflow:hidden;position:relative;background:#111;">' +
        '<img src="' + _esc(src) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy">' +
        (overlay || '') + '</div>';
    };

    if (n === 1) {
      return '<div style="padding:0 14px;margin-top:10px;">' +
        wrap(imgs[0], 'aspect-ratio:4/3;border-radius:8px;') +
        '</div>';
    }

    if (n === 2) {
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:0 14px;margin-top:10px;">' +
        wrap(imgs[0], 'aspect-ratio:1/1;border-radius:8px 0 0 8px;') +
        wrap(imgs[1], 'aspect-ratio:1/1;border-radius:0 8px 8px 0;') +
        '</div>';
    }

    if (n === 3) {
      return '<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:130px 130px;gap:2px;padding:0 14px;margin-top:10px;height:260px;">' +
        wrap(imgs[0], 'grid-row:1/3;border-radius:8px 0 0 8px;') +
        wrap(imgs[1], 'border-radius:0 8px 0 0;') +
        wrap(imgs[2], 'border-radius:0 0 8px 0;') +
        '</div>';
    }

    /* 4+ : 2x2 grid with +N overlay on last cell */
    var extra = n > 4 ? n - 4 : 0;
    var overlayHtml = extra > 0
      ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;font-family:\'DM Sans\',sans-serif;font-size:20px;font-weight:700;color:#fff;">+' + extra + '</div>'
      : '';
    return '<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:150px 150px;gap:2px;padding:0 14px;margin-top:10px;height:300px;">' +
      wrap(imgs[0], 'border-radius:8px 0 0 0;') +
      wrap(imgs[1], 'border-radius:0 8px 0 0;') +
      wrap(imgs[2], 'border-radius:0 0 0 8px;') +
      wrap(imgs[3] || imgs[2], 'border-radius:0 0 8px 0;', overlayHtml) +
      '</div>';
  }

  /* ---- metadata rows ---- */

  function _metaRow1(post) {
    var parts = [];
    if (post.contentPillar) parts.push(_esc(post.contentPillar));
    if (post.location) parts.push(_esc(post.location));
    if (post.owner) parts.push(_esc(post.owner));
    if (!parts.length) return '';
    return '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#444;margin-top:2px;">' + parts.join(' &middot; ') + '</div>';
  }

  function _metaRow2(post) {
    if (!post.targetDate) return '';
    return '<div style="display:flex;align-items:center;gap:4px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#444;margin-top:2px;">' +
      ICON_GLOBE + ' ' + _esc(_fmtDate(post.targetDate)) +
      '</div>';
  }

  /* ---- single card ---- */

  function _cardHtml(post, isPublished) {
    var opacity = isPublished ? 'opacity:0.45;' : '';
    var pid = _esc(post.post_id || post.id || '');
    return '<div data-card-id="' + pid + '" style="padding:14px;border-bottom:1px solid rgba(255,255,255,0.06);' + opacity + '">' +
      /* header row */
      '<div style="display:flex;align-items:flex-start;gap:10px;">' +
        _avatarHtml(post) +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:15px;color:#e8e2d9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(post.title || 'Untitled') + '</div>' +
            '<button data-action="card-menu" data-id="' + pid + '" style="background:none;border:none;color:#555;cursor:pointer;padding:2px;flex-shrink:0;">' + ICON_DOTS + '</button>' +
          '</div>' +
          _metaRow1(post) +
          _metaRow2(post) +
        '</div>' +
      '</div>' +
      /* badge */
      '<div style="padding:8px 14px 0 56px;">' + _badgeHtml(post.stage) + '</div>' +
      /* caption */
      _captionHtml(post) +
      /* images */
      _imgGridHtml(post.images) +
    '</div>';
  }

  /* ---- section label ---- */

  function _sectionLabel(text) {
    return '<div style="padding:14px 14px 6px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:0.06em;color:#666;text-transform:uppercase;">' + text + '</div>';
  }

  /* ---- top bar ---- */

  function _topBarHtml(awaitCount) {
    var pill = awaitCount > 0
      ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,0.12);color:#f59e0b;margin-left:10px;">' + awaitCount + ' awaiting</span>'
      : '';
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);position:sticky;top:0;background:#0a0a0a;z-index:100;">' +
      '<div style="display:flex;align-items:center;">' +
        '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.22em;color:#888;">SRTD.IO</span>' +
        pill +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:14px;">' +
        '<button data-action="open-notifications" style="position:relative;background:none;border:none;color:#888;cursor:pointer;padding:4px;">' +
          ICON_BELL +
          '<span data-bell-dot style="position:absolute;top:2px;right:2px;width:7px;height:7px;border-radius:50%;background:#ef4444;"></span>' +
        '</button>' +
        '<div style="position:relative;">' +
          '<button data-action="top-menu-toggle" style="background:none;border:none;color:#888;cursor:pointer;padding:4px;">' + ICON_DOTS + '</button>' +
          '<div data-top-menu style="display:none;position:absolute;right:0;top:28px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:8px;min-width:160px;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,0.5);">' +
            '<button data-action="new-request" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#ccc;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;">New Request</button>' +
            '<button data-action="sign-out" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#888;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;border-top:1px solid rgba(255,255,255,0.06);">Sign Out</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---- bottom nav ---- */

  function _bottomNavHtml() {
    return '<div id="bottom-nav" style="position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:space-around;align-items:center;padding:8px 0 calc(8px + env(safe-area-inset-bottom));background:#0a0a0a;border-top:1px solid rgba(255,255,255,0.06);z-index:100;">' +
      '<button data-action="nav-feed" style="display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;color:#C8A84B;cursor:pointer;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.04em;padding:4px 12px;">' +
        ICON_FEED + 'Feed</button>' +
      '<button data-action="nav-requests" style="display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;color:#555;cursor:pointer;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.04em;padding:4px 12px;">' +
        ICON_REQ + 'Requests</button>' +
      '<button data-action="nav-alerts" style="display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;color:#555;cursor:pointer;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.04em;padding:4px 12px;">' +
        ICON_ALERTS + 'Alerts</button>' +
    '</div>';
  }

  /* ---- event delegation ---- */

  function _wireEvents(root) {
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      var id = btn.getAttribute('data-id');

      switch (action) {
        case 'open-notifications':
          if (typeof window.openNotifications === 'function') window.openNotifications();
          break;

        case 'top-menu-toggle':
          var menu = root.querySelector('[data-top-menu]');
          if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
          break;

        case 'new-request':
          var menu2 = root.querySelector('[data-top-menu]');
          if (menu2) menu2.style.display = 'none';
          if (typeof window.openClientRequestForm === 'function') window.openClientRequestForm();
          break;

        case 'sign-out':
          var menu3 = root.querySelector('[data-top-menu]');
          if (menu3) menu3.style.display = 'none';
          if (typeof window.logout === 'function') window.logout();
          break;

        case 'nav-feed':
          /* already on feed -- no-op */
          break;

        case 'nav-requests':
          if (typeof window.openClientRequestForm === 'function') window.openClientRequestForm();
          break;

        case 'nav-alerts':
          if (typeof window.openNotifications === 'function') window.openNotifications();
          break;

        case 'expand-caption':
          var capEl = document.getElementById(id);
          if (capEl) {
            var full = capEl.querySelector('[data-full]');
            if (full) {
              capEl.innerHTML = full.innerHTML;
            }
          }
          break;

        case 'card-menu':
          /* placeholder for Pass 2 */
          break;

        default:
          break;
      }
    });

    /* close top menu on outside click */
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-action="top-menu-toggle"]')) {
        var menu = root.querySelector('[data-top-menu]');
        if (menu) menu.style.display = 'none';
      }
    });
  }

  /* ---- main render ---- */

  window.renderClientView = function () {
    var cv = document.getElementById('client-view');
    if (!cv) return;

    _ensurePulseStyle();

    var posts = window.allPosts || [];
    var buckets = _bucket(posts);
    var awaitCount = buckets.approval.length + buckets.input.length;

    var html = _topBarHtml(awaitCount);

    var hasContent = buckets.approval.length || buckets.input.length || buckets.published.length;

    html += '<div style="padding-bottom:72px;">';

    if (!hasContent) {
      html += '<div style="padding:48px 16px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">Nothing awaiting your review.</div>';
    } else {
      if (buckets.approval.length) {
        html += _sectionLabel('&#9670; Awaiting Your Approval');
        for (var a = 0; a < buckets.approval.length; a++) {
          html += _cardHtml(buckets.approval[a], false);
        }
      }
      if (buckets.input.length) {
        html += _sectionLabel('&#9670; Team Needs Your Input');
        for (var b = 0; b < buckets.input.length; b++) {
          html += _cardHtml(buckets.input[b], false);
        }
      }
      if (buckets.published.length) {
        html += _sectionLabel('&#9670; Published Posts');
        for (var c = 0; c < buckets.published.length; c++) {
          html += _cardHtml(buckets.published[c], true);
        }
      }
    }

    html += '</div>';
    html += _bottomNavHtml();

    cv.innerHTML = html;
    _wireEvents(cv);
  };

})();

/* ============================================================
   Preserved functions below -- untouched from original
   ============================================================ */

window.openClientRequestForm = function() {
  var o = document.getElementById('req-overlay');
  if (o) {
    o.style.display = 'flex';
    var nav = document.getElementById('bottom-nav');
    if (nav) nav.style.display = 'none';
    var _mn = new Date();
    _mn.setDate(_mn.getDate() + 2);
    var _ms = _mn.toISOString().split('T')[0];
    var _di = document.getElementById('req-date');
    if (_di) _di.min = _ms;
  }
}

window._closeReqForm = function() {
  var o = document.getElementById('req-overlay');
  if (o) o.style.display = 'none';
  var nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = '';
  // Reset name field
  var nameEl = document.getElementById('req-name');
  if (nameEl) nameEl.value = '';
  // Reset all fields for next open
  var topic = document.getElementById('req-topic');
  if (topic) topic.value = '';
  var date = document.getElementById('req-date');
  if (date) date.value = '';
  var dateLabel = document.getElementById('req-date-label');
  if (dateLabel) { dateLabel.textContent = 'Pick a date'; dateLabel.style.color = 'rgba(255,255,255,0.45)'; }
  // Reset chips
  var chips = document.querySelectorAll('#req-overlay button[onclick*="_reqToggleChip"]');
  chips.forEach(function(c) {
    c.style.color = 'rgba(255,255,255,0.55)';
    c.style.background = 'transparent';
    c.style.borderColor = 'rgba(255,255,255,0.18)';
  });
  // Reset photo grid
  window._reqStoredFiles = [];
  var grid = document.getElementById('req-photo-grid');
  if (grid) {
    var thumbs = grid.querySelectorAll('[data-file-idx]');
    thumbs.forEach(function(t) { t.remove(); });
  }
  var countEl = document.getElementById('req-photo-count');
  if (countEl) countEl.textContent = 'No photos added';
  var fi = document.getElementById('req-file');
  if (fi) fi.value = '';
  var pw = document.getElementById('req-progress-wrap');
  if (pw) pw.style.display = 'none';
  // Reset submit button to disabled state
  var btn = document.getElementById('req-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.style.color = '#444';
    btn.style.borderColor = 'rgba(255,255,255,0.1)';
    btn.style.background = 'transparent';
    btn.style.cursor = 'not-allowed';
    btn.style.boxShadow = 'none';
  }
}

window._reqToggleChip = function(el) {
  var allChips = el.parentNode.querySelectorAll('button');
  allChips.forEach(function(chip) {
    chip.style.color = 'rgba(255,255,255,0.55)';
    chip.style.background = 'transparent';
    chip.style.borderColor = 'rgba(255,255,255,0.18)';
  });
  el.style.color = '#C8A84B';
  el.style.background = 'rgba(200,168,75,0.07)';
  el.style.borderColor = 'rgba(200,168,75,0.4)';
}

window._reqSetUrgency = function(el, type) {
  var n = document.getElementById('req-urgency-normal');
  var u = document.getElementById('req-urgency-urgent');
  if (n) { n.style.color='#555'; n.style.background='transparent'; n.style.borderColor='rgba(255,255,255,0.07)'; }
  if (u) { u.style.color='#555'; u.style.background='transparent'; u.style.borderColor='rgba(255,255,255,0.07)'; }
  if (type === 'urgent' && u) {
    u.style.color='#FF4B4B'; u.style.background='rgba(255,75,75,0.06)'; u.style.borderColor='rgba(255,75,75,0.3)';
  } else if (n) {
    n.style.color='#3ECF8E'; n.style.background='rgba(62,207,142,0.08)'; n.style.borderColor='rgba(62,207,142,0.3)';
  }
}

window._reqPreviewFile = function(input) {
  var files = Array.from(input.files);
  if (!files.length) return;
  var area = document.getElementById('req-upload-area');
  var preview = document.getElementById('req-upload-preview');
  var img = document.getElementById('req-preview-img');
  var name = document.getElementById('req-preview-name');
  var reader = new FileReader();
  reader.onload = function(e) {
    if (img) img.src = e.target.result;
    if (area) area.style.display = 'none';
    if (preview) preview.style.display = 'block';
  };
  reader.readAsDataURL(files[0]);
  if (name) name.textContent = files.length === 1
    ? files[0].name
    : files.length + ' photos selected';
}

window._reqClearUpload = function() {
  var input = document.getElementById('req-file');
  var area = document.getElementById('req-upload-area');
  var preview = document.getElementById('req-upload-preview');
  if (input) input.value = '';
  if (area) area.style.display = 'block';
  if (preview) preview.style.display = 'none';
}

window._reqAddPhotos = function(input) {
  var files = Array.from(input.files);
  if (!files.length) return;
  var grid = document.getElementById('req-photo-grid');
  var addTile = document.getElementById('req-add-tile');
  var progressWrap = document.getElementById('req-progress-wrap');
  var progressFill = document.getElementById('req-progress-fill');
  var progressText = document.getElementById('req-progress-text');
  if (!grid || !addTile) return;

  window._reqStoredFiles = window._reqStoredFiles || [];
  var total = files.length;
  var loaded = 0;

  // Show progress bar
  if (progressWrap) progressWrap.style.display = 'block';
  if (progressFill) progressFill.style.background = '#C8A84B';

  // Disable send button during upload
  var sendBtn = document.getElementById('req-submit-btn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.style.color = '#444';
    sendBtn.style.borderColor = 'rgba(255,255,255,0.1)';
    sendBtn.style.cursor = 'not-allowed';
    sendBtn.style.boxShadow = 'none';
    sendBtn.textContent = 'Loading photos...';
  }

  files.forEach(function(file) {
    var fileIdx = window._reqStoredFiles.length;
    window._reqStoredFiles.push(file);
    var reader = new FileReader();
    reader.onload = function(e) {
      loaded++;
      var pct = Math.round((loaded / total) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.textContent =
        'Loading ' + loaded + ' of ' + total + ' photos...';

      var div = document.createElement('div');
      div.dataset.fileIdx = fileIdx;
      div.style.cssText = 'aspect-ratio:1/1;position:relative;' +
        'overflow:hidden;background:#111;';
      div.innerHTML =
        '<img src="' + e.target.result + '" ' +
        'style="width:100%;height:100%;object-fit:cover;display:block;">' +
        '<button onclick="(function(el){' +
        'var idx=el.closest(\'div\').dataset.fileIdx;' +
        'if(window._reqStoredFiles&&idx!==undefined)' +
        'window._reqStoredFiles[idx]=null;' +
        'el.closest(\'div\').remove();' +
        '_reqUpdatePhotoCount();})(this)" ' +
        'style="position:absolute;top:3px;right:3px;width:22px;height:22px;' +
        'background:rgba(0,0,0,0.85);border-radius:50%;display:flex;' +
        'align-items:center;justify-content:center;font-size:11px;' +
        'color:#e8e2d9;cursor:pointer;border:none;">&#x2715;</button>';
      grid.insertBefore(div, addTile);
      _reqUpdatePhotoCount();

      // All loaded
      if (loaded === total) {
        if (progressFill) {
          progressFill.style.background = '#3ECF8E';
          progressFill.style.width = '100%';
        }
        if (progressText) {
          progressText.style.color = '#3ECF8E';
          progressText.textContent =
            window._reqStoredFiles.filter(function(f){return f!==null;}).length +
            ' photos ready';
        }
        // Re-enable send if name + brief filled
        _reqValidate();
      }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

window._reqUpdatePhotoCount = function() {
  var grid = document.getElementById('req-photo-grid');
  var count = grid ? grid.querySelectorAll('img').length : 0;
  var el = document.getElementById('req-photo-count');
  if (el) el.textContent = count > 0
    ? count + ' photo' + (count !== 1 ? 's' : '') + ' selected'
    : 'No photos added';
}

window._reqValidate = function() {
  var name = (document.getElementById('req-name') || {}).value || '';
  var brief = (document.getElementById('req-topic') || {}).value || '';
  var btn = document.getElementById('req-submit-btn');
  if (!btn) return;
  var valid = name.trim().length > 0 && brief.trim().length > 0;
  if (valid) {
    btn.disabled = false;
    btn.style.color = '#C8A84B';
    btn.style.borderColor = '#C8A84B';
    btn.style.background = 'rgba(200,168,75,0.06)';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 0 12px rgba(200,168,75,0.12)';
    btn.innerHTML = '&#x2192; Send Request';
  } else {
    btn.disabled = true;
    btn.style.color = '#444';
    btn.style.borderColor = 'rgba(255,255,255,0.1)';
    btn.style.background = 'transparent';
    btn.style.cursor = 'not-allowed';
    btn.style.boxShadow = 'none';
  }
}
