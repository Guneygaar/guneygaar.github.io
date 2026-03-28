/* render/client.js -- Client portal feed (Pass 2 of 3) */
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
  var ICON_CLOCK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
  var ICON_COMMENT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_THUMBUP = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
  var ICON_WA = '<svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>';
  var ICON_COMMENT_SM = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

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
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 0;font-family:\'IBM Plex Mono\',monospace;font-size:9px;">' +
      left + right + '</div>';
  }

  /* ---- engagement bar ---- */

  function _engagementBarHtml(post) {
    if (post.stage !== 'awaiting_approval' && post.stage !== 'awaiting_brand_input') return '';
    var pid = _esc(post.post_id || post.id || '');
    var title = _esc(post.title || '');
    var btnStyle = 'flex:1;display:flex;align-items:center;justify-content:center;gap:5px;' +
      'background:none;border:none;border-right:1px solid rgba(255,255,255,0.06);' +
      'padding:10px 0;cursor:pointer;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.03em;';
    var lastBtnStyle = btnStyle.replace('border-right:1px solid rgba(255,255,255,0.06);', '');

    var btn1 = '';
    if (post.stage === 'awaiting_approval') {
      btn1 = '<button data-action="clientApprovePrompt" data-id="' + pid + '" data-title="' + title + '" style="' + btnStyle + 'color:#22c55e;">' +
        ICON_THUMBUP + ' Approve</button>';
    } else {
      btn1 = '<div style="flex:1;"></div>';
    }

    var btn2 = '<button data-action="focusComment" data-id="' + pid + '" style="' + btnStyle + 'color:#888;">' +
      ICON_COMMENT + ' Comment</button>';

    var btn3 = '<button data-action="shareWA" data-id="' + pid + '" style="' + lastBtnStyle + 'color:#25D366;">' +
      ICON_WA + ' WhatsApp</button>';

    return '<div data-engagement="' + pid + '" style="display:flex;border-top:1px solid rgba(255,255,255,0.06);margin-top:8px;">' +
      btn1 + btn2 + btn3 + '</div>' +
      '<div id="approved-strip-' + pid + '" style="display:none;padding:10px 14px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#444;border-top:1px solid rgba(255,255,255,0.06);margin-top:8px;">' +
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

  function _cardMenuHtml() {
    return '<div id="client-card-menu" style="display:none;position:fixed;z-index:300;background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:8px;min-width:170px;box-shadow:0 8px 24px rgba(0,0,0,0.5);">' +
      '<button data-action="cardMenuWA" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#ccc;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;">Share on WhatsApp</button>' +
      '<button data-action="cardMenuRequest" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:#ccc;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;border-top:1px solid rgba(255,255,255,0.06);">New Request</button>' +
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
            '<button data-action="openCardMenu" data-id="' + pid + '" style="background:none;border:none;color:#555;cursor:pointer;padding:2px;flex-shrink:0;">' + ICON_DOTS + '</button>' +
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
      /* stats bar */
      _statsBarHtml(post, isPublished) +
      /* engagement bar (not on published) */
      (isPublished ? '' : _engagementBarHtml(post)) +
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

  var _pendingApproveId = '';

  function _closeCardMenu() {
    var m = document.getElementById('client-card-menu');
    if (m) m.style.display = 'none';
    _cardMenuActiveId = '';
  }

  var _cardMenuActiveId = '';

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

        /* -- card 3-dot menu -- */
        case 'openCardMenu':
          e.stopPropagation();
          var cm = document.getElementById('client-card-menu');
          if (!cm) break;
          if (_cardMenuActiveId === id && cm.style.display !== 'none') {
            _closeCardMenu();
            break;
          }
          _cardMenuActiveId = id;
          var rect = btn.getBoundingClientRect();
          cm.style.top = (rect.bottom + 4) + 'px';
          cm.style.left = Math.max(0, rect.right - 170) + 'px';
          cm.style.display = 'block';
          break;

        case 'cardMenuWA':
          _closeCardMenu();
          if (typeof window._clientShareWA === 'function') window._clientShareWA(_cardMenuActiveId || id);
          break;

        case 'cardMenuRequest':
          _closeCardMenu();
          if (typeof window.openClientRequestForm === 'function') window.openClientRequestForm();
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
            var eng = root.querySelector('[data-engagement="' + pid + '"]');
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
          if (typeof window._clientFocusComment === 'function') window._clientFocusComment(id);
          break;

        case 'shareWA':
          if (typeof window._clientShareWA === 'function') window._clientShareWA(id);
          break;

        default:
          break;
      }
    });

    /* close top menu + card menu on outside click */
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-action="top-menu-toggle"]')) {
        var tmenu = root.querySelector('[data-top-menu]');
        if (tmenu) tmenu.style.display = 'none';
      }
      if (!e.target.closest('[data-action="openCardMenu"]') && !e.target.closest('#client-card-menu')) {
        _closeCardMenu();
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
    html += _approvePopupHtml();
    html += _cardMenuHtml();

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
