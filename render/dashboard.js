/* ===============================================
   render/dashboard.js - Dashboard rendering
   Extracted from 07-post-load.js (Phase 1)
=============================================== */
console.log("LOADED:", "render/dashboard.js");

// ===============================================
// Dashboard  -  Hero, Pipeline, Blockers
// ===============================================

// -- Scoreboard  -  Data + Render ------------------

// Safe stage accessor
window._safeStage = function(p) {
  if (!p || typeof p !== 'object') return '';
  return p.stage || '';
}

// Config  -  single source for all thresholds
window.SCOREBOARD_CONFIG = {
  MONTHLY_TARGET: 35,
  CRITICAL_THRESHOLD: 7
};

// Single-pass count engine
window.getScoreboardCounts = function(posts) {
  var counts = {
    in_production: 0,
    ready: 0,
    awaiting_approval: 0,
    awaiting_brand_input: 0,
    scheduled: 0,
    published: 0
  };

  if (!Array.isArray(posts)) return counts;

  for (var i = 0; i < posts.length; i++) {
    var s = _safeStage(posts[i]);
    if (counts.hasOwnProperty(s)) counts[s]++;
  }

  return counts;
}

// Final data model
window.getScoreboardData = function() {
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var c = getScoreboardCounts(posts);
  var MONTHLY_TARGET = window.SCOREBOARD_CONFIG.MONTHLY_TARGET;

  // FIX 6: Runway = scheduled posts with target_date >= today
  var todayStr = new Date().toISOString().split('T')[0];
  var runwayPosts = posts.filter(function(p) {
    return p.stage === 'scheduled' && p.target_date && p.target_date >= todayStr;
  });
  var runwayCount = runwayPosts.length;

  // FIX 7: Pranav = posts in system vs target
  var inSystemPosts = posts.filter(function(p) {
    return ['ready', 'awaiting_approval', 'awaiting_brand_input', 'scheduled'].includes(p.stage);
  });
  var pranavDeficit = inSystemPosts.length - MONTHLY_TARGET;

  // FIX 8: Chitra = posts she needs to act on
  var threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  var threeDaysAgoStr = threeDaysAgo.toISOString();

  // Chitra owns: ready posts + overdue awaiting posts (>3 days old, came back to her)
  var chitraOverdue = posts.filter(function(p) {
    return (p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input') &&
      p.status_changed_at !== null &&
      p.status_changed_at !== undefined &&
      new Date((p.status_changed_at || '') + 'Z') < threeDaysAgo;
  }).length;
  var chitraReady = posts.filter(function(p) {
    return p.stage === 'ready';
  }).length;
  var chitraCount = chitraReady + chitraOverdue;

  // FIX 9: Approval = awaiting_approval still with client (<3 days)
  var approvalCount = posts.filter(function(p) {
    return p.stage === 'awaiting_approval' && (
      !p.status_changed_at ||
      new Date((p.status_changed_at || '') + 'Z') >= threeDaysAgo
    );
  }).length;

  // FIX 10: Input = awaiting_brand_input still with client (<3 days)
  var inputCount = posts.filter(function(p) {
    return p.stage === 'awaiting_brand_input' && (
      !p.status_changed_at ||
      new Date((p.status_changed_at || '') + 'Z') >= threeDaysAgo
    );
  }).length;

  // B-02 FIX: Count failed_publish (scheduled posts past target_date)
  var failedPublishCount = posts.filter(function(p) {
    return p.stage === 'scheduled' && p.target_date && p.target_date < todayStr;
  }).length;

  // B-01 FIX: Count ready posts for Chitra context-aware action
  var readyCount = c.ready || 0;

  window._lastScoreboardData = {
    runwayCount: runwayCount,
    pranavDeficit: pranavDeficit,
    chitraCount: chitraCount,
    chitraOverdue: chitraOverdue,
    approvalCount: approvalCount,
    inputCount: inputCount
  };

  return {
    failedPublish: failedPublishCount,
    readyCount: readyCount,
    runway: {
      count: runwayCount
    },
    pranav: {
      deficit: pranavDeficit,
      inSystem: inSystemPosts.length,
      target: MONTHLY_TARGET
    },
    chitra: {
      count: chitraCount,
      overdue: chitraOverdue
    },
    client: {
      approval: approvalCount,
      input: inputCount
    }
  };
}

window.dashPad = function(n) {
  return String(Math.abs(n)).padStart(2, '0');
}


window.updateDashGreeting = function() {
  var nameEl = document.getElementById('dash-greeting-name');
  var hdrEl = document.getElementById('dash-greeting-hdr');
  if (!nameEl || !hdrEl) return;
  var role = (window.effectiveRole || window.currentRole || 'admin').toLowerCase();
  var nameMap = {
    admin: 'Shubham', shubham: 'Shubham',
    servicing: 'Chitra', chitra: 'Chitra',
    creative: 'Pranav', pranav: 'Pranav',
    client: ''
  };
  var name = nameMap[role] || 'Shubham';
  var h = new Date().getHours();
  var timeWord;
  if (h >= 5 && h < 12) timeWord = 'Good morning';
  else if (h >= 12 && h < 17) timeWord = 'Good afternoon';
  else if (h >= 17 && h < 22) timeWord = 'Good evening';
  else timeWord = 'Working late';
  if (name) {
    nameEl.textContent = name;
    nameEl.style.color = '#C8A84B';
    nameEl.style.fontWeight = '500';
    hdrEl.childNodes[0].textContent = timeWord + ', ';
  } else {
    hdrEl.textContent = timeWord;
  }
}

window.updateDashKicker = function(state) {
  var dot = document.getElementById('dash-kicker-dot');
  var text = document.getElementById('dash-kicker-text');
  var line = document.getElementById('dash-kicker-line');
  if (!dot || !text || !line) return;
  var states = {
    crisis: { text: 'BREAKING \u00b7 RUNWAY CRISIS', color: 'var(--c-red)' },
    urgent: { text: 'HEADS UP \u00b7 ACTION NEEDED', color: 'var(--c-amber)' },
    steady: { text: 'ALL SORTED \u00b7 RUNWAY HEALTHY', color: 'var(--c-green)' },
    idle:   { text: 'SORTED \u00b7 QUIET DAY', color: '#444' }
  };
  var s = states[state] || states.idle;
  line.style.color = s.color;
  dot.style.background = s.color;
  text.textContent = s.text;
}

window.updateDashDeck = function(runway, overdue, pranavDef) {
  var el = document.getElementById('dash-deck');
  if (!el) return;
  var parts = [];
  if (runway <= 6) parts.push('Only ' + runway + ' post' + (runway===1?'':'s') + ' scheduled');
  if (pranavDef < 0) parts.push('Pranav ' + Math.abs(pranavDef) + ' behind');
  if (overdue > 0) parts.push(overdue + ' overdue');
  if (parts.length) parts.push('sort now');
  el.textContent = parts.join(' \u00b7 ');
  el.style.cssText = 'font-family:var(--mono);font-size:7px;color:#555;margin:4px 0 4px;line-height:1.4;letter-spacing:0.04em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;';
}

window.updateDashDatetime = function() {
  var el = document.getElementById('dash-datetime');
  if (!el) return;
  var now = new Date();
  var h = now.getHours(), m = now.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  el.textContent = h + ':' + (m<10?'0':'') + m + ' ' + ampm + ' \u00b7 ' + days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
}


window.renderScoreboard = function() {
  try {
    var data = getScoreboardData();
    if (!data || typeof data !== 'object') return;

    window._dashLastUpdated = Date.now();

    function safe(v) { return (v != null && Number.isFinite(v)) ? v : 0; }

    var runwayCount = safe(data.runway.count);
    var pranavDeficit = safe(data.pranav.deficit);
    var pranavInSystem = safe(data.pranav.inSystem);
    var chitraCount = safe(data.chitra.count);
    var chitraOverdue = safe(data.chitra.overdue);
    var approvalCount = safe(data.client.approval);
    var inputCount = safe(data.client.input);

    // --- HEADLINE PRIORITY ---
    var kicker, kickerColor, headline, deck;
    var role = window.effectiveRole || 'Admin';

    if (role === 'Creative') {
      // Pranav-specific headline
      kicker = 'Your Status \u00b7 Creative';
      if (pranavDeficit >= 0) {
        kickerColor = 'var(--green)';
        headline = 'Target met \u00b7 <span class="hl-num" style="color:var(--green)">' + dashPad(pranavDeficit) + '</span> ahead \u00b7 great work';
        deck = dashPad(runwayCount) + ' posts in runway \u00b7 team on track';
      } else if (pranavDeficit <= -15) {
        kickerColor = 'var(--red)';
        headline = 'Pranav \u00b7 <span class="hl-num" style="color:var(--red)">' + dashPad(Math.abs(pranavDeficit)) + '</span> posts behind \u00b7 build now';
        deck = dashPad(runwayCount) + ' posts in runway \u00b7 ' + pranavInSystem + ' in system vs 35 target';
      } else {
        kickerColor = 'var(--amber)';
        headline = 'Pranav \u00b7 <span class="hl-num" style="color:var(--amber)">' + dashPad(Math.abs(pranavDeficit)) + '</span> posts behind \u00b7 keep going';
        deck = dashPad(runwayCount) + ' posts in runway \u00b7 ' + pranavInSystem + ' in system vs 35 target';
      }
    } else if (runwayCount <= 6) {
      // Priority 1 - Runway critical
      kicker = 'Breaking \u00b7 Runway Crisis';
      kickerColor = 'var(--red)';
      headline = 'Runway at \u00b7 <span style="color:var(--c-red);display:inline-block;animation:hb 2.4s ease-in-out infinite;">' + dashPad(runwayCount) + '</span> \u00b7 agency running on empty';
      deck = 'Only ' + runwayCount + ' post' + (runwayCount === 1 ? '' : 's') + ' scheduled from today \u00b7 Pranav ' + Math.abs(pranavDeficit) + ' posts behind \u00b7 sort now';
    } else if (pranavDeficit < -14 && role !== 'Servicing') {
      // Priority 2 - Pranav deficit worse than -14
      kicker = 'Alert \u00b7 Team Behind';
      kickerColor = 'var(--amber)';
      headline = 'Pranav \u00b7 <span class="hl-num" style="color:var(--amber)">' + dashPad(Math.abs(pranavDeficit)) + '</span> posts behind \u00b7 ' + (chitraOverdue > 0 ? chitraOverdue + ' overdue approvals' : 'runway watch closely');
      deck = dashPad(runwayCount) + ' posts in runway \u00b7 ' + (chitraOverdue > 0 ? 'Chitra chasing overdue clients \u00b7 system under strain' : 'team needs to build urgently');
    } else if (chitraOverdue > 0) {
      // Priority 3 - Chitra has overdue
      kicker = 'Alert \u00b7 Client Not Responding';
      kickerColor = 'var(--red)';
      headline = '<span class="hl-num" style="color:var(--red)">' + dashPad(chitraOverdue) + '</span> approvals overdue \u00b7 chase client now';
      deck = 'Chitra has ' + chitraCount + ' posts total \u00b7 ' + chitraOverdue + ' waiting more than 3 days \u00b7 client not responding';
    } else if (runwayCount <= 14) {
      // Priority 4 - Normal
      kicker = 'Update \u00b7 Watch Closely';
      kickerColor = 'var(--amber)';
      headline = 'One week of runway \u00b7 <span class="hl-num" style="color:var(--amber)">' + dashPad(runwayCount) + '</span> posts scheduled';
      deck = 'Pranav ' + Math.abs(pranavDeficit) + ' behind target \u00b7 Chitra has ' + chitraCount + ' to dispatch \u00b7 ' + (approvalCount > 0 ? approvalCount + ' approval pending' : 'no pending approvals');
    } else if (runwayCount <= 21) {
      // Priority 5 - Good
      kicker = 'Good \u00b7 On Track';
      kickerColor = 'var(--green)';
      headline = 'Strong at \u00b7 <span class="hl-num" style="color:var(--green)">' + dashPad(runwayCount) + '</span> \u00b7 team nearly on target';
      deck = 'Pranav ' + Math.abs(pranavDeficit) + ' posts short \u00b7 Chitra has ' + chitraCount + ' ready \u00b7 ' + (approvalCount > 0 ? approvalCount + ' approval pending' : 'all approvals clear');
    } else if (pranavDeficit >= 0) {
      // Priority 6 - Perfect
      kicker = 'Excellent \u00b7 All Systems Go';
      kickerColor = 'var(--green)';
      headline = 'Target met \u00b7 <span class="hl-num" style="color:var(--green)">' + dashPad(runwayCount) + '</span> posts scheduled \u00b7 team firing';
      deck = 'Pranav ' + pranavDeficit + ' ahead of target \u00b7 Chitra all clear \u00b7 no pending approvals';
    } else {
      // Fallback (runwayCount > 21 but pranavDeficit < 0)
      kicker = 'Good \u00b7 On Track';
      kickerColor = 'var(--green)';
      headline = 'Strong at \u00b7 <span class="hl-num" style="color:var(--green)">' + dashPad(runwayCount) + '</span> \u00b7 team nearly on target';
      deck = 'Pranav ' + Math.abs(pranavDeficit) + ' posts short \u00b7 Chitra has ' + chitraCount + ' ready \u00b7 ' + (approvalCount > 0 ? approvalCount + ' approval pending' : 'all approvals clear');
    }

    // --- STEP 3: METRIC ROWS ---

    // RUNWAY
    var rColor = runwayCount <= 6 ? 'var(--red)' : runwayCount <= 14 ? 'var(--amber)' : 'var(--green)';
    var rMsg = runwayCount <= 1 ? 'Almost empty \u00b7 build now' : runwayCount <= 6 ? 'Running out \u00b7 sort now' : runwayCount <= 14 ? 'Getting low \u00b7 sort this week' : runwayCount <= 21 ? 'Good shape \u00b7 keep sorting' : 'Strong runway \u00b7 well done';
    var elRPre = document.getElementById('metric-runway-prefix');
    var elRNum = document.getElementById('metric-runway-num');
    var elRMsg = document.getElementById('metric-runway-msg');
    if (elRPre) { elRPre.textContent = '\u00b7'; elRPre.style.color = rColor; }
    if (elRNum) { elRNum.textContent = dashPad(runwayCount); elRNum.style.color = rColor; }
    var rMsgColor = runwayCount <= 6 ? '#cc3a3a' : runwayCount <= 14 ? 'var(--c-amber)' : 'var(--c-green)';
    if (elRMsg) { elRMsg.textContent = rMsg; elRMsg.style.color = rMsgColor; }

    // PRANAV
    var pPrefix = pranavDeficit >= 0 ? '+' : '-';
    var pColor = pranavDeficit <= -22 ? 'var(--red)' : pranavDeficit <= -15 ? 'var(--red)' : pranavDeficit <= -8 ? 'var(--amber)' : pranavDeficit < 0 ? 'var(--amber)' : 'var(--green)';
    var pMsg = pranavDeficit <= -22 ? 'Pipeline at risk \u00b7 sort now' : pranavDeficit <= -15 ? dashPad(Math.abs(pranavDeficit)) + ' behind \u00b7 team needs you' : pranavDeficit <= -8 ? dashPad(Math.abs(pranavDeficit)) + ' behind \u00b7 pick up pace' : pranavDeficit < 0 ? dashPad(Math.abs(pranavDeficit)) + ' posts behind \u00b7 keep going' : 'Target met \u00b7 great work';
    var elPPre = document.getElementById('metric-pranav-prefix');
    var elPNum = document.getElementById('metric-pranav-num');
    var elPMsg = document.getElementById('metric-pranav-msg');
    if (elPPre) { elPPre.textContent = pPrefix; elPPre.style.color = pColor; }
    if (elPNum) { elPNum.textContent = dashPad(pranavDeficit); elPNum.style.color = pColor; }
    var pMsgColor = pranavDeficit <= -15 ? '#cc3a3a' : pranavDeficit < 0 ? 'var(--c-amber)' : 'var(--c-green)';
    if (elPMsg) { elPMsg.textContent = pMsg; elPMsg.style.color = pMsgColor; }

    // CHITRA
    var cTotal = (allPosts||[]).filter(function(p) {
      var s = p.stage || p.stageLC || '';
      return s === 'awaiting_approval' || s === 'awaiting_brand_input';
    }).length;
    var cPrefix = cTotal > 0 ? '-' : '\u00b7';
    var cColor = chitraOverdue > 0 ? 'var(--red)' : cTotal > 8 ? 'var(--red)' : cTotal > 3 ? 'var(--amber)' : cTotal > 0 ? 'var(--green)' : 'var(--green)';
    var cMsg = chitraOverdue > 0 ? dashPad(chitraOverdue) + ' overdue \u00b7 chase client' : cTotal > 8 ? dashPad(cTotal) + ' posts piling up' : cTotal > 3 ? dashPad(cTotal) + ' posts waiting on you' : cTotal > 0 ? dashPad(cTotal) + ' post' + (cTotal === 1 ? '' : 's') + ' ready to send' : 'All sorted \u00b7 well done';
    var elCPre = document.getElementById('metric-chitra-prefix');
    var elCNum = document.getElementById('metric-chitra-num');
    var elCMsg = document.getElementById('metric-chitra-msg');
    if (elCPre) { elCPre.textContent = cPrefix; elCPre.style.color = cColor; }
    if (elCNum) { elCNum.textContent = dashPad(cTotal); elCNum.style.color = cColor; }
    var cMsgColor = chitraOverdue > 0 ? '#cc3a3a' : cTotal > 8 ? '#cc3a3a' : cTotal > 3 ? 'var(--c-amber)' : 'var(--c-green)';
    if (elCMsg) { elCMsg.textContent = cMsg; elCMsg.style.color = cMsgColor; }

    // CLIENT
    var clientPendingPosts = allPosts.filter(function(p) {
      var owner = (p.owner||'').toLowerCase();
      var stage = p.stage || p.stageLC || '';
      return owner === 'client' &&
        (stage === 'awaiting_approval' || stage === 'awaiting_brand_input');
    });
    var approvalOnly = clientPendingPosts.filter(function(p) {
      return (p.stage||p.stageLC) === 'awaiting_approval';
    }).length;
    var inputOnly = clientPendingPosts.filter(function(p) {
      return (p.stage||p.stageLC) === 'awaiting_brand_input';
    }).length;
    var clTotal = clientPendingPosts.length;
    var clPrefix = clTotal > 0 ? '-' : '\u00b7';
    var clColor = clTotal > 0 ? 'var(--red)' : 'var(--muted)';
    var elClPre = document.getElementById('metric-client-prefix');
    var elClNum = document.getElementById('metric-client-num');
    var elClMsg = document.getElementById('metric-client-msg');
    if (elClPre) { elClPre.textContent = clPrefix; elClPre.style.color = clColor; }
    if (elClNum) { elClNum.textContent = dashPad(clTotal); elClNum.style.color = clColor; }
    var clMsgColor = clTotal > 0 ? '#cc3a3a' : '#aaa';
    if (elClMsg) {
      if (approvalOnly > 0 || inputOnly > 0) {
        elClMsg.innerHTML =
          '<span style="cursor:pointer;color:var(--c-red);"' +
          ' onclick="event.stopPropagation();openStageSheet(\'awaiting_approval\')">' +
          dashPad(approvalOnly) + ' APPROVAL</span>' +
          ' <span style="color:#555;">\u00b7</span> ' +
          '<span style="cursor:pointer;color:#888;"' +
          ' onclick="event.stopPropagation();openStageSheet(\'awaiting_brand_input\')">' +
          dashPad(inputOnly) + ' INPUT</span>';
      } else {
        var clMsg = 'Client sorted \u00b7 good week';
        elClMsg.textContent = clMsg;
        elClMsg.style.color = clMsgColor;
      }
    }

    // --- STEP 4: HEADLINE RENDER ---
    var elHL = document.getElementById('dash-headline');
    if (elHL) {
      elHL.innerHTML = headline;
      elHL.style.cursor = 'pointer';
      elHL.onclick = function() { openRunwaySheet(); };
    }

    // --- STEP 5: KICKER, DECK, DATETIME ---
    var kickerState;
    if (runwayCount <= 3) kickerState = 'crisis';
    else if (runwayCount <= 6 || chitraOverdue > 0) kickerState = 'urgent';
    else if (runwayCount > 6) kickerState = 'steady';
    else kickerState = 'idle';
    updateDashKicker(kickerState);
    updateDashDeck(runwayCount, chitraOverdue, pranavDeficit);
    updateDashDatetime();

    // --- STEP 6: TASK LIST ---
    _renderDashTaskList(role);

    // --- STEP 7: PERSONALIZATION ---
    var rowPranav = document.getElementById('metric-row-pranav');
    var rowChitra = document.getElementById('metric-row-chitra');
    var rowClient = document.getElementById('metric-row-client');
    var rowRunway = document.getElementById('metric-row-runway');

    if (role === 'Servicing') {
      if (rowPranav) rowPranav.style.display = 'none';
      if (rowChitra) rowChitra.style.display = '';
      if (rowClient) rowClient.style.display = '';
      if (rowRunway) rowRunway.style.display = '';
    } else if (role === 'Creative') {
      if (rowChitra) rowChitra.style.display = 'none';
      if (rowClient) rowClient.style.display = 'none';
      if (rowPranav) rowPranav.style.display = '';
      if (rowRunway) rowRunway.style.display = '';
    } else {
      // Admin: show all
      if (rowPranav) rowPranav.style.display = '';
      if (rowChitra) rowChitra.style.display = '';
      if (rowClient) rowClient.style.display = '';
      if (rowRunway) rowRunway.style.display = '';
    }

    // --- STEP 8: TAPPABLE METRIC ROWS ---
    if (rowRunway) rowRunway.onclick = function() { if (typeof openRunwaySheet === 'function') openRunwaySheet(); };
    if (rowPranav) rowPranav.onclick = function() {
      var pranavPosts = (allPosts||[]).filter(function(p) {
        var s = p.stage || p.stageLC || '';
        var owner = (p.owner||'').toLowerCase();
        return (owner === 'pranav' || owner === 'creative') &&
               s === 'in_production';
      });
      if (pranavPosts.length > 0) {
        openStageSheet('pranav_production');
      } else {
        var fab = document.getElementById('fab-btn');
        if (fab) fab.click();
      }
    };
    if (rowChitra) rowChitra.onclick = function() {
      openStageSheet('chitra_active');
    };
    if (rowClient) rowClient.onclick = function() {
      openStageSheet('client_pending');
    };

  } catch (err) {
    console.error('[Scoreboard] Render error', err);
  }
}

window._renderDashTaskList = function(role) {
  var items = _buildDoThisNowItems(role);
  var container = document.getElementById('dash-task-list');
  if (!container) return;

  // Filter by role
  var filtered = items;
  if (role === 'Servicing') {
    filtered = items.filter(function(item) {
      var who = (item.assignedTo || '').toLowerCase();
      return who === 'chitra' || item.taskId === 'auto';
    });
  } else if (role === 'Creative') {
    filtered = items.filter(function(item) {
      var who = (item.assignedTo || '').toLowerCase();
      return who === 'pranav' || item.taskId === 'auto';
    });
  }

  // Build urgent crisis items from current system state
  var urgentItems = [];
  var scoreData = getScoreboardData();
  if (scoreData && typeof scoreData === 'object') {
    var _rc = scoreData.runway ? scoreData.runway.count : 99;
    var _co = scoreData.chitra ? scoreData.chitra.overdue : 0;
    var _pd = scoreData.pranav ? scoreData.pranav.deficit : 0;
    var _ac = scoreData.client ? scoreData.client.approval : 0;

    if (_rc <= 6) {
      urgentItems.push({
        text: '<span style="color:#FF4B4B">' + dashPad(_rc) + '</span> runway',
        arrow: '#FF4B4B',
        onclick: "if(typeof openRunwaySheet==='function')openRunwaySheet()"
      });
    }
    if (_co > 0) {
      urgentItems.push({
        text: 'chase client <span style="color:#FF4B4B">' + dashPad(_co) + '</span> overdue',
        arrow: '#FF4B4B',
        onclick: "openStageSheet('overdue')"
      });
    }
    if (_pd <= -15) {
      urgentItems.push({
        text: '<span style="color:#FF4B4B">' + dashPad(Math.abs(_pd)) + '</span> posts to build <span style="color:#9b87f5">pranav</span>',
        arrow: '#9b87f5',
        onclick: "openStageSheet('pranav_production')"
      });
    }

    // Only show empty state when system is calm
    if (!filtered.length && !urgentItems.length) {
      if (_rc > 6 && _pd > -8 && _co === 0 && _ac === 0) {
        var emptyMessages = {
          'Admin':     'All sorted - nothing needs you',
          'Servicing': 'All sorted - nothing to dispatch',
          'Creative':  'All sorted - keep creating',
          'Client':    'All sorted - nothing from us right now'
        };
        var emptyRole = window.effectiveRole || window.currentRole || 'Admin';
        var emptyMsg = emptyMessages[emptyRole] || 'All sorted';
        container.innerHTML = '<div class="dash-empty-state">' + emptyMsg + '</div>';
        return;
      }
    }
  } else if (!filtered.length) {
    container.innerHTML = '<div class="dash-empty-state">All sorted</div>';
    return;
  }

  // Separate chase tasks from non-chase tasks
  var normalTasks = [];
  var chaseTasks = [];
  for (var i = 0; i < filtered.length; i++) {
    var item = filtered[i];
    var tLower = (item.title || '').toLowerCase();
    if (tLower.indexOf('chase client') === 0 || tLower.indexOf('brand input pending') === 0 || tLower.indexOf('fix publish') === 0) {
      chaseTasks.push(item);
    } else {
      normalTasks.push(item);
    }
  }

  var html = '';
  // Render non-chase tasks as pipeline cards
  for (var n = 0; n < normalTasks.length; n++) {
    var nItem = normalTasks[n];
    var nTid = nItem.taskId || 'auto';
    html += '<div style="display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;" onclick="toggleDashTask(this, \'' + nTid + '\')">';
    html += '<div style="width:3px;flex-shrink:0;background:#FF4B4B;"></div>';
    html += '<div style="flex:1;padding:8px 12px;">';
    html += '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#e8e2d9;margin-bottom:3px;">' + esc(nItem.title) + '</div>';
    html += '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' +
      '<span style="color:' + _ownerColor(nItem.assignedTo) + '">' + esc((nItem.assignedTo || '').toLowerCase()) + '</span></div>';
    html += '</div></div>';
  }

  // Render chase tasks as pipeline cards (max 3)
  var totalOverdue = chaseTasks.length;
  var chaseShow = Math.min(3, totalOverdue);
  var chaseOverflow = totalOverdue - chaseShow;
  for (var ci = 0; ci < chaseShow; ci++) {
    var cItem = chaseTasks[ci];
    var cPid = cItem.postId || '';
    var cPost = cItem.post;
    var cDays = cPost ? _staleDays(cPost) : 0;
    var cStage = cPost ? (STAGE_META[cPost.stage] || {}).label || cPost.stage : '';
    var cOwner = cPost ? (cPost.owner || '') : (cItem.assignedTo || '');
    var cPillar = cPost ? (cPost.content_pillar || '') : '';
    var cLocation = cPost ? (cPost.location || '') : '';
    var cTitle = cPost ? (cPost.title || 'Untitled') : cItem.title;
    var cClick = cPid ? 'openPostOverSheet(\'' + cPid + '\')' : '';
    var cMeta = [];
    if (cOwner) cMeta.push('<span style="color:' + _ownerColor(cOwner) + '">' + esc(cOwner.toLowerCase()) + '</span>');
    if (cPillar) cMeta.push(esc(cPillar.toLowerCase()));
    if (cLocation) cMeta.push(esc(cLocation.toLowerCase()));
    html += '<div style="display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;"' + (cClick ? ' onclick="' + cClick + '"' : '') + '>';
    html += '<div style="width:3px;flex-shrink:0;background:#FF4B4B;"></div>';
    html += '<div style="flex:1;padding:8px 12px;">';
    html += '<div style="font-family:var(--mono);font-size:8px;letter-spacing:0.04em;margin-bottom:3px;color:#FF4B4B;">' +
      (cDays > 0 ? cDays + 'd waiting' : '') + (cStage ? (cDays > 0 ? ' - ' : '') + esc(cStage.toLowerCase()) : '') + '</div>';
    html += '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#e8e2d9;margin-bottom:3px;">' + esc(cTitle) + '</div>';
    if (cMeta.length) html += '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' + cMeta.join(' - ') + '</div>';
    html += '</div>';
    html += '<div style="padding:8px 14px 8px 8px;display:flex;align-items:center;flex-shrink:0;">';
    html += '<span style="font-family:var(--mono);font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:#FF4B4B;background:transparent;border:none;">chase</span>';
    html += '</div></div>';
  }
  if (chaseOverflow > 0) {
    html += '<div style="padding:7px 18px;font-family:var(--mono);font-size:8px;color:#555;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.07);" onclick="openStageSheet(\'overdue\')">+ ' +
      chaseOverflow + ' more - ' + totalOverdue + ' total overdue</div>';
  }

  // Arrow action items
  if (urgentItems.length) {
    html += '<div style="padding:10px 18px 12px;border-bottom:1px solid rgba(255,255,255,0.07);">';
    for (var u = 0; u < urgentItems.length; u++) {
      var ui = urgentItems[u];
      html += '<div style="display:flex;gap:8px;margin-bottom:5px;cursor:pointer;" onclick="' + ui.onclick + '">';
      html += '<span style="font-size:10px;flex-shrink:0;color:' + ui.arrow + ';">&#8594;</span>';
      html += '<span style="font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#888;">' + ui.text + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }

  if (!html) {
    container.innerHTML = '<div class="dash-empty-state">All sorted</div>';
    return;
  }

  container.innerHTML = html;
}

window.toggleDashTask = async function(row, taskId) {
  var cb = row.querySelector('.dash-task-cb');
  var txt = row.querySelector('.dash-task-text');
  cb.classList.toggle('done');
  txt.classList.toggle('done');
  if (taskId && taskId !== 'auto') {
    try {
      await apiFetch('/tasks?id=eq.' + taskId, {
        method: 'PATCH',
        body: JSON.stringify({ done: cb.classList.contains('done') })
      });
    } catch(e) { console.warn('Task toggle failed:', e); }
  }
}

window.openRunwaySheet = function() {
  var posts = (allPosts || []).filter(function(p) {
    return p.stage === 'scheduled' || p.stageLC === 'scheduled';
  });
  var sheet = document.getElementById('runway-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'runway-sheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center;';
    sheet.onclick = function(e) { if (e.target === sheet) sheet.style.display = 'none'; };
    document.body.appendChild(sheet);
  }
  var html = '<div style="width:100%;max-width:480px;max-height:88vh;overflow-y:auto;background:#141414;border-top:1px solid rgba(255,255,255,0.1);padding-bottom:30px;">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--dotline);">';
  html += '<span style="font-family:var(--mono);font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--text1);">Runway - ' + posts.length + ' scheduled</span>';
  html += '<button onclick="document.getElementById(\'runway-sheet\').style.display=\'none\'" style="background:none;border:none;color:var(--c-text3);font-size:18px;cursor:pointer;line-height:1;">x</button>';
  html += '</div>';
  if (!posts.length) {
    html += '<div style="padding:24px 18px;font-family:var(--mono);font-size:11px;color:var(--c-text3);">Nothing scheduled yet.</div>';
  } else {
    posts.forEach(function(p) {
      var d = p.targetDate || p.target_date;
      var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var dateStr = '-- --';
      if (d) { var dt = new Date(d); dateStr = days[dt.getDay()] + ' - ' + dt.getDate() + ' ' + months[dt.getMonth()]; }
      var rpid = p.id || p.post_id || '';
      html += '<div onclick="openPostOverSheet(\'' + rpid + '\')" style="display:flex;align-items:stretch;border-bottom:1px solid var(--dotline);cursor:pointer;transition:background 0.1s;" onmousedown="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseup="this.style.background=\'\'">';
      html += '<div style="width:3px;flex-shrink:0;background:var(--c-cyan);"></div>';
      html += '<div style="flex:1;padding:10px 14px;">';
      html += '<div style="font-family:var(--mono);font-size:8px;color:var(--c-cyan);letter-spacing:0.08em;margin-bottom:3px;">' + dateStr + '</div>';
      html += '<div style="font-family:var(--sans);font-size:13px;font-weight:500;color:var(--text1);">' + esc(p.title || 'Untitled') + '</div>';
      html += '<div style="font-family:var(--mono);font-size:8px;color:var(--c-text3);margin-top:2px;">' + esc(p.owner || '') + (p.content_pillar ? ' - ' + esc(p.content_pillar) : '') + '</div>';
      html += '</div></div>';
    });
  }
  html += '</div>';
  sheet.innerHTML = html;
  sheet.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

window.openPostOverSheet = function(pid) {
  var match = (allPosts||[]).find(function(p) {
    return p.id === pid || p.post_id === pid;
  });
  var realId = match ? (match.id || match.post_id) : pid;
  if (typeof openPCS === 'function') {
    openPCS(realId, 'pipeline');
  }
}

window.openStageSheet = function(stage) {
  var stageNames = {
    'awaiting_approval': 'Awaiting Approval',
    'awaiting_brand_input': 'Awaiting Input',
    'overdue': 'Overdue Posts',
    'client_pending': 'Client \u00b7 Pending',
    'chitra_overdue': 'Chitra \u00b7 Overdue',
    'chitra_active': 'Chitra \u00b7 Awaiting Action',
    'pranav_overdue': 'Pranav \u00b7 Overdue',
    'pranav_production': 'Pranav \u00b7 In Progress'
  };
  var posts;
  var title;
  if (stage === 'overdue') {
    posts = (allPosts||[]).filter(function(p) {
      return isPostStale(p);
    });
  } else if (stage === 'client_pending') {
    posts = (allPosts||[]).filter(function(p) {
      var owner = (p.owner||'').toLowerCase();
      var s = p.stage || p.stageLC || '';
      return owner === 'client' &&
        (s === 'awaiting_approval' ||
         s === 'awaiting_brand_input');
    });
    title = 'Client \u00b7 Pending';
  } else if (stage === 'chitra_active') {
    posts = (allPosts||[]).filter(function(p) {
      var s = p.stage || p.stageLC || '';
      return s === 'awaiting_approval' ||
             s === 'awaiting_brand_input';
    }).sort(function(a,b) {
      return new Date((a.status_changed_at||a.updated_at||'') + 'Z') -
             new Date((b.status_changed_at||b.updated_at||'') + 'Z');
    });
    title = 'Chitra \u00b7 Awaiting Action';
  } else if (stage === 'chitra_overdue') {
    posts = (allPosts||[]).filter(function(p) {
      var owner = (p.owner||'').toLowerCase();
      var s = p.stage || p.stageLC || '';
      return (owner === 'chitra' || owner === 'servicing') &&
        !['published','parked','rejected'].includes(s);
    }).sort(function(a,b) {
      var ac = a.status_changed_at||a.updated_at||'';
      var bc = b.status_changed_at||b.updated_at||'';
      return new Date(ac) - new Date(bc);
    });
    title = 'Chitra \u00b7 Active Posts';
  } else if (stage === 'pranav_production') {
    posts = (allPosts||[]).filter(function(p) {
      var s = p.stage || p.stageLC || '';
      var owner = (p.owner||'').toLowerCase();
      return (owner === 'pranav' || owner === 'creative') &&
             s === 'in_production';
    }).sort(function(a,b) {
      return new Date((a.status_changed_at||a.updated_at||'') + 'Z') -
             new Date((b.status_changed_at||b.updated_at||'') + 'Z');
    });
    title = 'Pranav \u00b7 In Production';
  } else if (stage === 'pranav_overdue') {
    posts = (allPosts||[]).filter(function(p) {
      var owner = (p.owner||'').toLowerCase();
      var s = p.stage || p.stageLC || '';
      return (owner === 'pranav' || owner === 'creative') &&
        !['published','parked','rejected'].includes(s);
    }).sort(function(a,b) {
      var ac = a.status_changed_at||a.updated_at||'';
      var bc = b.status_changed_at||b.updated_at||'';
      return new Date(ac) - new Date(bc);
    });
    title = 'Pranav \u00b7 Active Posts';
  } else {
    posts = (allPosts||[]).filter(function(p) {
      return (p.stage||p.stageLC) === stage;
    });
  }
  var sheetTitle = title || stageNames[stage] || stage;
  var sheet = document.getElementById('stage-sheet-overlay');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'stage-sheet-overlay';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:1400;'+
      'background:rgba(0,0,0,0.75);display:flex;'+
      'align-items:flex-end;justify-content:center;';
    sheet.onclick = function(e) {
      if (e.target===sheet) sheet.style.display='none';
    };
    document.body.appendChild(sheet);
  }
  var html = '<div style="width:100%;max-width:480px;'+
    'max-height:88vh;overflow-y:auto;background:#141414;'+
    'border-top:1px solid rgba(255,255,255,0.1);'+
    'padding-bottom:30px;">';
  html += '<div style="display:flex;align-items:center;'+
    'justify-content:space-between;padding:14px 18px;'+
    'border-bottom:1px solid rgba(255,255,255,0.07);">'+
    '<span style="font-family:var(--mono);font-size:9px;'+
    'letter-spacing:0.2em;text-transform:uppercase;'+
    'color:#e8e2d9;">'+esc(sheetTitle)+' \u00b7 '+posts.length+'</span>'+
    '<button onclick="document.getElementById('+
    '\'stage-sheet-overlay\').style.display=\'none\'"'+
    ' style="background:none;border:none;color:#555;'+
    'font-size:18px;cursor:pointer;">\u00d7</button></div>';
  if (!posts.length) {
    html += '<div style="padding:20px 18px;font-family:'+
      'var(--mono);font-size:11px;color:#555;">'+
      'All sorted.</div>';
  } else {
    posts.forEach(function(p) {
      var pid = p.id || p.post_id || '';
      var pTitle = esc(p.title || 'Untitled');
      var pOwner = esc(p.owner || '');
      var pStage = esc((p.stage||p.stageLC||'').replace(/_/g,' '));
      html += '<div onclick="openPostOverSheet(\''+pid+'\')"'+
        ' style="display:flex;align-items:stretch;'+
        'border-bottom:1px solid rgba(255,255,255,0.07);'+
        'cursor:pointer;transition:background 0.1s;"'+
        ' onmousedown="this.style.background=\'rgba(255,255,255,0.03)\'"'+
        ' onmouseup="this.style.background=\'\'">'+
        '<div style="width:3px;flex-shrink:0;background:'+
        'var(--c-red);"></div>'+
        '<div style="flex:1;padding:10px 14px;">'+
        '<div style="font-family:var(--mono);font-size:11px;'+
        'color:#bbb;margin-bottom:3px;">'+pTitle+'</div>'+
        '<div style="font-family:var(--mono);font-size:8px;'+
        'color:#444;text-transform:uppercase;">'+
        pOwner+(pStage?' \u00b7 '+pStage:'')+'</div>'+
        '</div></div>';
    });
  }
  html += '</div>';
  sheet.innerHTML = html;
  sheet.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

window._buildDoThisNowItems = function(role) {
  var items = [];
  var todayStr = new Date().toISOString().split('T')[0];
  var threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  role = role || window.effectiveRole || window.currentRole || 'Admin';

  // B-02 FIX: PRIORITY 0  Failed publish items (scheduled posts past target_date)
  if (role !== 'Client') {
    var failedPub = _ttFailedPublish();
    for (var fp = 0; fp < failedPub.length && items.length < 3; fp++) {
      var fpPost = failedPub[fp];
      items.push({
        title: 'FIX PUBLISH - ' + getTitle(fpPost),
        assignedTo: 'Admin',
        taskId: getPostId(fpPost) || 'auto',
        postId: fpPost.id || fpPost.post_id || '',
        post: fpPost
      });
    }
  }

  // 1. Manual tasks first (sorted by due_date ascending)
  var manualTasks = (window.allTasks || []).filter(function(t) { return !t.done; }).sort(function(a, b) {
    var ad = a.due_date || '9999-12-31';
    var bd = b.due_date || '9999-12-31';
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  }).slice(0, 5);
  for (var t = 0; t < manualTasks.length; t++) {
    var task = manualTasks[t];
    items.push({
      title: task.message || 'Task',
      assignedTo: task.assigned_to || 'Unassigned',
      taskId: task.id ? String(task.id) : 'auto'
    });
  }

  // 2. Auto-generated: overdue client posts (Admin and Servicing only)
  if (role === 'Admin' || role === 'Servicing') {
    var overdueApprovalPosts = allPosts.filter(function(p) {
      return p.stage === 'awaiting_approval' &&
        p.status_changed_at && new Date((p.status_changed_at || '') + 'Z') < threeDaysAgo;
    }).sort(function(a, b) {
      return new Date((a.status_changed_at || '') + 'Z') - new Date((b.status_changed_at || '') + 'Z');
    });
    for (var c = 0; c < overdueApprovalPosts.length && items.length < 7; c++) {
      var op = overdueApprovalPosts[c];
      items.push({
        title: 'Chase client - ' + getTitle(op),
        assignedTo: 'Chitra',
        taskId: 'auto',
        postId: op.id || op.post_id || '',
        post: op
      });
    }
    var overdueBrandPosts = allPosts.filter(function(p) {
      return p.stage === 'awaiting_brand_input' &&
        p.status_changed_at && new Date((p.status_changed_at || '') + 'Z') < threeDaysAgo;
    }).sort(function(a, b) {
      return new Date((a.status_changed_at || '') + 'Z') - new Date((b.status_changed_at || '') + 'Z');
    });
    for (var bi = 0; bi < overdueBrandPosts.length && items.length < 8; bi++) {
      var bp = overdueBrandPosts[bi];
      items.push({
        title: 'Brand input pending - ' + getTitle(bp),
        assignedTo: 'Chitra',
        taskId: 'auto',
        postId: bp.id || bp.post_id || '',
        post: bp
      });
    }
  }

  // 3. Auto: Pranav deficit (Admin and Creative only)
  if (role === 'Admin' || role === 'Creative') {
    var inSystemCount = allPosts.filter(function(p) {
      return ['ready', 'awaiting_approval', 'awaiting_brand_input', 'scheduled'].includes(p.stage);
    }).length;
    var awaitingTotal = allPosts.filter(function(p) {
      return p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input';
    }).length;
    var pranavDeficitAuto = inSystemCount - 35;
    if (pranavDeficitAuto < 0 && awaitingTotal === 0 && items.length < 8) {
      if (role === 'Creative') {
        items.push({
          title: dashPad(Math.abs(pranavDeficitAuto)) + ' posts to build \u00b7 target ' + dashPad(35 - Math.abs(pranavDeficitAuto)) + ' of 35',
          assignedTo: 'Pranav',
          taskId: 'auto'
        });
      } else {
        items.push({
          title: pranavDeficitAuto + ' posts needed -- build now',
          assignedTo: 'Pranav',
          taskId: 'auto'
        });
      }
    }
  }

  return items;
}

window.renderDashboard = function() {
  if ((window.effectiveRole || '').toLowerCase() === 'client') return;
  try { _renderDashboardInner(); } catch(e) { console.error('[PCS] renderDashboard crash:', e); }
}
window._renderDashboardInner = function() {
  var el = document.getElementById('pcs-dashboard');
  if (!el) return;
  if (!window._activityLogsFetched) {
    window._activityLogsFetched = true;
    _fetchActivityLogs();
  }
  updateDashGreeting();
  renderScoreboard();
  updateDashDatetime();
  if (!window._dashDatetimeInterval) {
    window._dashDatetimeInterval = setInterval(updateDashDatetime, 60000);
  }
  _updateStreakLines();
  updateBelowFold();
}

async function _updateStreakLines() {
  try {
    var today = new Date();

    var logs = await apiFetch(
      '/activity_log?select=actor,created_at,action,new_stage,old_stage' +
      '&order=created_at.desc&limit=200'
    );
    if (!Array.isArray(logs)) return;

    logs = logs.map(function(l) {
      var a = l.actor || '';
      if (a === 'system' || a === 'Admin' ||
          a.indexOf('@') > -1) {
        l.actor = 'Shubham';
      }
      return l;
    });

    function getStreak(actor) {
      var days = {};
      logs.filter(function(l) {
        return l.actor === actor;
      }).forEach(function(l) {
        var d = (l.created_at || '').split('T')[0];
        if (d) days[d] = true;
      });
      var streak = 0;
      var check = new Date(today);
      check.setDate(check.getDate() - 1);
      while (true) {
        var ds = check.toISOString().split('T')[0];
        if (days[ds]) {
          streak++;
          check.setDate(check.getDate() - 1);
        } else { break; }
      }
      return streak;
    }

    function getIdleDays(actor) {
      var actorLogs = logs.filter(function(l) {
        return l.actor === actor;
      });
      if (!actorLogs.length) return 99;
      var last = new Date(actorLogs[0].created_at);
      return Math.floor((today - last) / (1000 * 60 * 60 * 24));
    }

    function getLastActive(actor) {
      var actorLogs = logs.filter(function(l) {
        return l.actor === actor;
      });
      if (!actorLogs.length) return '';
      var d = new Date(actorLogs[0].created_at);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
    }

    var pEl = document.getElementById('metric-pranav-streak');
    if (pEl) {
      var pStreak = getStreak('Pranav');
      var pIdle = getIdleDays('Pranav');
      if (pIdle >= 2) {
        var pLast = getLastActive('Pranav');
        pEl.innerHTML = '<span class="dms-idle">\u00b7 idle ' + pIdle + ' days \u00b7 last active ' + pLast + '</span>';
      } else if (pStreak >= 3) {
        pEl.innerHTML = '<span class="dms-on">\u00b7 ' + String(pStreak).padStart(2, '0') + ' day streak \u00b7 ' + String(pStreak) + ' posts created</span>';
      } else {
        pEl.innerHTML = '';
      }
    }

    var cEl = document.getElementById('metric-chitra-streak');
    if (cEl) {
      var chitraLogs = logs.filter(function(l) { return l.actor === 'Chitra'; });
      if (chitraLogs.length === 0) {
        cEl.innerHTML = '';
      } else {
        var cStreak = getStreak('Chitra');
        var cIdle = getIdleDays('Chitra');
        if (cIdle >= 2) {
          var cLast = getLastActive('Chitra');
          cEl.innerHTML = '<span class="dms-idle">- idle ' + cIdle + ' days - last active ' + cLast + '</span>';
        } else if (cStreak >= 3) {
          cEl.innerHTML = '<span class="dms-on">- ' + String(cStreak).padStart(2, '0') + ' day streak</span>';
        } else {
          cEl.innerHTML = '';
        }
      }
    }

    var clEl = document.getElementById('metric-client-streak');
    if (clEl) {
      var todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      var approvedToday = (window._activityLogs||[]).some(function(l) {
        return new Date(l.created_at) >= todayStart &&
          (l.new_stage === 'scheduled' ||
           l.new_stage === 'ready' ||
           l.new_stage === 'published') &&
          l.old_stage === 'awaiting_approval';
      });
      var clientLogs = logs.filter(function(l) {
        return l.actor === 'Client' ||
               l.new_stage === 'scheduled' ||
               l.old_stage === 'awaiting_approval';
      });
      if (approvedToday) {
        clEl.innerHTML = '<span class="dms-good">- approved today</span>';
      } else if (clientLogs.length) {
        var clLast = new Date(clientLogs[0].created_at);
        var clDiff = Math.floor((today - clLast) / (1000 * 60 * 60 * 24));
        var clLastStr = clLast.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
        if (clDiff === 1) {
          clEl.innerHTML = '<span class="dms-good">- approved yesterday</span>';
        } else if (clDiff >= 5) {
          clEl.innerHTML = '<span class="dms-idle">- idle ' + clDiff + ' days - last approved ' + clLastStr + '</span>';
        } else {
          clEl.innerHTML = '<span class="dms-muted">- last approved ' + clLastStr + '</span>';
        }
      } else {
        clEl.innerHTML = '';
      }
    }
  } catch (e) {
    console.warn('Streak update failed:', e);
  }
}



window.updateBelowFold = function(posts) {
  var allP = posts || allPosts || [];
  _updateNextScheduled(allP);
  _updateTodaysFocus(allP);
  _updateUnsaidThing(allP);
  _updateLastMove(allP);
}

window._updateNextScheduled = function(allP) {
  var listEl = document.getElementById('dash-next-list');
  if (!listEl) return;
  var todayStr = new Date().toISOString().slice(0, 10);
  var upcoming = allP.filter(function(p) {
    return p.stage === 'scheduled' && p.target_date && p.target_date >= todayStr;
  }).sort(function(a, b) {
    return (a.target_date || '') < (b.target_date || '') ? -1 : 1;
  });
  var show = upcoming.slice(0, 2);
  if (!show.length) {
    listEl.innerHTML = '<div style="font-family:var(--mono);font-size:8px;color:#888;">Nothing scheduled yet</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < show.length; i++) {
    var p = show[i];
    var fd = formatPipelineDate(p.target_date);
    var pid = p.id || p.post_id || '';
    var owner = p.owner || '';
    var initials = owner.length >= 2 ? owner.slice(0,2).toUpperCase() : owner.toUpperCase();
    var metaParts = [];
    if (owner) metaParts.push('<span style="color:' + _ownerColor(owner) + '">' + esc(owner.toLowerCase()) + '</span>');
    if (p.content_pillar) metaParts.push(esc(p.content_pillar.toLowerCase()));
    if (p.location) metaParts.push(esc(p.location.toLowerCase()));
    html += '<div style="display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;" onclick="openPostOverSheet(\'' + pid + '\')">';
    html += '<div style="width:3px;flex-shrink:0;background:#22D3EE;"></div>';
    html += '<div style="flex:1;padding:8px 12px;">';
    html += '<div style="font-family:var(--mono);font-size:8px;letter-spacing:0.04em;margin-bottom:3px;color:#22D3EE;">' + esc(fd.text) + '</div>';
    html += '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#e8e2d9;margin-bottom:3px;">' + esc(p.title || 'Untitled') + '</div>';
    if (metaParts.length) html += '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' + metaParts.join(' - ') + '</div>';
    html += '</div>';
    html += '<div style="padding:8px 14px 8px 8px;display:flex;align-items:center;flex-shrink:0;">';
    html += '<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:8px;letter-spacing:0.04em;color:' + _ownerColor(owner) + ';">' + esc(initials) + '</div>';
    html += '</div></div>';
  }
  listEl.innerHTML = html;
}

window._updateTodaysFocus = function(allP) {
  var rowEl = document.getElementById('dash-focus-row');
  if (!rowEl) return;
  var candidates = allP.filter(function(p) {
    return p.stage === 'awaiting_approval' ||
           p.stageLC === 'awaiting_approval';
  }).sort(function(a,b) {
    return new Date((a.status_changed_at||a.statusChangedAt||a.updated_at||'') + 'Z') -
           new Date((b.status_changed_at||b.statusChangedAt||b.updated_at||'') + 'Z');
  });
  var focus = candidates.length ? candidates : allP.filter(function(p) {
    return p.stage === 'in_production' || p.stage === 'ready';
  }).sort(function(a, b) {
    return new Date(a.updated_at || a.created_at || 0) - new Date(b.updated_at || b.created_at || 0);
  });
  if (focus.length) {
    var f = focus[0];
    var cfg = STAGE_META[f.stage] || {};
    var waitDays = _staleDays(f);
    var dateParts = [];
    if (waitDays > 0) dateParts.push('waiting ' + waitDays + 'd');
    dateParts.push((cfg.label || f.stage).toLowerCase());
    if (focus.length > 1) dateParts.push('+' + (focus.length - 1) + ' more');
    var owner = f.owner || '';
    var metaParts = [];
    if (owner) metaParts.push('<span style="color:' + _ownerColor(owner) + '">' + esc(owner.toLowerCase()) + '</span>');
    if (f.content_pillar) metaParts.push(esc(f.content_pillar.toLowerCase()));
    if (f.location) metaParts.push(esc(f.location.toLowerCase()));
    var pid = f.id || f.post_id || '';
    rowEl.innerHTML =
      '<div style="display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;" onclick="openPostOverSheet(\'' + pid + '\')">' +
      '<div style="width:3px;flex-shrink:0;background:#F6A623;"></div>' +
      '<div style="flex:1;padding:8px 12px;">' +
      '<div style="font-family:var(--mono);font-size:8px;letter-spacing:0.04em;margin-bottom:3px;color:#F6A623;">' + esc(dateParts.join(' - ')) + '</div>' +
      '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#e8e2d9;margin-bottom:3px;">' + esc(f.title || 'Untitled') + '</div>' +
      (metaParts.length ? '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' + metaParts.join(' - ') + '</div>' : '') +
      '</div>' +
      '<div style="padding:8px 14px 8px 8px;display:flex;align-items:center;flex-shrink:0;">' +
      '<span style="font-family:var(--mono);font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:#FF4B4B;background:transparent;border:none;">chase</span>' +
      '</div></div>';
  } else {
    rowEl.innerHTML =
      '<div style="padding:10px 18px 12px;font-family:var(--sans);font-size:13px;color:#888;line-height:1.5;font-style:italic;">Clear runway - nothing needs attention today</div>';
  }
}

window._updateLastMove = function(allP) {
  var textEl = document.getElementById('dash-move-text');
  if (!textEl) return;
  var moved = allP.filter(function(p) {
    return p.status_changed_at;
  }).sort(function(a, b) {
    return new Date((b.status_changed_at || '') + 'Z') - new Date((a.status_changed_at || '') + 'Z');
  });
  if (moved.length) {
    var last = moved[0];
    var cfg = STAGE_META[last.stage] || {};
    var ago = _timeAgo(last.status_changed_at);
    var actor = last.owner || '';
    var pid = last.id || last.post_id || '';
    var metaParts = [];
    if (actor) metaParts.push('<span style="color:' + _ownerColor(actor) + '">' + esc(actor.toLowerCase()) + '</span>');
    metaParts.push(esc((cfg.label || last.stage).toLowerCase()));
    var clickAttr = pid ? ' onclick="openPostOverSheet(\'' + pid + '\')"' : '';
    textEl.innerHTML =
      '<div style="display:flex;align-items:stretch;cursor:pointer;"' + clickAttr + '>' +
      '<div style="width:3px;flex-shrink:0;background:' + _ownerColor(actor) + ';"></div>' +
      '<div style="flex:1;padding:8px 12px;">' +
      '<div style="font-family:var(--mono);font-size:8px;letter-spacing:0.04em;margin-bottom:3px;color:#555;">' + esc(ago) + ' - ' + esc((cfg.label || last.stage).toLowerCase()) + '</div>' +
      '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#e8e2d9;margin-bottom:3px;">' + esc(last.title || 'Untitled') + '</div>' +
      '<div style="font-family:var(--mono);font-size:8px;color:#444;letter-spacing:0.04em;text-transform:uppercase;">' + metaParts.join(' - ') + '</div>' +
      '</div></div>';
  } else {
    textEl.innerHTML = '<div style="padding:10px 18px 12px;font-family:var(--sans);font-size:13px;color:#888;line-height:1.5;font-style:italic;">No moves yet</div>';
  }
}

window._timeAgo = function(dateStr) {
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  return days + 'd ago';
}

window._updateUnsaidThing = function(allP) {
  var el = document.getElementById('dash-unsaid-text');
  if (!el) return;
  var logs = window._activityLogs || [];

  // Priority 1: Pranav idle 3+ days
  var pranavPosts = allP.filter(function(p) {
    var o = (p.owner||'').toLowerCase();
    return o === 'pranav' || o === 'creative';
  });
  if (pranavPosts.length) {
    var lastPranav = pranavPosts.sort(function(a,b) {
      return new Date(b.updated_at||b.updatedAt||0) -
             new Date(a.updated_at||a.updatedAt||0);
    })[0];
    var pranavIdle = Math.floor(
      (Date.now() - new Date(lastPranav.updated_at||
      lastPranav.updatedAt)) / 86400000);
    if (pranavIdle >= 3) {
      el.textContent = 'Pranav has not submitted anything' +
        ' in ' + pranavIdle + ' days. The pipeline is waiting.';
      return;
    }
  }

  // Priority 2: Client not approving 3+ days
  var oldApprovals = allP.filter(function(p) {
    var s = p.stage || p.stageLC || '';
    return s === 'awaiting_approval' && isPostStale(p);
  });
  if (oldApprovals.length >= 3) {
    el.textContent = oldApprovals.length + ' posts are' +
      ' waiting on client approval for 3+ days.' +
      ' Chitra should be chasing.';
    return;
  }

  // Priority 3: Chitra has overdue posts
  var chitraOverdue = allP.filter(function(p) {
    var s = p.stage || p.stageLC || '';
    return (s === 'awaiting_approval' ||
            s === 'awaiting_brand_input') &&
           isPostStale(p);
  });
  if (chitraOverdue.length) {
    el.textContent = chitraOverdue.length +
      ' posts are waiting on client approval.' +
      ' Chitra needs to follow up.';
    return;
  }

  // Priority 4: runway low
  var runway = allP.filter(function(p) {
    var s = p.stage || p.stageLC || '';
    return s === 'scheduled';
  }).length;
  if (runway <= 3) {
    el.textContent = 'Only ' + runway +
      ' posts scheduled. The runway is thinning.';
    return;
  }

  // Priority 5: all good
  el.textContent = 'Nothing to flag today. Everyone is moving.';
}

window._updateDashTimestamp = function() {
  var el = document.getElementById('dash-updated');
  if (!el || !window._dashLastUpdated) return;
  var mins = Math.floor((Date.now() - window._dashLastUpdated) / 60000);
  el.textContent = mins === 0 ? 'Updated just now' :
                   mins === 1 ? 'Updated 1 min ago' :
                   'Updated ' + mins + ' min ago';
}

document.addEventListener('DOMContentLoaded', function() {
  setInterval(_updateDashTimestamp, 60000);
});


window.updateDashboardHeader = function() {
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var runway = 0, active = 0;
  posts.forEach(function(p) {
    var s = (p.stage || '').toLowerCase();
    if (s === 'scheduled') runway++;
    if (['published','parked','rejected','scheduled'].indexOf(s) === -1) active++;
  });
  var el;
  el = document.getElementById('dh-runway'); if (el) el.textContent = runway;
  el = document.getElementById('dh-active'); if (el) el.textContent = active;
}
