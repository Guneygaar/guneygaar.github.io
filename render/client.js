/* ===============================================
   render/client.js - Client portal rendering
   Extracted from 07-post-load.js (Phase 1)
=============================================== */
console.log("LOADED:", "render/client.js");

window.renderClientView = function() {
  try { _renderClientViewInner(); } catch(e) { console.error('[PCS] renderClientView crash:', e); }
}
window._renderClientViewInner = function() {
  var fab = document.getElementById('fab') ||
    document.querySelector('.fab');
  if (fab) fab.style.display = 'none';

  var h = new Date().getHours();
  var timeOfDay = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  var greetName = window.currentUserName ||
    (window.currentUser && window.currentUser.name) ||
    (window.currentUserEmail || '').split('@')[0];
  var clientName = greetName.charAt(0).toUpperCase() + greetName.slice(1);

  // CHANGE 2 - Header
  var headerEl = document.getElementById('client-header');
  if (headerEl) {
    headerEl.innerHTML =
      '<div style="display:flex;align-items:center;' +
      'justify-content:space-between;padding:13px 18px;' +
      'border-bottom:1px solid rgba(255,255,255,0.06);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.5);">srtd.io</div>' +
      '<div style="display:flex;align-items:center;gap:4px;">' +
      '<button onclick="openNotifications()" ' +
      'style="background:transparent;border:none;cursor:pointer;' +
      'position:relative;padding:6px;display:flex;' +
      'align-items:center;justify-content:center;">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="rgba(255,255,255,0.6)" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>' +
      '<path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<span id="notif-client-badge" style="display:none;' +
      'position:absolute;top:2px;right:2px;background:#FF4B4B;' +
      'color:#fff;border-radius:50%;width:14px;height:14px;' +
      'font-size:8px;align-items:center;' +
      'justify-content:center;font-family:\'IBM Plex Mono\',monospace;">' +
      '0</span></button>' +
      '<button onclick="toggleUserMenu()" ' +
      'style="background:transparent;border:none;cursor:pointer;' +
      'padding:6px;display:flex;align-items:center;' +
      'justify-content:center;color:rgba(255,255,255,0.6);' +
      'font-size:20px;line-height:1;">' +
      '&#8942;</button>' +
      '</div></div>';
  }

  // CHANGE 3 - Greeting
  var now = new Date();
  var timeStr = now.toLocaleDateString('en-IN', {
    weekday:'short', day:'numeric', month:'short', timeZone:'Asia/Kolkata'
  }) + ' \xB7 ' + now.toLocaleTimeString('en-IN', {
    hour:'numeric', minute:'2-digit', hour12:true, timeZone:'Asia/Kolkata'
  });

  var greetEl = document.getElementById('client-greeting');
  if (greetEl) {
    greetEl.innerHTML =
      '<div style="padding:14px 16px 13px;' +
      'border-bottom:1px solid rgba(255,255,255,0.06);' +
      'display:flex;align-items:baseline;' +
      'justify-content:space-between;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:10px;letter-spacing:0.04em;' +
      'color:rgba(255,255,255,0.55);">Good ' + esc(timeOfDay) + ', ' +
      '<span style="color:#C8A84B;font-weight:500;">' +
      esc(clientName) + '</span></div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:9px;letter-spacing:0.04em;' +
      'color:rgba(255,255,255,0.35);">' + esc(timeStr) + '</div>' +
      '</div>';
  }

  // Input needed section
  var inputPosts = allPosts.filter(function(p) { return p.stage === 'awaiting_brand_input'; });

  // CHANGE 4 - Input eyebrow
  var inputEyebrow = document.getElementById('client-input-eyebrow');
  if (inputEyebrow) {
    inputEyebrow.innerHTML =
      '<div style="background:#0a0a10;' +
      'border-top:1px solid rgba(255,255,255,0.05);' +
      'border-bottom:1px solid rgba(255,255,255,0.05);' +
      'padding:10px 16px;display:flex;align-items:center;' +
      'justify-content:space-between;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span style="color:#F6A623;font-size:13px;">&#x25C8;</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.22em;text-transform:uppercase;' +
      'font-weight:500;color:rgba(255,255,255,0.55);">' +
      'Awaiting Input</span>' +
      '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.1em;' +
      'color:rgba(255,255,255,0.4);' +
      'border:1px dashed rgba(255,255,255,0.12);' +
      'padding:2px 8px;">' + inputPosts.length + '</div>' +
      '</div>';
  }

  // CHANGE 7 - Input request cards
  var inputItems = document.getElementById('client-input-items');
  if (inputItems) {
    if (!inputPosts.length) {
      inputItems.innerHTML = '<div style="padding:10px 16px;' +
        'border-bottom:1px solid rgba(255,255,255,0.04);' +
        'display:flex;align-items:center;gap:8px;">' +
        '<div style="width:5px;height:5px;border-radius:50%;' +
        'background:rgba(62,207,142,0.4);flex-shrink:0;"></div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:8px;letter-spacing:0.12em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.35);">' +
        'All clear -- nothing needs your input</div>' +
        '</div>';
    } else {
      inputItems.innerHTML = inputPosts.map(function(p) {
        var id   = getPostId(p);
        var days = daysInStage(p);
        var staleLabel = days >= 1 ? days + 'd' : 'New';
        var _pillar = (p.content_pillar || p.contentPillar || '--').toUpperCase();
        var _loc = (p.location || '--').toUpperCase();

        var sentLine = (function() {
          if (!p.status_changed_at) return 'Submitted recently';
          var d = new Date((p.status_changed_at || '') + 'Z');
          var date = d.toLocaleDateString('en-IN', { day:'numeric', month:'short', timeZone:'Asia/Kolkata' });
          return 'Changes requested \xB7 ' + date;
        })();

        return '<div style="background:#0d0d16;' +
          'border-bottom:1px solid rgba(255,255,255,0.04);' +
          'position:relative;overflow:hidden;' +
          'box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);">' +

          // Amber top bar
          '<div style="height:3px;' +
          'background:linear-gradient(to right,#F6A623,rgba(246,166,35,0));"></div>' +

          // Header row: title + status
          '<div style="display:flex;align-items:flex-start;' +
          'justify-content:space-between;padding:16px 16px;' +
          'border-bottom:1px dashed rgba(255,255,255,0.07);">' +
          '<div style="flex:3;min-width:0;">' +
          '<div style="font-family:\'DM Sans\',sans-serif;font-size:18px;' +
          'font-weight:600;color:#e8e2d9;line-height:1.2;' +
          'word-wrap:break-word;overflow-wrap:break-word;">' +
          esc(getTitle(p)) + '</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;' +
          'font-size:10px;letter-spacing:0.04em;' +
          'color:rgba(255,255,255,0.55);margin-top:6px;">' +
          esc(sentLine) + '</div>' +
          '</div>' +
          '<div style="flex-shrink:0;display:flex;flex-direction:column;' +
          'align-items:flex-end;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
          'letter-spacing:0.08em;text-transform:uppercase;' +
          'color:rgba(255,255,255,0.45);margin-bottom:4px;">Status</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;' +
          'font-weight:500;color:#F6A623;">' + esc(staleLabel) + '</div>' +
          '</div>' +
          '</div>' +

          // Info grid: Pillar | Location | Target
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;' +
          'border-bottom:1px dashed rgba(255,255,255,0.08);">' +

          '<div style="padding:9px 16px;border-right:1px dashed rgba(255,255,255,0.08);">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
          'letter-spacing:0.08em;text-transform:uppercase;' +
          'color:rgba(255,255,255,0.55);margin-bottom:3px;">Pillar</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
          'letter-spacing:0.04em;color:#e8e2d9;white-space:nowrap;' +
          'overflow:hidden;text-overflow:ellipsis;">' +
          esc(_pillar) + '</div>' +
          '</div>' +

          '<div style="padding:9px 16px;border-right:1px dashed rgba(255,255,255,0.08);">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
          'letter-spacing:0.08em;text-transform:uppercase;' +
          'color:rgba(255,255,255,0.55);margin-bottom:3px;">Location</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
          'letter-spacing:0.04em;color:#e8e2d9;white-space:nowrap;' +
          'overflow:hidden;text-overflow:ellipsis;">' +
          esc(_loc) + '</div>' +
          '</div>' +

          '<div style="padding:9px 16px;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
          'letter-spacing:0.08em;text-transform:uppercase;' +
          'color:rgba(255,255,255,0.55);margin-bottom:3px;">Target</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
          'letter-spacing:0.04em;color:#e8e2d9;white-space:nowrap;' +
          'overflow:hidden;text-overflow:ellipsis;">' +
          (p.target_date ? new Date(p.target_date + 'T00:00:00')
            .toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'}) : '--') +
          '</div>' +
          '</div>' +

          '</div>' +

          // Brief section
          '<div style="padding:12px 16px;' +
          'border-bottom:1px dashed rgba(255,255,255,0.07);">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
          'letter-spacing:0.18em;text-transform:uppercase;color:#F6A623;' +
          'margin-bottom:6px;">What we need</div>' +
          '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;' +
          'color:rgba(255,255,255,0.55);line-height:1.55;">' +
          esc(p.comments || 'No brief added yet.') + '</div>' +
          '</div>' +

          // Action row
          '<div style="display:flex;' +
          'border-bottom:1px solid rgba(255,255,255,0.04);">' +
          '<label style="flex:1;font-family:\'IBM Plex Mono\',monospace;' +
          'font-size:8px;letter-spacing:0.14em;text-transform:uppercase;' +
          'color:#F6A623;background:rgba(246,166,35,0.04);' +
          'border:none;border-right:1px dashed rgba(255,255,255,0.08);' +
          'padding:13px 0;cursor:pointer;' +
          'text-align:center;" id="upload-label-' + esc(id) + '">Upload Here<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple style="display:none" onchange="handleClientUpload(this, \'' + esc(id) + '\')"></label>' +
          (function() {
            var inputMsg = 'Hi, we need something from you for the post: ' +
              (p.title || '') + '.\n\n' +
              (p.comments || '') + '\n\nPlease upload or send it here.';
            var inputWaUrl = 'https://wa.me/?text=' + encodeURIComponent(inputMsg);
            return '<a href="' + inputWaUrl + '" target="_blank" ' +
              'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
              'letter-spacing:0.14em;text-transform:uppercase;' +
              'color:rgba(255,255,255,0.55);' +
              'background:transparent;border:none;' +
              'padding:13px 0;cursor:pointer;text-align:center;' +
              'text-decoration:none;display:block;">Send on WhatsApp</a>';
          })() +
          '</div>' +
          '<div id="upload-confirm-' + esc(id) + '"></div>' +
          '</div>';
      }).join('');
    }
  }

  // Approval section
  var approvalPosts = allPosts.filter(function(p) {
    return p.stage === 'awaiting_approval';
  }).sort(function(a, b) {
    var aTime = a.status_changed_at ? new Date((a.status_changed_at || '') + 'Z').getTime() : 0;
    var bTime = b.status_changed_at ? new Date((b.status_changed_at || '') + 'Z').getTime() : 0;
    return aTime - bTime;
  });

  // CHANGE 4 - Approval eyebrow
  var approvalEyebrow = document.getElementById('client-approval-eyebrow');
  if (approvalEyebrow) {

    if (approvalPosts.length === 0) {
      approvalEyebrow.innerHTML =
        '<div style="background:#0a0a10;' +
        'border-top:2px solid rgba(62,207,142,0.1);' +
        'border-bottom:1px solid rgba(255,255,255,0.05);' +
        'padding:10px 16px;display:flex;align-items:center;' +
        'justify-content:space-between;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span style="color:#3ECF8E;font-size:13px;">&#x25C8;</span>' +
        '<span style="font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:8px;letter-spacing:0.22em;text-transform:uppercase;' +
        'font-weight:500;color:rgba(255,255,255,0.55);">' +
        'Awaiting Your Approval</span>' +
        '</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:8px;letter-spacing:0.1em;' +
        'color:rgba(62,207,142,0.7);' +
        'border:1px dashed rgba(62,207,142,0.2);' +
        'padding:2px 8px;">0</div>' +
        '</div>' +
        '<div style="padding:32px 16px;text-align:center;' +
        'border-bottom:1px solid rgba(255,255,255,0.04);">' +
        '<div style="font-size:20px;color:#3ECF8E;margin-bottom:12px;">&#x25C8;</div>' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-size:18px;' +
        'font-weight:600;color:#e8e2d9;margin-bottom:6px;">All approved.</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;' +
        'letter-spacing:0.06em;color:rgba(255,255,255,0.45);">' +
        'Nothing awaiting your approval.</div>' +
        '</div>';
    } else {

    // compute stats
    var now2 = Date.now();
    var waitTimes = approvalPosts.map(function(p) {
      return p.status_changed_at
        ? Math.floor((now2 - new Date((p.status_changed_at || '') + 'Z').getTime()) / 86400000)
        : 0;
    });
    var oldest = waitTimes.length ? Math.max.apply(null, waitTimes) : 0;
    var overdue = waitTimes.filter(function(d){ return d >= 5; }).length;

    // count color
    var countColor = '#e8e2d9';
    if (approvalPosts.length >= 13) countColor = '#FF4B4B';
    else if (approvalPosts.length >= 8) countColor = '#FF8C00';
    else if (approvalPosts.length >= 4) countColor = '#F6A623';

    approvalEyebrow.innerHTML =

      // Zone header
      '<div style="background:#0a0a10;' +
      'border-top:2px solid rgba(62,207,142,0.1);' +
      'border-bottom:1px solid rgba(255,255,255,0.05);' +
      'padding:10px 16px;display:flex;align-items:center;' +
      'justify-content:space-between;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span style="color:#3ECF8E;font-size:13px;">&#x25C8;</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.22em;text-transform:uppercase;' +
      'font-weight:500;color:rgba(255,255,255,0.55);">' +
      'Awaiting Your Approval</span>' +
      '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.1em;' +
      'color:rgba(62,207,142,0.7);' +
      'border:1px dashed rgba(62,207,142,0.2);' +
      'padding:2px 8px;">' + approvalPosts.length + '</div>' +
      '</div>' +

      // Departure board
      '<div style="background:#08080e;' +
      'border-bottom:1px solid rgba(255,255,255,0.05);' +
      'position:relative;overflow:hidden;">' +

      // Scanlines overlay
      '<div style="position:absolute;inset:0;' +
      'background:repeating-linear-gradient(0deg,transparent,' +
      'transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px);' +
      'pointer-events:none;z-index:1;"></div>' +

      '<div style="padding:16px 16px 0;position:relative;z-index:2;">' +

      // Big count
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:64px;' +
      'font-weight:600;line-height:1;letter-spacing:-0.03em;' +
      'color:' + countColor + ';margin-bottom:6px;">' +
      approvalPosts.length + '</div>' +

      // Subtitle
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:11px;letter-spacing:0.04em;' +
      'color:rgba(255,255,255,0.55);margin-bottom:16px;' +
      'line-height:1.4;">posts are waiting for your OK</div>' +

      '</div>' +

      // Stats grid
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;' +
      'border-top:1px solid rgba(255,255,255,0.06);' +
      'position:relative;z-index:2;">' +

      '<div style="padding:10px 16px;' +
      'border-right:1px solid rgba(255,255,255,0.06);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:4px;">Total</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;' +
      'font-weight:500;letter-spacing:0.04em;color:#e8e2d9;">' +
      approvalPosts.length + '</div>' +
      '</div>' +

      '<div style="padding:10px 16px;' +
      'border-right:1px solid rgba(255,255,255,0.06);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:4px;">Oldest</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;' +
      'font-weight:500;letter-spacing:0.04em;color:#F6A623;">' +
      oldest + ' days</div>' +
      '</div>' +

      '<div style="padding:10px 16px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:4px;">Overdue</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;' +
      'font-weight:500;letter-spacing:0.04em;color:#FF4B4B;">' +
      overdue + '</div>' +
      '</div>' +

      '</div>' + // end stats grid
      '</div>'; // end departure board
    } // end else (has approval posts)
  }

  // CHANGE 5 - Approval post cards
  var approvalItems = document.getElementById('client-approval-items');
  if (approvalItems) {
    if (!approvalPosts.length) {
      approvalItems.innerHTML = '<div style="padding:10px 16px;' +
        'border-bottom:1px solid rgba(255,255,255,0.04);' +
        'display:flex;align-items:center;gap:8px;">' +
        '<div style="width:5px;height:5px;border-radius:50%;' +
        'background:rgba(62,207,142,0.4);flex-shrink:0;"></div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:8px;letter-spacing:0.12em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.35);">' +
        'Nothing to approve</div>' +
        '</div>';
    } else {
      var now = Date.now();
      approvalItems.innerHTML = approvalPosts.map(function(p) {
        var daysWaiting = p.status_changed_at
          ? Math.floor((Date.now() - new Date((p.status_changed_at || '') + 'Z').getTime()) / 86400000)
          : 0;

        var barColor, waitColor, waitLabel;
        if (daysWaiting >= 5) {
          barColor = '#FF4B4B';
          waitColor = '#FF4B4B';
          waitLabel = daysWaiting + 'D';
        } else if (daysWaiting >= 2) {
          barColor = '#F6A623';
          waitColor = '#F6A623';
          waitLabel = daysWaiting + 'D';
        } else if (daysWaiting === 1) {
          barColor = '#F6A623';
          waitColor = '#F6A623';
          waitLabel = 'Yesterday';
        } else {
          barColor = '#3ECF8E';
          waitColor = '#3ECF8E';
          waitLabel = 'New';
        }

        var id = getPostId(p);
        var imgs = Array.isArray(p.images) ? p.images : [];
        var hero = imgs[0] || '';
        var _rawSlug = (p.title || '').toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 50);
        var approvalUrl = 'https://srtd.io/ok/?p=' + _rawSlug;
        var waText = encodeURIComponent(
          (p.title || '') + '\n\n' +
          (p.caption || '') + '\n\n' +
          'Approve: ' + approvalUrl + '\n' +
          'Request changes: https://srtd.io/no/?p=' + _rawSlug
        );
        var waLink = 'https://wa.me/?text=' + waText;

        var seatLabel, seatNum, seatColor, seatBorder;
        if (daysWaiting === 0) {
          seatLabel = '';
          seatNum = 'New';
          seatColor = '#3ECF8E';
          seatBorder = 'rgba(62,207,142,0.45)';
        } else if (daysWaiting >= 5) {
          seatLabel = 'WAITING';
          seatNum = daysWaiting + 'D';
          seatColor = '#FF4B4B';
          seatBorder = 'rgba(255,75,75,0.45)';
        } else {
          seatLabel = 'WAITING';
          seatNum = daysWaiting + 'D';
          seatColor = '#F6A623';
          seatBorder = 'rgba(246,166,35,0.45)';
        }

        var urgencyGrad = daysWaiting >= 5
          ? 'linear-gradient(to right,#FF4B4B,rgba(255,75,75,0))'
          : (daysWaiting >= 2
              ? 'linear-gradient(to right,#F6A623,rgba(246,166,35,0))'
              : 'linear-gradient(to right,#3ECF8E,rgba(62,207,142,0))');

        return (
        '<div id="apv-item-' + esc(id) + '" ' +
        'style="background:#0d0d14;position:relative;overflow:hidden;' +
        'border-bottom:1px solid rgba(255,255,255,0.05);">' +

        '<div style="height:3px;background:' + urgencyGrad + ';"></div>' +

        '<div style="display:flex;align-items:flex-start;justify-content:space-between;' +
        'padding:14px 16px 12px;gap:12px;">' +

        '<div style="min-width:0;">' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-size:22px;' +
        'font-weight:700;color:#e8e2d9;line-height:1.1;' +
        'letter-spacing:-0.01em;margin-bottom:5px;' +
        'word-wrap:break-word;overflow-wrap:break-word;min-width:0;">' +
        esc(p.title || '') + '</div>' +
        '<div style="font-size:10px;letter-spacing:0.04em;' +
        'color:rgba(255,255,255,0.5);line-height:1;">' +
        (function() {
          if (!p.status_changed_at) return '';
          var d = new Date((p.status_changed_at || '') + 'Z');
          var date = d.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'
          });
          var time = d.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit',
            hour12: true, timeZone: 'Asia/Kolkata'
          });
          return date + ' \xB7 ' + time;
        })() +
        '</div>' +
        '</div>' +

        '<div style="flex-shrink:0;text-align:center;' +
        'padding:7px 12px 8px;min-width:64px;' +
        'border:1px dashed ' + seatBorder + ';">' +
        (seatLabel
          ? '<span style="font-size:7px;letter-spacing:0.18em;' +
            'text-transform:uppercase;color:rgba(255,255,255,0.45);' +
            'display:block;margin-bottom:3px;line-height:1;">' +
            seatLabel + '</span>'
          : '') +
        '<span style="font-family:\'DM Sans\',sans-serif;font-size:28px;font-weight:700;' +
        'line-height:1;display:block;color:' + seatColor + ';">' +
        seatNum + '</span>' +
        '</div>' +

        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;' +
        'border-top:1px dashed rgba(255,255,255,0.08);">' +

        '<div style="padding:9px 16px 10px;border-right:1px dashed rgba(255,255,255,0.08);">' +
        '<span style="font-size:7px;letter-spacing:0.16em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.38);display:block;margin-bottom:4px;line-height:1;">Pillar</span>' +
        '<span style="font-size:11px;font-weight:500;letter-spacing:0.02em;' +
        'color:#e8e2d9;display:block;line-height:1.1;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        esc(p.content_pillar||p.contentPillar||'--') + '</span>' +
        '</div>' +

        '<div style="padding:9px 16px 10px;border-right:1px dashed rgba(255,255,255,0.08);">' +
        '<span style="font-size:7px;letter-spacing:0.16em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.38);display:block;margin-bottom:4px;line-height:1;">Location</span>' +
        '<span style="font-size:11px;font-weight:500;letter-spacing:0.02em;' +
        'color:#e8e2d9;display:block;line-height:1.1;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        esc(p.location||'--') + '</span>' +
        '</div>' +

        '<div style="padding:9px 16px 10px;">' +
        '<span style="font-size:7px;letter-spacing:0.16em;text-transform:uppercase;' +
        'color:rgba(255,255,255,0.38);display:block;margin-bottom:4px;line-height:1;">Target</span>' +
        '<span style="font-size:11px;font-weight:500;letter-spacing:0.02em;' +
        'color:#e8e2d9;display:block;line-height:1.1;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
        (p.target_date ? new Date(p.target_date + 'T00:00:00')
          .toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'}) : '--') +
        '</span>' +
        '</div>' +

        '</div>' +

        '<div style="height:14px;background:#080808;margin:0 -1px;display:flex;align-items:center;">' +
        '<div style="width:14px;height:14px;border-radius:0 50% 50% 0;' +
        'background:#0d0d14;border:1px solid rgba(255,255,255,0.07);' +
        'border-left:none;flex-shrink:0;"></div>' +
        '<div style="flex:1;border-top:1px dashed rgba(255,255,255,0.12);"></div>' +
        '<div style="width:14px;height:14px;border-radius:50% 0 0 50%;' +
        'background:#0d0d14;border:1px solid rgba(255,255,255,0.07);' +
        'border-right:none;flex-shrink:0;"></div>' +
        '</div>' +

        (hero
          ? '<div onclick="_openClientEditorial(\'' + esc(p.post_id) + '\')" ' +
            'style="cursor:pointer;">' +
            '<img src="' + hero + '" loading="eager" decoding="async" ' +
            'style="aspect-ratio:1/1;width:100%;object-fit:cover;display:block;"></div>'
          : (p.caption
              ? '<div onclick="_openClientEditorial(\'' + esc(p.post_id) + '\')" ' +
                'style="padding:12px 16px;cursor:pointer;">' +
                '<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;' +
                'color:rgba(255,255,255,0.55);line-height:1.6;max-height:52px;overflow:hidden;' +
                '-webkit-mask-image:linear-gradient(to bottom,black 20px,transparent 50px);">' +
                esc(p.caption) + '</div>' +
                '<div style="text-align:right;font-family:\'IBM Plex Mono\',monospace;' +
                'font-size:7px;letter-spacing:0.12em;text-transform:uppercase;' +
                'color:#F6A623;padding-top:6px;">See More &#x2192;</div>' +
                '</div>'
              : ''
            )
        ) +

        '<div style="display:flex;border-top:1px dashed rgba(255,255,255,0.08);position:relative;">' +

        '<button onclick="clientApprove(\'' + esc(id) + '\',this)" ' +
        'style="flex:5;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
        'letter-spacing:0.14em;text-transform:uppercase;color:#3ECF8E;' +
        'background:transparent;border:none;' +
        'border-right:1px solid rgba(255,255,255,0.22);' +
        'padding:14px 0;display:flex;align-items:center;justify-content:center;gap:6px;' +
        'box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);cursor:pointer;">&#x25C8; Approve</button>' +

        '<button onclick="showBoardingComment(\'' + esc(id) + '\')" ' +
        'style="flex:3;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.55);background:transparent;border:none;border-right:1px solid rgba(255,255,255,0.22);padding:14px 0;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);cursor:pointer;">&#x1F4AC; Comment</button>' +

        '<a href="' + esc(waLink) + '" target="_blank" ' +
        'style="flex:2;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(37,211,102,0.04);border:none;' +
        'color:#25D366;cursor:pointer;text-decoration:none;padding:14px 0;' +
        'font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.14em;' +
        'text-transform:uppercase;gap:6px;' +
        'box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">' +
        '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>' +
        '</svg>' +
        '</a>' +

        '</div>' +

        '<div id="boarding-comment-wrap-' + esc(id) + '" ' +
        'style="display:none;padding:12px 16px;">' +
        '<textarea id="boarding-comment-input-' + esc(id) + '" ' +
        'placeholder="Leave a comment or ask a question..." ' +
        'style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);color:#e8e2d9;font-family:\'DM Sans\',sans-serif;font-size:13px;line-height:1.5;padding:10px 12px;outline:none;resize:none;min-height:80px;caret-color:#C8A84B;"></textarea>' +
        '<button onclick="submitBoardingComment(\'' + esc(id) + '\')" ' +
        'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:#C8A84B;background:transparent;border:1px solid rgba(200,168,75,0.3);padding:9px 0;cursor:pointer;margin-top:8px;">Send Comment &#x2192;</button>' +
        '</div>' +

        '<div class="approval-confirmed" ' +
        'id="approved-confirm-' + esc(id) + '">' +
        'Approved - the team has been notified.</div>' +

        (function(){
          var _isDesktop = window.innerWidth > 768 && !('ontouchstart' in window);
          if (!_isDesktop) return '';
          return '<div style="padding:0 16px 14px;">' +
          '<button onclick="(function(){' +
          'var msg=\'' + (p.title||'').replace(/'/g,"\\'") + '\\n\\n' +
          (p.caption||'').replace(/'/g,"\\'").slice(0,300).replace(/\n/g,'\\n') +
          '\\n\\nApprove: https://srtd.io/ok/?p=' +
          (p.title||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,50) +
          '\\nChanges: https://srtd.io/no/?p=' +
          (p.title||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,50) + '\';' +
          'navigator.clipboard.writeText(msg).then(function(){' +
          'var b=this;b.textContent=\'Copied\';' +
          'setTimeout(function(){b.textContent=\'Copy to Share\';},2000);' +
          '}.bind(this));' +
          '})()" ' +
          'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
          'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);' +
          'background:transparent;border:1px solid rgba(255,255,255,0.1);' +
          'padding:10px 0;cursor:pointer;">' +
          'Copy to Share</button>' +
          '</div>';
        })() +

        '</div>'
        );
      }).join('');
    }
  }

  // CHANGE 8 - New Request section
  var reqEyebrow = document.getElementById('client-request-eyebrow');
  if (reqEyebrow) reqEyebrow.style.display = 'none';

  var reqForm = document.getElementById('client-request-form');
  if (reqForm && !reqForm.dataset.init) {
    var existingOverlay = document.getElementById('req-overlay');
    if (existingOverlay) existingOverlay.remove();
    reqForm.dataset.init = '1';
    var html =
      '<div id="req-overlay" ' +
      'style="position:fixed;inset:0;z-index:2000;background:#080808;' +
      'display:none;flex-direction:column;">' +

      // TOPBAR
      '<div style="display:flex;align-items:baseline;' +
      'justify-content:space-between;padding:16px 18px;' +
      'border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">' +
      '<div style="display:flex;align-items:baseline;gap:8px;">' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
      'letter-spacing:0.22em;text-transform:uppercase;color:#C8A84B;">' +
      'New Request</span>' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.45);">' +
      '-- We\'ll handle everything</span>' +
      '</div>' +
      '<button onclick="_closeReqForm()" ' +
      'style="font-size:15px;color:rgba(255,255,255,0.55);background:transparent;' +
      'border:none;cursor:pointer;padding:4px;">&#x2715;</button>' +
      '</div>' +

      // SCROLLABLE BODY
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;">' +

      // 01 -- Name (mandatory, 30 char max)
      '<div style="padding:16px 18px;' +
      'border-bottom:1px dashed rgba(255,255,255,0.1);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;color:#C8A84B;margin-bottom:4px;">01</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
      'font-weight:600;color:#e8e2d9;margin-bottom:12px;line-height:1.3;">' +
      'Name this request ' +
      '<span style="color:#FF4B4B;font-size:12px;">*</span></div>' +
      '<input type="text" id="req-name" maxlength="30" ' +
      'placeholder="e.g. Somaiya Diaries, Women\'s Day" ' +
      'oninput="_reqValidate()" ' +
      'style="width:100%;background:transparent;border:none;' +
      'border-bottom:1px solid rgba(200,168,75,0.25);color:#e8e2d9;' +
      'font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'padding:6px 0 8px;outline:none;caret-color:#C8A84B;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:6px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-top:5px;">' +
      'Max 30 characters -- becomes the post title</div>' +
      '</div>' +

      // 02 -- Brief (mandatory)
      '<div style="padding:16px 18px;' +
      'border-bottom:1px dashed rgba(255,255,255,0.1);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;color:#C8A84B;margin-bottom:4px;">02</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
      'font-weight:600;color:#e8e2d9;margin-bottom:12px;line-height:1.3;">' +
      'What\'s the brief? ' +
      '<span style="color:#FF4B4B;font-size:12px;">*</span></div>' +
      '<textarea id="req-topic" rows="2" ' +
      'placeholder="Write the brief here -- topic, story, key message..." ' +
      'oninput="this.style.height=\'auto\';' +
      'this.style.height=this.scrollHeight+\'px\';_reqValidate();" ' +
      'style="width:100%;background:transparent;border:none;' +
      'border-bottom:1px solid rgba(200,168,75,0.25);color:#e8e2d9;' +
      'font-family:\'DM Sans\',sans-serif;font-size:14px;padding:6px 0 8px;' +
      'outline:none;resize:none;line-height:1.7;min-height:44px;' +
      'caret-color:#C8A84B;overflow:hidden;"></textarea>' +
      '</div>' +

      // 03 -- Content type (optional)
      '<div style="padding:16px 18px;' +
      'border-bottom:1px dashed rgba(255,255,255,0.1);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;color:#C8A84B;margin-bottom:4px;">03</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
      'font-weight:600;color:#e8e2d9;margin-bottom:4px;line-height:1.3;">' +
      'Content type</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.12em;' +
      'text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:12px;">Optional</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
      ['Photo','Carousel','Video','Text','Creative'].map(function(t) {
        return '<button onclick="_reqToggleChip(this)" ' +
        'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
        'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);' +
        'border:1px solid rgba(255,255,255,0.18);padding:6px 11px;' +
        'cursor:pointer;background:transparent;">' + t + '</button>';
      }).join('') +
      '</div></div>' +

      // 04 -- Target date (optional)
      '<div style="padding:16px 18px;' +
      'border-bottom:1px dashed rgba(255,255,255,0.1);">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;color:#C8A84B;margin-bottom:4px;">04</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
      'font-weight:600;color:#e8e2d9;margin-bottom:4px;line-height:1.3;">' +
      'Target date</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.12em;' +
      'text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:12px;">Optional</div>' +
      '<div style="position:relative;display:flex;' +
      'align-items:center;justify-content:space-between;' +
      'border:1px solid rgba(255,255,255,0.18);' +
      'padding:11px 14px;cursor:pointer;margin-top:4px;' +
      'background:rgba(255,255,255,0.02);">' +
      '<span id="req-date-label" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:11px;letter-spacing:0.04em;' +
      'color:rgba(255,255,255,0.45);">Pick a date</span>' +
      '<span style="font-size:10px;color:rgba(255,255,255,0.4);">&#x25BE;</span>' +
      '<input type="date" id="req-date" ' +
      'onchange="(function(v){' +
      'var d=new Date(v+\'T00:00:00\');' +
      'var el=document.getElementById(\'req-date-label\');' +
      'el.textContent=d.toLocaleDateString(\'en-IN\',' +
      '{day:\'numeric\',month:\'short\',year:\'numeric\',timeZone:\'Asia/Kolkata\'});' +
      'el.style.color=\'#e8e2d9\';' +
      '})(this.value)" ' +
      'style="position:absolute;inset:0;opacity:0;' +
      'width:100%;height:100%;cursor:pointer;' +
      'color-scheme:dark;border:none;' +
      'background:transparent;padding:0;outline:none;">' +
      '</div>' +
      '</div>' +

      // 05 -- Reference photos (optional) -- grid + progress bar
      '<div style="padding:16px 18px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;color:#C8A84B;margin-bottom:4px;">05</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
      'font-weight:600;color:#e8e2d9;margin-bottom:4px;line-height:1.3;">' +
      'Reference photos</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;' +
      'font-size:8px;letter-spacing:0.12em;' +
      'text-transform:uppercase;' +
      'color:rgba(255,255,255,0.45);margin-bottom:12px;">Optional</div>' +

      // Progress bar -- hidden by default
      '<div id="req-progress-wrap" style="display:none;margin-bottom:10px;">' +
      '<div style="height:2px;background:rgba(255,255,255,0.06);margin-bottom:4px;">' +
      '<div id="req-progress-fill" ' +
      'style="height:2px;background:#C8A84B;width:0%;transition:width 0.3s;"></div>' +
      '</div>' +
      '<div id="req-progress-text" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:6px;' +
      'letter-spacing:0.12em;text-transform:uppercase;color:#C8A84B;">' +
      'Preparing...</div>' +
      '</div>' +

      // Photo grid
      '<div id="req-photo-grid" ' +
      'style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">' +
      '<div id="req-add-tile" ' +
      'onclick="document.getElementById(\'req-file\').click()" ' +
      'style="aspect-ratio:1/1;background:rgba(200,168,75,0.04);' +
      'border:1px dashed rgba(200,168,75,0.2);display:flex;' +
      'flex-direction:column;align-items:center;justify-content:center;' +
      'cursor:pointer;gap:4px;">' +
      '<div style="font-size:20px;color:rgba(200,168,75,0.4);line-height:1;">+</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:6px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Add photos</div>' +
      '</div></div>' +
      '<div id="req-photo-count" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-top:6px;">' +
      'No photos added</div>' +
      '<input type="file" id="req-file" accept="image/*" multiple ' +
      'style="display:none;" onchange="_reqAddPhotos(this)">' +
      '</div>' +

      // Keep hidden urgency buttons so submitClientRequest() doesnt break
      '<div style="display:none;">' +
      '<button id="req-urgency-normal"></button>' +
      '<button id="req-urgency-urgent"></button>' +
      '</div>' +

      '</div>' + // end scrollable body

      // FOOTER
      '<div style="flex-shrink:0;padding:12px 18px 20px;' +
      'border-top:1px solid rgba(200,168,75,0.1);background:#080808;' +
      'display:flex;gap:10px;">' +
      '<button onclick="_closeReqForm()" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.5);' +
      'background:transparent;border:1px solid rgba(255,255,255,0.18);' +
      'padding:13px 16px;cursor:pointer;flex-shrink:0;">Cancel</button>' +
      '<button id="req-submit-btn" onclick="submitClientRequest()" disabled ' +
      'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
      'letter-spacing:0.2em;text-transform:uppercase;color:#444;' +
      'background:transparent;border:1px solid rgba(255,255,255,0.1);' +
      'padding:13px 0;cursor:not-allowed;transition:all 0.2s;" ' +
      '>&#x2192; Send Request</button>' +
      '</div>' +

      '</div>';
    var existing = document.getElementById('req-overlay');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.innerHTML = html;
    var overlay = div.firstElementChild;
    document.body.appendChild(overlay);
  }

  renderClientApproved();

}

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

