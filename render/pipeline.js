/* ===============================================
   render/pipeline.js - Pipeline tab rendering
   Extracted from 07-post-load.js (Phase 1)
=============================================== */
console.log("LOADED:", "render/pipeline.js");

// -- pipeline search/critical/bar/filter --
window._pipelineSearchOpen = false;

window.openPipelineSearch = function() {
  window._pipelineSearchOpen = true;
  var hdr = document.querySelector('.app-header');
  var bar = document.getElementById('pipeline-search-bar');
  if (hdr) hdr.classList.add('searching');
  if (bar) bar.classList.add('open');
  setTimeout(function() {
    var input = document.getElementById('pipeline-search-input');
    if (input) input.focus();
  }, 200);
}

window.closePipelineSearch = function() {
  window._pipelineSearchOpen = false;
  var hdr = document.querySelector('.app-header');
  var bar = document.getElementById('pipeline-search-bar');
  var results = document.getElementById('pipeline-search-results');
  var empty = document.getElementById('pipeline-search-empty');
  var container = document.getElementById('pipeline-container');
  var input = document.getElementById('pipeline-search-input');
  if (hdr) hdr.classList.remove('searching');
  if (bar) bar.classList.remove('open');
  if (results) { results.classList.remove('visible'); results.innerHTML = ''; }
  if (empty) empty.classList.remove('visible');
  if (container) container.classList.remove('search-dimmed');
  if (input) input.value = '';
}

// -- Pipeline critical header line --
window.updatePipelineCritical = function(posts) {
  var _critRole = (effectiveRole || '').toLowerCase();
  var _isPranavCrit = _critRole === 'creative' ||
    _critRole === 'pranav' ||
    (window.currentUserEmail||'').toLowerCase().includes('pranav');
  if (_isPranavCrit) {
    var el = document.getElementById('pipeline-critical');
    if (el) el.style.display = 'none';
    return;
  }
  var el = document.getElementById('pipeline-critical');
  if (!el) return;
  var _isClientCrit = (effectiveRole || '').toLowerCase() === 'client';
  if (_isClientCrit) { el.textContent = ''; return; }
  var allP = posts || allPosts || [];
  var now = new Date();
  var overdue = allP.filter(function(p) {
    return isPostStale(p);
  }).sort(function(a,b) {
    var ac = a.status_changed_at||a.statusChangedAt||a.updated_at||a.updatedAt||'';
    var bc = b.status_changed_at||b.statusChangedAt||b.updated_at||b.updatedAt||'';
    return new Date(ac) - new Date(bc);
  });
  if (overdue.length) {
    var oldest = overdue[0];
    var changedAt = oldest.status_changed_at||oldest.statusChangedAt||oldest.updated_at||oldest.updatedAt;
    var daysOver = changedAt ? Math.floor((Date.now() - new Date(changedAt).getTime()) / 86400000) : 0;
    el.textContent = (oldest.title||'A post') + ' ' + daysOver + 'd in stage \u00b7 sort now';
    el.style.color = 'var(--c-red)';
    return;
  }
  var approval = allP.filter(function(p) { return (p.stage||p.stageLC||'') === 'awaiting_approval'; });
  if (approval.length >= 5) {
    el.textContent = approval.length + ' posts waiting on approval \u00b7 client needs to sort';
    el.style.color = 'var(--c-amber)';
    return;
  }
  var scheduled = allP.filter(function(p) { return (p.stage||p.stageLC||'') === 'scheduled'; }).sort(function(a,b) { return new Date(a.targetDate||a.target_date) - new Date(b.targetDate||b.target_date); });
  if (scheduled.length) {
    var next = scheduled[0];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var d = new Date(next.targetDate||next.target_date);
    var diff = Math.ceil((d - now) / 86400000);
    var when = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : 'in ' + diff + 'd';
    el.textContent = (next.title||'Next post') + ' goes live ' + when + ' \u00b7 pipeline sorted';
    el.style.color = 'var(--c-green)';
    return;
  }
  el.textContent = 'Pipeline sorted \u00b7 keep going';
  el.style.color = '#555';
}

// -- Pipeline stage bar --
window.updatePipelineStageBar = function(posts) {
  var bar = document.getElementById('pipeline-stage-bar');
  if (!bar) return;
  var allP = posts || allPosts || [];
  var stageDefs = [
    { key: 'awaiting_approval', color: 'var(--c-red)' },
    { key: 'awaiting_brand_input', color: 'var(--c-purple)' },
    { key: 'in_production', color: 'var(--c-amber)' },
    { key: 'scheduled', color: 'var(--c-cyan)' },
    { key: 'ready', color: 'var(--c-green)' }
  ];
  var active = allP.filter(function(p) { return !['published','parked','rejected'].includes(p.stage||p.stageLC||''); });
  var total = active.length || 1;
  var segments = [];
  stageDefs.forEach(function(s) {
    var count = allP.filter(function(p) { return (p.stage||p.stageLC||'') === s.key; }).length;
    if (count) segments.push({ count: count, color: s.color, key: s.key });
  });
  bar.innerHTML = segments.map(function(s) {
    return '<div style="flex:' + s.count + ';background:' + s.color + ';height:3px;cursor:pointer;" onclick="filterPipelineStage(\'' + s.key + '\')"></div>';
  }).join('');
}

window.filterPipelineStage = function(stage) {
  var chip = document.querySelector('[data-stage="' + stage + '"]');
  if (chip) chip.click();
  else { var all = document.querySelector('[data-stage="all"]'); if (all) all.click(); }
};

// -- Pipeline filter apply --
window._applyPFFilter = function(posts) {
  var pf = window._PF || { stage: 'all', owner: 'all', urgency: 'all' };
  return posts.filter(function(p) {
    var stage = p.stage || p.stageLC || '';
    var owner = (p.owner || '').toLowerCase();
    if (pf.stage !== 'all' && stage !== pf.stage) return false;
    if (pf.owner !== 'all') {
      if (owner !== pf.owner) return false;
    }
    if (pf.urgency === 'overdue' && !isPostStale(p)) return false;
    if (pf.urgency === 'week') {
      var td = new Date(p.targetDate || p.target_date);
      var diff = Math.ceil((td - new Date()) / 86400000);
      if (diff < 0 || diff > 7) return false;
    }
    return true;
  });
}

// -- pipeline search results/state/collapse --
window.openSearchResult = function(postId) {
  console.log('openSearchResult fired with:', postId);
  closePipelineSearch();
  setTimeout(function() {
    openPCS(postId);
  }, 50);
}

