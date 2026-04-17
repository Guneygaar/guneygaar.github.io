/* render/client.js -- Client portal feed (polish pass) */
console.log('LOADED:', 'render/client.js');
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
    return _nl2br(_esc(text)).replace(/(?<!&)(#[a-zA-Z]\w*)/g, '<span style="color:#378fe9;">$1</span>');
  }

  function _parseMentions(message) {
    if (!message) return [];
    var raw = message.match(/(?:^|[\s(])@([a-zA-Z0-9_]+)/g) || [];
    var out = [];
    for (var i = 0; i < raw.length; i++) out.push(raw[i].replace(/^[\s(@]+/, ''));
    return out;
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
    'client': '#FF4B4B',
    'servicing': '#22D3EE',
    'creative': '#9b87f5',
    'admin': '#C8A84B'
  };

  function _roleColor(role) {
    var r = (typeof getRoleFor === 'function') ? getRoleFor(role) : (role || '').toLowerCase();
    return ROLE_COLORS[r] || '#C8A84B';
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
    var requests = [];
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      if (p._isRequest) {
        // Only surface requests that need client input: assigned_to is
        // empty/null AND at least one agency comment exists. Briefs
        // already picked up by creative (assigned_to set) or still
        // waiting on agency to reply (no agency comment yet) stay
        // hidden from the client feed.
        var assigned = (p.assigned_to || '').trim();
        if (assigned) continue;
        var comments = p.post_comments || [];
        var hasAgencyComment = false;
        for (var ci = 0; ci < comments.length; ci++) {
          var cRole = String(comments[ci].author_role || '').toLowerCase();
          if (cRole && cRole !== 'client') { hasAgencyComment = true; break; }
        }
        if (!hasAgencyComment) continue;
        requests.push(p);
        continue;
      }
      if (p.stage === 'awaiting_approval') approval.push(p);
      else if (p.stage === 'awaiting_brand_input') input.push(p);
      else if (p.stage === 'published') published.push(p);
    }
    _sortAsc(approval);
    _sortAsc(input);
    _sortDesc(published);
    _sortDesc(requests);
    return { approval: approval, input: input, published: published, requests: requests };
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
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;background:#FF4B4B0D;border:1px dotted #FF4B4B2E;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;color:#FF4B4B;">' +
          '<span style="width:4px;height:4px;border-radius:50%;background:#FF4B4B;animation:clientPulse 2s infinite;"></span>' +
          'WAITING ' + days + ' DAYS &middot; OVERDUE</span>';
      }
      return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;background:#F6A6230D;border:1px dotted #F6A6232E;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;color:#F6A623;">' +
        '<span style="width:4px;height:4px;border-radius:50%;background:#F6A623;animation:clientPulse 2s infinite;"></span>' +
        'AWAITING YOUR APPROVAL</span>';
    }
    if (stage === 'awaiting_brand_input') {
      return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;background:#22D3EE0A;border:1px dotted #22D3EE29;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;color:#22D3EE;">' +
        '<span style="width:4px;height:4px;border-radius:50%;background:#22D3EE;animation:clientPulse 2s infinite;"></span>' +
        'TEAM NEEDS YOUR INPUT</span>';
    }
    if (stage === 'published') {
      return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;background:#3ECF8E0A;border:1px dotted #3ECF8E29;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.1em;color:#3ECF8E;">' +
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
      '.menu-root-absolute{position:absolute!important;z-index:999999!important;transform:none!important;background:#0d0d0d;border:1px dotted #FFFFFF1F;border-radius:0;min-width:180px;box-shadow:0 8px 24px #00000099;}' +
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
      return '<div id="' + _esc(id) + '" class="cf-caption" style="font-family:\'DM Sans\',sans-serif;font-size:14px;line-height:1.6;color:#E0E0E8;padding:0 14px;margin-top:8px;">' +
        _hashtagHtml(short) +
        '<span class="see-more" data-action="expand-caption" data-id="' + _esc(id) + '" style="color:#4A9FD8;font-weight:500;cursor:pointer;font-size:13px;">...more</span>' +
        '<span style="display:none;" data-full>' + _hashtagHtml(text) + '</span>' +
        '</div>';
    }
    return '<div class="cf-caption" style="font-family:\'DM Sans\',sans-serif;font-size:14px;line-height:1.6;color:#E0E0E8;padding:0 14px;margin-top:8px;">' + _hashtagHtml(text) + '</div>';
  }

  /* ---- image grid ---- */

  function _imgGridHtml(images) {
    if (!images || !images.length) return '';
    var imgs = images.filter(function (u) { return !!u; });
    var n = imgs.length;
    if (n === 0) return '';

    var imgsJson = _esc(JSON.stringify(imgs));
    var wrap = function (src, idx, css, overlay) {
      return '<div class="lb-trigger-cell" style="' + css + 'position:relative;display:block;width:100%;height:100%;overflow:hidden;background:#111;border-radius:0;">' +
        '<img src="' + _esc(src) + '"' +
        ' data-action="openLightbox"' +
        ' data-images=\'' + imgsJson + '\'' +
        ' data-index="' + idx + '"' +
        ' draggable="false"' +
        ' alt="" loading="lazy"' +
        ' style="cursor:pointer;width:100%;height:100%;object-fit:cover;-webkit-user-drag:none;pointer-events:auto;">' +
        (overlay || '') + '</div>';
    };

    /* +N overlay (PCS-style: big number + small "more" label). Used by 4+ case. */
    var _overlayHtml = function (extra) {
      return '<div class="client-img-overlay" style="position:absolute;inset:0;background:rgba(8,8,8,0.72);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none;">' +
        '<div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1;">+' + extra + '</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;color:rgba(255,255,255,0.5);letter-spacing:0.14em;text-transform:uppercase;">more</div>' +
        '</div>';
    };

    if (n === 1) {
      return '<div class="img-single" style="padding:0;margin:0;user-select:none;-webkit-user-select:none;">' +
        wrap(imgs[0], 0, 'aspect-ratio:1/1;') +
        '</div>';
    }

    if (n === 2) {
      return '<div class="img-duo" style="display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:0;margin:0;user-select:none;-webkit-user-select:none;">' +
        wrap(imgs[0], 0, 'aspect-ratio:1/1;') +
        wrap(imgs[1], 1, 'aspect-ratio:1/1;') +
        '</div>';
    }

    /* 3 and 4+ share the same hero+stack flex layout (PCS .pcs-pg-3 / .pcs-pg-3plus parity).
       4+ adds a +N overlay on cell 2. */
    if (n >= 3) {
      var extra = n - 3;
      var overlay = extra > 0 ? _overlayHtml(extra) : '';
      return '<div class="img-trio" style="display:flex;gap:2px;padding:0;margin:0;aspect-ratio:1/1;user-select:none;-webkit-user-select:none;">' +
        '<div style="flex:0 0 calc(60% - 1px);position:relative;overflow:hidden;">' +
          wrap(imgs[0], 0, '') +
        '</div>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:2px;">' +
          '<div style="flex:1;position:relative;overflow:hidden;">' +
            wrap(imgs[1], 1, '') +
          '</div>' +
          '<div style="flex:1;position:relative;overflow:hidden;">' +
            wrap(imgs[2], 2, '', overlay) +
          '</div>' +
        '</div>' +
      '</div>';
    }
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
    // 14x14 clock icon inherits currentColor from the wrapping span
    var ICON_CLOCK_14 = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    var left = '';
    if (isPublished) {
      var approvedDate = post.status_changed_at || post.statusChangedAt || post.updated_at || '';
      left = '<span style="display:inline-flex;align-items:center;gap:6px;line-height:1.4;color:#3ECF8E;font-size:12px;font-weight:500;">' +
        ICON_CHECK + ' Approved' +
        (approvedDate ? ' &middot; ' + _esc(_fmtDate(approvedDate)) : '') +
        '</span>';
    } else {
      var days = _waitDays(post);
      var dColor = days > 2 ? '#EF4444' : '#FBBF24';
      left = '<span style="display:inline-flex;align-items:center;gap:6px;line-height:1.4;color:' + dColor + ';font-size:12px;font-weight:500;">' +
        ICON_CLOCK_14 +
        '<span>Waiting ' + days + ' day' + (days !== 1 ? 's' : '') + '</span>' +
        '</span>';
    }
    var count = _commentCount(post);
    var right = '<span style="display:inline-flex;align-items:center;line-height:1.4;color:#909098;font-size:12px;font-weight:500;">' +
      count + ' comment' + (count === 1 ? '' : 's') +
    '</span>';
    return '<div class="stats-bar" style="display:flex;align-items:center;justify-content:space-between;">' +
      left + right + '</div>';
  }

  /* ---- engagement bar ---- */

  function _engagementBarHtml(post) {
    if (post.stage !== 'awaiting_approval' && post.stage !== 'awaiting_brand_input') return '';
    var pid = _esc(post.post_id || post.id || '');
    var title = _esc(post.title || '');
    var btnStyle = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;' +
      'background:none;border:none;border-right:1px solid #2A2A34;' +
      'color:#909098;font-size:11px;font-weight:500;' +
      'cursor:pointer;';
    var lastBtnStyle = btnStyle.replace('border-right:1px solid #2A2A34;', '');

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
      '<div id="approved-strip-' + pid + '" style="' +
      (post.stage === 'scheduled' ? 'display:block;' : 'display:none;') +
      'padding:10px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#3ECF8E;background:#0a1a12;margin-top:6px;">' +
      (post.stage === 'scheduled' ? '<span style="display:inline-flex;align-items:center;gap:5px;">' + ICON_CHECK + ' Approved</span>' : '') +
      '</div>';
  }

  /* ---- approve popup (singleton) ---- */

  function _approvePopupHtml() {
    return '<div id="client-approve-popup" style="display:none;position:fixed;inset:0;z-index:1500;background:#000000BF;align-items:center;justify-content:center;">' +
      '<div style="background:#1a1a1a;border:1px solid #2A2A34;border-radius:12px;padding:24px;max-width:340px;width:90%;text-align:center;">' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-weight:600;font-size:16px;color:#e8e2d9;">Approve this post?</div>' +
        '<div id="client-approve-title" style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#C8A84B;margin-top:10px;"></div>' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-size:12px;color:#666;margin-top:10px;line-height:1.5;">This will send it for scheduling. Your team will be notified immediately.</div>' +
        '<div style="display:flex;gap:10px;margin-top:20px;justify-content:center;">' +
          '<button data-action="approveCancel" style="flex:1;padding:10px;background:none;border:1px solid #FFFFFF1A;border-radius:8px;color:#888;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;">Cancel</button>' +
          '<button data-action="approveConfirm" style="flex:1;padding:10px;background:#22C55E1A;border:1px solid #22C55E4D;border-radius:8px;color:#22c55e;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;">Yes, Approve</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---- card 3-dot menu (singleton, repositioned on open) ---- */

  var _menuBtnStyle = 'display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#ccc;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;';
  var _menuBtnBorder = 'border-top:1px solid #2A2A34;';

  function _handleCardMenuAction(action, postId) {
    var post = (window.AppState.posts.all || []).find(function (p) { return p.post_id === postId || p.id === postId; });
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
          var cpPostId = post.post_id || '';
          var cpShortCode = cpPostId.replace(/[^0-9]/g, '').slice(-4);
          navigator.clipboard.writeText('https://srtd.io/p/' + cpShortCode).then(function () {
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

  var ICON_PERSON = '<svg viewBox="0 0 24 24" fill="none" stroke="#3a3a3a" stroke-width="1.5" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  var _CLIENT_AVATAR_PALETTE = {
    client:    { bg: '#FF4B4B30', fg: '#FF4B4B' },
    servicing: { bg: '#22D3EE30', fg: '#22D3EE' },
    admin:     { bg: '#C8A84B30', fg: '#C8A84B' },
    creative:  { bg: '#9b87f530', fg: '#9b87f5' }
  };

  function _clientAvatarColors(role) {
    var r = (typeof getRoleFor === 'function') ? getRoleFor(role) : (role || '').toLowerCase();
    return _CLIENT_AVATAR_PALETTE[r] || { bg: '#40405030', fg: '#A0A0B0' };
  }

  function _highlightClientMentions(escapedText) {
    return escapedText.replace(/@(\w+)/g, '<span style="color:#4A9FD8;font-weight:600;">@$1</span>');
  }

  function _parseCommentAttachments(c) {
    try {
      return typeof c.attachments === 'string'
        ? JSON.parse(c.attachments)
        : c.attachments;
    } catch (e) { return null; }
  }

  function _commentImgHtml(c) {
    var _att = _parseCommentAttachments(c);
    if (!_att || _att.type !== 'images' || !_att.urls || !_att.urls.length) return '';
    var urls = _att.urls;
    var postIdArg = _esc(c.post_id || '');
    var jsArr = '[' + urls.map(function(u){ return '&#39;' + _esc(u) + '&#39;'; }).join(',') + ']';
    return '<div class="pcs-comment-imgs">' +
      urls.map(function(u, i) {
        return '<img src="' + _esc(u) + '" class="pcs-comment-img-thumb" ' +
          'onclick="window._pcsOpenLightbox(&#39;' + postIdArg + '&#39;,' + jsArr + ',' + i + ')">';
      }).join('') +
    '</div>';
  }

  function _singleCommentHtml(c, opts) {
    opts = opts || {};
    var isReply = !!opts.isReply;
    var parentAuthor = opts.parentAuthor || '';
    var cid = _esc(c.id || '');
    var postId = _esc(c.post_id || '');
    var avSize = isReply ? 22 : 28;
    var avFontPx = isReply ? 9 : 10;
    var wrapperPad = isReply ? '8px 14px 8px 46px' : '10px 14px';
    var connectorHtml = isReply
      ? '<div style="position:absolute;left:17px;top:-8px;bottom:18px;width:2px;background:#404050;border-radius:1px;"></div>'
      : '';
    if (c.deleted) {
      return '<div class="client-comment-wrap client-comment-tomb" data-comment-id="' + cid + '" style="display:flex;gap:10px;padding:' + wrapperPad + ';align-items:center;position:relative;">' +
        connectorHtml +
        '<div style="width:' + avSize + 'px;height:' + avSize + 'px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#40405030;font-family:\'IBM Plex Mono\',monospace;font-size:' + avFontPx + 'px;font-weight:700;color:#404050;">?</div>' +
        '<div class="client-comment-tombstone">This message was deleted.</div>' +
      '</div>';
    }
    var _authorDisplay = (typeof getDisplayName === 'function') ? getDisplayName(c.author) : (c.author || '?');
    var ts = _relativeTime(c.created_at);
    var avatarHtml = (typeof renderAvatar === 'function')
      ? renderAvatar(c.author, c.author_role, avSize || 32)
      : (function() { var palette = _clientAvatarColors(c.author_role); var initial = _authorDisplay.charAt(0).toUpperCase(); return '<div style="width:' + avSize + 'px;height:' + avSize + 'px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:\'IBM Plex Mono\',monospace;font-size:' + avFontPx + 'px;font-weight:700;color:' + palette.fg + ';background:' + palette.bg + ';">' + _esc(initial) + '</div>'; })();
    var messageHtml = _highlightClientMentions(_esc(c.message || ''));
    var imgHtml = _commentImgHtml(c);
    var resolvedHtml = '';
    if (c.resolved && c.resolved_by) {
      resolvedHtml = '<div style="display:flex;align-items:center;gap:4px;margin-top:6px;">' +
        '<svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="#3ECF8E" stroke-width="1.5">' +
          '<circle cx="9" cy="9" r="7"/>' +
          '<polyline points="6,9 8.5,11.5 12.5,6.5"/>' +
        '</svg>' +
        '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#3ECF8E;font-weight:500;">Resolved by ' + _esc((typeof getDisplayName === 'function') ? getDisplayName(c.resolved_by) : c.resolved_by) + '</span>' +
      '</div>';
    }
    var replyTagHtml = (isReply && parentAuthor)
      ? '<div style="font-family:\'DM Sans\',sans-serif;font-size:11px;color:#A0A0B0;margin-bottom:3px;">' +
          '\u21a9 <span style="color:#A0A0B0;font-weight:600;">' + _esc(parentAuthor) + '</span>' +
        '</div>'
      : '';
    var editedLabel = c.edited_at
      ? '<span class="client-comment-edited-label" style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;color:#707078;font-style:italic;margin-left:6px;">(edited)</span>'
      : '';
    var dotsBtnHtml = '<span class="client-comment-dots" ' +
        'data-comment-id="' + cid + '" ' +
        'data-author="' + _esc(c.author || '') + '" ' +
        'data-post-id="' + postId + '" ' +
        'data-message="' + _esc(c.message || '') + '" ' +
        'onclick="event.stopPropagation();window._clientShowCommentMenu(this)" ' +
        'style="margin-left:auto;cursor:pointer;display:inline-flex;align-items:center;padding:2px 4px;">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#78788C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="12" cy="5" r="1"/>' +
          '<circle cx="12" cy="12" r="1"/>' +
          '<circle cx="12" cy="19" r="1"/>' +
        '</svg>' +
      '</span>';
    return '<div class="client-comment-wrap" data-comment-id="' + cid + '" style="display:flex;gap:10px;padding:' + wrapperPad + ';position:relative;">' +
      connectorHtml +
      avatarHtml +
      '<div style="flex:1;min-width:0;">' +
        replyTagHtml +
        '<div style="display:flex;align-items:center;flex-wrap:nowrap;gap:6px;">' +
          '<span style="font-family:\'DM Sans\',sans-serif;font-weight:700;font-size:14px;color:#FFFFFF;">' + _esc(_authorDisplay) + '</span>' +
          dotsBtnHtml +
        '</div>' +
        '<div class="client-comment-time" style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#909098;margin-top:1px;">' + ts + editedLabel + '</div>' +
        '<div class="client-comment-body" style="font-family:\'DM Sans\',sans-serif;font-size:14px;color:#E0E0E8;line-height:1.55;margin-top:3px;white-space:pre-wrap;">' + messageHtml + '</div>' +
        imgHtml +
        resolvedHtml +
        '<div class="client-comment-actions">' +
          '<span class="pcs-comment-react" data-comment-id="' + cid + '" ' +
            'onclick="window._pcsShowEmojiPicker(this)">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#B0B0B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
            'Like' +
          '</span>' +
          '<span style="color:#505058;font-size:12px;">|</span>' +
          '<span onclick="window._clientSetReply(\'' +
            cid + '\',\'' + _esc(c.author || '') + '\',\'' +
            postId + '\',\'' +
            _esc(String(c.message || '').replace(/'/g, '\\\'').replace(/\n/g, ' ')) +
            '\')">Reply</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Build threaded HTML for a flat list of comments.
     topCap: max top-level entries to render (null = all).
     Returns an object { html, remainingTop }. */
  function _buildThreadedCommentsHtml(comments, topCap, pid) {
    var topLevel = [];
    var replyMap = {};
    var byId = {};
    comments.forEach(function(c) { if (c.id) byId[c.id] = c; });
    comments.forEach(function(c) {
      if (c.reply_to && byId[c.reply_to]) {
        if (!replyMap[c.reply_to]) replyMap[c.reply_to] = [];
        replyMap[c.reply_to].push(c);
      } else {
        topLevel.push(c);
      }
    });
    var cap = (typeof topCap === 'number' && topCap > 0) ? topCap : topLevel.length;
    var showTop = topLevel.slice(0, cap);
    var remainingTop = topLevel.length - showTop.length;
    var html = '';
    for (var i = 0; i < showTop.length; i++) {
      var parent = showTop[i];
      html += _singleCommentHtml(parent);
      var replies = replyMap[parent.id] || [];
      if (!replies.length) continue;
      var parentAuthorRaw = parent.author || '';
      var parentAuthor = (typeof getDisplayName === 'function' && parentAuthorRaw)
        ? getDisplayName(parentAuthorRaw)
        : parentAuthorRaw;
      if (replies.length === 1) {
        html += _singleCommentHtml(replies[0], { isReply: true, parentAuthor: parentAuthor });
      } else if (replies.length === 2) {
        html += _singleCommentHtml(replies[0], { isReply: true, parentAuthor: parentAuthor });
        html += _singleCommentHtml(replies[1], { isReply: true, parentAuthor: parentAuthor });
      } else {
        var first = replies[0];
        var last = replies[replies.length - 1];
        var middle = replies.slice(1, replies.length - 1);
        var hiddenId = 'client-hidden-replies-' + _esc(parent.id || '') + '-' + i;
        html += _singleCommentHtml(first, { isReply: true, parentAuthor: parentAuthor });
        html += '<div class="pcs-expand-link" onclick="(function(el){var t=document.getElementById(\'' + hiddenId + '\');if(t){t.style.display=\'block\';}el.style.display=\'none\';})(this)" style="padding:6px 14px 6px 46px;cursor:pointer;color:#4A9FD8;font-size:13px;font-weight:600;font-family:\'DM Sans\',sans-serif;">' +
          'See ' + middle.length + ' more repl' + (middle.length === 1 ? 'y' : 'ies') +
        '</div>';
        html += '<div id="' + hiddenId + '" style="display:none;">';
        middle.forEach(function(r) {
          html += _singleCommentHtml(r, { isReply: true, parentAuthor: parentAuthor });
        });
        html += '</div>';
        html += _singleCommentHtml(last, { isReply: true, parentAuthor: parentAuthor });
      }
    }
    return { html: html, remainingTop: remainingTop };
  }

  function _commentsListHtml(post) {
    var visibleComments = (post.post_comments || []);
    if (!visibleComments.length) return '';
    var pid = _esc(post.post_id || post.id || '');
    var built = _buildThreadedCommentsHtml(visibleComments, 5, pid);
    var html = '<div data-comments-list="' + pid + '" data-full-comments="' + _esc(JSON.stringify(visibleComments)) + '" style="margin-top:6px;">';
    html += built.html;
    if (built.remainingTop > 0) {
      html += '<div data-action="expandComments" data-id="' + pid + '" style="font-size:12px;color:#555;padding:4px 14px 8px;cursor:pointer;font-family:\'DM Sans\',sans-serif;">View ' + built.remainingTop + ' more comment' + (built.remainingTop > 1 ? 's' : '') + '</div>';
    }
    html += '</div>';
    return html;
  }

  /* ---- comment input row ---- */

  function _commentInputHtml(post) {
    if (post.stage !== 'awaiting_approval' && post.stage !== 'awaiting_brand_input') return '';
    var pid = _esc(post.post_id || post.id || '');
    var userName = (window.AppState.user.name || 'C');
    var initial = userName.charAt(0).toUpperCase();
    var placeholder = post.stage === 'awaiting_brand_input'
      ? 'Share the information here...'
      : 'Add a comment\u2026';
    /* Claude-aesthetic composer — two-container pattern. Critical DOM
       contracts preserved for tests/wiring: id="comment-input-<pid>"
       (now a <textarea>, not <input>), id="client-feed-img-input-<pid>",
       id="client-img-preview-<pid>", id="client-mention-drop-<pid>",
       data-post-id, data-action="submitComment", _clientFeedHandleImg
       onchange, PHOTO / mention aria-labels. Legacy gold #C8A84B kept
       on the avatar fallback. */
    var ICON_PHOTO_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#808088" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    var ICON_MENTION_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#808088" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>';
    var SEND_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
    /* Avatar — gold initial fallback (#C8A84B) when renderAvatar is
       unavailable. Keeps legacy gold token in source for the
       client-comment.test.js "gold avatar" assertion. */
    var avatarHtml = (typeof renderAvatar === 'function')
      ? renderAvatar(window.AppState.user.email || window.AppState.user.name, window.AppState.user.effectiveRole, 32)
      : '<div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#2A2A34;border:1px solid #3A3A48;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;color:#C8A84B;">' + _esc(initial) + '</div>';
    return '<div style="display:flex;align-items:flex-end;gap:8px;padding:10px 14px 6px;">' +
      avatarHtml +
      '<div style="flex:1;min-width:0;">' +
        '<div class="claude-composer-root" id="client-composer-root-' + pid + '" data-post-id="' + pid + '">' +
          '<div class="claude-composer">' +
            '<div class="claude-textarea-wrap">' +
              '<textarea id="comment-input-' + pid + '" class="claude-textarea" placeholder="' + _esc(placeholder) + '" rows="1" data-post-id="' + pid + '"></textarea>' +
              '<div class="claude-polishing-overlay"><span>polishing</span><span class="claude-polishing-dots"><span></span><span></span><span></span></span></div>' +
            '</div>' +
            '<button type="button" class="claude-sparkle" aria-label="Polish with Claude" data-claude-polish-trigger="client-' + pid + '">\u2726</button>' +
            '<button type="button" class="claude-send dim" data-action="submitComment" data-id="' + pid + '" aria-label="Send">' + SEND_SVG + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    /* Action row — photo + mention. The icons row is left-padded to
       align under the composer, not the avatar. */
    '<div style="display:flex;align-items:center;gap:16px;padding:0 14px 10px 59px;">' +
      '<input type="file" id="client-feed-img-input-' + pid + '" accept="image/*" multiple style="display:none" onchange="window._clientFeedHandleImg(\'' + pid + '\')">' +
      '<span role="button" aria-label="PHOTO" title="PHOTO" onclick="document.getElementById(\'client-feed-img-input-' + pid + '\').click()" style="cursor:pointer;display:inline-flex;align-items:center;">' + ICON_PHOTO_SVG + '</span>' +
      '<span role="button" aria-label="mention" onclick="window._clientToggleMention(\'' + pid + '\')" style="cursor:pointer;display:inline-flex;align-items:center;">' + ICON_MENTION_SVG + '</span>' +
    '</div>' +
    /* Image preview strip (hidden by default; JS flips to flex) */
    '<div id="client-img-preview-' + pid + '" style="display:none;gap:6px;flex-wrap:wrap;padding:0 14px 8px 59px;"></div>' +
    /* Mention dropdown (hidden by default) */
    '<div id="client-mention-drop-' + pid + '" style="display:none;margin:0 14px 8px 59px;background:#191924;border:1px solid #2A2A34;border-radius:4px;overflow:hidden;"></div>';
  }

  /* Wrap comments list + input bar in a single collapsible container
     so the Comment engagement-bar button can toggle it. Feed defaults
     to collapsed; _openClientPostOverlay flips the display style to
     'block' after render because the user explicitly opened the post. */
  function _commentsContainerHtml(post, expanded) {
    var pid = _esc(post.post_id || post.id || '');
    var disp = expanded ? 'block' : 'none';
    return '<div id="client-comments-section-' + pid + '" ' +
      'class="client-comments-section" ' +
      'data-comments-section="' + pid + '" ' +
      'style="display:' + disp + ';">' +
      _commentsListHtml(post) +
      _commentInputHtml(post) +
    '</div>';
  }

  /* ---- drive link card ----
     Read-only mirror of actions/pcs.js:_buildDriveLinkCard for the
     client feed. No edit/remove buttons (clients can't manage drive
     links), no add-link CTA when missing — empty driveLink yields an
     empty string so the card disappears entirely. Visual styling
     matches the PCS card byte-for-byte. */
  function _driveLinkCardHtml(driveLink) {
    if (!driveLink) return '';
    return '<div class="drive-link-wrap" style="padding:10px 14px 0;">' +
      '<div style="background:#0d1117;border:1px solid #1a1f27;border-radius:8px;overflow:hidden;">' +
        '<a href="' + _esc(driveLink) + '" target="_blank" rel="noopener" ' +
          'style="display:flex;align-items:center;gap:10px;padding:12px 14px;text-decoration:none;">' +
          '<div style="width:40px;height:40px;border-radius:6px;background:#1a1a0a;border:1px solid #3d2e0a;' +
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F6A623" stroke-width="1.5">' +
              '<path d="M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>' +
            '</svg>' +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:12px;font-weight:600;color:#e8eaed;margin-bottom:2px;">View on Drive</div>' +
            '<div style="font-size:10px;color:#556070;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              _esc(driveLink) +
            '</div>' +
          '</div>' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#556070" stroke-width="2">' +
            '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>' +
            '<polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>' +
          '</svg>' +
        '</a>' +
      '</div>' +
    '</div>';
  }

  /* ---- single card ---- */

  function _cardHtml(post, isPublished) {
    var opacity = isPublished ? 'opacity:0.45;' : '';
    var pid = _esc(post.post_id || post.id || '');
    // Only cards whose engagement bar renders a Comment button can be
    // toggled — that bar only shows on awaiting_* stages. Every other
    // stage (published, brief, in_production) keeps comments expanded
    // so the user always has a way to read them.
    var hasCommentBtn = post.stage === 'awaiting_approval' || post.stage === 'awaiting_brand_input';
    return '<div class="post-card" data-card-id="' + pid + '" data-stage="' + _esc(post.stage || '') + '" style="' + opacity + '">' +
      _cardHeaderHtml(post, pid) +
      /* caption */
      _captionHtml(post) +
      /* images */
      _imgGridHtml(post.images) +
      /* drive link card (read-only; hidden when post has no drive_link) */
      _driveLinkCardHtml(post.drive_link || post.driveLink || '') +
      /* stats bar (shows comment count even when collapsed) */
      _statsBarHtml(post, isPublished) +
      /* engagement bar (not on published) */
      (isPublished ? '' : _engagementBarHtml(post)) +
      /* comments + input; collapsed only on the stages that have the
         Comment toggle button in the engagement bar */
      _commentsContainerHtml(post, !hasCommentBtn) +
    '</div>';
  }

  /* ---- brief card (requests bucket) ---- */

  function _briefRelTime(iso) {
    if (typeof window._notifRelTime === 'function') {
      return window._notifRelTime(iso);
    }
    return _relativeTime(iso);
  }

  function _briefCardHtml(post) {
    var pid = post.post_id || post.id || '';
    var title = post.title || 'Untitled request';
    var tag = post.content_pillar || post.format || post.content_type || '';
    var created = post.created_at || '';

    // Latest agency comment (last non-client by created_at)
    var comments = (post.post_comments || []).slice().sort(function(a, b) {
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
    var latestAgency = null;
    for (var i = comments.length - 1; i >= 0; i--) {
      var cRole = String(comments[i].author_role || '').toLowerCase();
      if (cRole && cRole !== 'client') { latestAgency = comments[i]; break; }
    }
    var totalCount = comments.length;

    var chipStyle = 'display:inline-flex;align-items:center;gap:5px;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;padding:3px 8px;border-radius:2px;background:#FBBF2410;color:#FBBF24;border:1px solid #FBBF2425;';
    var chipDot = '<span style="width:5px;height:5px;border-radius:50%;background:#FBBF24;display:inline-block;"></span>';
    var chipHtml = '<span style="' + chipStyle + '">' + chipDot + 'NEEDS YOUR INPUT</span>';

    var timeStyle = 'font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#545460;font-weight:500;';
    var timeHtml = '<span style="' + timeStyle + '">' + _esc(_briefRelTime(created)) + '</span>';

    var topRow = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' + chipHtml + timeHtml + '</div>';

    var titleHtml = '<div style="font-size:15px;font-weight:700;color:#FFFFFF;line-height:1.3;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(title) + '</div>';

    var tagHtml = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:.06em;color:#545460;text-transform:uppercase;font-weight:500;margin-bottom:10px;">' + _esc(tag || '') + '</div>';

    var previewHtml = '';
    if (latestAgency) {
      var authorName = (typeof getDisplayName === 'function') ? getDisplayName(latestAgency.author) : (latestAgency.author || '');
      var initial = (authorName.charAt(0) || '?').toUpperCase();
      var msg = String(latestAgency.message || '').replace(/\s+/g, ' ').trim();
      var avStyle = 'width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-family:\'IBM Plex Mono\',monospace;font-size:8px;font-weight:700;background:#22D3EE18;color:#22D3EE;border:1px solid #22D3EE30;flex-shrink:0;';
      var nameStyle = 'font-size:10px;font-weight:600;color:#B2B2B7;';
      var textStyle = 'font-size:11px;font-weight:500;color:#92929B;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;';
      previewHtml = '<div style="padding:8px 10px;background:#15151F;border-radius:4px;border-left:2px solid #22D3EE;display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">' +
        '<div style="' + avStyle + '">' + _esc(initial) + '</div>' +
        '<div style="min-width:0;flex:1;">' +
          '<div style="' + nameStyle + '">' + _esc(authorName) + '</div>' +
          '<div style="' + textStyle + '">' + _esc(msg) + '</div>' +
        '</div>' +
      '</div>';
    }

    var countIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#545460" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    var countHtml = '<div style="display:inline-flex;align-items:center;gap:5px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#545460;font-weight:500;">' + countIcon + '<span>' + totalCount + '</span></div>';

    return '<div data-brief-card="' + _esc(pid) + '" onclick="window._openBriefSheet(\'' + _esc(pid) + '\')" style="background:#0D0D12;border-bottom:1px solid #2A2A34;padding:14px 16px;cursor:pointer;">' +
      topRow +
      titleHtml +
      tagHtml +
      previewHtml +
      countHtml +
    '</div>';
  }

  /* ---- section label ---- */

  function _sectionLabel(text) {
    return '<div class="section-label" style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#A0A0B0;">' + text + '</div>';
  }

  /* ---- top bar ---- */

  function _pillColor(n) {
    if (n >= 14) return { c: '#FF4B4B', bg: '#FF4B4B0A', bc: '#FF4B4B4D' };
    if (n >= 7)  return { c: '#F6A623', bg: '#F6A6230A', bc: '#F6A6234D' };
    return { c: '#C8A84B', bg: '#C8A84B0A', bc: '#C8A84B4D' };
  }

  var ICON_BELL_SM = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#909098" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

  /* Smart awaiting-pill palette.
     State 1 (overdue):     red    #EF4444 / #EF444420
     State 2 (awaiting):    gold   #C4A44A / #C4A44A18
     State 3 (all clear):   green  #3ECF8E / #3ECF8E18 */
  function _clientTopBarPill(awaitingPosts) {
    var count = awaitingPosts.length;
    if (count === 0) {
      return {
        text: 'All clear \u2713',
        color: '#3ECF8E',
        bg: '#3ECF8E18'
      };
    }
    var todayStr = new Date().toISOString().slice(0, 10);
    var overdue = awaitingPosts.some(function(p) {
      var td = p.targetDate || p.target_date || '';
      return td && td < todayStr;
    });
    if (overdue) {
      return {
        text: count + ' awaiting',
        color: '#EF4444',
        bg: '#EF444420'
      };
    }
    return {
      text: count + ' awaiting',
      color: '#C4A44A',
      bg: '#C4A44A18'
    };
  }

  function _topBarHtml(buckets) {
    var clientName = _esc(window.AppState.user.name || '');
    var awaiting = (buckets.approval || []).concat(buckets.input || []);
    var pillData = _clientTopBarPill(awaiting);
    var pillStyle = 'font-family:\'IBM Plex Mono\',monospace;font-size:9px;font-weight:700;letter-spacing:0.04em;padding:3px 8px;border-radius:10px;background:' + pillData.bg + ';color:' + pillData.color + ';border:none;white-space:nowrap;line-height:1.4;';
    var pill = '<span style="' + pillStyle + '">' + _esc(pillData.text) + '</span>';

    // Bell red dot only when unread notifications exist.
    var unread = (window.AppState && window.AppState.ui && window.AppState.ui.unreadCount) || 0;
    var bellDotStyle = unread > 0
      ? 'position:absolute;top:2px;right:2px;width:7px;height:7px;border-radius:50%;background:#EF4444;'
      : 'display:none;';

    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;position:sticky;top:0;background:#0D0D12;z-index:100;border-bottom:1px solid #2A2A34;">' +
      '<div style="display:flex;align-items:center;min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:12px;line-height:1.4;">' +
        '<span style="font-family:\'DM Sans\',sans-serif;font-size:14px;font-weight:500;color:#B0B0B8;line-height:1.4;">' + _greeting() + '</span>' +
        (clientName ? '<span style="font-family:\'DM Sans\',sans-serif;font-weight:700;font-size:14px;color:#C4A44A;margin-left:6px;line-height:1.4;">' + clientName + '</span>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">' +
        pill +
        '<button data-action="open-notifications" style="position:relative;background:none;border:none;cursor:pointer;padding:2px;display:inline-flex;align-items:center;">' +
          ICON_BELL_SM +
          '<span data-bell-dot style="' + bellDotStyle + '"></span>' +
        '</button>' +
        '<div style="position:relative;">' +
          '<button data-action="top-menu-toggle" style="background:none;border:none;color:#707078;cursor:pointer;padding:2px 4px;font-size:14px;line-height:1;display:inline-flex;align-items:center;">' + ICON_DOTS + '</button>' +
          '<div data-top-menu style="display:none;position:fixed;background:#0d0d0d;border:1px solid #2A2A34;border-radius:0;min-width:160px;z-index:999999;box-shadow:0 8px 24px #00000099;">' +
            '<button data-action="new-request" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#ccc;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;">New Request</button>' +
            '<button data-action="light-mode" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#555;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;border-top:1px solid #2A2A34;">Light Mode</button>' +
            '<button data-action="sign-out" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#888;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;border-top:1px solid #2A2A34;">Sign Out</button>' +
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
    nav.style.cssText = 'position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:space-around;align-items:center;padding:8px 0 calc(8px + env(safe-area-inset-bottom));background:#0D0D12;border-top:1px solid #2A2A34;z-index:100;max-width:430px;margin:0 auto;';
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

  function _clientComposerRoot(postId) {
    return document.getElementById('client-composer-root-' + postId);
  }

  function _clientMountQuoteBar(postId, author, snippet) {
    var root = _clientComposerRoot(postId);
    if (!root) return;
    var existing = root.querySelector(':scope > .claude-quote-bar');
    if (existing) existing.remove();
    var _authorDisplay = (typeof getDisplayName === 'function') ? getDisplayName(author) : author;
    var _onClick = 'onclick="window._clientClearReply(\'' + postId + '\')"';
    var html = (typeof window._claudeQuoteBarHtml === 'function')
      ? window._claudeQuoteBarHtml(_authorDisplay, snippet || '', _onClick)
      : '';
    if (!html) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var bar = tmp.firstChild;
    root.insertBefore(bar, root.firstChild);
    root.classList.add('has-quote-bar');
  }

  window._clientSetReply = function(commentId, author, postId, snippet) {
    window._clientReplyTo = window._clientReplyTo || {};
    window._clientReplyTo[postId] = {
      id: commentId,
      author: author,
      snippet: snippet || ''
    };
    _clientMountQuoteBar(postId, author, snippet || '');
    var input = document.getElementById('comment-input-' + postId);
    if (input) input.focus();
  };

  window._clientClearReply = function(postId) {
    if (window._clientReplyTo) delete window._clientReplyTo[postId];
    var root = _clientComposerRoot(postId);
    if (root) {
      var existing = root.querySelector(':scope > .claude-quote-bar');
      if (existing) existing.remove();
      root.classList.remove('has-quote-bar');
      if (typeof window._claudeDismissPolishPreview === 'function') {
        window._claudeDismissPolishPreview(root);
      }
    }
  };

  // Wire each composer root after a render — idempotent.
  window._clientWireClaudeComposer = function(postId) {
    var root = _clientComposerRoot(postId);
    if (!root) return;
    if (typeof window._claudeWireComposer === 'function') {
      window._claudeWireComposer(root, {
        postIdFn: function() { return postId; }
      });
    }
  };

  /* ---- toggle collapsible comments section ---- */

  window._clientToggleComments = function(postId) {
    // Prefer the visible overlay host, fall back to the main feed,
    // mirroring the pattern in _clientEditComment / _clientDeleteComment.
    var _host = document.getElementById('client-post-overlay') || document.getElementById('client-view') || document;
    var section = _host.querySelector('#client-comments-section-' + postId)
      || document.getElementById('client-comments-section-' + postId);
    if (!section) return;
    var isHidden = section.style.display === 'none' || section.style.display === '';
    if (isHidden) {
      section.style.display = 'block';
      // Focus + scroll the input into view on expand so the user can type
      // immediately. Defer a frame so layout has settled first.
      requestAnimationFrame(function() {
        var input = document.getElementById('comment-input-' + postId);
        if (input) {
          try { input.focus(); } catch (_) {}
          try { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        }
      });
    } else {
      section.style.display = 'none';
    }
  };

  /* ---- 3-dot bottom sheet menu ---- */

  window._clientShowCommentMenu = function(dotsEl) {
    var existing = document.getElementById('client-comment-menu');
    if (existing) existing.remove();

    var cid = dotsEl.getAttribute('data-comment-id') || '';
    var author = dotsEl.getAttribute('data-author') || '';
    var postId = dotsEl.getAttribute('data-post-id') || '';
    var message = dotsEl.getAttribute('data-message') || '';
    var myName = (window.AppState && window.AppState.user && window.AppState.user.name) || '';
    var isMine = author === myName;

    var ICON_EDIT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    var ICON_COPY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    var ICON_REPLY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>';
    var ICON_DELETE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

    var backdrop = document.createElement('div');
    backdrop.id = 'client-comment-menu';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:9800;background:#00000070;';

    var sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:#1A1A22;border-radius:16px 16px 0 0;border:1px solid #2A2A34;border-bottom:none;';

    var itemStyle = 'display:flex;width:100%;padding:16px 20px;background:none;border:none;text-align:left;font-size:15px;color:#F0F0F2;cursor:pointer;font-family:\'DM Sans\',sans-serif;align-items:center;gap:14px;';
    var deleteStyle = 'display:flex;width:100%;padding:16px 20px;background:none;border:none;text-align:left;font-size:15px;color:#EF4444;cursor:pointer;font-family:\'DM Sans\',sans-serif;align-items:center;gap:14px;';
    var cancelStyle = 'border-top:1px solid #2A2A34;display:block;width:100%;padding:16px 20px;text-align:center;font-size:13px;color:#808088;font-family:\'IBM Plex Mono\',monospace;font-weight:600;letter-spacing:1px;text-transform:uppercase;background:none;border-left:none;border-right:none;border-bottom:none;cursor:pointer;';

    var html = '';
    html += '<div style="height:4px;width:36px;border-radius:2px;background:#404050;margin:10px auto 6px;"></div>';
    html += '<div style="padding:8px 20px 14px;border-bottom:1px solid #2A2A34;">' +
      '<div style="font-size:12px;font-weight:600;color:#A0A0B0;font-family:\'DM Sans\',sans-serif;">' + _esc(author) + '</div>' +
      '<div style="font-size:13px;color:#D0D0D8;font-family:\'DM Sans\',sans-serif;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + _esc(message) + '</div>' +
    '</div>';
    if (isMine) {
      html += '<button type="button" data-menu-action="edit" style="' + itemStyle + '">' + ICON_EDIT + 'Edit</button>';
    }
    html += '<button type="button" data-menu-action="copy" style="' + itemStyle + '">' + ICON_COPY + 'Copy text</button>';
    html += '<button type="button" data-menu-action="reply" style="' + itemStyle + '">' + ICON_REPLY + 'Reply</button>';
    if (isMine) {
      html += '<button type="button" data-menu-action="delete" style="' + deleteStyle + '">' + ICON_DELETE + 'Delete</button>';
    }
    html += '<button type="button" data-menu-action="cancel" style="' + cancelStyle + '">CANCEL</button>';

    sheet.innerHTML = html;
    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);

    function closeMenu() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) closeMenu();
    });

    sheet.addEventListener('click', function(e) {
      var btn = e.target.closest && e.target.closest('button[data-menu-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-menu-action');
      if (action === 'edit') {
        closeMenu();
        window._clientEditComment(cid, message, postId);
      } else if (action === 'copy') {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(message);
          } else {
            var ta = document.createElement('textarea');
            ta.value = message;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch(_) {}
            document.body.removeChild(ta);
          }
          if (window.showToast) window.showToast('Copied', 'success');
        } catch (err) {
          if (window.logError) window.logError(err && err.message, err && err.stack, 'client-copy-comment');
        }
        closeMenu();
      } else if (action === 'reply') {
        closeMenu();
        if (typeof window._clientSetReply === 'function') {
          window._clientSetReply(cid, author, postId, message);
        }
      } else if (action === 'delete') {
        closeMenu();
        window._clientDeleteComment(cid, postId);
      } else if (action === 'cancel') {
        closeMenu();
      }
    });
  };

  /* ---- Inline edit comment ---- */

  window._clientEditComment = function(commentId, currentMessage, postId) {
    var _host = document.getElementById('client-post-overlay') || document.getElementById('client-view');
    var wrap = _host && _host.querySelector('.client-comment-wrap[data-comment-id="' + commentId + '"]');
    if (!wrap) return;
    var msgEl = wrap.querySelector('.client-comment-body');
    if (!msgEl) return;
    // Bail if already editing this comment
    if (wrap.querySelector('.client-comment-edit')) return;

    var originalHtml = msgEl.innerHTML;

    var editContainer = document.createElement('div');
    editContainer.className = 'client-comment-edit';
    editContainer.style.cssText = 'margin-top:3px;';

    var textarea = document.createElement('textarea');
    textarea.value = currentMessage || '';
    textarea.style.cssText = 'background:#111118;border:1px solid #2A2A34;border-radius:8px;width:100%;padding:10px;color:#E0E0E8;font-size:14px;font-family:\'DM Sans\',sans-serif;line-height:1.55;resize:none;outline:none;box-sizing:border-box;min-height:60px;';

    function autoHeight() {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
    textarea.addEventListener('input', autoHeight);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:6px;';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'background:none;border:1px solid #2A2A34;border-radius:6px;padding:6px 14px;color:#808088;font-size:12px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif;';
    cancelBtn.addEventListener('click', function() {
      msgEl.innerHTML = originalHtml;
      msgEl.style.display = '';
      if (editContainer.parentNode) editContainer.parentNode.removeChild(editContainer);
    });

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'background:#C4A44A;border:none;border-radius:6px;padding:6px 14px;color:#000;font-size:12px;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif;';
    saveBtn.addEventListener('click', function() {
      var newText = (textarea.value || '').trim();
      if (!newText) return;
      if (newText === (currentMessage || '').trim()) {
        // No change — revert
        msgEl.innerHTML = originalHtml;
        msgEl.style.display = '';
        if (editContainer.parentNode) editContainer.parentNode.removeChild(editContainer);
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      var nowIso = new Date().toISOString();
      window.apiFetch('/post_comments?id=eq.' + encodeURIComponent(commentId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ message: newText, edited_at: nowIso })
      }).then(function() {
        // Update in-memory AppState so a subsequent re-render is consistent
        try {
          var posts = (window.AppState && window.AppState.posts && window.AppState.posts.all) || [];
          posts.forEach(function(p) {
            var pid = p.post_id || p.id;
            if (pid !== postId || !Array.isArray(p.post_comments)) return;
            p.post_comments = p.post_comments.map(function(cc) {
              if (cc.id === commentId) {
                return Object.assign({}, cc, { message: newText, edited_at: nowIso });
              }
              return cc;
            });
          });
        } catch (_) {}
        // Update DOM in place
        msgEl.innerHTML = _highlightClientMentions(_esc(newText));
        msgEl.style.display = '';
        if (editContainer.parentNode) editContainer.parentNode.removeChild(editContainer);
        var timeRow = wrap.querySelector('.client-comment-time');
        if (timeRow && !timeRow.querySelector('.client-comment-edited-label')) {
          var span = document.createElement('span');
          span.className = 'client-comment-edited-label';
          span.style.cssText = 'font-family:\'IBM Plex Mono\',monospace;font-size:8px;color:#707078;font-style:italic;margin-left:6px;';
          span.textContent = '(edited)';
          timeRow.appendChild(span);
        }
        if (window.showToast) window.showToast('Comment updated', 'success');
      }).catch(function(err) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        if (window.showToast) window.showToast('Failed to save', 'error');
        if (window.logError) window.logError(err && err.message, err && err.stack, 'client-edit-comment');
      });
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    editContainer.appendChild(textarea);
    editContainer.appendChild(btnRow);

    msgEl.style.display = 'none';
    msgEl.parentNode.insertBefore(editContainer, msgEl.nextSibling);

    setTimeout(function() {
      autoHeight();
      textarea.focus();
      try { textarea.setSelectionRange(textarea.value.length, textarea.value.length); } catch (_) {}
    }, 0);
  };

  /* ---- Delete comment (client side) ---- */

  window._clientDeleteComment = function(commentId, postId) {
    var existing = document.getElementById('client-delete-confirm');
    if (existing) existing.remove();

    var backdrop = document.createElement('div');
    backdrop.id = 'client-delete-confirm';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:9850;background:#00000080;display:flex;align-items:center;justify-content:center;padding:20px;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1A1A22;border:1px solid #2A2A34;border-radius:12px;padding:24px;max-width:320px;width:100%;text-align:center;';
    box.innerHTML =
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:16px;color:#F0F0F2;font-weight:600;margin-bottom:20px;">Delete this comment?</div>' +
      '<div style="display:flex;gap:10px;">' +
        '<button type="button" data-confirm-action="cancel" style="flex:1;background:none;border:1px solid #2A2A34;border-radius:8px;padding:10px;color:#B0B0B8;font-size:13px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif;">Cancel</button>' +
        '<button type="button" data-confirm-action="delete" style="flex:1;background:#EF4444;border:none;border-radius:8px;padding:10px;color:#FFF;font-size:13px;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif;">Delete</button>' +
      '</div>';

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    function closeConfirm() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) closeConfirm();
    });

    box.addEventListener('click', function(e) {
      var btn = e.target.closest && e.target.closest('button[data-confirm-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-confirm-action');
      if (action === 'cancel') {
        closeConfirm();
        return;
      }
      if (action !== 'delete') return;
      btn.disabled = true;
      btn.textContent = 'Deleting...';
      window.apiFetch('/post_comments?id=eq.' + encodeURIComponent(commentId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ deleted: true })
      }).then(function() {
        try {
          var posts = (window.AppState && window.AppState.posts && window.AppState.posts.all) || [];
          posts.forEach(function(p) {
            var pid = p.post_id || p.id;
            if (pid !== postId || !Array.isArray(p.post_comments)) return;
            p.post_comments = p.post_comments.map(function(cc) {
              if (cc.id === commentId) return Object.assign({}, cc, { deleted: true });
              return cc;
            });
          });
        } catch (_) {}
        var _host = document.getElementById('client-post-overlay') || document.getElementById('client-view');
        var wrap = _host && _host.querySelector('.client-comment-wrap[data-comment-id="' + commentId + '"]');
        if (wrap && wrap.parentNode) {
          var tombHost = document.createElement('div');
          tombHost.innerHTML = _singleCommentHtml({ deleted: true, id: commentId });
          var tombNode = tombHost.firstChild;
          if (tombNode) wrap.parentNode.replaceChild(tombNode, wrap);
        }
        closeConfirm();
        if (window.showToast) window.showToast('Comment deleted', 'success');
      }).catch(function(err) {
        btn.disabled = false;
        btn.textContent = 'Delete';
        if (window.showToast) window.showToast('Failed to delete', 'error');
        if (window.logError) window.logError(err && err.message, err && err.stack, 'client-delete-comment');
      });
    });
  };

  window._clientFeedPendingImgs = window._clientFeedPendingImgs || {};

  function _clientRenderImgPreview(postId) {
    var strip = document.getElementById('client-img-preview-' + postId);
    if (!strip) return;
    var urls = window._clientFeedPendingImgs[postId] || [];
    if (urls.length === 0) {
      strip.style.display = 'none';
      strip.innerHTML = '';
      return;
    }
    strip.style.display = 'flex';
    strip.innerHTML = urls.map(function(url, idx) {
      return '<div style="position:relative;width:56px;height:56px;flex-shrink:0;">' +
        '<img src="' + _esc(url) + '" style="width:56px;height:56px;object-fit:cover;border-radius:4px;">' +
        '<button onclick="window._clientRemoveImg(\'' + _esc(postId) + '\',' + idx + ')" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:#FF4B4B;border:none;color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">\u2715</button>' +
      '</div>';
    }).join('');
  }

  window._clientRemoveImg = function(postId, idx) {
    var imgs = window._clientFeedPendingImgs[postId] || [];
    window._clientFeedPendingImgs[postId] = imgs.filter(function(_, i) { return i !== idx; });
    _clientRenderImgPreview(postId);
  };

  window._clientFeedHandleImg = async function(postId) {
    var input = document.getElementById('client-feed-img-input-' + postId);
    if (!input || !input.files || !input.files.length) return;
    var files = Array.prototype.slice.call(input.files);
    input.value = '';
    for (var i = 0; i < files.length; i++) {
      try {
        var url = await uploadPostAsset(files[i], postId + '-comment-' + Date.now());
        window._clientFeedPendingImgs[postId] = (window._clientFeedPendingImgs[postId] || []).concat([url]);
        _clientRenderImgPreview(postId);
      } catch(e) {
        showToast('Image upload failed.', 'error');
        window.logError && window.logError(e && e.message, e && e.stack, 'client-img-upload');
      }
    }
    if ((window._clientFeedPendingImgs[postId] || []).length > 0) {
      showToast('Image ready. Add a message and send.', 'success');
    }
  };

  /* Fetch the @mention roster from user_roles once and cache it in
     window._clientMentionRoster. Idempotent — further calls return
     the same promise so concurrent callers share a single fetch. */
  function _fetchClientMentionRoster() {
    if (window._clientMentionRoster) return Promise.resolve(window._clientMentionRoster);
    if (window._clientMentionRosterPromise) return window._clientMentionRosterPromise;
    if (typeof window.apiFetch !== 'function') {
      window._clientMentionRoster = [];
      return Promise.resolve(window._clientMentionRoster);
    }
    // allowLogout:false — the roster fetch runs in background while the
    // client overlay is rendering. A transient 401 must not evict the
    // user. The visibilitychange handler and the 50-min proactive refresh
    // timer are the only paths that should ever trigger logout.
    window._clientMentionRosterPromise = window.withRetry(function() { return window.apiFetch('/user_roles?select=name,email,role', {}, { allowLogout: false }); })
      .then(function(rows) {
        if (Array.isArray(rows)) {
          window._clientMentionRoster = rows.filter(function(r) { return r && (r.name || r.email); });
        } else {
          window._clientMentionRoster = [];
        }
        return window._clientMentionRoster;
      })
      .catch(function(err) {
        window._clientMentionRoster = [];
        window.logError && window.logError(err && err.message, err && err.stack, 'client-mention-roster');
        return window._clientMentionRoster;
      });
    return window._clientMentionRosterPromise;
  }

  function _displayNameForRow(row) {
    if (row.name) return row.name;
    var email = row.email || '';
    var local = email.split('@')[0] || '';
    // e.g. thakur.manisha -> Thakur Manisha
    return local.split(/[._-]/).filter(Boolean).map(function(p) {
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    }).join(' ');
  }

  function _renderMentionDropdown(drop, postId) {
    var roster = window._clientMentionRoster || [];
    var currentName = (window.AppState.user.name || '').toLowerCase();
    var currentEmail = (window.AppState.user.email || '').toLowerCase();
    var items = roster
      .map(function(row) {
        return { name: _displayNameForRow(row), role: row.role || '', email: (row.email || '').toLowerCase() };
      })
      .filter(function(m) {
        if (!m.name) return false;
        if (m.email && currentEmail && m.email === currentEmail) return false;
        if (m.name.toLowerCase() === currentName) return false;
        return true;
      });
    if (!items.length) {
      drop.innerHTML = '<div style="padding:8px 12px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#555;">No team members found</div>';
      return;
    }
    drop.innerHTML = items.map(function(m) {
      return '<div onclick="window._clientInsertMention(\'' + _esc(postId) + '\',\'' + _esc(m.name) + '\')" ' +
        'style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="font-family:\'DM Sans\',sans-serif;font-size:13px;color:#E8E8E8;">@' + _esc(m.name) + '</span>' +
        '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#555;text-transform:uppercase;">' + _esc(m.role) + '</span>' +
      '</div>';
    }).join('');
  }

  window._clientToggleMention = function(postId) {
    var drop = document.getElementById('client-mention-drop-' + postId);
    if (!drop) return;
    if (drop.style.display === 'block') { drop.style.display = 'none'; return; }
    drop.style.display = 'block';
    if (window._clientMentionRoster) {
      _renderMentionDropdown(drop, postId);
    } else {
      drop.innerHTML = '<div style="padding:8px 12px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#555;">Loading team\u2026</div>';
      _fetchClientMentionRoster().then(function() {
        // Drop may have been closed while the fetch was in flight
        if (drop.style.display === 'block') _renderMentionDropdown(drop, postId);
      });
    }
  };

  window._clientInsertMention = function(postId, name) {
    var input = document.getElementById('comment-input-' + postId);
    if (input) {
      var val = input.value;
      var pos = input.selectionStart || val.length;
      var before = val.slice(0, pos);
      var after = val.slice(pos);
      var prefix = (before.length > 0 && before.charAt(before.length - 1) !== ' ') ? ' ' : '';
      input.value = before + prefix + '@' + name + ' ' + after;
      input.focus();
    }
    var drop = document.getElementById('client-mention-drop-' + postId);
    if (drop) drop.style.display = 'none';
  };

  function _handleSubmitComment(postId, root) {
    var input = document.getElementById('comment-input-' + postId);
    if (!input) return;
    var _sendBtn = document.querySelector('button[data-action="submitComment"][data-id="' + postId + '"]');
    if (input.dataset.submitting === 'true' || (_sendBtn && _sendBtn.dataset.submitting === 'true')) return;
    var message = input.value.trim();
    var _urls = window._clientFeedPendingImgs[postId] || [];
    if (!message && _urls.length === 0) return;
    var savedValue = input.value;
    input.value = '';

    var _emailKey = window.AppState.user.email || '';
    var authorName = (typeof getDisplayName === 'function' && _emailKey)
      ? getDisplayName(_emailKey)
      : (window.AppState.user.name || _emailKey || 'Client');
    var _mentioned = _parseMentions(message);
    var post = (window.AppState.posts.all || []).find(function (p) {
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

    var _savedComments = post && Array.isArray(post.post_comments) ? post.post_comments : null;
    if (post && Array.isArray(post.post_comments)) {
      post.post_comments = post.post_comments.concat([commentObj]);
    }

    if (typeof window.apiFetch !== 'function') return;

    var _replyTo = (window._clientReplyTo &&
      window._clientReplyTo[postId])
      ? window._clientReplyTo[postId].id
      : null;
    window._clientClearReply(postId);

    window._clientFeedPendingImgs[postId] = [];
    _clientRenderImgPreview(postId);

    var _commentBody = {
      post_id: realPostId,
      author: authorName,
      author_role: 'Client',
      message: message,
      reply_to: _replyTo || null,
      post_title: postTitle,
      mentioned_users: _mentioned,
      attachments: _urls.length > 0
        ? JSON.stringify({ type: 'images', urls: _urls })
        : null
    };

    input.dataset.submitting = 'true';
    if (_sendBtn) { _sendBtn.dataset.submitting = 'true'; _sendBtn.disabled = true; }
    // Object-level flag so 07-post-load.js:loadPostsForClient can skip
    // overwriting this post's post_comments array while the insert is
    // still in flight (protects the optimistic row from poll clobber).
    if (post) post._commentSaving = true;

    window.apiFetch('/post_comments', {
      method: 'POST',
      body: JSON.stringify(_commentBody)
    }).then(function (_resp) {
      var _createdId = Array.isArray(_resp) && _resp[0] && _resp[0].id
        ? _resp[0].id
        : (_resp && _resp.id) || null;
      if (_createdId) commentObj.id = _createdId;
      if (!_createdId) {
        if (post && Array.isArray(post.post_comments)) {
          post.post_comments = post.post_comments.filter(function(c){ return c !== commentObj; });
        }
        if (listEl && listEl.lastChild) {
          listEl.removeChild(listEl.lastChild);
        }
        if (typeof window.showToast === 'function') {
          window.showToast('Failed to sync comment. Please try again.', 'error');
        }
        return;
      }
      // Notification fan-out removed — notify-comment edge function now
      // writes all comment + mention notification rows and sends emails.
      // JS-side fan-out caused duplicate notifications.
    }).catch(function (err) {
      if (typeof window.showToast === 'function') {
        window.showToast('Failed to send comment', 'error');
      }
      window.logError && window.logError(err && err.message, err && err.stack, 'submit-comment');
      input.value = savedValue;
      if (listEl && listEl.lastChild) {
        listEl.removeChild(listEl.lastChild);
      }
      if (post && _savedComments !== null) {
        post.post_comments = _savedComments;
      }
    }).finally(function() {
      delete input.dataset.submitting;
      if (_sendBtn) { delete _sendBtn.dataset.submitting; _sendBtn.disabled = false; }
      if (post) delete post._commentSaving;
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
          // Toggle the collapsible comments section in place. If it
          // was collapsed, expand + focus the input; if expanded,
          // collapse it.
          if (typeof window._clientToggleComments === 'function') {
            window._clientToggleComments(id);
          }
          break;

        case 'expandComments':
          var clDiv = root.querySelector('[data-comments-list="' + id + '"]');
          if (clDiv) {
            try {
              var allComments = JSON.parse(clDiv.getAttribute('data-full-comments') || '[]');
              var built = _buildThreadedCommentsHtml(allComments, null, id);
              clDiv.innerHTML = built.html;
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
      window.AppState.ui.modalOpen = true;
      document.body.style.overflow = 'hidden';
    }
  }

  function _lbClose() {
    var el = document.getElementById('client-lightbox');
    if (el) el.style.display = 'none';
    _lbImages = [];
    _lbIndex = 0;
    window.AppState.ui.modalOpen = false;
    document.body.style.overflow = '';
    if (typeof _drainDeferredRender === 'function') _drainDeferredRender();
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
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:2000;background:#080808;flex-direction:column;';
    var mono = "'IBM Plex Mono',monospace";
    var sans = "'DM Sans',sans-serif";
    var numStyle = 'font-family:' + mono + ';font-size:9px;color:#C8A84B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1px;';
    var labelStyle = 'font-family:' + sans + ';font-size:15px;font-weight:600;color:#E8E8E8;margin-bottom:5px;';
    var inputStyle = 'width:100%;background:transparent;border:none;border-bottom:1px solid #2a2a2a;color:#E8E8E8;font-family:' + sans + ';font-size:14px;padding:4px 0;outline:none;';
    var chipBtnStyle = 'font-family:' + mono + ';font-size:9px;letter-spacing:0.05em;text-transform:uppercase;color:#666;background:none;border:1px dotted #2a2a2a;padding:5px 10px;cursor:pointer;';
    var optStyle = 'font-family:' + mono + ';font-size:9px;letter-spacing:0.1em;color:#666;text-transform:uppercase;margin-bottom:5px;';
    var fieldBorder = 'padding:8px 16px;border-bottom:1px dotted #222;';
    overlay.innerHTML =
      /* HEADER */
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #1c1c1c;">' +
        '<div><span style="font-family:' + mono + ';font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#C8A84B;">NEW REQUEST</span>' +
        '<span style="font-family:' + mono + ';font-size:10px;letter-spacing:0.08em;color:#555;"> -- WE\'LL HANDLE EVERYTHING</span></div>' +
        '<button data-action="reqClose" style="background:none;border:none;color:#AEAEB2;font-size:16px;cursor:pointer;padding:4px;">&#x2715;</button>' +
      '</div>' +
      /* SCROLLABLE BODY */
      '<div style="flex:1;overflow-y:auto;">' +
        /* FIELD 01 */
        '<div style="' + fieldBorder + '">' +
          '<div style="' + numStyle + '">01</div>' +
          '<div style="' + labelStyle + '">Name this request <span style="color:#FF4B4B;">*</span></div>' +
          '<input id="req-name" type="text" maxlength="30" placeholder="e.g. Somaiya Diaries, Women\'s Day" style="' + inputStyle + '">' +
          '<div style="font-family:' + mono + ';font-size:9px;letter-spacing:0.08em;color:#8E8E93;margin-top:3px;text-transform:uppercase;">MAX 30 CHARACTERS -- BECOMES THE POST TITLE</div>' +
        '</div>' +
        /* FIELD 02 */
        '<div style="' + fieldBorder + '">' +
          '<div style="' + numStyle + '">02</div>' +
          '<div style="' + labelStyle + '">What\'s the brief? <span style="color:#FF4B4B;">*</span></div>' +
          '<textarea id="req-topic" rows="1" placeholder="Topic, story, key message..." style="' + inputStyle + 'resize:none;min-height:28px;overflow:hidden;line-height:1.5;"></textarea>' +
        '</div>' +
        /* FIELD 03 */
        '<div style="' + fieldBorder + '">' +
          '<div style="' + numStyle + '">03</div>' +
          '<div style="' + labelStyle + '">Content type</div>' +
          '<div style="' + optStyle + '">OPTIONAL</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:7px;">' +
            '<button data-action="reqChip" style="' + chipBtnStyle + '">PHOTO</button>' +
            '<button data-action="reqChip" style="' + chipBtnStyle + '">CAROUSEL</button>' +
            '<button data-action="reqChip" style="' + chipBtnStyle + '">VIDEO</button>' +
            '<button data-action="reqChip" style="' + chipBtnStyle + '">TEXT</button>' +
            '<button data-action="reqChip" style="' + chipBtnStyle + '">CREATIVE</button>' +
          '</div>' +
        '</div>' +
        /* FIELD 04 */
        '<div style="' + fieldBorder + '">' +
          '<div style="' + numStyle + '">04</div>' +
          '<div style="' + labelStyle + '">Target date</div>' +
          '<div style="' + optStyle + '">OPTIONAL</div>' +
          '<div style="position:relative;border:1px solid #2a2a2a;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;">' +
            '<span id="req-date-label" style="font-family:' + sans + ';font-size:14px;color:#3a3a3a;">Pick a date</span>' +
            '<span style="color:#555;font-size:12px;">&#9662;</span>' +
            '<input id="req-date" type="date" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;">' +
          '</div>' +
        '</div>' +
        /* FIELD 05 */
        '<div style="' + fieldBorder + '">' +
          '<div style="' + numStyle + '">05</div>' +
          '<div style="' + labelStyle + '">Reference photos</div>' +
          '<div style="' + optStyle + '">OPTIONAL &middot; MAX 5 PHOTOS &middot; MAX 5MB EACH</div>' +
          '<div id="req-photo-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:6px;">' +
            '<div id="req-add-tile" data-action="reqAddPhoto" style="width:68px;height:68px;display:flex;align-items:center;justify-content:center;border:1px dashed #222;cursor:pointer;color:#3a3a3a;font-size:20px;">+</div>' +
          '</div>' +
          '<input id="req-file" type="file" accept="image/*" multiple style="display:none;">' +
          '<div id="req-photo-count" style="font-family:' + mono + ';font-size:9px;letter-spacing:0.1em;color:#8E8E93;margin-top:5px;text-transform:uppercase;">NO PHOTOS ADDED</div>' +
          '<div id="req-progress-wrap" style="display:none;margin-top:8px;">' +
            '<div style="height:3px;background:#1c1c1c;overflow:hidden;">' +
              '<div id="req-progress-fill" style="height:100%;width:0%;background:#C8A84B;transition:width 0.3s;"></div>' +
            '</div>' +
            '<div id="req-progress-text" style="font-family:' + mono + ';font-size:8px;color:#555;margin-top:4px;"></div>' +
          '</div>' +
        '</div>' +
        /* FIELD 06 -- drive link (unwired to DB) */
        '<div style="padding:8px 16px;">' +
          '<div style="' + numStyle + '">06</div>' +
          '<div style="' + labelStyle + '">Or share a drive link</div>' +
          '<div style="' + optStyle + '">OPTIONAL &middot; FOR LARGE FILES OR MANY PHOTOS</div>' +
          '<input id="req-drive-link" type="url" placeholder="Google Drive, Dropbox, WeTransfer..." style="' + inputStyle + '">' +
          '<div style="font-family:' + mono + ';font-size:9px;letter-spacing:0.08em;color:#3ECF8E;margin-top:5px;text-transform:uppercase;">PASTE ANY LINK -- WE\'LL ACCESS IT</div>' +
        '</div>' +
      '</div>' +
      /* STICKY FOOTER */
      '<div style="position:sticky;bottom:0;padding:8px 16px 20px;border-top:1px solid #1c1c1c;background:#080808;display:grid;grid-template-columns:1fr 2.2fr;gap:8px;">' +
        '<button data-action="reqClose" style="font-family:' + mono + ';font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#8E8E93;background:none;border:1px dotted #444;padding:11px;cursor:pointer;">CANCEL</button>' +
        '<button id="req-submit-btn" disabled data-action="reqSubmit" style="font-family:' + mono + ';font-size:10px;letter-spacing:0.1em;font-weight:700;text-transform:uppercase;color:#333;background:none;border:1px dotted #2a2a2a;padding:11px;cursor:not-allowed;">-- SEND REQUEST</button>' +
      '</div>';
    document.body.appendChild(overlay);
    // Wire delegated events on request overlay
    overlay.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var act = btn.getAttribute('data-action');
      if (act === 'reqClose') { if (typeof _closeReqForm === 'function') _closeReqForm(); }
      else if (act === 'reqChip') { if (typeof _reqToggleChip === 'function') _reqToggleChip(btn); }
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
    var reqDrive = document.getElementById('req-drive-link');
    if (reqName) reqName.addEventListener('input', function() { if (typeof _reqValidate === 'function') _reqValidate(); });
    if (reqTopic) {
      reqTopic.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
        if (typeof _reqValidate === 'function') _reqValidate();
      });
    }
    if (reqDate) reqDate.addEventListener('change', function() {
      var l = document.getElementById('req-date-label');
      if (l) { l.textContent = this.value; l.style.color = '#E8E8E8'; }
    });
    if (reqFile) reqFile.addEventListener('change', function() { if (typeof _reqAddPhotos === 'function') _reqAddPhotos(this); });
    if (reqDrive) reqDrive.addEventListener('input', function() { window._reqDriveLink = this.value; });
    // Wire focus/blur for input border highlight
    var allInputs = overlay.querySelectorAll('input[type="text"],input[type="url"],textarea');
    allInputs.forEach(function(inp) {
      inp.addEventListener('focus', function() { this.style.borderBottomColor = '#C8A84B'; });
      inp.addEventListener('blur', function() { this.style.borderBottomColor = '#2a2a2a'; });
    });
  }

  /* ---- iOS keyboard: scroll focused input into view ---- */

  function _wireCommentInputFocus(root) {
    if (!root) return;
    var inputs = root.querySelectorAll('[id^="comment-input-"]');
    for (var i = 0; i < inputs.length; i++) {
      (function(input) {
        input.addEventListener('focus', function() {
          setTimeout(function() {
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        });
        var pid = input.id.replace(/^comment-input-/, '');
        // Wire the Claude composer root so the sparkle, auto-expand,
        // and polish-preview actions all work. Idempotent.
        if (typeof window._clientWireClaudeComposer === 'function') {
          window._clientWireClaudeComposer(pid);
        }
        // Keep the send button dim when there is no text AND no
        // pending images — the composer's default state is dim-on-empty,
        // but pending images should also unlock it.
        input.addEventListener('input', function() {
          var _root = document.getElementById('client-composer-root-' + pid);
          var send = _root && _root.querySelector('.claude-send');
          if (!send) return;
          var hasContent = this.value.trim().length > 0;
          var hasPendingImgs = window._clientFeedPendingImgs &&
            window._clientFeedPendingImgs[pid] &&
            window._clientFeedPendingImgs[pid].length > 0;
          if (hasContent || hasPendingImgs) send.classList.remove('dim');
          else send.classList.add('dim');
        });
      })(inputs[i]);
    }
  }

  /* ---- main render ---- */

  window.renderClientView = function () {
    var cv = document.getElementById('client-view');
    if (!cv) return;

    try {
    _ensurePulseStyle();
    _ensureReqOverlay();

    // Capture which comment sections are currently expanded so we can
    // restore them after innerHTML is rebuilt. Without this, a Realtime
    // refresh (post_comments INSERT/UPDATE) collapses any thread the
    // user had manually opened via the Comment toggle button.
    var _expandedCommentPids = {};
    try {
      var _openSecs = cv.querySelectorAll('[data-comments-section]');
      for (var _i = 0; _i < _openSecs.length; _i++) {
        var _sec = _openSecs[_i];
        if (_sec.style && _sec.style.display === 'block') {
          var _spid = _sec.getAttribute('data-comments-section');
          if (_spid) _expandedCommentPids[_spid] = 1;
        }
      }
    } catch (_capErr) {}

    cv.style.display = 'block';
    cv.style.background = '#0D0D12';

    var fab = document.getElementById('fab');
    if (fab) fab.style.display = 'none';
    var fabBtn = document.getElementById('main-fab-btn');
    if (fabBtn) fabBtn.style.display = 'none';
    _setClientNav();

    var posts = window.AppState.posts.all || [];
    var buckets = _bucket(posts);
    var awaitCount = buckets.approval.length + buckets.input.length;

    var html = _topBarHtml(buckets);

    var hasContent = buckets.approval.length || buckets.input.length || buckets.published.length || (buckets.requests && buckets.requests.length);

    html += '<div style="padding-bottom:72px;max-width:560px;margin:0 auto;">';

    if (!hasContent) {
      html += '<div style="padding:48px 16px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:0.06em;color:#FFFFFF59;">All caught up. Nothing pending.</div>';
    } else {
      if (buckets.requests && buckets.requests.length) {
        html += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#505058;font-weight:600;padding:18px 16px 8px;">YOUR REQUESTS <span style="color:#C8A84B;font-weight:700;">' + buckets.requests.length + '</span></div>';
        for (var r = 0; r < buckets.requests.length; r++) {
          html += _briefCardHtml(buckets.requests[r]);
        }
      }
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

    // Capture which comment sections are currently expanded BEFORE we
    // rebuild innerHTML. The client realtime refresh and any other
    // renderClientView() call would otherwise reset every awaiting_*
    // card back to collapsed state, wiping the user's explicit toggle.
    var _expandedCommentIds = [];
    var _prevSections = cv.querySelectorAll('.client-comments-section');
    for (var _psi = 0; _psi < _prevSections.length; _psi++) {
      if (_prevSections[_psi].style.display === 'block') {
        var _pid = _prevSections[_psi].getAttribute('data-comments-section');
        if (_pid) _expandedCommentIds.push(_pid);
      }
    }

    cv.innerHTML = html;

    // Restore the expanded comment sections captured above. Safe no-op
    // when the post is gone from the new render or the section defaults
    // to expanded already (non-awaiting stages).
    for (var _rsi = 0; _rsi < _expandedCommentIds.length; _rsi++) {
      var _restoreEl = cv.querySelector('[data-comments-section="' + _expandedCommentIds[_rsi] + '"]');
      if (_restoreEl) _restoreEl.style.display = 'block';
    }

    _wireTopNavOnce();
    // cv is a persistent DOM element — only its innerHTML is replaced
    // by re-renders. Listeners attached to cv itself survive every
    // re-render, so we must bind them exactly once. Without this guard,
    // every renderClientView() call stacked another _wireEvents listener,
    // which turned the symmetric _clientToggleComments toggle into a
    // parity sensor (tap fired N times, net zero on even N).
    if (!cv._clientEventsWired) {
      cv._clientEventsWired = true;
      _wireEvents(cv);
      cv.addEventListener('click', function(e) {
        var cell = e.target.closest('[data-action="openLightbox"]');
        if (!cell) return;
        e.stopPropagation();
        try {
          var imgs = JSON.parse(
            cell.getAttribute('data-images') || '[]');
          var idx = parseInt(
            cell.getAttribute('data-index') || '0', 10);
          if (imgs.length) _lbOpen(imgs, idx);
        } catch (_e) {}
      });
      // Eagerly fetch the @mention roster so it's ready by the time
      // the user taps @ or submits a comment containing @name.
      if (typeof _fetchClientMentionRoster === 'function') {
        _fetchClientMentionRoster();
      }
    }
    _wireNavEvents();
    _wireLightboxTouch();
    _wireLightboxKeyboard();

    var lbEl = document.getElementById('client-lightbox');
    if (lbEl && !lbEl.dataset.clickWired) {
      _wireEvents(lbEl);
      lbEl.dataset.clickWired = '1';
    }
    _wireCommentInputFocus(cv);
    } catch(err) {
      console.error('[client] renderClientView crashed', err);
      window.logError && window.logError(err && err.message, err && err.stack, 'render-client-view');
      if (cv) cv.innerHTML = '<div style="color:#FF4B4B;padding:24px;font-family:DM Sans,sans-serif">Something went wrong. Please refresh.</div>';
    }
  };

  /* ---- client post overlay (single card, full-screen) ---- */

  window._openClientPostOverlay = function(postId) {
    var post = (window.AppState.posts.all || []).find(function(p) {
      return p.post_id === postId || p.id === postId;
    });
    if (!post) {
      if (typeof window.showToast === 'function') window.showToast('Post not found', 'error');
      return;
    }

    // Capture expanded comment sections from an existing overlay before
    // we tear it down, so a re-open of the same post (or any re-render
    // while already open) preserves the user's explicit toggle state.
    var existing = document.getElementById('client-post-overlay');
    var _overlayExpandedIds = [];
    if (existing) {
      var _exSecs = existing.querySelectorAll('.client-comments-section');
      for (var _esi = 0; _esi < _exSecs.length; _esi++) {
        if (_exSecs[_esi].style.display === 'block') {
          var _esId = _exSecs[_esi].getAttribute('data-comments-section');
          if (_esId) _overlayExpandedIds.push(_esId);
        }
      }
      existing.remove();
    }

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
      _driveLinkCardHtml(post.drive_link || post.driveLink || '') +
      _statsBarHtml(post, isPublished) +
      (isPublished ? '' : _engagementBarHtml(post)) +
      /* overlay shows comments expanded by default since the user
         explicitly opened the post */
      _commentsContainerHtml(post, true);

    var overlay = document.createElement('div');
    overlay.id = 'client-post-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#0D0D12;overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:\'DM Sans\',sans-serif;';
    overlay.innerHTML =
      '<div style="position:sticky;top:0;z-index:10;background:#0D0D12;padding:0;border-bottom:1px solid #2A2A34;">' +
        '<button id="client-overlay-close" style="background:none;border:none;color:#888;font-size:24px;cursor:pointer;padding:12px 16px;">&#x2715;</button>' +
      '</div>' +
      '<div style="padding-bottom:72px;">' +
        '<div class="post-card" data-card-id="' + pid + '" data-stage="' + _esc(post.stage || '') + '">' +
          cardHtml +
        '</div>' +
      '</div>';

    var _self_overlay = overlay;
    requestAnimationFrame(function() {
      document.body.appendChild(_self_overlay);
      // Restore any expanded comment sections captured from the prior
      // overlay. _commentsContainerHtml(post, true) already defaults the
      // overlay card's section to display:block, so this is a no-op for
      // the common case and only matters if the prior overlay had a
      // different post open or had more than one section rendered.
      for (var _orsi = 0; _orsi < _overlayExpandedIds.length; _orsi++) {
        var _orEl = _self_overlay.querySelector('[data-comments-section="' + _overlayExpandedIds[_orsi] + '"]');
        if (_orEl) _orEl.style.display = 'block';
      }
      window.AppState.ui.modalOpen = true;
      document.body.style.overflow = 'hidden';
      _wireEvents(_self_overlay);
      var approvePopup =
        document.getElementById('client-approve-popup');
      if (approvePopup && !approvePopup.dataset.wired) {
        _wireEvents(approvePopup);
        approvePopup.dataset.wired = '1';
      }
      _wireLightboxTouch();
      _wireLightboxKeyboard();
      var lbEl = document.getElementById('client-lightbox');
      if (lbEl && !lbEl.dataset.clickWired) {
        _wireEvents(lbEl);
        lbEl.dataset.clickWired = '1';
      }
      // Back-to-notifications button (when opened from notif panel)
      if (window._notifOpenedPCS) {
        var nbBtn = document.createElement('button');
        nbBtn.className = 'pcs-back-notif-btn';
        nbBtn.textContent = '\u2190 NOTIFICATIONS';
        nbBtn.onclick = function() {
          window._notifOpenedPCS = false;
          _self_overlay.remove();
          window.AppState.ui.modalOpen = false;
          document.body.style.overflow = '';
          if (typeof _drainDeferredRender === 'function') _drainDeferredRender();
          setTimeout(function() {
            if (typeof window.openNotifications === 'function') window.openNotifications();
          }, 150);
        };
        var clientHeader = _self_overlay.querySelector('[id="client-overlay-close"]');
        if (clientHeader && clientHeader.parentNode) clientHeader.parentNode.prepend(nbBtn);
      }
      var closeBtn =
        document.getElementById('client-overlay-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() {
          window._notifOpenedPCS = false;
          _self_overlay.remove();
          window.AppState.ui.modalOpen = false;
          document.body.style.overflow = '';
          if (typeof _drainDeferredRender === 'function') _drainDeferredRender();
        });
      }
    });
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
  if (topic) { topic.value = ''; topic.style.height = 'auto'; }
  var date = document.getElementById('req-date');
  if (date) date.value = '';
  var dateLabel = document.getElementById('req-date-label');
  if (dateLabel) { dateLabel.textContent = 'Pick a date'; dateLabel.style.color = '#3a3a3a'; }
  // Reset chips
  var chips = document.querySelectorAll('#req-overlay [data-action="reqChip"]');
  chips.forEach(function(c) {
    c.style.color = '#666';
    c.style.background = 'none';
    c.style.borderColor = '#2a2a2a';
    c.style.borderStyle = 'dotted';
  });
  // Reset drive link
  var driveEl = document.getElementById('req-drive-link');
  if (driveEl) driveEl.value = '';
  window._reqDriveLink = '';
  // Reset photo grid
  window._reqStoredFiles = [];
  var grid = document.getElementById('req-photo-grid');
  if (grid) {
    var thumbs = grid.querySelectorAll('[data-file-idx]');
    thumbs.forEach(function(t) { t.remove(); });
  }
  var countEl = document.getElementById('req-photo-count');
  if (countEl) countEl.textContent = 'NO PHOTOS ADDED';
  var fi = document.getElementById('req-file');
  if (fi) fi.value = '';
  var pw = document.getElementById('req-progress-wrap');
  if (pw) pw.style.display = 'none';
  // Reset submit button to disabled state
  var btn = document.getElementById('req-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.style.color = '#333';
    btn.style.background = 'none';
    btn.style.border = '1px dotted #2a2a2a';
    btn.style.cursor = 'not-allowed';
    btn.textContent = '-- SEND REQUEST';
  }
}

window._reqToggleChip = function(el) {
  var isSelected = el.style.color === 'rgb(200, 168, 75)';
  // Single-select: deselect all chips first
  var chips = document.querySelectorAll('#req-overlay [data-action="reqChip"]');
  chips.forEach(function(c) {
    c.style.color = '#666';
    c.style.background = 'none';
    c.style.borderColor = '#2a2a2a';
    c.style.borderStyle = 'dotted';
  });
  // If it was already selected, leave all deselected (toggle off)
  if (!isSelected) {
    el.style.color = '#C8A84B';
    el.style.background = 'none';
    el.style.borderColor = '#C8A84B';
    el.style.borderStyle = 'solid';
  }
}

window._reqSetUrgency = function(el, type) {
  var n = document.getElementById('req-urgency-normal');
  var u = document.getElementById('req-urgency-urgent');
  if (n) { n.style.color='#555'; n.style.background='transparent'; n.style.borderColor='#1a1a1a'; }
  if (u) { u.style.color='#555'; u.style.background='transparent'; u.style.borderColor='#1a1a1a'; }
  if (type === 'urgent' && u) {
    u.style.color='#FF4B4B'; u.style.background='#1a0a0a'; u.style.borderColor='#FF4B4B';
  } else if (n) {
    n.style.color='#3ECF8E'; n.style.background='#0a1a12'; n.style.borderColor='#3ECF8E';
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

  // Enforce max 5 photos total
  var currentCount = window._reqStoredFiles.filter(function(f) { return f !== null; }).length;
  var maxAllowed = 5 - currentCount;
  if (maxAllowed <= 0) {
    if (typeof window._showErrorToast === 'function') window._showErrorToast('Max 5 photos allowed');
    input.value = '';
    return;
  }
  if (files.length > maxAllowed) {
    files = files.slice(0, maxAllowed);
    if (typeof window._showErrorToast === 'function') window._showErrorToast('Max 5 photos allowed');
  }

  // Filter out files > 5MB
  var MAX_FILE_SIZE = 5 * 1024 * 1024;
  var validFiles = [];
  for (var fi = 0; fi < files.length; fi++) {
    if (files[fi].size > MAX_FILE_SIZE) {
      if (typeof window._showErrorToast === 'function') window._showErrorToast('Photo too large — max 5MB each');
    } else {
      validFiles.push(files[fi]);
    }
  }
  files = validFiles;
  if (!files.length) { input.value = ''; return; }

  var total = files.length;
  var loaded = 0;

  // Show progress bar
  if (progressWrap) progressWrap.style.display = 'block';
  if (progressFill) progressFill.style.background = '#C8A84B';

  // Disable send button during upload
  var sendBtn = document.getElementById('req-submit-btn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.style.cursor = 'not-allowed';
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
        'background:#000000;border-radius:50%;display:flex;' +
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
    reader.onerror = function() {
      console.error('[client] FileReader failed');
      window.logError && window.logError('FileReader error', '', 'req-add-photos');
      if (typeof window._showErrorToast === 'function') window._showErrorToast('Failed to load photo — try again');
      loaded++;
      if (loaded === total) _reqValidate();
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
    btn.style.background = 'none';
    btn.style.border = '1px dotted #C8A84B';
    btn.style.cursor = 'pointer';
    btn.textContent = '-- SEND REQUEST';
  } else {
    btn.disabled = true;
    btn.style.color = '#333';
    btn.style.background = 'none';
    btn.style.border = '1px dotted #2a2a2a';
    btn.style.cursor = 'not-allowed';
  }
}