window.renderClientApproved = function() {
  // Hide published section on Client home - still visible in Library
  var pubSection = document.getElementById('client-published-section');
  if (pubSection && effectiveRole === 'Client') { pubSection.style.display = 'none'; return; }
  if (pubSection) pubSection.style.display = '';
  var published = allPosts.filter(function(p) { return p.stage === 'published'; });

  // Eyebrow
  var pubEyebrow = document.getElementById('client-published-eyebrow');
  if (pubEyebrow) {
    pubEyebrow.innerHTML =
      '<div style="display:flex;align-items:center;' +
      'justify-content:space-between;padding:8px 18px;' +
      'font-family:var(--mono);font-size:7px;' +
      'letter-spacing:0.22em;text-transform:uppercase;' +
      'color:#555;border-bottom:1px solid rgba(255,255,255,0.07);">' +
      '<span>Published</span>' +
      '<span style="font-size:8px;color:var(--c-amber);' +
      'border:1px solid rgba(246,166,35,0.25);' +
      'padding:1px 6px;">' + published.length + '</span></div>';
  }

  var wrap = document.getElementById('client-approved-tbody-wrap');
  if (!wrap) return;
  if (!published.length) {
    wrap.innerHTML = '<div style="padding:18px;font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.1em;text-transform:uppercase;">No published posts yet</div>';
    return;
  }
  wrap.innerHTML = '<table class="cp-pub-table"><thead><tr><th>Post</th><th>Published</th><th>View</th></tr></thead><tbody>' +
    published.map(function(p) {
      var link = getPostLink(p);
      return '<tr><td>' + esc(getTitle(p)) + '</td><td class="mono">' + displayDate(p.targetDate) + '</td><td>' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">View</a>' : '-') + '</td></tr>';
    }).join('') + '</tbody></table>';
}