window.handlePipelineSearch = function(query) {
  var results = document.getElementById('pipeline-search-results');
  var empty = document.getElementById('pipeline-search-empty');
  var container = document.getElementById('pipeline-container');
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];

  var pipelineStages = ['awaiting_approval','awaiting_brand_input','scheduled','ready','in_production'];
  var pipelinePosts = posts.filter(function(p) { return pipelineStages.indexOf(p.stage) > -1; });

  if (!query || query.trim() === '') {
    if (results) { results.classList.remove('visible'); results.innerHTML = ''; }
    if (empty) empty.classList.remove('visible');
    if (container) container.classList.remove('search-dimmed');
    return;
  }

  if (container) container.classList.add('search-dimmed');
  var q = query.toLowerCase().trim();

  var stageDisplayMap = {
    'awaiting_approval': 'Approval',
    'awaiting_brand_input': 'Input',
    'scheduled': 'Scheduled',
    'ready': 'Ready',
    'in_production': 'Production'
  };
  var stageColorMap = {
    'awaiting_approval': '#FF4B4B',
    'awaiting_brand_input': '#9b87f5',
    'scheduled': '#22D3EE',
    'ready': '#3ECF8E',
    'in_production': '#F6A623'
  };

  var matches = pipelinePosts.filter(function(p) {
    return (p.title && p.title.toLowerCase().indexOf(q) > -1) ||
           (p.contentPillar && p.contentPillar.toLowerCase().indexOf(q) > -1) ||
           (p.owner && p.owner.toLowerCase().indexOf(q) > -1);
  });

  if (matches.length === 0) {
    if (results) { results.classList.remove('visible'); results.innerHTML = ''; }
    if (empty) empty.classList.add('visible');
    return;
  }

  if (empty) empty.classList.remove('visible');

  var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var html = matches.map(function(p) {
    var highlighted = (p.title || '').replace(
      new RegExp('(' + escaped + ')', 'gi'),
      '<mark>$1</mark>'
    );
    var color = stageColorMap[p.stage] || '#555';
    var badgeLabel = stageDisplayMap[p.stage] || p.stage;
    var badgeClass = 'badge-' + p.stage;
    var pillar = p.contentPillar || '';
    return '<div class="pipeline-search-result-item" onclick="openSearchResult(\'' + (p.post_id || p.id) + '\')">' +
      '<div class="result-stage-dot" style="background:' + color + '"></div>' +
      '<div class="pipeline-result-body">' +
        '<div class="pipeline-result-title">' + highlighted + '</div>' +
        '<div class="pipeline-result-meta">' + pillar + '</div>' +
      '</div>' +
      '<span class="result-stage-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
    '</div>';
  }).join('');

  if (results) { results.innerHTML = html; results.classList.add('visible'); }
}

// -- Batch selection state --
window._batchMode = false;
window._batchSelected = new Set();

// -- Person filter state --
window._activePerson = null;

// -- Group collapse state (persists across re-renders) --
window._collapsedGroups = {};

window.togglePipelineGroup = function(stage) {
  window._collapsedGroups[stage] = !window._collapsedGroups[stage];
  var section = document.getElementById('group-section-' + stage);
  if (section) {
    section.classList.toggle('collapsed', !!window._collapsedGroups[stage]);
  }
}

window._pipelinePubExpanded = false;
window.togglePipelinePub = function() {
  window._pipelinePubExpanded = !window._pipelinePubExpanded;
  var group = document.getElementById('pipeline-pub-group');
  if (group) group.classList.toggle('pipeline-pub-expanded', window._pipelinePubExpanded);
}

// -- pipelineStageKey/card/chips/person/wiring --
window._pipelineStageKey = function(stage) {
  var s = stage || '';
  if (s === 'in_production') return 'production';
  if (s === 'ready') return 'ready';
  if (s === 'awaiting_brand_input') return 'input';
  if (s === 'awaiting_approval') return 'approval';
  if (s === 'scheduled') return 'scheduled';
  if (s === 'published') return 'published';
  if (s === 'parked') return 'parked';
  if (s === 'rejected') return 'rejected';
  return '';
}

