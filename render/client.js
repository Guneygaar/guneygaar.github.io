/* render/client.js -- Client portal feed (polish pass) */
(function () {
  'use strict';

  /* ---- helpers ---- */

  var SUPABASE_URL = window.SUPABASE_URL || '';

  function _greeting() {
    var h = new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' });
    var hr = parseInt(h, 10);
    if (isNaN(hr)) hr = 12;
    if (hr < 12) return 'Good morning,';
    if (hr < 17) return 'Good afternoon,';
    return 'Good evening,';
  }

  function _esc(s) { return typeof esc === 'function' ? esc(s) : String(s || ''); }

  function _fmtDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (_) { return ''; }
  }

  function _fmtShortDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch (_) { return ''; }
  }

  function _toTitleCase(value) {
    if (!value) return '';
    return String(value).replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function _truncate(text, max) {
    if (!text || text.length <= max) return null;
    return text.slice(0, max);
  }

  function _nl2br(s) {
    return s.replace(/\n/g, '<br>');
  }

  function _hashtagHtml(text) {
    return _nl2br(_esc(text)).replace(/(#\w[\w]*)/g, '<span style="color:#378fe9;">$1</span>');
  }

  function _sortAsc(arr) {
    arr.sort(function (a, b) {
      var ta = a.status_changed_at || a.statusChangedAt || a.updated_at || '';
      var tb = b.status_changed_at || b.statusChangedAt || b.updated_at || '';
      return (new Date(ta || 0)).getTime() - (new Date(tb || 0)).getTime();
    });
  }

  function _sortDesc(arr) {
    arr.sort(function (a, b) {
      var ta = a.status_changed_at || a.statusChangedAt || a.updated_at || '';
      var tb = b.status_changed_at || b.statusChangedAt || b.updated_at || '';
      return (new Date(tb || 0)).getTime() - (new Date(ta || 0)).getTime();
    });
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
  var ICON_CLOCK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
  var ICON_COMMENT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_THUMBUP = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
  var ICON_WA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>';
  var ICON_COMMENT_SM = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_SEND = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  /* ---- role color map ---- */

  var ROLE_COLORS = {
    'chitra': '#22D3EE',
    'servicing': '#22D3EE',
    'pranav': '#9b87f5',
    'creative': '#9b87f5',
    'client': '#FF4B4B',
    'admin': '#C8A84B'
  };

  function _roleColor(role) {
    return ROLE_COLORS[(role || '').toLowerCase()] || '#C8A84B';
  }

  /* ---- relative timestamp ---- */

  function _relativeTime(isoStr) {
    if (!isoStr) return '';
    var ts = isoStr.replace(' ', 'T').replace('+00:00', 'Z').replace('+00', 'Z');
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    var diffMs = Date.now() - d.getTime();
    var diffMin = Math.floor(diffMs / 60000);
    var diffHr = Math.floor(diffMs / 3600000);
    if (diffMs < 0 || diffHr >= 12) {
      return d.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'
      }) + ' &middot; ' + d.toLocaleTimeString('en-IN', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
      });
    }
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return diffMin + 'm ago';
    return diffHr + 'h ago';
  }

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
    _sortAsc(approval);
    _sortAsc(input);
    _sortDesc(published);
    return { approval: approval, input: input, published: published };
  }

  /* ---- avatar ---- */

  function _avatarHtml(post) {
    var imgs = post.images;
    if (imgs && imgs.length && imgs[0]) {
      return '<img class="cf-avatar" src="' + _esc(imgs[0]) + '" alt="" style="display:block;">';
    }
    if (post.stage === 'awaiting_brand_input') {
      return '<div class="cf-avatar" style="background:#111;display:flex;align-items:center;justify-content:center;">' + ICON_EYE + '</div>';
    }
    var initial = (post.title || '?').charAt(0).toUpperCase();
    return '<div class="cf-avatar" style="background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-family:\'DM Sans\',sans-serif;font-weight:700;font-size:17px;color:#C8A84B;">' + _esc(initial) + '</div>';
  }

  /* ---- status badge ---- */

  var ICON_CHECK_SM = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3ECF8E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  function _badgeHtml(post) {
    var stage = post.stage;
    var days = _waitDays(post);
    if (stage === 'awaiting_approval') {
      if (days > 2) {
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;background:rgba(255,75,75,0.05);border:1px dotted rgba(255,75,75,0.18);font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;color:#FF4B4B;">' +
          '<span style="width:4px;height:4px;border-radius:50%;background:#FF4B4B;animation:clientPulse 2s infinite;"></span>' +
          'WAITING ' + days + ' DAYS &middot; OVERDUE</span>';
      }
      return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;background:rgba(246,166,35,0.05);border:1px dotted rgba(246,166,35,0.18);font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;color:#F6A623;">' +
        '<span style="width:4px;height:4px;border-radius:50%;background:#F6A623;animation:clientPulse 2s infinite;"></span>' +
        'AWAITING YOUR APPROVAL</span>';
    }
    if (stage === 'awaiting_brand_input') {
      return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;background:rgba(34,211,238,0.04);border:1px dotted rgba(34,211,238,0.16);font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;color:#22D3EE;">' +
        '<span style="width:4px;height:4px;border-radius:50%;background:#22D3EE;animation:clientPulse 2s infinite;"></span>' +
        'TEAM NEEDS YOUR INPUT</span>';
    }
    if (stage === 'published') {
      return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;background:rgba(62,207,142,0.04);border:1px dotted rgba(62,207,142,0.16);font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;color:#3ECF8E;">' +
        ICON_CHECK_SM + ' LIVE ON LINKEDIN</span>';
    }
    return '';
  }

  /* ---- pulse keyframes (injected once) ---- */

  function _ensurePulseStyle() {
    if (document.getElementById('client-pulse-style')) return;
    var style = document.createElement('style');
    style.id = 'client-pulse-style';
    style.textContent = '@keyframes clientPulse{0%,100%{opacity:1;}50%{opacity:0.35;}}' +
      '.menu-root-absolute{position:absolute!important;z-index:999999!important;transform:none!important;background:#0d0d0d;border:1px dotted rgba(255,255,255,0.12);border-radius:0;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,0.6);}' +
      '#app,#root,#client-view{transform:none!important;}';
    document.head.appendChild(style);
  }

  /* ---- caption ---- */

  function _captionHtml(post) {
    var text = post.caption || '';
    if (!text) return '';
    var noTruncate = post.stage === 'awaiting_brand_input';
    var limit = 210;
    var short = noTruncate ? null : _truncate(text, limit);
    if (short) short = short.replace(/\)\s*$/, '');
    var id = 'cap-' + (post.post_id || post.id || '');

    if (short) {
      return '<div id="' + _esc(id) + '" style="font-family:\'DM Sans\',sans-serif;font-size:13px;line-height:1.55;color:#ccc;padding:0 14px;margin-top:8px;">' +
        _hashtagHtml(short) +
        '<span data-action="expand-caption" data-id="' + _esc(id) + '" style="color:#0a66c2;cursor:pointer;font-size:12px;">...more</span>' +
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

    var imgsJson = _esc(JSON.stringify(imgs));
    var wrap = function (src, idx, css, overlay) {
      return '<div data-action="openLightbox" data-images="' + imgsJson + '" data-index="' + idx + '" style="' + css + 'overflow:hidden;position:relative;background:#111;cursor:pointer;">' +
        '<img src="' + _esc(src) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;" loading="lazy">' +
        (overlay || '') + '</div>';
    };

    if (n === 1) {
      return '<div class="img-single" style="padding:0 14px;margin-top:10px;">' +
        wrap(imgs[0], 0, 'aspect-ratio:4/3;border-radius:8px;') +
        '</div>';
    }

    if (n === 2) {
      return '<div class="img-duo" style="display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:0 14px;margin-top:10px;">' +
        wrap(imgs[0], 0, 'aspect-ratio:1/1;border-radius:8px 0 0 8px;') +
        wrap(imgs[1], 1, 'aspect-ratio:1/1;border-radius:0 8px 8px 0;') +
        '</div>';
    }

    if (n === 3) {
      return '<div class="img-trio" style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:130px 130px;gap:2px;padding:0 14px;margin-top:10px;height:260px;">' +
        wrap(imgs[0], 0, 'grid-row:1/3;border-radius:8px 0 0 8px;') +
        wrap(imgs[1], 1, 'border-radius:0 8px 0 0;') +
        wrap(imgs[2], 2, 'border-radius:0 0 8px 0;') +
        '</div>';
    }

    /* 4+ : 2x2 grid with +N overlay on last cell */
    var extra = n > 4 ? n - 4 : 0;
    var overlayHtml = extra > 0
      ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;font-family:\'DM Sans\',sans-serif;font-size:20px;font-weight:700;color:#fff;pointer-events:none;">+' + extra + '</div>'
      : '';
    return '<div class="img-quad" style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:150px 150px;gap:2px;padding:0 14px;margin-top:10px;height:300px;">' +
      wrap(imgs[0], 0, 'border-radius:8px 0 0 0;') +
      wrap(imgs[1], 1, 'border-radius:0 8px 0 0;') +
      wrap(imgs[2], 2, 'border-radius:0 0 0 8px;') +
      wrap(imgs[3] || imgs[2], 3, 'border-radius:0 0 8px 0;', overlayHtml) +
      '</div>';
  }

  /* ---- metadata rows ---- */

  function _inlineStatus(post) {
    var stage = post.stage;
    var days = _waitDays(post);
    if (stage === 'awaiting_approval') {
      if (days > 2) return { text: days + 'd overdue', cls: 'cf-overdue' };
      return { text: '', cls: '' };
    }
    if (stage === 'awaiting_brand_input') return { text: 'needs input', cls: 'cf-input-needed' };
    if (stage === 'published') return { text: 'live', cls: 'cf-live' };
    return { text: '', cls: '' };
  }

  function _cardHeaderHtml(post, pid) {
    var loc = post.location ? _esc(_toTitleCase(post.location)) : '';
    var pil = post.contentPillar ? _esc(_toTitleCase(post.contentPillar)) : '';
    var st = _inlineStatus(post);
    var sent = _fmtShortDate(post.status_changed_at || post.statusChangedAt || '');
    var target = _fmtShortDate(post.targetDate || '');

    var metaParts = '';
    if (loc) metaParts += '<span>' + loc + '</span>';
    if (loc && pil) metaParts += '<span class="cf-dot">&middot;</span>';
    if (pil) metaParts += '<span>' + pil + '</span>';
    if ((loc || pil) && st.text) metaParts += '<span class="cf-dot">&middot;</span>';
    if (st.text) metaParts += '<span class="cf-status ' + st.cls + '">' + _esc(st.text) + '</span>';

    var dateParts = '';
    if (sent) dateParts += 'Sent ' + _esc(sent);
    if (sent && target) dateParts += ' &middot; ';
    if (target) dateParts += 'Target ' + _esc(target);

    return '<div class="cf-header">' +
      _avatarHtml(post) +
      '<div class="cf-headtext">' +
        '<div class="cf-title">' + _esc(post.title || 'Untitled') + '</div>' +
        (metaParts ? '<div class="cf-meta-line">' + metaParts + '</div>' : '') +
        (dateParts ? '<div class="cf-date-line">' + dateParts + '</div>' : '') +
      '</div>' +
      '<button data-action="openCardMenu" data-id="' + pid + '" class="cf-dots" style="background:none;border:none;">' + ICON_DOTS + '</button>' +
    '</div>';
  }

  /* ---- metadata rows (kept for reference, no longer called) ---- */

  function _metaRow1(post) {
    var parts = [];
    if (post.location) parts.push(_esc(_toTitleCase(post.location)));
    if (post.contentPillar) parts.push(_esc(_toTitleCase(post.contentPillar)));
    if (!parts.length) return '';
    return '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#555;margin-bottom:1px;">' + parts.join(' &middot; ') + '</div>';
  }

  function _metaRow2(post) {
    var sent = _fmtShortDate(post.status_changed_at || post.statusChangedAt || '');
    var target = _fmtShortDate(post.targetDate || '');
    var parts = [];
    if (sent) parts.push('Sent ' + _esc(sent));
    if (target) parts.push('Target ' + _esc(target));
    if (!parts.length) return '';
    return '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#3a3a4a;">' + parts.join(' &middot; ') + '</div>';
  }

  /* ---- stats bar ---- */

  function _waitDays(post) {
    var ref = post.status_changed_at || post.statusChangedAt || post.updated_at || '';
    if (!ref) return 0;
    var then = new Date(ref).getTime();
    if (isNaN(then)) return 0;
    return Math.max(0, Math.floor((Date.now() - then) / 86400000));
  }

  function _commentCount(post) {
    if (Array.isArray(post.post_comments)) return post.post_comments.length;
    return 0;
  }

  function _statsBarHtml(post, isPublished) {
    var left = '';
    if (isPublished) {
      var approvedDate = post.status_changed_at || post.statusChangedAt || post.updated_at || '';
      left = '<span style="display:inline-flex;align-items:center;gap:4px;color:#22c55e;">' +
        ICON_CHECK + ' Approved' +
        (approvedDate ? ' &middot; ' + _esc(_fmtDate(approvedDate)) : '') +
        '</span>';
    } else {
      var days = _waitDays(post);
      var dColor = days > 2 ? '#FF4B4B' : '#444';
      left = '<span style="display:inline-flex;align-items:center;gap:4px;color:' + dColor + ';">' +
        ICON_CLOCK + ' Waiting ' + days + ' day' + (days !== 1 ? 's' : '') +
        '</span>';
    }
    var count = _commentCount(post);
    var right = '<span style="display:inline-flex;align-items:center;gap:4px;color:#444;">' +
      ICON_COMMENT_SM + ' ' + count + '</span>';
    return '<div class="stats-bar" style="display:flex;align-items:center;justify-content:space-between;">' +
      left + right + '</div>';
  }

  /* ---- engagement bar ---- */

  function _engagementBarHtml(post) {
    if (post.stage !== 'awaiting_approval' && post.stage !== 'awaiting_brand_input') return '';
    var pid = _esc(post.post_id || post.id || '');
    var title = _esc(post.title || '');
    var btnStyle = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;' +
      'background:none;border:none;border-right:1px solid rgba(255,255,255,0.03);' +
      'cursor:pointer;';
    var lastBtnStyle = btnStyle.replace('border-right:1px solid rgba(255,255,255,0.03);', '');

    var btn1 = '';
    if (post.stage === 'awaiting_approval') {
      btn1 = '<button class="eng-btn" data-action="clientApprovePrompt" data-id="' + pid + '" data-title="' + title + '" style="' + btnStyle + '">' +
        ICON_THUMBUP + '<span>Approve</span></button>';
    } else {
      btn1 = '<div style="flex:1;"></div>';
    }

    var btn2 = '<button class="eng-btn" data-action="focusComment" data-id="' + pid + '" style="' + btnStyle + '">' +
      ICON_COMMENT + '<span>Comment</span></button>';

    var btn3 = '<button class="eng-btn" data-action="shareWA" data-id="' + pid + '" style="' + lastBtnStyle + '">' +
      ICON_WA + '<span>WhatsApp</span></button>';

    return '<div class="eng-bar" data-engagement="' + pid + '" style="display:flex;">' +
      btn1 + btn2 + btn3 + '</div>' +
      '<div id="approved-strip-' + pid + '" style="display:none;padding:10px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#3ECF8E;background:rgba(62,207,142,0.05);margin-top:6px;">' +
      '</div>';
  }

  /* ---- approve popup (singleton) ---- */

  function _approvePopupHtml() {
    return '<div id="client-approve-popup" style="display:none;position:fixed;inset:0;z-index:1500;background:rgba(0,0,0,0.75);align-items:center;justify-content:center;">' +
      '<div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;max-width:340px;width:90%;text-align:center;">' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:16px;color:#e8e2d9;">Approve this post?</div>' +
        '<div id="client-approve-title" style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#C8A84B;margin-top:10px;"></div>' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-size:12px;color:#666;margin-top:10px;line-height:1.5;">This will send it for scheduling. Your team will be notified immediately.</div>' +
        '<div style="display:flex;gap:10px;margin-top:20px;justify-content:center;">' +
          '<button data-action="approveCancel" style="flex:1;padding:10px;background:none;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#888;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;">Cancel</button>' +
          '<button data-action="approveConfirm" style="flex:1;padding:10px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;color:#22c55e;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;">Yes, Approve</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---- card 3-dot menu (singleton, repositioned on open) ---- */

  var _menuBtnStyle = 'display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#ccc;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;';
  var _menuBtnBorder = 'border-top:1px solid rgba(255,255,255,0.06);';

  function _handleCardMenuAction(action, postId) {
    var post = (window.allPosts || []).find(function (p) { return p.post_id === postId || p.id === postId; });
    switch (action) {
      case 'cardMenuWA':
        if (typeof window._sharePostOnWhatsApp === 'function') window._sharePostOnWhatsApp(postId);
        break;
      case 'cardMenuApprove':
        _pendingApproveId = postId;
        var apPopup = document.getElementById('client-approve-popup');
        var apTitle = document.getElementById('client-approve-title');
        if (apTitle) apTitle.textContent = post ? (post.title || '') : '';
        if (apPopup) apPopup.style.display = 'flex';
        break;
      case 'cardMenuInput':
        var inEl = document.getElementById('comment-input-' + postId);
        if (inEl) {
          inEl.focus();
          var inCard = inEl.closest('[data-card-id]');
          if (inCard) inCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      case 'cardMenuLinkedIn':
        var lnUrl = post ? (post.linkedinUrl || post.linkedin_link || '') : '';
        if (lnUrl) { window.open(lnUrl, '_blank'); }
        else { if (typeof window.showToast === 'function') window.showToast('LinkedIn link not available yet', 'info'); }
        break;
      case 'cardMenuCopyApproval':
        if (post) {
          var cpSlug = _makeSlug(post.title || '');
          navigator.clipboard.writeText('https://srtd.io/ok/?p=' + cpSlug).then(function () {
            if (typeof window.showToast === 'function') window.showToast('Approval link copied', 'success');
          }).catch(function () {
            if (typeof window.showToast === 'function') window.showToast('Failed to copy', 'error');
          });
        }
        break;
      case 'cardMenuCopyLink':
        var clUrl = post ? (post.linkedinUrl || post.linkedin_link || '') : '';
        if (clUrl) {
          navigator.clipboard.writeText(clUrl).then(function () {
            if (typeof window.showToast === 'function') window.showToast('Post link copied', 'success');
          }).catch(function () {
            if (typeof window.showToast === 'function') window.showToast('Failed to copy', 'error');
          });
        } else {
          if (typeof window.showToast === 'function') window.showToast('LinkedIn link not available yet', 'info');
        }
        break;
    }
  }

  // TODO Phase 2: Replace floating menus with Bottom Sheet pattern for mobile-first UX

  window._openClientCardMenu = function (buttonElement, postId, stage) {
    var existing = document.getElementById('dynamic-card-menu');
    if (existing) existing.remove();

    var menu = document.createElement('div');
    menu.id = 'dynamic-card-menu';
    menu.className = 'menu-root-absolute';
    _populateCardMenu(menu, stage, postId);
    document.body.appendChild(menu);

    menu.addEventListener('click', function (e) {
      var mbtn = e.target.closest('[data-action]');
      if (!mbtn) return;
      menu.remove();
      _handleCardMenuAction(mbtn.getAttribute('data-action'), postId);
    });

    requestAnimationFrame(function () {
      var rect = buttonElement.getBoundingClientRect();
      if (rect.top === 0 && rect.left === 0 && rect.width === 0) {
        menu.remove();
        return;
      }
      var topPos = rect.bottom + window.scrollY + 8;
      var leftPos = rect.right + window.scrollX - menu.offsetWidth;
      menu.style.top = topPos + 'px';
      menu.style.left = leftPos + 'px';
    });

    setTimeout(function () {
      document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 200);
  };

  function _makeSlug(title) {
    if (typeof window._generatePreviewSlug === 'function') return window._generatePreviewSlug(title);
    return (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 50) + '-' + Date.now();
  }

  function _populateCardMenu(menuEl, stage) {
    var isDesktop = window.matchMedia('(min-width: 768px)').matches;
    var html = '';
    if (stage === 'awaiting_approval') {
      html += '<button data-action="cardMenuApprove" style="' + _menuBtnStyle + '">Approve Post</button>';
      html += '<button data-action="cardMenuWA" style="' + _menuBtnStyle + _menuBtnBorder + '">Share on WhatsApp</button>';
      if (isDesktop) html += '<button data-action="cardMenuCopyApproval" style="' + _menuBtnStyle + _menuBtnBorder + '">Copy Approval Link</button>';
    } else if (stage === 'awaiting_brand_input') {
      html += '<button data-action="cardMenuInput" style="' + _menuBtnStyle + '">Add Your Input</button>';
      if (isDesktop) html += '<button data-action="cardMenuCopyApproval" style="' + _menuBtnStyle + _menuBtnBorder + '">Copy Approval Link</button>';
    } else if (stage === 'published') {
      html += '<button data-action="cardMenuLinkedIn" style="' + _menuBtnStyle + '">View on LinkedIn</button>';
      html += '<button data-action="cardMenuCopyLink" style="' + _menuBtnStyle + _menuBtnBorder + '">Copy Post Link</button>';
    }
    menuEl.innerHTML = html;
  }

  /* ---- comments display ---- */

  var ICON_PERSON = '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  function _singleCommentHtml(c) {
    var isClient = (c.author_role || '').toLowerCase() === 'client';
    var color = _roleColor(c.author_role);
    var initial = (c.author || '?').charAt(0).toUpperCase();
    var roleLabel = _esc((c.author_role || '').toUpperCase());
    var ts = _relativeTime(c.created_at);
    var avatarInner = isClient
      ? ICON_PERSON
      : _esc(initial);
    var avatarStyle = isClient
      ? 'width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);'
      : 'width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;color:' + color + ';background:rgba(' + _hexToRgb(color) + ',0.12);';
    return '<div style="display:flex;gap:8px;padding:6px 14px;">' +
      '<div style="' + avatarStyle + '">' + avatarInner + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;">' +
          '<span style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:12px;color:#ccc;">' + _esc(c.author) + '</span>' +
          '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;text-transform:uppercase;color:#333;">' + roleLabel + '</span>' +
          '<span style="margin-left:auto;font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#333;">' + ts + '</span>' +
        '</div>' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;color:#999;line-height:1.5;margin-top:2px;white-space:pre-wrap;">' + _esc(c.message) + '</div>' +
      '</div>' +
    '</div>';
  }

  function _hexToRgb(hex) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return r + ',' + g + ',' + b;
  }

  function _commentsListHtml(post) {
    var comments = Array.isArray(post.post_comments) ? post.post_comments : [];
    if (!comments.length) return '';
    var pid = _esc(post.post_id || post.id || '');
    var show = comments.length <= 3 ? comments : comments.slice(0, 3);
    var remaining = comments.length - show.length;
    var html = '<div data-comments-list="' + pid + '" data-full-comments="' + _esc(JSON.stringify(comments)) + '" style="margin-top:6px;">';
    for (var i = 0; i < show.length; i++) {
      html += _singleCommentHtml(show[i]);
    }
    if (remaining > 0) {
      html += '<div data-action="expandComments" data-id="' + pid + '" style="font-size:12px;color:#555;padding:4px 14px 8px;cursor:pointer;font-family:\'DM Sans\',sans-serif;">View ' + remaining + ' more comment' + (remaining > 1 ? 's' : '') + '</div>';
    }
    html += '</div>';
    return html;
  }

  /* ---- comment input row ---- */

  function _commentInputHtml(post) {
    if (post.stage !== 'awaiting_approval' && post.stage !== 'awaiting_brand_input') return '';
    var pid = _esc(post.post_id || post.id || '');
    var userName = (window.currentUserName || 'C');
    var initial = userName.charAt(0).toUpperCase();
    var placeholder = post.stage === 'awaiting_brand_input'
      ? 'Share the information here...'
      : 'Add your thoughts...';
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;">' +
      '<div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);">' + ICON_PERSON + '</div>' +
      '<div style="flex:1;display:flex;align-items:center;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:0 4px 0 14px;">' +
        '<input id="comment-input-' + pid + '" type="text" placeholder="' + _esc(placeholder) + '" style="flex:1;background:transparent;border:none;outline:none;font-family:\'DM Sans\',sans-serif;font-size:13px;color:#ccc;padding:7px 0;" data-post-id="' + pid + '">' +
        '<button data-action="submitComment" data-id="' + pid + '" style="background:none;border:none;color:#555;cursor:pointer;padding:4px;flex-shrink:0;">' + ICON_SEND + '</button>' +
      '</div>' +
    '</div>';
  }

  /* ---- single card ---- */

  function _cardHtml(post, isPublished) {
    var opacity = isPublished ? 'opacity:0.45;' : '';
    var pid = _esc(post.post_id || post.id || '');
    return '<div class="post-card" data-card-id="' + pid + '" data-stage="' + _esc(post.stage || '') + '" style="' + opacity + '">' +
      _cardHeaderHtml(post, pid) +
      /* caption */
      _captionHtml(post) +
      /* images */
      _imgGridHtml(post.images) +
      /* stats bar */
      _statsBarHtml(post, isPublished) +
      /* engagement bar (not on published) */
      (isPublished ? '' : _engagementBarHtml(post)) +
      /* comments */
      _commentsListHtml(post) +
    '</div>';
  }

  /* ---- section label ---- */

  function _sectionLabel(text) {
    return '<div class="section-label" style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;">' + text + '</div>';
  }

  /* ---- top bar ---- */

  function _pillColor(n) {
    if (n >= 14) return { c: '#FF4B4B', bg: 'rgba(255,75,75,0.04)', bc: 'rgba(255,75,75,0.3)' };
    if (n >= 7)  return { c: '#F6A623', bg: 'rgba(246,166,35,0.04)', bc: 'rgba(246,166,35,0.3)' };
    return { c: '#C8A84B', bg: 'rgba(200,168,75,0.04)', bc: 'rgba(200,168,75,0.3)' };
  }

  var ICON_BELL_SM = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

  function _topBarHtml(awaitCount) {
    var clientName = _esc(window.currentUserName || '');
    var pill = '';
    if (awaitCount > 0) {
      var pc = _pillColor(awaitCount);
      pill = '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:0.06em;padding:3px 9px;border-radius:10px;background:' + pc.bg + ';color:' + pc.c + ';border:1px dotted ' + pc.bc + ';">' + awaitCount + ' AWAITING</span>';
    }
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;position:sticky;top:0;background:#1b1f23;z-index:100;border-bottom:1px dotted rgba(255,255,255,0.08);">' +
      '<div style="display:flex;align-items:baseline;">' +
        '<span style="font-family:\'DM Sans\',sans-serif;font-size:13px;color:#555;">' + _greeting() + '</span>' +
        (clientName ? '<span style="font-family:\'DM Sans\',sans-serif;font-weight:500;font-size:13px;color:#C8A84B;margin-left:5px;">' + clientName + '</span>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        pill +
        '<button data-action="open-notifications" style="position:relative;background:none;border:none;color:#444;cursor:pointer;padding:4px;">' +
          ICON_BELL_SM +
          '<span data-bell-dot style="position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:#ef4444;"></span>' +
        '</button>' +
        '<div style="position:relative;">' +
          '<button data-action="top-menu-toggle" style="background:none;border:none;color:#444;cursor:pointer;padding:4px;">' + ICON_DOTS + '</button>' +
          '<div data-top-menu style="display:none;position:fixed;background:#0d0d0d;border:1px dotted rgba(255,255,255,0.12);border-radius:0;min-width:160px;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,0.6);">' +
            '<button data-action="new-request" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#ccc;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;">New Request</button>' +
            '<button data-action="light-mode" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#555;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;border-top:1px solid rgba(255,255,255,0.06);">Light Mode</button>' +
            '<button data-action="sign-out" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#888;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;border-top:1px solid rgba(255,255,255,0.06);">Sign Out</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---- bottom nav (reuse existing #bottom-nav) ---- */

  var _savedNavHtml = '';

  var ICON_NAV_LIST = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
  var ICON_NAV_BOOK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
  var ICON_NAV_CHART = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>';

  var _clientActiveNav = 'feed';

  function _setClientNav() {
    var nav = document.getElementById('bottom-nav');
    if (!nav) return;
    if (!_savedNavHtml) _savedNavHtml = nav.innerHTML;
    var btnStyle = function(action) {
      var color = _clientActiveNav === action ? '#C8A84B' : '#555';
      return 'display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;color:' + color + ';cursor:pointer;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.04em;padding:4px 12px;';
    };
    nav.style.cssText = 'position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:space-around;align-items:center;padding:8px 0 calc(8px + env(safe-area-inset-bottom));background:rgba(27,31,35,0.97);border-top:1px solid rgba(255,255,255,0.06);z-index:100;max-width:430px;margin:0 auto;';
    nav.className = '';
    nav.innerHTML =
      '<button class="tab-btn" data-tab="tasks" data-action="nav-feed" style="' + btnStyle('feed') + '">' +
        ICON_FEED + 'Feed</button>' +
      '<button class="tab-btn" data-tab="pipeline" data-action="nav-pipeline" style="' + btnStyle('pipeline') + '">' +
        ICON_NAV_LIST + 'Pipeline</button>' +
      '<button class="tab-btn" data-tab="library" data-action="nav-library" style="' + btnStyle('library') + '">' +
        ICON_NAV_BOOK + 'Library</button>' +
      '<button class="tab-btn" data-tab="insights" data-action="nav-insights" style="' + btnStyle('insights') + '">' +
        ICON_NAV_CHART + 'Insights</button>';
  }

  window._restoreAgencyNav = function () {
    if (!_savedNavHtml) return;
    var nav = document.getElementById('bottom-nav');
    if (!nav) return;
    nav.innerHTML = _savedNavHtml;
    nav.style.cssText = '';
    nav.className = 'bottom-nav';
    _savedNavHtml = '';
    var fab = document.getElementById('fab');
    if (fab) fab.style.display = '';
    var fabBtn = document.getElementById('main-fab-btn');
    if (fabBtn) fabBtn.style.display = '';
  };

  function _updateNavActive(action) {
    _clientActiveNav = action;
    var nav = document.getElementById('bottom-nav');
    if (!nav) return;
    nav.querySelectorAll('[data-action]').forEach(function(b) {
      var a = b.getAttribute('data-action');
      b.style.color = (a === 'nav-' + action) ? '#C8A84B' : '#555';
    });
  }

  function _wireNavEvents() {
    var nav = document.getElementById('bottom-nav');
    if (!nav || nav._clientNavWired) return;
    nav._clientNavWired = true;
    nav.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'nav-feed') {
        _updateNavActive('feed');
        document.getElementById('dashboard-view')?.classList.remove('active');
        document.getElementById('insights-view')?.classList.remove('active');
        document.getElementById('library-view')?.classList.remove('active');
        var cv = document.getElementById('client-view');
        if (cv) { cv.style.display = 'block'; cv.classList.add('active'); }
        if (typeof renderClientView === 'function') renderClientView();
      } else if (action === 'nav-pipeline') {
        _updateNavActive('pipeline');
        var cv2 = document.getElementById('client-view');
        if (cv2) { cv2.style.display = 'none'; cv2.classList.remove('active'); }
        if (typeof switchTab === 'function') switchTab('pipeline');
      } else if (action === 'nav-library') {
        _updateNavActive('library');
        var cv3 = document.getElementById('client-view');
        if (cv3) { cv3.style.display = 'none'; cv3.classList.remove('active'); }
        if (typeof showLibrary === 'function') showLibrary();
      } else if (action === 'nav-insights') {
        _updateNavActive('insights');
        var cv4 = document.getElementById('client-view');
        if (cv4) { cv4.style.display = 'none'; cv4.classList.remove('active'); }
        if (typeof showInsights === 'function') showInsights();
      }
    });
  }

  /* ---- event delegation ---- */

  var _pendingApproveId = '';

  function _closeDynamicCardMenu() {
    var m = document.getElementById('dynamic-card-menu');
    if (m) m.remove();
  }

  function _handleSubmitComment(postId, root) {
    var input = document.getElementById('comment-input-' + postId);
    if (!input) return;
    var message = input.value.trim();
    if (!message) return;
    var savedValue = input.value;
    input.value = '';

    var authorName = window.currentUserName || 'Client';
    var post = (window.allPosts || []).find(function (p) {
      return p.post_id === postId || p.id === postId;
    });
    var realPostId = post ? (post.post_id || postId) : postId;
    var postTitle = post ? (post.title || realPostId) : realPostId;

    var commentObj = {
      post_id: realPostId,
      author: authorName,
      author_role: 'Client',
      message: message,
      created_at: new Date().toISOString()
    };

    var listEl = root.querySelector('[data-comments-list="' + postId + '"]');
    if (!listEl) {
      var engBar = root.querySelector('[data-engagement="' + postId + '"]');
      var stripEl = document.getElementById('approved-strip-' + postId);
      var insertAfter = stripEl || engBar;
      if (insertAfter) {
        var newList = document.createElement('div');
        newList.setAttribute('data-comments-list', postId);
        newList.style.marginTop = '6px';
        insertAfter.parentNode.insertBefore(newList, insertAfter.nextSibling);
        listEl = newList;
      }
    }
    if (listEl) {
      listEl.insertAdjacentHTML('beforeend', _singleCommentHtml(commentObj));
    }

    if (post && Array.isArray(post.post_comments)) {
      post.post_comments.push(commentObj);
    }

    if (typeof window.apiFetch !== 'function') return;

    window.apiFetch('/post_comments', {
      method: 'POST',
      body: JSON.stringify({
        post_id: realPostId,
        author: authorName,
        author_role: 'Client',
        message: message
      })
    }).then(function () {
      window.apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_role: 'Servicing',
          type: 'comment',
          post_id: realPostId,
          message: authorName + ' commented on ' + postTitle
        })
      }).catch(function () {});
      window.apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_role: 'Admin',
          type: 'comment',
          post_id: realPostId,
          message: authorName + ' commented on ' + postTitle
        })
      }).catch(function () {});
    }).catch(function () {
      if (typeof window.showToast === 'function') {
        window.showToast('Failed to send comment', 'error');
      }
      input.value = savedValue;
      if (listEl && listEl.lastChild) {
        listEl.removeChild(listEl.lastChild);
      }
      if (post && Array.isArray(post.post_comments)) {
        post.post_comments.pop();
      }
    });
  }

  function _wireTopNavOnce() {
    if (window._clientTopNavWired) return;
    window._clientTopNavWired = true;
    document.body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      var cv = document.getElementById('client-view');

      switch (action) {
        case 'open-notifications':
          if (typeof window.openNotifications === 'function') window.openNotifications();
          break;

        case 'top-menu-toggle':
          var menu = cv ? cv.querySelector('[data-top-menu]') : null;
          if (menu) {
            if (menu.style.display !== 'none') {
              menu.style.display = 'none';
            } else {
              menu.style.display = 'block';
              var tmBtn = e.target.closest('[data-action="top-menu-toggle"]');
              requestAnimationFrame(function () {
                if (!tmBtn) return;
                var tmRect = tmBtn.getBoundingClientRect();
                if (tmRect.top === 0 && tmRect.width === 0) {
                  menu.style.display = 'none';
                  return;
                }
                menu.style.top = (tmRect.bottom + 4) + 'px';
                menu.style.right = (window.innerWidth - tmRect.right) + 'px';
              });
            }
          }
          break;

        case 'new-request':
          e.stopPropagation();
          var menu2 = cv ? cv.querySelector('[data-top-menu]') : null;
          if (menu2) menu2.style.display = 'none';
          if (typeof window.openClientRequestForm === 'function') window.openClientRequestForm();
          break;

        case 'light-mode':
          var menu3a = cv ? cv.querySelector('[data-top-menu]') : null;
          if (menu3a) menu3a.style.display = 'none';
          if (typeof window.showToast === 'function') window.showToast('Coming soon', 'info');
          break;

        case 'sign-out':
          var menu3 = cv ? cv.querySelector('[data-top-menu]') : null;
          if (menu3) menu3.style.display = 'none';
          if (typeof window.logout === 'function') window.logout();
          break;

        default:
          break;
      }
    });

    document.body.addEventListener('click', function (e) {
      if (!e.target.closest('[data-action="top-menu-toggle"]') && !e.target.closest('[data-top-menu]')) {
        var cv = document.getElementById('client-view');
        var tmenu = cv ? cv.querySelector('[data-top-menu]') : null;
        if (tmenu) tmenu.style.display = 'none';
      }
    });
  }

  function _wireEvents(root) {
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      var id = btn.getAttribute('data-id');

      switch (action) {
        case 'expand-caption':
          var capEl = root.querySelector('#' + id);
          if (capEl) {
            var full = capEl.querySelector('[data-full]');
            if (full) {
              capEl.innerHTML = full.innerHTML;
            }
          }
          break;

        /* -- card 3-dot menu -- */
        case 'openCardMenu':
          e.stopPropagation();
          var cardEl = btn.closest('[data-card-id]');
          var cardStage = cardEl ? cardEl.getAttribute('data-stage') : '';
          window._openClientCardMenu(btn, id, cardStage);
          break;

        /* -- engagement bar actions -- */
        case 'clientApprovePrompt':
          _pendingApproveId = id;
          var popup = document.getElementById('client-approve-popup');
          var titleEl = document.getElementById('client-approve-title');
          if (titleEl) titleEl.textContent = btn.getAttribute('data-title') || '';
          if (popup) popup.style.display = 'flex';
          break;

        case 'approveCancel':
          _pendingApproveId = '';
          var popup2 = document.getElementById('client-approve-popup');
          if (popup2) popup2.style.display = 'none';
          break;

        case 'approveConfirm':
          var pid = _pendingApproveId;
          _pendingApproveId = '';
          var popup3 = document.getElementById('client-approve-popup');
          if (popup3) popup3.style.display = 'none';
          if (pid) {
            var eng = document.querySelector('[data-engagement="' + pid + '"]');
            if (eng) eng.style.display = 'none';
            var strip = document.getElementById('approved-strip-' + pid);
            if (strip) {
              var now = new Date();
              var dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              var timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
              strip.innerHTML = '<span style="display:inline-flex;align-items:center;gap:5px;">' +
                ICON_CHECK + ' Approved on ' + _esc(dateStr) + ' &middot; ' + _esc(timeStr) + '</span>';
              strip.style.display = 'block';
            }
            if (typeof window.clientApprove === 'function') window.clientApprove(pid);
          }
          break;

        case 'focusComment':
          var cInput = root.querySelector('#comment-input-' + id);
          if (cInput) {
            cInput.focus();
            var fcCard = cInput.closest('[data-card-id]');
            if (fcCard) fcCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            var fcAnchor = root.querySelector('[data-comments-list="' + id + '"]') ||
              root.querySelector('[data-engagement="' + id + '"]') ||
              root.querySelector('#approved-strip-' + id);
            if (fcAnchor) {
              var fcInputHtml = '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;">' +
                '<div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);">' + ICON_PERSON + '</div>' +
                '<div style="flex:1;display:flex;align-items:center;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:0 4px 0 14px;">' +
                  '<input id="comment-input-' + _esc(id) + '" type="text" placeholder="Add your thoughts..." style="flex:1;background:transparent;border:none;outline:none;font-family:\'DM Sans\',sans-serif;font-size:13px;color:#ccc;padding:7px 0;" data-post-id="' + _esc(id) + '">' +
                  '<button data-action="submitComment" data-id="' + _esc(id) + '" style="background:none;border:none;color:#555;cursor:pointer;padding:4px;flex-shrink:0;">' + ICON_SEND + '</button>' +
                '</div></div>';
              fcAnchor.insertAdjacentHTML('afterend', fcInputHtml);
              var fcNew = root.querySelector('#comment-input-' + id);
              if (fcNew) {
                fcNew.focus();
                var fcCard2 = fcNew.closest('[data-card-id]');
                if (fcCard2) fcCard2.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }
          break;

        case 'expandComments':
          var clDiv = root.querySelector('[data-comments-list="' + id + '"]');
          if (clDiv) {
            try {
              var allComments = JSON.parse(clDiv.getAttribute('data-full-comments') || '[]');
              var ecHtml = '';
              for (var ecI = 0; ecI < allComments.length; ecI++) {
                ecHtml += _singleCommentHtml(allComments[ecI]);
              }
              clDiv.innerHTML = ecHtml;
            } catch (_ec) {}
          }
          break;

        case 'submitComment':
          _handleSubmitComment(id, root);
          break;

        case 'shareWA':
          if (typeof window._sharePostOnWhatsApp === 'function') window._sharePostOnWhatsApp(id);
          break;

        case 'openLightbox':
          try {
            var lbImgs = JSON.parse(btn.getAttribute('data-images') || '[]');
            var lbIdx = parseInt(btn.getAttribute('data-index') || '0', 10);
            if (lbImgs.length) _lbOpen(lbImgs, lbIdx);
          } catch (_e) {}
          break;

        case 'lbClose':
          _lbClose();
          break;

        case 'lbPrev':
          _lbPrev();
          break;

        case 'lbNext':
          _lbNext();
          break;

        default:
          break;
      }
    });

  }

  /* ---- lightbox ---- */

  var _lbImages = [];
  var _lbIndex = 0;
  var _lbTouchX = 0;

  function _lightboxHtml() {
    return '<div id="client-lightbox" style="display:none;position:fixed;inset:0;z-index:9500;background:#000000;flex-direction:column;align-items:center;justify-content:center;">' +
      '<button data-action="lbClose" style="position:absolute;top:14px;left:14px;background:none;border:none;color:#888;font-size:24px;cursor:pointer;z-index:1;padding:8px;">&#x2715;</button>' +
      '<span id="client-lb-counter" style="position:absolute;top:18px;right:14px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#666;z-index:1;"></span>' +
      '<button id="client-lb-prev" data-action="lbPrev" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#888;font-size:28px;cursor:pointer;z-index:1;padding:12px;">&#x2039;</button>' +
      '<button id="client-lb-next" data-action="lbNext" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#888;font-size:28px;cursor:pointer;z-index:1;padding:12px;">&#x203A;</button>' +
      '<img id="client-lb-img" src="" alt="" style="max-width:100%;max-height:100%;object-fit:contain;">' +
    '</div>';
  }

  function _lbUpdate() {
    var img = document.getElementById('client-lb-img');
    var counter = document.getElementById('client-lb-counter');
    var prev = document.getElementById('client-lb-prev');
    var next = document.getElementById('client-lb-next');
    if (img) img.src = _lbImages[_lbIndex] || '';
    var multi = _lbImages.length > 1;
    if (counter) {
      counter.textContent = multi ? (_lbIndex + 1) + ' / ' + _lbImages.length : '';
    }
    if (prev) prev.style.display = multi ? 'block' : 'none';
    if (next) next.style.display = multi ? 'block' : 'none';
  }

  function _lbOpen(images, index) {
    _lbImages = images;
    _lbIndex = Math.max(0, Math.min(index, images.length - 1));
    var el = document.getElementById('client-lightbox');
    if (el) {
      el.style.display = 'flex';
      _lbUpdate();
      window._modalOpen = true;
      document.body.style.overflow = 'hidden';
    }
  }

  function _lbClose() {
    var el = document.getElementById('client-lightbox');
    if (el) el.style.display = 'none';
    _lbImages = [];
    _lbIndex = 0;
    window._modalOpen = false;
    document.body.style.overflow = '';
  }

  function _lbPrev() {
    if (_lbImages.length < 2) return;
    _lbIndex = (_lbIndex - 1 + _lbImages.length) % _lbImages.length;
    _lbUpdate();
  }

  function _lbNext() {
    if (_lbImages.length < 2) return;
    _lbIndex = (_lbIndex + 1) % _lbImages.length;
    _lbUpdate();
  }

  function _wireLightboxTouch() {
    var el = document.getElementById('client-lightbox');
    if (!el || el._touchWired) return;
    el._touchWired = true;
    el.addEventListener('touchstart', function (e) {
      _lbTouchX = e.changedTouches[0].clientX;
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      var diff = e.changedTouches[0].clientX - _lbTouchX;
      if (Math.abs(diff) >= 50) {
        if (diff < 0) _lbNext();
        else _lbPrev();
      }
    }, { passive: true });
  }

  function _wireLightboxKeyboard() {
    if (window._clientLbKeyWired) return;
    window._clientLbKeyWired = true;
    document.addEventListener('keydown', function (e) {
      var el = document.getElementById('client-lightbox');
      if (!el || el.style.display === 'none') return;
      if (e.key === 'Escape') _lbClose();
      else if (e.key === 'ArrowLeft') _lbPrev();
      else if (e.key === 'ArrowRight') _lbNext();
    });
  }

  /* ---- ensure request overlay on document.body ---- */

  function _ensureReqOverlay() {
    if (document.getElementById('req-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'req-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:2000;background:#080808;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    var mono = "'IBM Plex Mono',monospace";
    var sans = "'DM Sans',sans-serif";
    var labelStyle = 'font-family:' + mono + ';font-size:7px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:8px;';
    var inputStyle = 'width:100%;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.12);color:#e8e2d9;font-family:' + sans + ';font-size:15px;padding:10px 0;outline:none;caret-color:#C8A84B;';
    var chipBtnStyle = 'font-family:' + mono + ';font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);background:transparent;border:1px solid rgba(255,255,255,0.18);padding:8px 14px;cursor:pointer;';
    overlay.innerHTML =
      '<div style="position:sticky;top:0;z-index:10;background:rgba(8,8,8,0.97);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
        '<div style="font-family:' + mono + ';font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#C8A84B;">New Request</div>' +
        '<button data-action="reqClose" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer;padding:4px;">&#x2715;</button>' +
      '</div>' +
      '<div style="padding:24px 18px 120px;max-width:430px;margin:0 auto;width:100%;">' +
        '<div style="margin-bottom:24px;">' +
          '<div style="' + labelStyle + '">Title</div>' +
          '<input id="req-name" type="text" placeholder="Give your request a short title" style="' + inputStyle + '">' +
        '</div>' +
        '<div style="margin-bottom:24px;">' +
          '<div style="' + labelStyle + '">Brief</div>' +
          '<textarea id="req-topic" rows="4" placeholder="Describe what you need..." style="' + inputStyle + 'resize:none;line-height:1.7;"></textarea>' +
        '</div>' +
        '<div style="margin-bottom:24px;">' +
          '<div style="' + labelStyle + '">Content Type</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
            '<button data-action="reqChip" style="' + chipBtnStyle + '">Carousel</button>' +
            '<button data-action="reqChip" style="' + chipBtnStyle + '">Static</button>' +
            '<button data-action="reqChip" style="' + chipBtnStyle + '">Video</button>' +
            '<button data-action="reqChip" style="' + chipBtnStyle + '">Article</button>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:24px;">' +
          '<div style="' + labelStyle + '">Target Date</div>' +
          '<div style="position:relative;">' +
            '<span id="req-date-label" style="font-family:' + sans + ';font-size:14px;color:rgba(255,255,255,0.45);">Pick a date</span>' +
            '<input id="req-date" type="date" style="position:absolute;inset:0;opacity:0;cursor:pointer;">' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:24px;">' +
          '<div style="' + labelStyle + '">Urgency</div>' +
          '<div style="display:flex;gap:8px;">' +
            '<button id="req-urgency-normal" data-action="reqUrgency" data-type="normal" style="' + chipBtnStyle + 'color:#3ECF8E;background:rgba(62,207,142,0.08);border-color:rgba(62,207,142,0.3);">Normal</button>' +
            '<button id="req-urgency-urgent" data-action="reqUrgency" data-type="urgent" style="' + chipBtnStyle + '">Urgent</button>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:24px;">' +
          '<div style="' + labelStyle + '">Photos</div>' +
          '<div id="req-photo-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">' +
            '<div id="req-add-tile" data-action="reqAddPhoto" style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(255,255,255,0.15);cursor:pointer;color:rgba(255,255,255,0.3);font-size:20px;">+</div>' +
          '</div>' +
          '<input id="req-file" type="file" accept="image/*" multiple style="display:none;">' +
          '<div id="req-photo-count" style="font-family:' + mono + ';font-size:9px;color:#444;margin-top:6px;">No photos added</div>' +
          '<div id="req-progress-wrap" style="display:none;margin-top:8px;">' +
            '<div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">' +
              '<div id="req-progress-fill" style="height:100%;width:0%;background:#C8A84B;transition:width 0.3s;"></div>' +
            '</div>' +
            '<div id="req-progress-text" style="font-family:' + mono + ';font-size:8px;color:#555;margin-top:4px;"></div>' +
          '</div>' +
        '</div>' +
        '<button id="req-submit-btn" disabled data-action="reqSubmit" style="width:100%;font-family:' + mono + ';font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#444;background:transparent;border:1px solid rgba(255,255,255,0.1);padding:16px 0;cursor:not-allowed;">&#x2192; Send Request</button>' +
      '</div>';
    document.body.appendChild(overlay);
    // Wire delegated events on request overlay
    overlay.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var act = btn.getAttribute('data-action');
      if (act === 'reqClose') { if (typeof _closeReqForm === 'function') _closeReqForm(); }
      else if (act === 'reqChip') { if (typeof _reqToggleChip === 'function') _reqToggleChip(btn); }
      else if (act === 'reqUrgency') { if (typeof _reqSetUrgency === 'function') _reqSetUrgency(btn, btn.getAttribute('data-type')); }
      else if (act === 'reqAddPhoto') { var fi = document.getElementById('req-file'); if (fi) fi.click(); }
      else if (act === 'reqSubmit') { if (typeof submitClientRequest === 'function') submitClientRequest(); }
      else if (act === 'reqRemovePhoto') {
        var tile = btn.closest('[data-file-idx]');
        if (tile) {
          var idx = tile.dataset.fileIdx;
          if (window._reqStoredFiles && idx !== undefined) window._reqStoredFiles[idx] = null;
          tile.remove();
          if (typeof _reqUpdatePhotoCount === 'function') _reqUpdatePhotoCount();
        }
      }
    });
    // Wire input/change events
    var reqName = document.getElementById('req-name');
    var reqTopic = document.getElementById('req-topic');
    var reqDate = document.getElementById('req-date');
    var reqFile = document.getElementById('req-file');
    if (reqName) reqName.addEventListener('input', function() { if (typeof _reqValidate === 'function') _reqValidate(); });
    if (reqTopic) reqTopic.addEventListener('input', function() { if (typeof _reqValidate === 'function') _reqValidate(); });
    if (reqDate) reqDate.addEventListener('change', function() {
      var l = document.getElementById('req-date-label');
      if (l) { l.textContent = this.value; l.style.color = '#e8e2d9'; }
    });
    if (reqFile) reqFile.addEventListener('change', function() { if (typeof _reqAddPhotos === 'function') _reqAddPhotos(this); });
  }

  /* ---- main render ---- */

  window.renderClientView = function () {
    var cv = document.getElementById('client-view');
    if (!cv) return;

    _ensurePulseStyle();
    _ensureReqOverlay();
    cv.style.display = 'block';
    cv.style.background = '#1b1f23';

    var fab = document.getElementById('fab');
    if (fab) fab.style.display = 'none';
    var fabBtn = document.getElementById('main-fab-btn');
    if (fabBtn) fabBtn.style.display = 'none';
    _setClientNav();

    var posts = window.allPosts || [];
    var buckets = _bucket(posts);
    var awaitCount = buckets.approval.length + buckets.input.length;

    var html = _topBarHtml(awaitCount);

    var hasContent = buckets.approval.length || buckets.input.length || buckets.published.length;

    html += '<div style="padding-bottom:72px;max-width:560px;margin:0 auto;">';

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
    html += _approvePopupHtml();
    html += _lightboxHtml();

    cv.innerHTML = html;
    _wireTopNavOnce();
    _wireEvents(cv);
    _wireNavEvents();
    _wireLightboxTouch();
    _wireLightboxKeyboard();
  };

  /* ---- client post overlay (single card, full-screen) ---- */

  window._openClientPostOverlay = function(postId) {
    var post = (window.allPosts || []).find(function(p) {
      return p.post_id === postId || p.id === postId;
    });
    if (!post) {
      if (typeof window.showToast === 'function') window.showToast('Post not found', 'error');
      return;
    }

    var existing = document.getElementById('client-post-overlay');
    if (existing) existing.remove();

    _ensurePulseStyle();

    // Ensure singleton lightbox + approve popup on document.body
    if (!document.getElementById('client-lightbox')) {
      var lbDiv = document.createElement('div');
      lbDiv.innerHTML = _lightboxHtml();
      document.body.appendChild(lbDiv.firstChild);
    }
    if (!document.getElementById('client-approve-popup')) {
      var apDiv = document.createElement('div');
      apDiv.innerHTML = _approvePopupHtml();
      document.body.appendChild(apDiv.firstChild);
    }

    var isPublished = post.stage === 'published';
    var pid = _esc(post.post_id || post.id || '');

    var cardHtml =
      _cardHeaderHtml(post, pid) +
      _captionHtml(post) +
      _imgGridHtml(post.images) +
      _statsBarHtml(post, isPublished) +
      (isPublished ? '' : _engagementBarHtml(post)) +
      _commentsListHtml(post);

    var overlay = document.createElement('div');
    overlay.id = 'client-post-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#1b1f23;overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:\'DM Sans\',sans-serif;';
    overlay.innerHTML =
      '<div style="position:sticky;top:0;z-index:10;background:rgba(27,31,35,0.95);backdrop-filter:blur(8px);padding:0;border-bottom:1px solid rgba(255,255,255,0.06);">' +
        '<button id="client-overlay-close" style="background:none;border:none;color:#888;font-size:24px;cursor:pointer;padding:12px 16px;">&#x2715;</button>' +
      '</div>' +
      '<div style="padding-bottom:72px;">' +
        '<div class="post-card" data-card-id="' + pid + '" data-stage="' + _esc(post.stage || '') + '">' +
          cardHtml +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    window._modalOpen = true;
    document.body.style.overflow = 'hidden';

    _wireEvents(overlay);
    var approvePopup = document.getElementById('client-approve-popup');
    if (approvePopup && !approvePopup.dataset.wired) {
      _wireEvents(approvePopup);
      approvePopup.dataset.wired = '1';
    }
    _wireLightboxTouch();
    _wireLightboxKeyboard();

    var closeBtn = document.getElementById('client-overlay-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        overlay.remove();
        window._modalOpen = false;
        document.body.style.overflow = '';
      });
    }
  };

  /* ---- client request form (moved inside IIFE for load-order safety) ---- */

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
  };

})();

/* ============================================================
   Preserved functions below -- untouched from original
   ============================================================ */

window._closeReqForm = function() {
  var o = document.getElementById('req-overlay');
  if (o) o.style.display = 'none';
  var nav = document.getElementById('bottom-nav');
  if (nav) {
    var _isClientMode = document.body.classList.contains('client-mode');
    nav.style.display = _isClientMode ? 'flex' : '';
  }
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
  var chips = document.querySelectorAll('#req-overlay [data-action="reqChip"]');
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
        '<button data-action="reqRemovePhoto" ' +
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