window._openClientEditorial = function(postId) {
  var post = (typeof getPostById === 'function') ? getPostById(postId) : null;
  if (!post) return;

  var existing = document.getElementById('client-editorial-overlay');
  if (existing) existing.remove();

  var imgs = Array.isArray(post.images) ? post.images : [];
  var hero = imgs[0] || '';
  var img2 = imgs[1] || '';
  var pillar = (post.content_pillar || post.contentPillar || '').toUpperCase();
  var location = (post.location || '').toUpperCase();
  var caption = post.caption || '';
  var title = post.title || '';

  var overlay = document.createElement('div');
  overlay.id = 'client-editorial-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;' +
    'background:#0a0a0a;overflow-y:auto;' +
    '-webkit-overflow-scrolling:touch;';

  overlay.innerHTML =
    // Topbar
    '<div style="position:sticky;top:0;z-index:10;' +
    'background:rgba(10,10,10,0.92);backdrop-filter:blur(8px);' +
    'display:flex;align-items:center;justify-content:space-between;' +
    'padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
    '<button onclick="_closeClientEditorial()" ' +
    'style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.12em;text-transform:uppercase;color:#e8e2d9;' +
    'background:transparent;border:none;cursor:pointer;">&#x2190; Back</button>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
    'letter-spacing:0.14em;text-transform:uppercase;color:#333;">' +
    'Awaiting Approval</div>' +
    '<div style="width:60px;"></div>' +
    '</div>' +

    // Hero image
    (hero ?
      '<img src="' + hero + '" style="width:100%;max-height:280px;' +
      'object-fit:cover;display:block;cursor:pointer;" loading="eager" ' +
      'onclick="_edOpenLightbox(\'' + postId + '\',0)">'
      : '') +

    // Body
    '<div style="padding:28px 22px 0;max-width:390px;margin:0 auto;">' +

    // Pillar label
    (pillar ?
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.22em;text-transform:uppercase;color:#C8A84B;' +
      'margin-bottom:10px;">' + pillar + '</div>'
      : '') +

    // Title
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:26px;' +
    'font-weight:700;color:#f0ece4;line-height:1.2;margin-bottom:20px;' +
    'letter-spacing:-0.01em;">' + title + '</div>' +

    // Gold divider
    '<div style="width:32px;height:1px;background:#C8A84B;' +
    'margin-bottom:22px;"></div>' +

    // Caption
    '<div id="ed-caption-' + postId + '" style="font-family:\'DM Sans\',sans-serif;font-size:15px;' +
    'color:#888;line-height:1.8;white-space:pre-wrap;' +
    'word-wrap:break-word;margin-bottom:28px;">' + caption + '</div>' +

    '</div>' +

    // Image gallery strip with dots
    (function(){
      var stripId = 'ed-strip-' + postId;
      var dotsId = 'ed-dots-' + postId;
      return (imgs.length > 1 ?
      '<div style="padding:0 0 20px;">' +

      '<div style="display:flex;align-items:center;' +
      'justify-content:space-between;padding:0 22px 8px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#555;">All Photos</div>' +
      '<div onclick="_edOpenLightbox(\'' + postId + '\',0)" ' +
      'style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#F6A623;cursor:pointer;">' +
      imgs.length + ' photos &#x2192;</div>' +
      '</div>' +

      '<div id="' + stripId + '" ' +
      'style="display:flex;gap:2px;overflow-x:auto;' +
      'scrollbar-width:none;-webkit-overflow-scrolling:touch;' +
      'padding-left:22px;" ' +
      'onscroll="_edUpdateDots(\'' + stripId + '\',\'' + dotsId + '\',' + imgs.length + ')">' +
      imgs.map(function(url, i) {
        return '<img src="' + url + '" loading="eager" decoding="async" ' +
        'onclick="_edOpenLightbox(\'' + postId + '\',' + i + ')" ' +
        'style="flex-shrink:0;width:100px;height:100px;object-fit:cover;' +
        'display:block;cursor:pointer;">';
      }).join('') +
      '<div style="flex-shrink:0;width:22px;"></div>' +
      '</div>' +

      '<div id="' + dotsId + '" ' +
      'style="display:flex;justify-content:center;gap:5px;padding:10px 0 0;">' +
      imgs.map(function(u, i) {
        return '<div style="width:5px;height:5px;border-radius:50%;background:' +
        (i === 0 ? '#e8e2d9' : '#2a2a2a') + ';transition:background 0.2s;"></div>';
      }).join('') +
      '</div></div>'
      : '');
    })() +

    // Footer
    '<div style="padding:0 22px 44px;max-width:390px;margin:0 auto;">' +

    // Meta pills -- pillar + location only, NOT client
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;">' +
    (pillar ?
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:#777;' +
      'border:1px solid rgba(255,255,255,0.15);padding:4px 8px;">' +
      pillar + '</div>'
      : '') +
    (location ?
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.1em;text-transform:uppercase;color:#777;' +
      'border:1px solid rgba(255,255,255,0.15);padding:4px 8px;">' +
      location + '</div>'
      : '') +
    '</div>' +

    // WhatsApp share
    (function(){
      var _isDesktop = window.innerWidth > 768 && !('ontouchstart' in window);
      var rawSlug = (post.title||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,50);
      return '<div style="display:' + (_isDesktop ? 'flex' : 'block') + ';gap:8px;margin-bottom:10px;">' +
      '<button onclick="(function(){' +
      'var msg=\'' + (post.title||'').replace(/'/g,"\\'") + '\\n\\n\'+' +
      '(document.getElementById(\'ed-caption-\'+\'' + postId + '\') ? ' +
      'document.getElementById(\'ed-caption-\'+\'' + postId + '\').textContent : ' +
      '\'' + (post.caption||'').replace(/'/g,"\\'").slice(0,200) + '\') +' +
      '\'\\n\\nPlease review and let me know.\'+' +
      '\'\\n\\nApprove: https://srtd.io/ok/?p=' + rawSlug + '\'+' +
      '\'\\nChanges: https://srtd.io/no/?p=' + rawSlug + '\';' +
      'window.open(\'https://wa.me/?text=\'+encodeURIComponent(msg),\'_blank\');' +
      '})()" ' +
      'style="flex:1;width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.14em;text-transform:uppercase;color:#e8e2d9;' +
      'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);' +
      'padding:14px 0;cursor:pointer;display:block;">' +
      '&#x2197; Share on WhatsApp</button>' +
      (_isDesktop ?
        '<button onclick="(function(){' +
        'var msg=\'' + (post.title||'').replace(/'/g,"\\'") + '\\n\\n\'+' +
        '(document.getElementById(\'ed-caption-' + postId + '\') ? ' +
        'document.getElementById(\'ed-caption-' + postId + '\').textContent : ' +
        '\'' + (post.caption||'').replace(/'/g,"\\'").slice(0,200) + '\') +' +
        '\'\\n\\nApprove: https://srtd.io/ok/?p=' + rawSlug + '\'+' +
        '\'\\nChanges: https://srtd.io/no/?p=' + rawSlug + '\';' +
        'navigator.clipboard.writeText(msg).then(function(){' +
        'var b=document.getElementById(\'ed-copy-' + postId + '\');' +
        'if(b){b.textContent=\'Copied\';' +
        'setTimeout(function(){b.textContent=\'&#x2318; Copy to Share\';},2000);}' +
        '});' +
        '})()" id="ed-copy-' + postId + '" ' +
        'style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
        'letter-spacing:0.14em;text-transform:uppercase;color:#888;' +
        'background:transparent;border:1px solid rgba(255,255,255,0.12);' +
        'padding:14px 0;cursor:pointer;">' +
        '\u2398 Copy to Share</button>'
        : '') +
      '</div>';
    })() +

    // Approve button
    '<button onclick="_editorialApprove(\'' + postId + '\')" ' +
    'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.2em;text-transform:uppercase;color:#3ECF8E;' +
    'background:rgba(62,207,142,0.08);border:1px solid rgba(62,207,142,0.35);' +
    'padding:16px 0;cursor:pointer;display:block;margin-bottom:10px;">' +
    '&#x2713; Approve Post</button>' +

    // Comment button
    '<button onclick="_editorialChanges(\'' + postId + '\')" ' +
    'style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.7);' +
    'background:transparent;border:1px solid rgba(255,255,255,0.07);' +
    'padding:14px 0;cursor:pointer;display:block;">' +
    '&#x1F4AC; Comment</button>' +

    '</div>';

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

window._closeClientEditorial = function() {
  var overlay = document.getElementById('client-editorial-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
}

window._editorialApprove = function(postId) {
  var overlay = document.getElementById('client-editorial-overlay');
  if (overlay) {
    overlay.innerHTML =
      '<div style="position:fixed;inset:0;background:#0a0a0f;' +
      'display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:14px;z-index:6000;">' +
      '<div style="font-size:32px;color:#3ECF8E;line-height:1;">&#x2713;</div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:22px;' +
      'font-weight:600;color:#e8e2d9;letter-spacing:-0.01em;">Approved.</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.5);">' +
      'Team has been notified.</div>' +
      '</div>';
  }
  setTimeout(function() {
    _closeClientEditorial();
    if (typeof clientApprove === 'function') clientApprove(postId);
  }, 1500);
}

window._editorialChanges = function(postId) {
  var overlay = document.getElementById('client-editorial-overlay');
  if (!overlay) return;

  overlay.innerHTML =
    '<div style="position:fixed;inset:0;background:#0a0a0f;display:flex;flex-direction:column;z-index:9500;">' +

    '<div style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">' +
    '<button onclick="_closeClientEditorial()" style="background:transparent;border:none;color:rgba(255,255,255,0.6);font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;padding:4px 0;">&#x2190; Back</button>' +
    '</div>' +

    '<div style="flex:1;padding:24px 16px;display:flex;flex-direction:column;gap:16px;">' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:18px;font-weight:600;color:#e8e2d9;">Leave a comment</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Ask a question or share feedback</div>' +
    '<textarea id="editorial-comment-input-' + esc(postId) + '" placeholder="Type your comment here..." style="flex:1;min-height:160px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8e2d9;font-family:\'DM Sans\',sans-serif;font-size:15px;line-height:1.6;padding:14px;outline:none;resize:none;caret-color:#C8A84B;"></textarea>' +
    '</div>' +

    '<div style="padding:12px 16px 32px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;">' +
    '<button onclick="_submitEditorialComment(\'' + esc(postId) + '\')" style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:#C8A84B;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.3);padding:16px 0;cursor:pointer;">Send Comment &#x2192;</button>' +
    '</div>' +

    '</div>';

  setTimeout(function() {
    var ta = document.getElementById('editorial-comment-input-' + postId);
    if (ta) ta.focus();
  }, 100);
}

window._submitEditorialComment = function(postId) {
  var ta = document.getElementById('editorial-comment-input-' + postId);
  if (!ta) return;
  var message = (ta.value || '').trim();
  if (!message) {
    showToast('Please write a comment first', 'error');
    return;
  }

  var _post = (allPosts||[]).find(function(p) {
    return p.post_id === postId || p.id === postId;
  });
  var _realPostId = _post ? _post.post_id : postId;
  var _title = _post ? (_post.title || postId) : postId;
  var _author = window.currentUserName || 'Client';
  var _role = window.effectiveRole || 'Client';
  var _normalRole = _role.charAt(0).toUpperCase() + _role.slice(1).toLowerCase();

  var btn = document.querySelector('[onclick*="_submitEditorialComment"]');
  if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }

  apiFetch('/post_comments', {
    method: 'POST',
    body: JSON.stringify({
      post_id: _realPostId,
      author: _author,
      author_role: _normalRole,
      message: message
    })
  }).then(function() {

    ['Servicing', 'Admin'].forEach(function(role) {
      apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_role: role,
          post_id: _realPostId,
          type: 'comment',
          message: _author + ' commented on ' + _title
        })
      }).catch(function(){});
    });

    var overlay = document.getElementById('client-editorial-overlay');
    if (overlay) {
      overlay.innerHTML =
        '<div style="position:fixed;inset:0;background:#0a0a0f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">' +
        '<div style="font-size:32px;">&#x1F4AC;</div>' +
        '<div style="font-family:\'DM Sans\',sans-serif;font-size:20px;font-weight:600;color:#e8e2d9;">Comment sent</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:0.16em;text-transform:uppercase;color:#C8A84B;">Team has been notified</div>' +
        '</div>';
    }

    setTimeout(function() {
      _closeClientEditorial();
    }, 1500);

  }).catch(function() {
    showToast('Failed to send. Try again.', 'error');
    if (btn) { btn.textContent = 'Send Comment \u2192'; btn.disabled = false; }
  });
}

window._edUpdateDots = function(stripId, dotsId, total) {
  var strip = document.getElementById(stripId);
  var dotsEl = document.getElementById(dotsId);
  if (!strip || !dotsEl) return;
  var idx = Math.round(strip.scrollLeft / 102);
  idx = Math.max(0, Math.min(idx, total - 1));
  var dots = dotsEl.querySelectorAll('div');
  dots.forEach(function(d, i) {
    d.style.background = i === idx ? '#e8e2d9' : '#2a2a2a';
  });
}

window._edLbNav = function(dir) {
  var imgs = window._edLbImages || [];
  var idx = (window._edLbIdx + dir + imgs.length) % imgs.length;
  window._edLbIdx = idx;
  var img = document.getElementById('ed-lb-img');
  var counter = document.getElementById('ed-lb-counter');
  var dl = document.getElementById('ed-lb-dl');
  var dots = document.getElementById('ed-lb-dots');
  if (img) img.src = imgs[idx];
  if (counter) counter.textContent = (idx+1) + ' / ' + imgs.length;
  if (dl) dl.href = imgs[idx];
  if (dots) {
    dots.querySelectorAll('div').forEach(function(d,i){
      d.style.background = i === idx ? '#e8e2d9' : '#2a2a2a';
    });
  }
}