window.buildPipelineCard = function(p, listKey) {
  var id = getPostId(p);
  var title = getTitle(p);
  var stage = p.stage || '';
  var stageLC = stage.toLowerCase();

  // Card type detection
  var _isBrief = (p.stage || '') === 'brief';
  var _hasComments = !_isBrief &&
    (p._commentCount || 0) > 0;
  var _commentCount = p._commentCount || 0;

  // FIX 1 -- Color bar computation
  var tdRaw = p.targetDate || p.target_date;
  var cardIsStale = isPostStale(p);
  var barColor = _isBrief ? '#C8A84B' :
    _hasComments ? '#C8A84B' :
    cardIsStale && stageLC === 'awaiting_approval'
    ? 'var(--c-red)' :
    cardIsStale ? 'var(--c-amber)' :
    stageLC === 'scheduled' ? 'var(--c-cyan)' :
    stageLC === 'awaiting_brand_input' ? 'var(--c-purple)' :
    'rgba(255,255,255,0.06)';

  // Row wash background
  var rowBg = _isBrief ? 'rgba(200,168,75,0.04)' :
    _hasComments ? 'rgba(200,168,75,0.04)' : 'transparent';

  // FIX 2 -- Date
  var dateInfo = formatPipelineDate(tdRaw);

  // FIX 4 -- Meta line: PILLAR . OWNER . LOCATION
  var pillarShort = (p.contentPillar || p.content_pillar || '').slice(0,6).toUpperCase();
  var ownerStr = p.owner || '';
  var locationStr = p.location || '';
  var metaParts = [pillarShort, ownerStr, locationStr].filter(Boolean);
  var metaLine = metaParts.join(' \xB7 ');

  // Brief cards show date/time instead of pillar/owner/location
  if (_isBrief) {
    var sentTime = '';
    if (p.status_changed_at && p.status_changed_at !== 'null') {
      var _d = new Date((p.status_changed_at || '') + 'Z');
      if (!isNaN(_d.getTime())) {
        var _date = _d.toLocaleDateString('en-IN',
          {day:'numeric',month:'short',timeZone:'Asia/Kolkata'});
        var _time = _d.toLocaleTimeString('en-IN',
          {hour:'numeric',minute:'2-digit',hour12:true,
          timeZone:'Asia/Kolkata'});
        sentTime = _date + ' \xB7 ' + _time;
      }
    }
    metaLine = 'Client request' + (sentTime ? ' \xB7 ' + sentTime : '');
  }

  // Chip HTML for brief/feedback card types
  var chipHtml = '';
  if (_isBrief) {
    chipHtml =
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.12em;text-transform:uppercase;' +
      'background:#C8A84B;color:#000;font-weight:600;' +
      'padding:4px 8px;flex-shrink:0;">BRIEF</div>';
  } else if (_hasComments) {
    chipHtml =
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:7px;' +
      'letter-spacing:0.1em;text-transform:uppercase;' +
      'background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.25);' +
      'color:#C8A84B;font-weight:600;' +
      'padding:3px 8px;flex-shrink:0;' +
      'display:flex;align-items:center;gap:4px;">' +
      '&#x1F4AC; ' + _commentCount +
      '</div>';
  }

  // Right side: chip for brief/feedback, chase/owner badge for normal
  var rightHtml = '';
  if (_isBrief || _hasComments) {
    rightHtml = chipHtml;
  } else {
    // FIX 5 -- Chase button (plain text, no border)
    var _isClientCard = (effectiveRole || '').toLowerCase() === 'client';
    if (!_isClientCard && stage === 'awaiting_approval') {
      var changed = p.status_changed_at ? new Date((p.status_changed_at || '') + 'Z') : null;
      var daysWaiting = changed ? Math.floor((new Date() - changed) / 86400000) : 0;
      if (daysWaiting >= 3) {
        var sentDate = changed ? changed.toLocaleDateString('en-GB', {day:'numeric', month:'short', timeZone:'Asia/Kolkata'}) : 'recently';
        var chaseMsg = 'Hi! Following up on ' + title + ' sent for approval on ' + sentDate + '. Please review when you get a chance';
        rightHtml = '<button onclick="event.stopPropagation();copyChase(\'' + encodeURIComponent(chaseMsg) + '\')" ' +
          'style="font-family:var(--mono);font-size:8px;letter-spacing:0.1em;text-transform:uppercase;' +
          'color:var(--c-red);background:transparent;border:none;cursor:pointer;padding:0;">' +
          'CHASE ' + daysWaiting + 'D</button>';
      }
    }
    // FIX 6 -- Owner badge on non-chase cards (colored initials)
    if (!rightHtml) {
      var ownerColors = {
        'client': 'var(--c-red)',
        'chitra': 'var(--c-cyan)',
        'pranav': 'var(--c-purple)'
      };
      var ownerKey = (p.owner || '').toLowerCase();
      var ownerColor = ownerColors[ownerKey] || '#666';
      var ownerInitial = (p.owner || '').slice(0,2).toUpperCase();
      if (ownerInitial) {
        rightHtml = '<div style="width:24px;height:24px;border-radius:50%;' +
          'background:rgba(255,255,255,0.05);font-family:var(--mono);' +
          'font-size:7px;color:' + ownerColor + ';display:flex;align-items:center;' +
          'justify-content:center;flex-shrink:0;">' + esc(ownerInitial) + '</div>';
      }
    }
  }

  // Build card content (all inline -- no CSS classes for card layout)
  var innerCard =
    '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-family:var(--mono);font-size:8px;letter-spacing:0.04em;margin-bottom:4px;color:rgba(255,255,255,0.6);">' + esc(dateInfo.text) + '</div>' +
        '<div style="font-family:var(--sans);font-size:15px;font-weight:500;color:#ccc;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(title) + '</div>' +
        (metaLine ? '<div style="font-family:var(--mono);font-size:8px;color:rgba(255,255,255,0.55);letter-spacing:0.04em;text-transform:uppercase;">' + esc(metaLine) + '</div>' : '') +
      '</div>' +
      (rightHtml ? '<div style="flex-shrink:0;">' + rightHtml + '</div>' : '') +
    '</div>';

  // FIX 1 -- Outer wrapper with 3px color bar + bottom divider
  return '<div data-post-id="' + esc(id) + '" data-list="' + esc(listKey||'pipeline') + '" data-stage="' + esc(stageLC) + '" id="upc-' + esc(id) + '" style="display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;background:' + rowBg + ';">' +
    '<div style="width:3px;flex-shrink:0;background:' + barColor + ';"></div>' +
    '<div style="flex:1;">' + innerCard + '</div>' +
  '</div>';
}

// -- Pipeline chip count updater ----------------
window.updatePipelineChipCounts = function() {
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var _chipRole = (effectiveRole || '').toLowerCase();
  var _isPranavChip = _chipRole === 'creative' ||
    _chipRole === 'pranav' ||
    (window.currentUserEmail||'').toLowerCase().includes('pranav');
  var _isChitraChip = (_chipRole === 'servicing' ||
    _chipRole === 'chitra') && !_isPranavChip;
  var chipPosts = posts.filter(function(p) {
    var s = p.stage || '';
    if (s === 'published' || s === 'parked' || s === 'rejected') return false;
    if (_isPranavChip) {
      var owner = (p.owner || '').toLowerCase();
      var isMine = owner === 'pranav';
      return (s === 'brief' || s === 'in_production' || s === 'ready') && isMine;
    }
    return true;
  });
  var stageCounts = {
    all:                  chipPosts.length,
    brief:                chipPosts.filter(function(p) { return p.stage === 'brief'; }).length,
    in_production:        chipPosts.filter(function(p) { return p.stage === 'in_production'; }).length,
    ready:                chipPosts.filter(function(p) { return p.stage === 'ready'; }).length,
    awaiting_approval:    chipPosts.filter(function(p) { return p.stage === 'awaiting_approval'; }).length,
    awaiting_brand_input: chipPosts.filter(function(p) { return p.stage === 'awaiting_brand_input'; }).length,
    scheduled:            chipPosts.filter(function(p) { return p.stage === 'scheduled'; }).length,
  };
  var chipMap = {
    all: 'all', brief: 'brief', in_production: 'in_production', ready: 'ready',
    awaiting_approval: 'awaiting_approval', awaiting_brand_input: 'awaiting_brand_input',
    scheduled: 'scheduled'
  };
  var keys = Object.keys(stageCounts);
  for (var k = 0; k < keys.length; k++) {
    var chipKey = chipMap[keys[k]] || keys[k];
    var el = document.getElementById('chip-count-' + chipKey);
    if (el) el.textContent = stageCounts[keys[k]];
  }
  // Hide chips with zero count (except ALL); also filter for Client role
  var _isClientChip = (effectiveRole || '').toLowerCase() === 'client';
  var _clientVisibleStages = ['all', 'awaiting_approval', 'awaiting_brand_input', 'published'];
  document.querySelectorAll('#stage-strip .stage-chip').forEach(function(chip) {
    var stage = chip.dataset.stage;
    if (_isClientChip && _clientVisibleStages.indexOf(stage) === -1) {
      chip.style.display = 'none';
      return;
    }
    if (stage === 'all') return;
    var count = stageCounts[stage] || 0;
    chip.style.display = count > 0 ? 'flex' : 'none';
  });
  if (_isPranavChip) {
    // Hide chips Pranav doesn't need
    ['awaiting_approval','awaiting_brand_input',
     'scheduled'].forEach(function(stage) {
      var chip = document.querySelector(
        '.stage-chip[data-stage="' + stage + '"]');
      if (chip) chip.style.display = 'none';
    });
    // Show only relevant chips
    ['brief','in_production','ready'].forEach(function(stage) {
      var chip = document.querySelector(
        '.stage-chip[data-stage="' + stage + '"]');
      if (chip) chip.style.display = '';
    });
  } else {
    // Restore all chips for non-Pranav roles
    // (existing zero-count hiding logic handles this)
    ['awaiting_approval','awaiting_brand_input',
     'scheduled','brief','in_production','ready'].forEach(
      function(stage) {
        var chip = document.querySelector(
          '.stage-chip[data-stage="' + stage + '"]');
        if (chip) chip.style.display = '';
      });
  }
  // Inject colored dots into stage chips (after counts and visibility)
  var dotColors = {
    all: '#666',
    awaiting_approval: 'var(--c-red)',
    awaiting_brand_input: 'var(--c-purple)',
    scheduled: 'var(--c-cyan)',
    ready: 'var(--c-green)',
    in_production: 'var(--c-amber)'
  };
  document.querySelectorAll('#stage-strip .stage-chip').forEach(function(chip) {
    var stage = chip.dataset.stage;
    if (!chip.querySelector('.chip-dot')) {
      var dot = document.createElement('span');
      dot.className = 'chip-dot';
      dot.style.background = dotColors[stage] || '#555';
      chip.insertBefore(dot, chip.firstChild);
    }
    var countEl = chip.querySelector('.chip-count');
    if (countEl) {
      countEl.style.color = dotColors[stage] || '#555';
    }
  });
}

// -- Person strip count updater ------------------
window.updatePersonStripCounts = function() {
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var clientCount = posts.filter(function(p) {
    return p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input';
  }).length;
  var chitraCount = posts.filter(function(p) {
    return p.stage === 'ready' || p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input';
  }).length;
  var pranavCount = posts.filter(function(p) {
    return p.stage === 'in_production';
  }).length;
  var clientEl = document.getElementById('person-num-client');
  var chitraEl = document.getElementById('person-num-chitra');
  var pranavEl = document.getElementById('person-num-pranav');
  if (clientEl) clientEl.textContent = clientCount;
  if (chitraEl) chitraEl.textContent = chitraCount;
  if (pranavEl) pranavEl.textContent = pranavCount;
}

// -- Person filter handler -----------------------
window.filterPipelineByPerson = function(person) {
  if (window._activePerson === person) {
    window._activePerson = null;
    document.querySelectorAll('.person-btn').forEach(b => b.classList.remove('active'));
  } else {
    window._activePerson = person;
    document.querySelectorAll('.person-btn').forEach(b => b.classList.remove('active'));
    var btn = document.getElementById('person-btn-' + person);
    if (btn) btn.classList.add('active');
  }
  renderPipeline();
}

// -- Pipeline stage chip click handler ----------
window.filterPipelineByChip = function(stage) {
  var strip = document.getElementById('stage-strip');
  if (!strip) return;
  var chips = strip.querySelectorAll('.stage-chip');
  chips.forEach(function(c) { c.classList.remove('active'); });
  var clicked = strip.querySelector('.stage-chip[data-stage="' + stage + '"]');
  if (clicked) clicked.classList.add('active');
  if (stage === 'all') {
    window.pcsPipelineFilter = null;
  } else {
    window.pcsPipelineFilter = [stage];
  }
  renderPipeline();
}

// Wire pipeline stage chip clicks
document.addEventListener('DOMContentLoaded', function() {
  var strip = document.getElementById('stage-strip');
  if (strip) {
    strip.addEventListener('click', function(e) {
      var chip = e.target.closest('.stage-chip');
      if (!chip) return;
      var stage = chip.dataset.stage;
      if (stage) filterPipelineByChip(stage);
    });
  }
});

// -- batch mode --
// Batch selection mode for Ready group
// ===============================================
window.toggleBatchMode = function() {
  window._batchMode = !window._batchMode;
  window._batchSelected.clear();

  var btn = document.getElementById('batch-select-btn');
  var bar = document.getElementById('batch-bar');

  if (btn) btn.classList.toggle('active', window._batchMode);
  if (bar) bar.style.display = window._batchMode ? 'flex' : 'none';

  document.querySelectorAll('[data-post-id][data-stage="ready"]').forEach(function(card) {
    if (window._batchMode) {
      card.classList.add('batch-mode');
      var cb = document.createElement('div');
      cb.className = 'batch-checkbox';
      cb.setAttribute('data-batch-cb', '1');
      card.insertBefore(cb, card.firstChild);
    } else {
      card.classList.remove('batch-mode', 'batch-selected');
      var existing = card.querySelector('[data-batch-cb]');
      if (existing) existing.remove();
    }
  });

  updateBatchCount();
}

window.toggleBatchCard = function(postId, cardEl) {
  if (!window._batchMode) return;
  if (window._batchSelected.has(postId)) {
    window._batchSelected.delete(postId);
    cardEl.classList.remove('batch-selected');
  } else {
    window._batchSelected.add(postId);
    cardEl.classList.add('batch-selected');
  }
  updateBatchCount();
}

window.updateBatchCount = function() {
  var countEl = document.getElementById('batch-count');
  if (countEl) countEl.textContent = window._batchSelected.size;
}

window.executeBatchAction = async function(targetStage) {
  if (window._batchSelected.size === 0) return;

  var ids = Array.from(window._batchSelected);
  var now = new Date().toISOString();
  var dbStage = toDbStage(targetStage);
  var actor = resolveActor();

  try {
    // PostgREST IN filter: post_id=in.(id1,id2,...)
    var inList = ids.map(function(id) { return encodeURIComponent(id); }).join(',');
    await apiFetch('/posts?post_id=in.(' + inList + ')', {
      method: 'PATCH',
      body: JSON.stringify({
        stage: dbStage,
        status_changed_at: now,
        updated_at: now,
        updated_by: actor
      }),
    });

    var notifActor = resolveActor() || 'Chitra';
    var count = ids.length;
    var stageLabel = targetStage === 'awaiting_approval'
      ? 'for approval' : 'for brand input';

    await apiFetch('/notifications', {
      method: 'POST',
      body: JSON.stringify({
        user_role: 'Admin',
        post_id: null,
        type: targetStage,
        message: notifActor + ' sent ' + count + ' posts ' + stageLabel
      })
    });

    toggleBatchMode();
    loadPosts();

  } catch (err) {
    console.error('Batch action error:', err);
    showToast('Batch update failed - try again', 'error');
  }
}

// -- renderPipeline/narrative --
window.renderPipeline = function() {
  try { _renderPipelineInner(); } catch(e) { console.error('[PCS] renderPipeline crash:', e); }
  updatePipelineCritical(allPosts);
  updatePipelineStageBar(allPosts);
  updatePipelineNarrative(allPosts);
}
window.updatePipelineHeader = function() {
  updatePipelineNarrative(allPosts);
}

window.updatePipelineNarrative = function(posts) {
  var wrapEl = document.getElementById('pipeline-narrative');
  if (!wrapEl) return;
  var el = document.getElementById('pipeline-narrative-text');
  if (!el) el = wrapEl;

  var _narrRole = (effectiveRole || '').toLowerCase();
  var _isPranavNarr = _narrRole === 'creative' ||
    _narrRole === 'pranav' ||
    (window.currentUserEmail||'').toLowerCase().includes('pranav');

  if (_isPranavNarr) {
    var narrEl = document.getElementById('pipeline-narrative-text')
      || document.getElementById('pipeline-narrative');
    if (narrEl) {
      var _myProd = (allPosts || []).filter(function(p) {
        return (p.stage === 'in_production') &&
          (p.owner || '').toLowerCase() === 'pranav';
      }).length;
      var _myBriefs = (allPosts || []).filter(function(p) {
        return (p.stage === 'brief') &&
          (p.owner || '').toLowerCase() === 'pranav';
      }).length;
      var _myReady = (allPosts || []).filter(function(p) {
        return (p.stage === 'ready') &&
          (p.owner || '').toLowerCase() === 'pranav';
      }).length;

      if (_myBriefs > 0) {
        narrEl.textContent = _myBriefs + ' brief' +
          (_myBriefs > 1 ? 's' : '') + ' waiting to start';
        narrEl.style.color = 'var(--c-gold)';
      } else if (_myProd > 0) {
        narrEl.textContent = _myProd + ' in production';
        narrEl.style.color = 'var(--c-purple)';
      } else if (_myReady > 0) {
        narrEl.textContent = _myReady + ' ready for approval';
        narrEl.style.color = 'var(--c-green)';
      } else {
        narrEl.textContent = 'All clear';
        narrEl.style.color = 'rgba(255,255,255,0.4)';
      }
    }
    return;
  }

  var allP = posts || allPosts || [];
  var now = new Date(); now.setHours(0,0,0,0);

  var stageDisplayNames = {
    'awaiting_approval':   'Approval',
    'awaiting_brand_input': 'Input',
    'in_production':       'Production',
    'ready':               'Ready',
    'scheduled':           'Scheduled'
  };

  function setText(text, color, filterStage) {
    el.textContent = text;
    el.style.color = color;
    wrapEl.dataset.filterStage = filterStage || 'all';
  }

  // PRIORITY 1: post stuck in stage 2+ days
  var stuck = allP.filter(function(p) {
    return isPostStale(p);
  }).sort(function(a,b) {
    var aChanged = a.status_changed_at || a.statusChangedAt ||
                   a.updated_at || a.updatedAt;
    var bChanged = b.status_changed_at || b.statusChangedAt ||
                   b.updated_at || b.updatedAt;
    return new Date(aChanged) - new Date(bChanged);
  });

  if (stuck.length) {
    var stuckStage = stuck[0].stage || stuck[0].stageLC;
    var stageName = stageDisplayNames[stuckStage] || 'Post';
    var changed = stuck[0].status_changed_at ||
                  stuck[0].statusChangedAt ||
                  stuck[0].updated_at || stuck[0].updatedAt;
    var daysStuck = Math.floor(
      (Date.now() - new Date(changed)) / 86400000);
    var color = daysStuck >= 4 ? 'var(--c-red)' : 'var(--c-amber)';
    setText(
      stageName + ' \u00b7 ' + daysStuck + 'd waiting',
      color,
      stuckStage
    );
    return;
  }

  // PRIORITY 2a: 5+ approvals waiting
  var approvals = allP.filter(function(p) {
    return p.stage === 'awaiting_approval' ||
           p.stageLC === 'awaiting_approval';
  });
  if (approvals.length >= 5) {
    setText(
      approvals.length + ' waiting on approval',
      'var(--c-red)',
      'awaiting_approval'
    );
    return;
  }

  // PRIORITY 2b: 1-4 approvals waiting
  if (approvals.length >= 1) {
    setText(
      'Approval \u00b7 ' + approvals.length + ' post' +
      (approvals.length === 1 ? '' : 's') + ' waiting',
      'var(--c-amber)',
      'awaiting_approval'
    );
    return;
  }

  // PRIORITY 3: input blocked
  var inputs = allP.filter(function(p) {
    return p.stage === 'awaiting_brand_input' ||
           p.stageLC === 'awaiting_brand_input';
  });
  if (inputs.length) {
    setText(
      'Input \u00b7 ' + inputs.length + ' post' +
      (inputs.length === 1 ? '' : 's') + ' waiting',
      'var(--c-purple)',
      'awaiting_brand_input'
    );
    return;
  }

  // PRIORITY 4: production posts exist
  var production = allP.filter(function(p) {
    return p.stage === 'in_production' ||
           p.stageLC === 'in_production';
  });
  if (production.length) {
    setText(
      'Production \u00b7 ' + production.length + ' in progress',
      'var(--c-amber)',
      'in_production'
    );
    return;
  }

  // PRIORITY 5: Pranav idle 3+ days
  var pranavPosts = allP.filter(function(p) {
    return (p.owner||'').toLowerCase() === 'pranav' ||
           (p.owner||'').toLowerCase() === 'creative';
  });
  if (pranavPosts.length) {
    var last = pranavPosts.sort(function(a,b) {
      return new Date(b.updated_at||b.updatedAt) -
             new Date(a.updated_at||a.updatedAt);
    })[0];
    var idle = Math.floor(
      (Date.now() - new Date(last.updated_at||last.updatedAt))
      / 86400000);
    if (idle >= 3) {
      setText(
        'Pranav idle \u00b7 ' + idle + ' days',
        'var(--c-amber)',
        'all'
      );
      return;
    }
  }

  // PRIORITY 6: scheduled posts exist
  var sched = allP.filter(function(p) {
    return p.stage === 'scheduled' || p.stageLC === 'scheduled';
  });
  if (sched.length) {
    setText(
      'Pipeline sorted \u00b7 ' + sched.length + ' scheduled',
      'var(--c-green)',
      'scheduled'
    );
    return;
  }

  // PRIORITY 7: default
  setText(
    allP.length ? 'All sorted \u00b7 nothing blocking' :
                  'Pipeline empty \u00b7 create now',
    allP.length ? '#555' : '#444',
    'all'
  );
}

window.filterFromNarrative = function() {
  var el = document.getElementById('pipeline-narrative');
  if (!el) return;
  var stage = el.dataset.filterStage || 'all';
  var chip = document.querySelector(
    '.stage-chip[data-stage="' + stage + '"]');
  if (chip) chip.click();
}


// -- _renderPipelineInner --
window._renderPipelineInner = function() {
  // Consume pressure-click filter (set by dashboard click handler)
  const activeFilter = window.pcsPipelineFilter;
  window.pcsPipelineFilter = null;

  // Pipeline only renders PIPELINE_RENDER_ORDER stages (excludes parked, rejected, published)
  var _clientStages = ['awaiting_approval', 'awaiting_brand_input',
    'scheduled', 'published', 'brief', 'brief_done'];
  var _isClient = (effectiveRole || '').toLowerCase() === 'client';
  const base = allPosts.filter(p => {
    if (_isClient && !_clientStages.includes(p.stage || '')) return false;
    return PIPELINE_RENDER_ORDER.includes(p.stage || '');
  });
  var stageFiltered = activeFilter && Array.isArray(activeFilter)
    ? base.filter(p => activeFilter.includes(p.stage || ''))
    : base;

  // -- Pipeline filter sheet --
  stageFiltered = _applyPFFilter(stageFiltered);

  // -- Person filter --
  var source = stageFiltered;
  if (window._activePerson === 'client') {
    source = stageFiltered.filter(function(p) { return p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input'; });
  } else if (window._activePerson === 'chitra') {
    source = stageFiltered.filter(function(p) { return p.stage === 'ready' || p.stage === 'awaiting_approval' || p.stage === 'awaiting_brand_input'; });
  } else if (window._activePerson === 'pranav') {
    source = stageFiltered.filter(function(p) { return p.stage === 'in_production'; });
  }

  // -- ROLE-BASED PIPELINE FILTERING --
  var _rolePL = (effectiveRole || '').toLowerCase();
  var _isPranavPL = _rolePL === 'creative' ||
    _rolePL === 'pranav' ||
    (window.currentUserEmail || '').toLowerCase().includes('pranav');
  var _isChitraPL = (_rolePL === 'servicing' || _rolePL === 'chitra') && !_isPranavPL;
  var _isAdminPL = !_isClient && !_isPranavPL && !_isChitraPL;

  if (_isPranavPL) {
    source = source.filter(function(p) {
      var stage = p.stage || '';
      var owner = (p.owner || '').toLowerCase();
      var isMine = owner === 'pranav';
      if (stage === 'brief') return isMine;
      if (stage === 'in_production') return isMine;
      if (stage === 'ready') return isMine;
      return false;
    });
  }

  if (_isChitraPL) {
    var _chitraStages = [
      'brief',
      'awaiting_approval',
      'awaiting_brand_input',
      'ready',
      'scheduled'
    ];
    source = source.filter(function(p) {
      var stage = p.stage || '';
      if (!_chitraStages.includes(stage)) return false;
      if (stage === 'brief') {
        return (p.owner || '').toLowerCase() === 'chitra';
      }
      return true;
    });
  }

  // -- PRIORITY SORT: overdue first, then soonest date --
  function prioritySort(posts) {
    var now = new Date().setHours(0,0,0,0);
    return posts.slice().sort(function(a, b) {
      var da = new Date(a.targetDate || a.target_date).setHours(0,0,0,0);
      var db = new Date(b.targetDate || b.target_date).setHours(0,0,0,0);
      var aOver = da < now; var bOver = db < now;
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      return da - db;
    });
  }

  // -- ROLE-SPECIFIC EMPTY STATES --
  const emptyMsg = {};
  if (activeFilter) {
    const key = activeFilter.sort().join(',');
    if (key.includes('in_production')) emptyMsg.default = 'Nothing in production -- create new posts';
    else if (key.includes('ready')) emptyMsg.default = 'Nothing ready -- wait or push production';
    else if (key.includes('awaiting_approval')) emptyMsg.default = 'Nothing pending -- you are clear';
  }

  const grouped = {};
  source.forEach(p => { const s = p.stage || 'Unknown'; if (!grouped[s]) grouped[s] = []; grouped[s].push(p); });
  // Pranav only sees briefs assigned to him
  if (grouped['brief']) {
    var _roleBF = (effectiveRole || '').toLowerCase();
    var _isPranavBF = _roleBF === 'creative' ||
      (window.currentUserEmail || '').toLowerCase().includes('pranav');
    if (_isPranavBF) {
      grouped['brief'] = (grouped['brief'] || []).filter(function(p) {
        return (p.owner || '').toLowerCase() === 'pranav';
      });
      if (!grouped['brief'].length) delete grouped['brief'];
    }
  }
  const stages = Object.keys(grouped).sort((a,b) => {
    const ia = PIPELINE_RENDER_ORDER.indexOf(a), ib = PIPELINE_RENDER_ORDER.indexOf(b);
    if (ia===-1 && ib===-1) return a.localeCompare(b);
    if (ia===-1) return 1; if (ib===-1) return -1;
    return ia - ib;
  });

  let isFirstCard = true;
  const html = stages.map(stage => {
    var posts;
    if (stage === 'in_production') {
      posts = (grouped[stage] || []).slice().sort(function(a, b) {
        var aIsBrief = (a.stage || '') === 'brief';
        var bIsBrief = (b.stage || '') === 'brief';
        var aHasComments = !aIsBrief && (a._commentCount||0) > 0;
        var bHasComments = !bIsBrief && (b._commentCount||0) > 0;
        var aPriority = aIsBrief ? 0 : aHasComments ? 1 : 2;
        var bPriority = bIsBrief ? 0 : bHasComments ? 1 : 2;
        if (aPriority !== bPriority) return aPriority - bPriority;
        if (aHasComments && bHasComments) {
          return (b._commentCount||0) - (a._commentCount||0);
        }
        var aTime = new Date((a.status_changed_at||'')+'Z').getTime();
        var bTime = new Date((b.status_changed_at||'')+'Z').getTime();
        return aTime - bTime;
      });
    } else {
      posts = prioritySort(grouped[stage]);
    }
    const listKey = `pipeline-${stage.toLowerCase().replace(/\s+/g,'-')}`;
    window._postLists[listKey] = posts;
    const { label } = stageStyle(stage);
    const sk = _pipelineStageKey(stage);
    const cards = posts.map((p, i) => {
      const card = buildPipelineCard(p, listKey);
      if (isFirstCard && activeFilter) {
        isFirstCard = false;
        return card.replace('data-post-id=', 'data-focus="1" data-post-id=');
      }
      return card;
    }).join('');
    var selectBtn = (stage === 'ready')
      ? '<button class="batch-select-btn" id="batch-select-btn" onclick="event.stopPropagation();toggleBatchMode()">Select</button>'
      : '';
    // Chase All button for awaiting_approval group
    var _isClientCA = (effectiveRole || '').toLowerCase() === 'client';
    var chaseAllBtn = '';
    if (!_isClientCA && stage === 'awaiting_approval') {
      var nowCA = new Date();
      var threeDaysAgoCA = new Date();
      threeDaysAgoCA.setDate(threeDaysAgoCA.getDate() - 3);
      var overdueCount = posts.filter(function(p) {
        if (!p.status_changed_at) return true;
        return new Date((p.status_changed_at || '') + 'Z') < threeDaysAgoCA;
      }).length;
      if (overdueCount >= 1) {
        chaseAllBtn = '<button class="chase-all-btn" onclick="chaseAll()" id="chase-all-btn">Chase All</button>';
      }
    }
    // Per-stage summary line
    var _isClientSum = (effectiveRole || '').toLowerCase() === 'client';
    var summaryText = '';
    var now5 = new Date();
    var stageKey = stage;
    var stagePosts = posts;
    if (_isClientSum) {
      // Client sees no summary lines
    } else if (stageKey === 'awaiting_approval') {
      var clientCount = stagePosts.filter(function(p) { return (p.owner||'').toLowerCase() === 'client'; }).length;
      var sortedByUpdate = stagePosts.slice().sort(function(a,b) { return new Date(a.updated_at||a.updatedAt) - new Date(b.updated_at||b.updatedAt); });
      var oldestPost = sortedByUpdate[0];
      var oldDays = oldestPost ? Math.floor((now5 - new Date(oldestPost.updated_at||oldestPost.updatedAt)) / 86400000) : 0;
      summaryText = stagePosts.length + ' posts waiting \u00b7 oldest ' + oldDays + 'd \u00b7 ' + clientCount + ' from client';
    } else if (stageKey === 'awaiting_brand_input') {
      summaryText = stagePosts.length + ' blocked on brief \u00b7 needs unblocking';
    } else if (stageKey === 'scheduled') {
      var schedSorted = stagePosts.slice().sort(function(a,b) { return new Date(a.targetDate||a.target_date) - new Date(b.targetDate||b.target_date); });
      var nextSched = schedSorted[0];
      var daysToNext = nextSched ? Math.ceil((new Date(nextSched.targetDate||nextSched.target_date) - now5) / 86400000) : 0;
      summaryText = 'Next goes live ' + (daysToNext <= 1 ? 'tomorrow' : 'in ' + daysToNext + 'd') + ' \u00b7 pipeline sorted ' + stagePosts.length + ' days';
    } else if (stageKey === 'in_production') {
      summaryText = stagePosts.length + ' posts in progress \u00b7 keep sorting';
    } else if (stageKey === 'ready') {
      summaryText = stagePosts.length + ' ready to schedule \u00b7 sort now';
    }
    var summaryHtml = summaryText ? '<div style="padding:5px 18px 5px 21px;font-family:var(--mono);font-size:7px;color:#333;letter-spacing:0.04em;border-bottom:1px solid var(--dotline);background:rgba(255,255,255,0.01);">' + summaryText + '</div>' : '';

    return `
      <div class="group-section" id="group-section-${esc(stage)}" data-stage="${esc(stage)}">
      <div class="group-hdr" onclick="togglePipelineGroup('${esc(stage)}')">
        <div class="group-hdr-left">
          <span class="group-chevron">&#9660;</span>
          <div class="group-label ${esc(sk)}" data-stage="${esc(sk)}">${esc(label)}</div>
        </div>
        <div class="group-hdr-right" style="display:flex;align-items:center;gap:8px">
          ${selectBtn}
          <div class="group-count">${posts.length}</div>
        </div>
      </div>
      ${summaryHtml}
      <div class="group-post-list">
        <div class="row-list post-list">
          ${cards || '<div class="pstage-empty">' + (emptyMsg.default || 'Empty') + '</div>'}
        </div>
      </div>
      </div>`;
  }).join('');

  // -- Closed Briefs collapsed group --
  var briefDonePosts = allPosts.filter(function(p) {
    return (p.stage || '') === 'brief_done';
  });
  var briefDoneCount = briefDonePosts.length;
  var briefDoneCardsHtml = '';
  if (briefDoneCount > 0) {
    var bdListKey = 'pipeline-brief-done';
    var bdSorted = briefDonePosts.slice().sort(function(a, b) {
      var dA = new Date((a.status_changed_at||'')+'Z').getTime();
      var dB = new Date((b.status_changed_at||'')+'Z').getTime();
      return dB - dA;
    });
    window._postLists[bdListKey] = bdSorted;
    briefDoneCardsHtml = bdSorted.map(function(p) {
      return buildPipelineCard(p, bdListKey);
    }).join('');
  }
  var briefDoneGroupHtml = briefDoneCount > 0 ?
    '<div class="group-section pipeline-brief-done-group" ' +
    'id="pipeline-brief-done-group">' +
    '<div class="pipeline-pub-toggle" ' +
    'onclick="this.closest(\'.pipeline-brief-done-group\')' +
    '.classList.toggle(\'pipeline-pub-expanded\')">' +
    '<span class="pipeline-pub-arrow">&#9654;</span>' +
    '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;' +
    'letter-spacing:0.18em;text-transform:uppercase;color:#C8A84B;">' +
    'CLOSED BRIEFS</span>' +
    '<span style="margin-left:auto"></span>' +
    '<span class="group-count">' + briefDoneCount + '</span>' +
    '</div>' +
    '<div class="pipeline-pub-cards"><div class="row-list post-list">' +
    briefDoneCardsHtml +
    '</div></div>' +
    '</div>' : '';

  // -- Published collapsed group --
  var pubPosts = allPosts.filter(function(p) { return (p.stage || '') === 'published'; });
  var pubCount = pubPosts.length;
  var pubCardsHtml = '';
  if (pubCount > 0) {
    var pubListKey = 'pipeline-published';
    var pubSorted = pubPosts.slice().sort(function(a, b) {
      var dA = parseDate(a.targetDate), dB = parseDate(b.targetDate);
      if (dA && dB) return dB - dA;
      if (dA) return -1; if (dB) return 1;
      return 0;
    });
    window._postLists[pubListKey] = pubSorted;
    pubCardsHtml = pubSorted.map(function(p) { return buildPipelineCard(p, pubListKey); }).join('');
  }
  var pubGroupHtml = '<div class="group-section pipeline-pub-group" id="pipeline-pub-group">' +
    '<div class="pipeline-pub-toggle" onclick="togglePipelinePub()">' +
      '<span class="pipeline-pub-arrow">&#9660;</span>' +
      '<span style="font-family:var(--mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--c-green)">PUBLISHED</span>' +
      '<span style="margin-left:auto"></span>' +
      '<span class="group-count">' + pubCount + '</span>' +
    '</div>' +
    '<div class="pipeline-pub-cards"><div class="row-list post-list">' +
      (pubCardsHtml || '<div class="pstage-empty">No published posts</div>') +
    '</div></div>' +
  '</div>';

  // Build COMMENTED section -- posts with comments across all stages
  var commentedPosts = source.filter(function(p) {
    return (p._commentCount || 0) > 0;
  });
  commentedPosts = commentedPosts.slice().sort(function(a, b) {
    return (b._commentCount||0) - (a._commentCount||0);
  });
  var commentedHtml = '';
  if (commentedPosts.length > 0) {
    var _cListKey = 'pipeline-commented';
    window._postLists[_cListKey] = commentedPosts;
    var _cCards = commentedPosts.map(function(p) {
      return buildPipelineCard(p, _cListKey);
    }).join('');
    commentedHtml =
      '<div class="group-section" id="group-section-commented">' +
      '<div class="group-hdr" onclick="togglePipelineGroup(\'commented\')">' +
      '<div class="group-hdr-left">' +
      '<span class="group-chevron">&#9660;</span>' +
      '<div class="group-label" style="color:#C8A84B;' +
      'font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
      'letter-spacing:0.16em;text-transform:uppercase;">' +
      'Commented</div>' +
      '</div>' +
      '<div class="group-hdr-right" style="display:flex;' +
      'align-items:center;gap:8px;">' +
      '<div class="group-count">' + commentedPosts.length + '</div>' +
      '</div></div>' +
      '<div style="font-size:8px;color:rgba(255,255,255,0.3);' +
      'padding:0 16px 8px;letter-spacing:0.04em;">' +
      commentedPosts.length + ' post' +
      (commentedPosts.length > 1 ? 's' : '') +
      ' with comments</div>' +
      '<div class="group-post-list">' +
      '<div class="row-list post-list">' + _cCards + '</div>' +
      '</div></div>';
  }

  const container = document.getElementById('pipeline-container');
  if (!container) return;
  container.innerHTML = html + briefDoneGroupHtml + commentedHtml + pubGroupHtml;

  // -- Restore published expanded state --
  if (window._pipelinePubExpanded) {
    var pubGroup = document.getElementById('pipeline-pub-group');
    if (pubGroup) pubGroup.classList.add('pipeline-pub-expanded');
  }

  // -- Restore collapsed state across re-renders --
  Object.keys(window._collapsedGroups).forEach(function(stage) {
    if (window._collapsedGroups[stage]) {
      var section = document.getElementById('group-section-' + stage);
      if (section) section.classList.add('collapsed');
    }
  });

  // -- Update chip counts from rendered group headers --
  updatePipelineChipCounts();
  updatePersonStripCounts();

  // -- GLOBAL EMPTY STATE (filtered view with no results) --
  if (activeFilter && stages.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">\u2713</div><p>' + (emptyMsg.default || 'Nothing here -- you are clear') + '</p></div>';
    return;
  }

  // -- AUTO-SCROLL to first focused card --
  if (activeFilter) {
    requestAnimationFrame(function() {
      var focus = container.querySelector('.pc-focus');
      if (focus) {
        focus.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

// -- DOMContentLoaded batch/search --
document.addEventListener('DOMContentLoaded', function() {
  var approvalBtn = document.getElementById('batch-approval-btn');
  if (approvalBtn) approvalBtn.addEventListener('click', function() {
    executeBatchAction('awaiting_approval');
  });
  var inputBtn = document.getElementById('batch-input-btn');
  if (inputBtn) inputBtn.addEventListener('click', function() {
    executeBatchAction('awaiting_brand_input');
  });

  document.addEventListener('click', function(e) {
    if (!window._pipelineSearchOpen) return;
    var bar = document.getElementById('pipeline-search-bar');
    var trigger = document.getElementById('pipeline-search-trigger');
    var resultsEl = document.getElementById('pipeline-search-results');
    if (bar && !bar.contains(e.target) &&
        trigger && !trigger.contains(e.target) &&
        (!resultsEl || !resultsEl.contains(e.target))) {
      closePipelineSearch();
    }
  });
});

// -- chase functions --
window.copyChase = function(encodedMsg) {
  var msg = decodeURIComponent(encodedMsg);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(function() {
      showChaseToast('Copied to clipboard');
    }).catch(function() {
      fallbackCopy(msg);
    });
  } else {
    fallbackCopy(msg);
  }
}

window.fallbackCopy = function(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    showChaseToast('Copied to clipboard');
  } catch(e) {
    showChaseToast('Copy failed');
  }
  document.body.removeChild(ta);
}

window.chaseAll = function() {
  var posts = Array.isArray(window.allPosts) ? window.allPosts : [];
  var now = new Date();
  var threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  var overduePosts = posts.filter(function(p) {
    if (p.stage !== 'awaiting_approval') return false;
    if (!p.status_changed_at) return true;
    return new Date((p.status_changed_at || '') + 'Z') < threeDaysAgo;
  });

  if (overduePosts.length === 0) return;

  var lines = overduePosts.map(function(p) {
    var sentDate = 'recently';
    if (p.status_changed_at) {
      var d = new Date((p.status_changed_at || '') + 'Z');
      sentDate = d.toLocaleDateString('en-GB', {day:'numeric', month:'short', timeZone:'Asia/Kolkata'});
    }
    return '- ' + (p.title || 'Untitled') + ' (sent ' + sentDate + ')';
  });

  var msg = 'Hi! Following up on ' + overduePosts.length + ' posts awaiting approval:\n' + lines.join('\n') + '\nPlease review when you get a chance';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(function() {
      showChaseToast(overduePosts.length + ' posts copied');
    }).catch(function() {
      fallbackCopy(msg);
    });
  } else {
    fallbackCopy(msg);
  }
}
