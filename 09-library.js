/* ===============================================
   09-library.js  -  Library tab: data + filters
   Part A: data loading, filter state, filter sheet
=============================================== */
console.log("LOADED:", "09-library.js");

// --------------- state ---------------
var _libPosts = null;
var _libLinkedIn = {};
var _libFilterWired = false;
var _libCalPopupClose = null;
var LIB_FILTER = {
  date: 'all', status: 'all', pillar: 'all',
  dateFrom: null, dateTo: null
};

// --------------- data loading ---------------
async function libLoadPosts() {
  var data = await apiFetch(
    '/posts?select=*&stage=in.(published,parked,rejected)&order=target_date.desc'
  );
  _libPosts = data || [];
  updateLibraryHeader();

  var li = await apiFetch('/linkedin_posts?select=*');
  _libLinkedIn = {};
  if (li && li.length) {
    for (var i = 0; i < li.length; i++) {
      _libLinkedIn[li[i].post_id] = li[i];
    }
  }
  console.log('[Library] linkedin_posts loaded:', li ? li.length : 0, 'rows, _libLinkedIn keys:', Object.keys(_libLinkedIn).length);

  // FIX 1: fallback to hardcoded INS_POSTS when Supabase empty
  if (Object.keys(_libLinkedIn).length === 0 && window.INS_POSTS) {
    _matchLinkedInFromHardcoded(_libPosts);
    console.log('[Library] hardcoded fallback applied, _libLinkedIn keys:', Object.keys(_libLinkedIn).length);
  }
}

function _matchLinkedInFromHardcoded(posts) {
  if (!window.INS_POSTS || !Array.isArray(window.INS_POSTS)) return;
  posts.forEach(function(post) {
    if (_libLinkedIn[post.id]) return;
    var titleLower = (post.title || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
    var words = titleLower.split(' ').filter(function(w) { return w.length > 3; });
    if (!words.length) return;
    var match = null;
    // Pass 1: any word >3 chars appears in INS_POSTS title
    match = window.INS_POSTS.find(function(ip) {
      var ipNorm = ip.title.toLowerCase().replace(/[^a-z0-9 ]/g, '');
      return words.some(function(w) { return ipNorm.indexOf(w) > -1; });
    });
    // Pass 2: first 6 chars of post title matches start of any INS_POSTS title
    if (!match && titleLower.length >= 6) {
      var prefix = titleLower.slice(0, 6);
      match = window.INS_POSTS.find(function(ip) {
        return ip.title.toLowerCase().replace(/[^a-z0-9 ]/g, '').indexOf(prefix) > -1;
      });
    }
    if (match) {
      _libLinkedIn[post.id] = {
        imp: match.imp, impressions: match.imp,
        likes: match.likes, comments: match.comments,
        reposts: match.reposts, clicks: match.clicks,
        ctr: match.ctr, eng: match.eng, follows: match.follows
      };
    }
  });
}

function updateLibraryHeader() {
  if (!_libPosts) return;
  var pub = 0, park = 0, rej = 0;
  for (var i = 0; i < _libPosts.length; i++) {
    var s = (_libPosts[i].stage || '').toLowerCase();
    if (s === 'published') pub++;
    else if (s === 'parked') park++;
    else if (s === 'rejected') rej++;
  }
  var el;
  el = document.getElementById('lh-pub'); if (el) el.textContent = pub;
  el = document.getElementById('lh-park'); if (el) el.textContent = park;
  el = document.getElementById('lh-rej'); if (el) el.textContent = rej;
}

// --------------- filter sheet wiring ---------------
function libWireFilters() {
  if (_libFilterWired) return;
  _libFilterWired = true;

  var chipGroups = [
    { sel: '.lib-fsd-chip', key: 'date' },
    { sel: '.lib-fss-chip', key: 'status' },
    { sel: '.lib-fsp-chip', key: 'pillar' }
  ];

  function getActiveClass(key, val) {
    if (key === 'status') {
      if (val === 'published') return 'active-pub';
      if (val === 'parked') return 'active-park';
      if (val === 'rejected') return 'active-rej';
      return 'active';
    }
    if (key === 'pillar') {
      var v = (val || '').toLowerCase();
      if (v === 'leadership') return 'active-lead';
      if (v === 'innovation') return 'active-innov';
      if (v === 'sustainability') return 'active-sustain';
      if (v === 'inclusivity') return 'active-incl';
      return 'active';
    }
    return 'active';
  }

  function clearActiveClasses(chip) {
    var cls = chip.className.split(' ');
    for (var i = cls.length - 1; i >= 0; i--) {
      if (cls[i].indexOf('active') === 0) {
        chip.classList.remove(cls[i]);
      }
    }
  }

  for (var g = 0; g < chipGroups.length; g++) {
    (function(group) {
      var chips = document.querySelectorAll(group.sel);
      for (var c = 0; c < chips.length; c++) {
        (function(chip) {
          var tapped = false;

          chip.addEventListener('touchend', function(e) {
            e.preventDefault();
            tapped = true;
            handleChip(chip, group);
            setTimeout(function() { tapped = false; }, 300);
          });

          chip.addEventListener('click', function() {
            if (tapped) return;
            handleChip(chip, group);
          });

          chip.style.touchAction = 'manipulation';
        })(chips[c]);
      }
    })(chipGroups[g]);
  }

  function handleChip(chip, group) {
    var val = chip.getAttribute('data-v') || 'all';
    LIB_FILTER[group.key] = val;

    var siblings = document.querySelectorAll(group.sel);
    for (var i = 0; i < siblings.length; i++) {
      clearActiveClasses(siblings[i]);
    }
    chip.classList.add(getActiveClass(group.key, val));

    // Toggle custom date row
    if (group.key === 'date') {
      var customRow = document.getElementById('lib-fs-custom-row');
      if (customRow) {
        if (val === 'custom') {
          customRow.classList.add('open');
        } else {
          customRow.classList.remove('open');
        }
      }
    }
  }

  // Reset button
  var resetBtn = document.getElementById('lib-fs-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      libResetFilters();
    });
  }

  // Apply button
  var applyBtn = document.getElementById('lib-fs-apply-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', function() {
      if (LIB_FILTER.date === 'custom') {
        var fromEl = document.getElementById('lib-date-from');
        var toEl = document.getElementById('lib-date-to');
        LIB_FILTER.dateFrom = fromEl ? fromEl.value : null;
        LIB_FILTER.dateTo = toEl ? toEl.value : null;
      }
      libApplyFilters();
      libCloseFilterSheet();
    });
  }

  // Overlay close
  var overlay = document.getElementById('lib-filter-sheet-overlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        libCloseFilterSheet();
      }
    });
  }

  // Stop propagation on sheet itself
  var sheet = document.getElementById('lib-filter-sheet');
  if (sheet) {
    sheet.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }

  // Explicit custom date row handler as backup
  var dateChips = document.querySelectorAll('.lib-fsd-chip');
  for (var dc = 0; dc < dateChips.length; dc++) {
    (function(chip) {
      chip.addEventListener('click', function() {
        var customRow = document.getElementById('lib-fs-custom-row');
        if ((chip.getAttribute('data-v') || '') === 'custom') {
          if (customRow) customRow.classList.add('open');
        } else {
          if (customRow) customRow.classList.remove('open');
        }
      });
    })(dateChips[dc]);
  }
}

// --------------- open / close filter sheet ---------------
function libOpenFilterSheet() {
  var el = document.getElementById('lib-filter-sheet-overlay');
  if (el) el.classList.add('open');
}

function libCloseFilterSheet() {
  var el = document.getElementById('lib-filter-sheet-overlay');
  if (el) el.classList.remove('open');
  libSyncChipVisuals();
}

function libSyncChipVisuals() {
  var groups = [
    { sel: '.lib-fsd-chip', key: 'date' },
    { sel: '.lib-fss-chip', key: 'status' },
    { sel: '.lib-fsp-chip', key: 'pillar' }
  ];
  for (var g = 0; g < groups.length; g++) {
    var chips = document.querySelectorAll(groups[g].sel);
    for (var c = 0; c < chips.length; c++) {
      var chip = chips[c];
      chip.className = chip.className.replace(/\bactive\S*/g, '').trim();
      if ((chip.getAttribute('data-v') || 'all') === LIB_FILTER[groups[g].key]) {
        chip.classList.add('active');
      }
    }
  }
}

// --------------- apply filters ---------------
function libApplyFilters() {
  var items = document.querySelectorAll('.lib-item');
  var allDefault = LIB_FILTER.date === 'all' &&
                   LIB_FILTER.status === 'all' &&
                   LIB_FILTER.pillar === 'all';

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var dayOfWeek = today.getDay();
  var monOffset = (dayOfWeek === 0) ? -6 : 1 - dayOfWeek;
  var weekMon = new Date(today.getTime() + monOffset * 86400000);
  var weekSun = new Date(weekMon.getTime() + 6 * 86400000);
  var lastWeekMon = new Date(weekMon.getTime() - 7 * 86400000);
  var lastWeekSun = new Date(weekMon.getTime() - 86400000);
  var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  var monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var show = true;

    // Gap items only visible when no filters
    if (item.getAttribute('data-s') === 'gap') {
      item.style.display = allDefault ? '' : 'none';
      continue;
    }

    // Date filter
    if (LIB_FILTER.date !== 'all') {
      var dateStr = item.getAttribute('data-date');
      var d = parseDate(dateStr);
      if (!d) {
        show = false;
      } else {
        var dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (LIB_FILTER.date === 'week') {
          show = dt >= weekMon && dt <= weekSun;
        } else if (LIB_FILTER.date === 'lastweek') {
          show = dt >= lastWeekMon && dt <= lastWeekSun;
        } else if (LIB_FILTER.date === 'month') {
          show = dt >= monthStart && dt <= monthEnd;
        } else if (LIB_FILTER.date === 'custom') {
          var from = LIB_FILTER.dateFrom ? parseDate(LIB_FILTER.dateFrom) : null;
          var to = LIB_FILTER.dateTo ? parseDate(LIB_FILTER.dateTo) : null;
          if (from && to) {
            show = dt >= from && dt <= to;
          } else if (from) {
            show = dt >= from;
          } else if (to) {
            show = dt <= to;
          }
        }
      }
    }

    // Status filter
    if (show && LIB_FILTER.status !== 'all') {
      var s = item.getAttribute('data-s') || '';
      if (s !== LIB_FILTER.status) show = false;
    }

    // Pillar filter
    if (show && LIB_FILTER.pillar !== 'all') {
      var p = (item.getAttribute('data-p') || '').toLowerCase();
      if (p !== LIB_FILTER.pillar.toLowerCase()) show = false;
    }

    item.style.display = show ? '' : 'none';
  }

  // Pillar bar dimming
  var pbSegs = document.querySelectorAll('.lib-pb-seg');
  if (LIB_FILTER.pillar !== 'all') {
    for (var j = 0; j < pbSegs.length; j++) {
      pbSegs[j].classList.add('lib-dimmed');
    }
    var activeSeg = document.getElementById('lib-pb-' + LIB_FILTER.pillar.toLowerCase());
    if (activeSeg) activeSeg.classList.remove('lib-dimmed');
  } else {
    for (var j = 0; j < pbSegs.length; j++) {
      pbSegs[j].classList.remove('lib-dimmed');
    }
  }

  // Filter dot
  var dot = document.getElementById('lib-filter-dot');
  var anyActive = LIB_FILTER.date !== 'all' ||
                  LIB_FILTER.status !== 'all' ||
                  LIB_FILTER.pillar !== 'all';
  if (dot) {
    if (anyActive) dot.classList.add('active');
    else dot.classList.remove('active');
  }

  // Active filter strip
  var strip = document.getElementById('lib-active-strip');
  if (strip) {
    if (anyActive) {
      strip.classList.add('has-tags');
      var tags = '';

      if (LIB_FILTER.date !== 'all') {
        var dlabel = LIB_FILTER.date;
        if (dlabel === 'week') dlabel = 'This Week';
        else if (dlabel === 'lastweek') dlabel = 'Last Week';
        else if (dlabel === 'month') dlabel = 'This Month';
        else if (dlabel === 'custom') dlabel = 'Custom';
        tags += '<div class="lib-af-tag">' + esc(dlabel) +
                ' <span onclick="LIB_FILTER.date=\'all\';libApplyFilters()">x</span></div>';
      }
      if (LIB_FILTER.status !== 'all') {
        var slabel = LIB_FILTER.status.charAt(0).toUpperCase() + LIB_FILTER.status.slice(1);
        tags += '<div class="lib-af-tag">' + esc(slabel) +
                ' <span onclick="LIB_FILTER.status=\'all\';libApplyFilters()">x</span></div>';
      }
      if (LIB_FILTER.pillar !== 'all') {
        var plabel = formatPillarDisplay(LIB_FILTER.pillar);
        tags += '<div class="lib-af-tag">' + esc(plabel) +
                ' <span onclick="LIB_FILTER.pillar=\'all\';libApplyFilters()">x</span></div>';
      }
      tags += '<div class="lib-af-tag" onclick="libResetFilters()">Clear all <span>x</span></div>';
      strip.innerHTML = tags;
    } else {
      strip.classList.remove('has-tags');
      strip.innerHTML = '';
    }
  }
}

// --------------- reset filters ---------------
function libResetFilters() {
  LIB_FILTER.date = 'all';
  LIB_FILTER.status = 'all';
  LIB_FILTER.pillar = 'all';
  LIB_FILTER.dateFrom = null;
  LIB_FILTER.dateTo = null;

  // Reset chip visuals
  var groups = ['.lib-fsd-chip', '.lib-fss-chip', '.lib-fsp-chip'];
  for (var g = 0; g < groups.length; g++) {
    var chips = document.querySelectorAll(groups[g]);
    for (var c = 0; c < chips.length; c++) {
      var cls = chips[c].className.split(' ');
      for (var k = cls.length - 1; k >= 0; k--) {
        if (cls[k].indexOf('active') === 0) {
          chips[c].classList.remove(cls[k]);
        }
      }
      if (chips[c].getAttribute('data-v') === 'all') {
        chips[c].classList.add('active');
      }
    }
  }

  libApplyFilters();
}

// ===============================================
// Part B: rendering functions
// ===============================================

// --------------- helpers ---------------
function libGetLifespan(post) {
  if (!post.created_at || !post.status_changed_at) return null;
  var a = new Date(post.created_at).getTime();
  var b = new Date(post.status_changed_at).getTime();
  return Math.round(Math.abs(b - a) / 86400000);
}

function libFormatImp(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function libFormatDMon(dateStr) {
  var d = parseDate(dateStr);
  if (!d) return '';
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var dow = days[d.getDay()];
  var dateStrOut = dow + ' \xB7 ' + d.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return dateStrOut;
}

function libLifespanArrow(days) {
  if (days <= 3) return { cls: 'lib-arr-fast', arrow: '&uarr;' };
  if (days >= 10) return { cls: 'lib-arr-slow', arrow: '&darr;' };
  return { cls: 'lib-arr-avg', arrow: '&ndash;' };
}

// --------------- pillar bar ---------------
function libRenderPillarBar() {
  var bar = document.getElementById('lib-pillar-bar');
  var labels = document.getElementById('lib-pillar-labels');
  if (!bar || !labels || !_libPosts) return;

  var counts = {};
  var total = 0;
  for (var i = 0; i < _libPosts.length; i++) {
    var pl = (_libPosts[i].content_pillar || '').toLowerCase();
    if (!pl) continue;
    counts[pl] = (counts[pl] || 0) + 1;
    total++;
  }
  if (total === 0) return;

  var barHtml = '';
  var lblHtml = '';
  var pillarOrder = ['leadership', 'innovation', 'sustainability', 'inclusivity'];
  for (var p = 0; p < pillarOrder.length; p++) {
    var pk = pillarOrder[p];
    var cnt = counts[pk] || 0;
    if (cnt === 0) continue;
    var pct = ((cnt / total) * 100).toFixed(0);
    barHtml += '<div class="lib-pb-seg lib-pb-' + pk + '" id="lib-pb-' + pk + '" style="width:' + pct + '%"></div>';
    lblHtml += '<span class="lib-pb-label lib-pl-item" data-pillar="' + pk + '" style="cursor:pointer;">' +
               '<span class="lib-pb-dot lib-pb-' + pk + '"></span>' +
               formatPillarDisplay(pk).substring(0, 4) + ' ' + pct + '%</span>';
  }

  bar.innerHTML = barHtml;
  labels.innerHTML = lblHtml;

  // FIX 3: wire pillar label clicks for filtering
  var plItems = labels.querySelectorAll('.lib-pl-item');
  for (var pi = 0; pi < plItems.length; pi++) {
    (function(item) {
      item.addEventListener('click', function() {
        var pillarName = item.getAttribute('data-pillar');
        // toggle: clicking same pillar resets to all
        if (LIB_FILTER.pillar.toLowerCase() === pillarName) {
          LIB_FILTER.pillar = 'all';
        } else {
          LIB_FILTER.pillar = pillarName.charAt(0).toUpperCase() + pillarName.slice(1);
        }
        libApplyFilters();
        // update visual state on pillar labels
        var allItems = labels.querySelectorAll('.lib-pl-item');
        for (var a = 0; a < allItems.length; a++) {
          allItems[a].style.borderBottom = '';
          allItems[a].style.color = '';
        }
        if (LIB_FILTER.pillar !== 'all') {
          item.style.borderBottom = '2px solid var(--gold, #c8a84b)';
          item.style.color = 'var(--gold, #c8a84b)';
        }
        // sync filter sheet chip
        var fspChips = document.querySelectorAll('.lib-fsp-chip');
        for (var fc = 0; fc < fspChips.length; fc++) {
          fspChips[fc].className = fspChips[fc].className.replace(/\bactive\S*/g, '').trim();
          if ((fspChips[fc].getAttribute('data-v') || 'all') === LIB_FILTER.pillar) {
            fspChips[fc].classList.add('active');
          }
        }
      });
    })(plItems[pi]);
  }
}

// --------------- list view ---------------
function libRenderList() {
  var container = document.getElementById('lib-list-content');
  if (!container || !_libPosts) return;

  // group by YYYY-MM (skip posts with no target_date)
  var months = {};
  var monthOrder = [];
  for (var i = 0; i < _libPosts.length; i++) {
    var p = _libPosts[i];
    var td = p.target_date || '';
    if (td.length < 7) continue;
    var key = td.substring(0, 7);
    if (!months[key]) { months[key] = []; monthOrder.push(key); }
    months[key].push(p);
  }

  // find best post per month (highest impressions)
  var monthBest = {};
  for (var m = 0; m < monthOrder.length; m++) {
    var mk = monthOrder[m];
    var bestImp = -1;
    var bestId = null;
    for (var j = 0; j < months[mk].length; j++) {
      var post = months[mk][j];
      var li = _libLinkedIn[post.id] || _libLinkedIn[post.post_id];
      if (li && li.impressions > bestImp) {
        bestImp = li.impressions;
        bestId = post.id || post.post_id;
      }
    }
    if (bestId) monthBest[mk] = bestId;
  }

  // find week bests
  var weekBest = {};
  for (var i = 0; i < _libPosts.length; i++) {
    var p = _libPosts[i];
    var td = parseDate(p.target_date);
    if (!td) continue;
    var dow = td.getDay();
    var monOff = (dow === 0) ? -6 : 1 - dow;
    var wk = new Date(td.getTime() + monOff * 86400000);
    var wkKey = wk.getFullYear() + '-' + String(wk.getMonth() + 1).padStart(2, '0') + '-' + String(wk.getDate()).padStart(2, '0');
    var li = _libLinkedIn[p.id] || _libLinkedIn[p.post_id];
    var imp = (li && li.impressions) ? li.impressions : 0;
    if (!weekBest[wkKey] || imp > weekBest[wkKey].imp) {
      weekBest[wkKey] = { id: p.id || p.post_id, imp: imp };
    }
  }

  var html = '';
  var prevMonthPosts = null;
  var prevMonthDays = null;

  for (var m = 0; m < monthOrder.length; m++) {
    var mk = monthOrder[m];
    var posts = months[mk];

    // counts
    var pubCnt = 0, parkCnt = 0, rejCnt = 0;
    var lifespanSum = 0, lifespanCnt = 0;
    for (var j = 0; j < posts.length; j++) {
      var st = (posts[j].stage || '').toLowerCase();
      if (st === 'published') pubCnt++;
      else if (st === 'parked') parkCnt++;
      else if (st === 'rejected') rejCnt++;
      if (st === 'published') {
        var ls = libGetLifespan(posts[j]);
        if (ls !== null) { lifespanSum += ls; lifespanCnt++; }
      }
    }
    var avgLife = lifespanCnt > 0 ? Math.round(lifespanSum / lifespanCnt) : null;

    // month header
    var parts = mk.split('-');
    var monthLabel = MONTHS[parseInt(parts[1], 10) - 1] + ' ' + parts[0];

    html += '<div class="lib-month-hdr" data-month="' + esc(mk) + '">';
    html += '<span class="lib-mh-arrow">v</span>';
    html += '<span class="lib-mh-title">' + esc(monthLabel) + '</span>';
    html += '<div class="lib-mh-counts">';
    if (pubCnt > 0) html += '<span class="lib-mh-dot lib-mh-dot-pub">' + pubCnt + '</span>';
    if (parkCnt > 0) html += '<span class="lib-mh-dot lib-mh-dot-park">' + parkCnt + '</span>';
    if (rejCnt > 0) html += '<span class="lib-mh-dot lib-mh-dot-rej">' + rejCnt + '</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="lib-month-content">';

    // pace line vs prior month
    if (m > 0 && prevMonthPosts !== null && prevMonthDays) {
      var curDays = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
      var curRate = posts.length / curDays;
      var prevRate = prevMonthPosts / prevMonthDays;
      var paceDir = curRate >= prevRate ? 'up' : 'down';
      html += '<div class="lib-pace-line">';
      html += '<div class="lib-pace-bar"></div>';
      html += '<span class="lib-pace-txt">Pace ' + paceDir + ' vs prior month (' +
              curRate.toFixed(1) + '/d vs ' + prevRate.toFixed(1) + '/d)</span>';
      html += '<div class="lib-pace-bar"></div>';
      html += '</div>';
    }

    for (var j = 0; j < posts.length; j++) {
      var post = posts[j];
      var pid = post.id || post.post_id;
      var stage = (post.stage || '').toLowerCase();
      var li = _libLinkedIn[post.id] || _libLinkedIn[post.post_id];
      var isBest = monthBest[mk] === pid;
      var isWeekBest = false;
      // check week best
      var tdParsed = parseDate(post.target_date);
      if (tdParsed) {
        var dow = tdParsed.getDay();
        var monOff2 = (dow === 0) ? -6 : 1 - dow;
        var wk2 = new Date(tdParsed.getTime() + monOff2 * 86400000);
        var wkKey2 = wk2.getFullYear() + '-' + String(wk2.getMonth() + 1).padStart(2, '0') + '-' + String(wk2.getDate()).padStart(2, '0');
        if (weekBest[wkKey2] && weekBest[wkKey2].id === pid && !isBest) isWeekBest = true;
      }
      var barClass = 'lib-bar';
      if (isBest) barClass += ' lib-bar-best';
      else if (stage === 'published') barClass += ' lib-bar-pub';
      else if (stage === 'parked') barClass += ' lib-bar-park';
      else if (stage === 'rejected') barClass += ' lib-bar-rej';

      var lifespan = libGetLifespan(post);

      html += '<div class="lib-post-row lib-item" data-s="' + esc(stage) +
              '" data-p="' + esc(post.content_pillar || '') +
              '" data-date="' + esc(post.target_date || '') +
              '" data-title="' + esc(post.title || '') +
              '" onclick="libOpenCard(\'' + esc(pid) + '\')">';
      html += '<div class="' + barClass + '"></div>';
      html += '<div class="lib-post-body">';

      // FIX 2: date above title in D MMM format
      html += '<div class="lib-p-date">' + esc(libFormatDMon(post.target_date)) + '</div>';

      // FIX 6: star on best post
      html += '<div class="lib-p-title">' + esc(post.title || 'Untitled');
      if (isBest) html += ' <span class="lib-star-best">&#9733;</span>';
      else if (isWeekBest) html += ' <span class="lib-star-week">&#9733;</span>';
      html += '</div>';

      // FIX 3: meta line with pillar, owner, lifespan badge, Wed marker
      html += '<div class="lib-p-meta">';
      html += esc(formatPillarDisplay(post.content_pillar));
      if (post.owner) html += ' &middot; ' + esc(post.owner);
      if (lifespan !== null) {
        var arrInfo = libLifespanArrow(lifespan);
        html += ' <span class="lib-life-badge ' + arrInfo.cls + '">' + lifespan + 'd ' + arrInfo.arrow + '</span>';
      }
      html += '</div>';

      // FIX 5: reason block inside row for parked/rejected
      if ((stage === 'parked' || stage === 'rejected') && post.comments) {
        var reasonCls = stage === 'parked' ? 'lib-reason-park' : 'lib-reason-rej';
        html += '<div class="lib-p-reason ' + reasonCls + '">' + esc(post.comments) + '</div>';
      }

      html += '</div>'; // close lib-post-body

      // FIX 4: right side impressions with all states
      html += '<div class="lib-p-right">';
      if (stage === 'published') {
        if (li && li.impressions) {
          var impClass = isBest ? 'lib-imp-best' : 'lib-imp-normal';
          html += '<div class="lib-p-imp ' + impClass + '">' + libFormatImp(li.impressions) + '</div>';
          html += '<div class="lib-p-imp-lbl">impressions</div>';
        } else {
          html += '<div class="lib-p-imp lib-imp-nodata">-</div>';
          html += '<div class="lib-p-imp-lbl">no data</div>';
        }
      } else if (stage === 'parked') {
        html += '<div class="lib-p-imp lib-imp-park">Parked</div>';
        if (post.status_changed_at) {
          var parkedDays = Math.round(Math.abs(new Date().getTime() - new Date(post.status_changed_at).getTime()) / 86400000);
          html += '<div class="lib-p-imp-lbl">' + parkedDays + 'd parked</div>';
        }
      } else if (stage === 'rejected') {
        html += '<div class="lib-p-imp lib-imp-rej">Rejected</div>';
      }
      html += '</div>';

      html += '</div>'; // close lib-post-row

      // gap alert between posts
      if (j < posts.length - 1) {
        var d1 = parseDate(post.target_date);
        var d2 = parseDate(posts[j + 1].target_date);
        if (d1 && d2) {
          var gap = Math.round(Math.abs(d1.getTime() - d2.getTime()) / 86400000);
          if (gap >= 5) {
            html += '<div class="lib-item lib-gap-alert" data-s="gap">' + gap + '-day gap</div>';
          }
        }
      }
    }

    html += '</div>';

    // track for pace comparison
    prevMonthPosts = posts.length;
    prevMonthDays = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
  }

  container.innerHTML = html;

  // wire month header collapse
  var hdrs = container.querySelectorAll('.lib-month-hdr');
  for (var h = 0; h < hdrs.length; h++) {
    (function(hdr) {
      hdr.addEventListener('click', function() {
        var content = hdr.nextElementSibling;
        if (content && content.classList.contains('lib-month-content')) {
          content.classList.toggle('collapsed');
        }
        var arrow = hdr.querySelector('.lib-mh-arrow');
        if (arrow) arrow.classList.toggle('collapsed');
      });
    })(hdrs[h]);
  }
}

// --------------- calendar view ---------------
function libRenderCalendar() {
  var wrap = document.getElementById('lib-cal-wrap');
  if (!wrap || !_libPosts) return;

  var now = new Date();
  var curMonth = { y: now.getFullYear(), m: now.getMonth() };
  var prevMonth = { y: curMonth.m === 0 ? curMonth.y - 1 : curMonth.y, m: curMonth.m === 0 ? 11 : curMonth.m - 1 };
  var displayMonths = [curMonth, prevMonth];

  // build post map by date
  var postsByDate = {};
  for (var i = 0; i < _libPosts.length; i++) {
    var p = _libPosts[i];
    var td = p.target_date || '';
    if (!td) continue;
    if (!postsByDate[td]) postsByDate[td] = [];
    postsByDate[td].push(p);
  }

  // best post per display month
  var bestByMonth = {};
  for (var dm = 0; dm < displayMonths.length; dm++) {
    var dmo = displayMonths[dm];
    var prefix = dmo.y + '-' + String(dmo.m + 1).padStart(2, '0');
    var bestImp = -1;
    var bestDate = null;
    for (var dateKey in postsByDate) {
      if (dateKey.substring(0, 7) !== prefix) continue;
      var dayPosts = postsByDate[dateKey];
      for (var j = 0; j < dayPosts.length; j++) {
        var li = _libLinkedIn[dayPosts[j].id] || _libLinkedIn[dayPosts[j].post_id];
        if (li && li.impressions > bestImp) {
          bestImp = li.impressions;
          bestDate = dateKey;
        }
      }
    }
    bestByMonth[prefix] = bestDate;
  }

  var html = '';

  for (var dm = 0; dm < displayMonths.length; dm++) {
    var dmo = displayMonths[dm];
    var prefix = dmo.y + '-' + String(dmo.m + 1).padStart(2, '0');
    var daysInMonth = new Date(dmo.y, dmo.m + 1, 0).getDate();
    var firstDay = new Date(dmo.y, dmo.m, 1).getDay();

    // counts
    var pubC = 0, parkC = 0, rejC = 0;
    for (var dateKey in postsByDate) {
      if (dateKey.substring(0, 7) !== prefix) continue;
      for (var j = 0; j < postsByDate[dateKey].length; j++) {
        var st = (postsByDate[dateKey][j].stage || '').toLowerCase();
        if (st === 'published') pubC++;
        else if (st === 'parked') parkC++;
        else if (st === 'rejected') rejC++;
      }
    }

    html += '<div class="lib-cal-month-blk">';
    html += '<div class="lib-cal-month-hdr">';
    html += '<span>' + MONTHS[dmo.m] + ' ' + dmo.y + '</span>';
    html += '<span class="lib-cal-hdr-counts">';
    html += '<span class="lib-cal-cnt-pub">' + pubC + '</span> ';
    html += '<span class="lib-cal-cnt-park">' + parkC + '</span> ';
    html += '<span class="lib-cal-cnt-rej">' + rejC + '</span>';
    html += '</span></div>';

    html += '<div class="lib-cal-grid">';
    var dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (var dl = 0; dl < 7; dl++) {
      html += '<div class="lib-cal-dlbl">' + dayLabels[dl] + '</div>';
    }

    // offset cells
    for (var o = 0; o < firstDay; o++) {
      html += '<div class="lib-cal-cell lib-empty"></div>';
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = dmo.y + '-' + String(dmo.m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var dayPosts = postsByDate[dateStr] || [];
      var cellClass = 'lib-cal-cell';

      if (dayPosts.length > 0) {
        cellClass += ' lib-has-post';
        // determine color class
        var isBestDay = bestByMonth[prefix] === dateStr;
        var hasRej = false, hasPark = false, pubCount = 0;
        for (var dp = 0; dp < dayPosts.length; dp++) {
          var ds = (dayPosts[dp].stage || '').toLowerCase();
          if (ds === 'rejected') hasRej = true;
          if (ds === 'parked') hasPark = true;
          if (ds === 'published') pubCount++;
        }
        if (isBestDay) cellClass += ' lib-c-best';
        else if (hasRej) cellClass += ' lib-c-rej';
        else if (hasPark) cellClass += ' lib-c-park';
        else if (pubCount >= 2) cellClass += ' lib-c-pub2';
        else if (pubCount >= 1) cellClass += ' lib-c-pub1';
      }

      html += '<div class="' + cellClass + '" data-cal-date="' + dateStr + '">';
      html += '<div class="lib-cal-inner">';
      html += '<div class="lib-cal-num">' + day + '</div>';
      if (dayPosts.length > 0) {
        html += '<div class="lib-cal-dots">';
        for (var dp = 0; dp < dayPosts.length; dp++) {
          var ds = (dayPosts[dp].stage || '').toLowerCase();
          var pid = dayPosts[dp].id || dayPosts[dp].post_id;
          var isBestPost = bestByMonth[prefix] === dateStr &&
                           (_libLinkedIn[dayPosts[dp].id] || _libLinkedIn[dayPosts[dp].post_id]);
          var dotCls = 'lib-cal-dot';
          if (isBestPost && (_libLinkedIn[dayPosts[dp].id] || _libLinkedIn[dayPosts[dp].post_id])) {
            var liCheck = _libLinkedIn[dayPosts[dp].id] || _libLinkedIn[dayPosts[dp].post_id];
            var bestCheck = true;
            for (var bc = 0; bc < dayPosts.length; bc++) {
              var liOther = _libLinkedIn[dayPosts[bc].id] || _libLinkedIn[dayPosts[bc].post_id];
              if (liOther && liOther.impressions > liCheck.impressions) { bestCheck = false; break; }
            }
            if (bestCheck) dotCls += ' lib-dot-best';
            else if (ds === 'published') dotCls += ' lib-dot-pub';
          } else if (ds === 'published') dotCls += ' lib-dot-pub';
          else if (ds === 'parked') dotCls += ' lib-dot-park';
          else if (ds === 'rejected') dotCls += ' lib-dot-rej';
          html += '<div class="' + dotCls + '"></div>';
        }
        html += '</div>';
      }
      html += '</div></div>';
    }

    html += '</div></div>';
  }

  // pillar distribution
  html += '<div class="lib-cal-pillar-wrap">';
  var pillarCounts = {};
  var totalPosts = 0;
  for (var i = 0; i < _libPosts.length; i++) {
    var pl = (_libPosts[i].content_pillar || 'other').toLowerCase();
    pillarCounts[pl] = (pillarCounts[pl] || 0) + 1;
    totalPosts++;
  }
  if (totalPosts > 0) {
    html += '<div class="lib-cal-pillar-bar">';
    for (var pk in pillarCounts) {
      var pct = ((pillarCounts[pk] / totalPosts) * 100).toFixed(1);
      html += '<div class="lib-cal-pillar-seg lib-cal-ps-' + esc(pk) + '" style="width:' + pct + '%"></div>';
    }
    html += '</div>';
    html += '<div class="lib-cal-pillar-legend">';
    for (var pk in pillarCounts) {
      var pct = ((pillarCounts[pk] / totalPosts) * 100).toFixed(1);
      html += '<span class="lib-cal-pl-item"><span class="lib-cal-pl-dot lib-cal-ps-' + esc(pk) + '"></span>' +
              esc(formatPillarDisplay(pk)) + ' ' + pct + '%</span>';
    }
    html += '</div>';
  }
  html += '</div>';

  wrap.innerHTML = html;

  // wire click on cells with posts
  var cells = wrap.querySelectorAll('.lib-has-post');
  for (var c = 0; c < cells.length; c++) {
    (function(cell) {
      cell.addEventListener('click', function(e) {
        e.stopPropagation();
        var dateStr = cell.getAttribute('data-cal-date');
        var dayPosts = postsByDate[dateStr] || [];
        if (!dayPosts.length) return;

        var popup = document.getElementById('lib-cal-popup');
        if (!popup) {
          popup = document.createElement('div');
          popup.id = 'lib-cal-popup';
          document.body.appendChild(popup);
        }

        var ph = '<div class="lib-cal-popup-inner">';
        ph += '<div class="lib-cal-popup-hdr">' + esc(formatDateShort(dateStr)) + '</div>';
        for (var pp = 0; pp < dayPosts.length; pp++) {
          var post = dayPosts[pp];
          var pid = post.id || post.post_id;
          var pStage = (post.stage || '').toLowerCase();
          var statusColor = pStage === 'published' ? 'var(--c-green)' : pStage === 'parked' ? 'var(--c-amber)' : 'var(--c-red)';
          ph += '<div style="display:flex;align-items:stretch;cursor:pointer;margin-bottom:4px;" onclick="libOpenCard(\'' + esc(pid) + '\')">';
          ph += '<div style="width:4px;flex-shrink:0;background:' + statusColor + ';"></div>';
          ph += '<div style="padding:8px 12px;flex:1;font-size:13px;color:#e8e2d9;">' + esc(post.title || 'Untitled') + '</div>';
          ph += '</div>';
        }
        ph += '</div>';
        popup.innerHTML = ph;
        popup.classList.add('open');

        if (popup.parentNode !== document.body) document.body.appendChild(popup);
        popup.style.position = 'fixed';
        popup.style.bottom = '10px';
        popup.style.left = '50%';
        popup.style.transform = 'translateX(-50%)';
        popup.style.width = 'calc(100% - 36px)';
        popup.style.maxWidth = '420px';
        popup.style.zIndex = '1050';
        popup.style.background = '#141414';
        popup.style.border = '1px solid rgba(255,255,255,0.1)';
        popup.style.padding = '14px';
        popup.style.top = '';

        if (_libCalPopupClose) document.removeEventListener('click', _libCalPopupClose);
        _libCalPopupClose = function(ev) {
          if (!popup.contains(ev.target) && ev.target !== cell) {
            popup.classList.remove('open');
            document.removeEventListener('click', _libCalPopupClose);
            _libCalPopupClose = null;
          }
        };
        setTimeout(function() {
          document.addEventListener('click', _libCalPopupClose);
        }, 0);
      });
    })(cells[c]);
  }
}

// --------------- board view ---------------
function libRenderBoard() {
  var container = document.getElementById('lib-board-cols');
  if (!container || !_libPosts) return;

  var cols = [
    { key: 'published', label: 'Published', color: '#22c55e' },
    { key: 'parked', label: 'Parked', color: '#f59e0b' },
    { key: 'rejected', label: 'Rejected', color: '#ef4444' }
  ];

  // find best post overall
  var bestId = null;
  var bestImp = -1;
  for (var i = 0; i < _libPosts.length; i++) {
    var li = _libLinkedIn[_libPosts[i].id] || _libLinkedIn[_libPosts[i].post_id];
    if (li && li.impressions > bestImp) {
      bestImp = li.impressions;
      bestId = _libPosts[i].id || _libPosts[i].post_id;
    }
  }

  var html = '';
  for (var c = 0; c < cols.length; c++) {
    var col = cols[c];
    html += '<div class="lib-board-col">';
    html += '<div class="lib-board-col-hdr" style="border-color:' + col.color + '">';
    html += '<span style="color:' + col.color + '">' + esc(col.label) + '</span>';

    var cnt = 0;
    for (var i = 0; i < _libPosts.length; i++) {
      if ((_libPosts[i].stage || '').toLowerCase() === col.key) cnt++;
    }
    html += '<span class="lib-board-cnt">' + cnt + '</span>';
    html += '</div>';

    for (var i = 0; i < _libPosts.length; i++) {
      var post = _libPosts[i];
      if ((post.stage || '').toLowerCase() !== col.key) continue;
      var pid = post.id || post.post_id;
      var li = _libLinkedIn[post.id] || _libLinkedIn[post.post_id];
      var isBest = pid === bestId;
      var lifespan = libGetLifespan(post);

      html += '<div class="lib-bp-row lib-item" data-s="' + esc(col.key) +
              '" data-p="' + esc(post.content_pillar || '') +
              '" data-date="' + esc(post.target_date || '') +
              '" data-title="' + esc(post.title || '') +
              '" onclick="libOpenCard(\'' + esc(pid) + '\')">';

      html += '<div class="lib-bp-bar lib-bp-bar-' + col.key + '"></div>';
      html += '<div class="lib-bp-body">';
      var _bd = parseDate(post.target_date);
      var _bdStr = '';
      if (_bd) {
        var _bdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        var _bmons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        _bdStr = _bdays[_bd.getDay()] + ' ' + _bd.getDate() + ' ' + _bmons[_bd.getMonth()];
      }
      html += '<div class="lib-bp-date">' + esc(_bdStr) + '</div>';
      html += '<div class="lib-bp-title">' + esc(post.title || 'Untitled');
      if (isBest) html += ' &#9733;';
      html += '</div>';
      html += '<div class="lib-bp-meta">' + esc(formatPillarDisplay(post.content_pillar));
      if (lifespan !== null) html += ' &middot; ' + lifespan + 'd';
      html += '</div>';

      if (col.key === 'published') {
        if (li && li.impressions) {
          html += '<div class="lib-bp-stats">';
          html += '<span>' + libFormatImp(li.impressions) + ' imp</span>';
          if (li.engagement) html += '<span>' + li.engagement + '% eng</span>';
          html += '</div>';
        } else {
          html += '<div class="lib-bp-nd">No data</div>';
        }
      } else if (col.key === 'parked') {
        if (post.comments) {
          html += '<div class="lib-bp-reason lib-bp-reason-park">' + esc(post.comments) + '</div>';
        }
      } else if (col.key === 'rejected') {
        if (post.comments) {
          html += '<div class="lib-bp-reason lib-bp-reason-rej">' + esc(post.comments) + '</div>';
        }
      }

      html += '</div></div>';
    }

    if (cnt === 0) {
      var emptyLabel = col.key === 'rejected' ? 'No rejected posts' : col.key === 'parked' ? 'No parked posts' : 'No published posts';
      html += '<div style="padding:18px 12px;font-family:var(--mono);font-size:11px;color:var(--c-text3,#555);text-align:center">' + emptyLabel + '</div>';
    }

    html += '</div>';
  }

  container.innerHTML = html;
}

// --------------- view switcher ---------------
function libSetView(view, btn) {
  var tabs = document.querySelectorAll('.lib-vt');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
  }
  if (btn) btn.classList.add('active');

  var bodies = document.querySelectorAll('.lib-tab-body');
  for (var i = 0; i < bodies.length; i++) {
    bodies[i].classList.add('lib-hidden');
  }
  var target = document.getElementById('lib-tab-' + view);
  if (target) target.classList.remove('lib-hidden');

  if (view === 'calendar') libRenderCalendar();
  if (view === 'board') libRenderBoard();
}

// --------------- open post card (bridges to pipeline PCS) ---------------
function libOpenPostCard(postId) {
  var libOverlay = document.getElementById('lib-card-overlay');
  if (libOverlay) libOverlay.style.display = 'none';
  var calPopup = document.getElementById('lib-cal-popup');
  if (calPopup) calPopup.style.display = 'none';

  var post = _libPosts.find(function(p) { return p.id === postId; });
  if (!post) return;

  var normalised = typeof normalise === 'function' ? normalise(post) : post;
  if (!normalised.id) normalised.id = post.id;
  if (!normalised.postId) normalised.postId = post.id;
  if (!normalised.post_id) normalised.post_id = post.id;

  if (typeof allPosts !== 'undefined' && Array.isArray(allPosts)) {
    var existingIdx = allPosts.findIndex(function(p) {
      return p.id === postId || p.postId === postId || p.post_id === postId;
    });
    if (existingIdx >= 0) {
      allPosts[existingIdx].post_id = postId;
      allPosts[existingIdx].id = postId;
      allPosts[existingIdx].postId = postId;
    } else {
      allPosts.push(normalised);
    }
  }

  var overlay = document.getElementById('pcs-overlay');
  var screen = document.getElementById('pcs-screen');
  if (!overlay || !screen) return;

  try {
    screen.style.cssText = '';
    screen.style.pointerEvents = '';
    overlay.style.display = 'flex';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '1200';
    overlay.style.pointerEvents = 'auto';
    document.body.style.overflow = 'hidden';
    window._modalOpen = true;

    _renderPCS(postId);

    overlay.offsetHeight;
    overlay.classList.add('open');
  } catch(e) {
    console.error('[PCS] failed:', e);
    overlay.style.display = 'none';
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    window._modalOpen = false;
  }
}
window.libOpenPostCard = libOpenPostCard;

// --------------- post card overlay ---------------
function libOpenCard(postId) {
  // FIX 2: dismiss calendar popup before opening card
  var calPopup = document.getElementById('lib-cal-popup');
  if (calPopup) calPopup.style.display = 'none';

  console.log('libOpenCard called', postId);
  var post = null;
  for (var i = 0; i < _libPosts.length; i++) {
    if (_libPosts[i].id === postId || _libPosts[i].post_id === postId) {
      post = _libPosts[i];
      break;
    }
  }
  if (!post) return;

  var li = _libLinkedIn[postId] || null;
  var stage = (post.stage || '').toLowerCase();
  var lifespan = libGetLifespan(post);

  var overlay = document.getElementById('lib-card-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'lib-card-overlay';
    overlay.className = 'ins-card-overlay';
    document.body.appendChild(overlay);
  }
  // FIX 3: always set cssText so overlay anchors to bottom
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1100;display:flex;align-items:flex-end;justify-content:center;';

  var h = '';
  h += '<div class="lib-card-inner" style="width:100%;max-width:480px;max-height:88vh;overflow-y:auto;background:#141414;border-top:1px solid rgba(255,255,255,0.1);padding-bottom:30px;">';
  h += '<div class="pc-handle"></div>';
  h += '<div class="pc-hdr">';
  h += '<div class="pc-hdr-date">' + esc(displayDate(post.target_date)) + '</div>';
  h += '<div class="pc-hdr-title">' + esc(post.title || 'Untitled') + '</div>';
  h += '<button class="pc-close-btn" id="lib-card-close">x</button>';
  h += '</div>';
  h += '<div class="pc-body">';

  if (stage === 'published' && li && li.impressions) {
    h += '<div class="pc-hero">';
    h += '<span class="pc-hero-imp">' + libFormatImp(li.impressions) + '</span>';
    h += '<span class="pc-hero-label" style="color:var(--c-text3,#555)">impressions</span>';
    h += '</div>';
    h += '<div class="pc-metrics">';
    if (li.likes !== undefined) h += '<div class="pc-metric pc-m-likes"><span class="pc-m-val">' + li.likes + '</span><span class="pc-m-lbl" style="color:var(--c-text3,#555)">likes</span></div>';
    if (li.comments !== undefined) h += '<div class="pc-metric pc-m-comments"><span class="pc-m-val">' + li.comments + '</span><span class="pc-m-lbl" style="color:var(--c-text3,#555)">comments</span></div>';
    if (li.engagement !== undefined) h += '<div class="pc-metric pc-m-eng"><span class="pc-m-val">' + li.engagement + '%</span><span class="pc-m-lbl" style="color:var(--c-text3,#555)">engagement</span></div>';
    h += '</div>';
    if (lifespan !== null) {
      h += '<div class="pc-life">';
      h += '<span class="pc-life-days">' + lifespan + ' days</span>';
      h += '<div class="pc-life-bar"><div class="pc-life-fill" style="width:' + Math.min(lifespan * 5, 100) + '%"></div></div>';
      h += '</div>';
    }
  } else if (stage === 'published') {
    h += '<div class="pc-nodata">No LinkedIn data available</div>';
    if (lifespan !== null) {
      h += '<div class="pc-life"><span class="pc-life-days">' + lifespan + ' days lifespan</span></div>';
    }
  } else if (stage === 'parked' || stage === 'rejected') {
    h += '<div class="pc-reason-block pc-reason-' + stage + '">';
    h += '<div class="pc-reason-label">' + (stage === 'parked' ? 'Parked' : 'Rejected') + '</div>';
    if (post.comments) h += '<div class="pc-reason-text">' + esc(post.comments) + '</div>';
    h += '</div>';
  }

  h += '</div>';
  // FIX 1: single "Open Post Card" button, no LinkedIn URL field
  h += '<div style="padding:14px 18px;">';
  h += '<button onclick="libOpenPostCard(\'' + esc(postId) + '\')" style="font-family:var(--mono);font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:var(--c-text3);background:transparent;border:1px solid var(--dotline);padding:10px 14px;cursor:pointer;width:100%;">';
  h += 'Open Post Card';
  h += '</button>';
  h += '</div>';
  h += '</div>';

  overlay.innerHTML = h;
  overlay.classList.add('open');

  var closeBtn = document.getElementById('lib-card-close');
  if (closeBtn) {
    closeBtn.onclick = function() {
      overlay.classList.remove('open');
      overlay.style.display = 'none';
    };
  }
  overlay.onclick = function(e) {
    if (e.target === overlay) {
      overlay.classList.remove('open');
      overlay.style.display = 'none';
    }
  };
}

// --------------- show library tab ---------------
function showLibrary() {
  var insightsView = document.getElementById('insights-view');
  if (insightsView) insightsView.classList.remove('active');
  var dashView = document.getElementById('dashboard-view');
  if (dashView) dashView.classList.remove('active');
  var lv = document.getElementById('library-view');
  if (lv) lv.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  var libBtn = document.querySelector('[onclick="showLibrary()"]');
  if (libBtn) libBtn.classList.add('active');
  // Hide shared app-header number blocks for other tabs
  var titleEl = document.getElementById('app-header-title');
  if (titleEl) titleEl.style.display = 'none';
  var greetHdr = document.getElementById('dash-greeting-hdr');
  if (greetHdr) greetHdr.style.display = 'none';

  setTimeout(function() { libWireFilters(); libInitSearch(); }, 0);

  if (_libPosts === null) {
    libLoadPosts().then(function() {
      libRenderPillarBar();
      libRenderList();
    });
  } else {
    libRenderPillarBar();
    libRenderList();
  }
}

// --------------- search toggle ---------------
var _libSearchOpen = false;
function libToggleSearch() {
  var bar = document.getElementById('lib-search-bar');
  if (!bar) return;
  if (_libSearchOpen) {
    bar.style.display = 'none';
    bar.querySelector('input').value = '';
    _libSearchOpen = false;
    libSearchFilter('');
  } else {
    bar.style.display = 'block';
    var inp = bar.querySelector('input');
    inp.value = '';
    inp.focus();
    _libSearchOpen = true;
  }
}

function libSearchFilter(term) {
  var items = document.querySelectorAll('.lib-item');
  var t = (term || '').toLowerCase();
  for (var i = 0; i < items.length; i++) {
    var title = (items[i].getAttribute('data-title') || '').toLowerCase();
    if (!t) { items[i].style.display = ''; continue; }
    items[i].style.display = title.indexOf(t) > -1 ? '' : 'none';
  }
}

function libInitSearch() {
  var hdr = document.querySelector('.lib-hdr');
  if (!hdr || document.getElementById('lib-search-bar')) return;
  var bar = document.createElement('div');
  bar.id = 'lib-search-bar';
  bar.className = 'lib-search-bar';
  bar.style.display = 'none';
  bar.innerHTML = '<input type="text" placeholder="Search posts..." class="lib-search-input">';
  hdr.parentNode.insertBefore(bar, hdr.nextSibling);
  var inp = bar.querySelector('input');
  inp.addEventListener('input', function() { libSearchFilter(inp.value); });
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { libToggleSearch(); }
  });
}

// --------------- libGoToPipeline ---------------
function libGoToPipeline(postId) {
  var overlay = document.getElementById('lib-card-overlay');
  if (overlay) overlay.style.display = 'none';
  window._pipelinePubExpanded = true;
  var pipelineBtn = document.querySelector('[data-tab="pipeline"]');
  if (pipelineBtn) pipelineBtn.click();
  setTimeout(function() {
    if (typeof openPCS === 'function') openPCS(postId, 'library');
  }, 500);
}

// --------------- libSaveLinkedInUrl ---------------
async function libSaveLinkedInUrl(postId) {
  var input = document.getElementById('lib-li-url-input');
  if (!input || !input.value.trim()) return;
  var url = input.value.trim();
  try {
    await apiFetch('/posts?id=eq.' + postId, {
      method: 'PATCH',
      body: JSON.stringify({ linkedin_link: url, updated_at: new Date().toISOString() })
    });
    if (!_libLinkedIn[postId]) _libLinkedIn[postId] = {};
    _libLinkedIn[postId].linkedinUrl = url;
    showToast('LinkedIn URL saved', 'success');
  } catch(e) {
    showToast('Failed to save URL', 'error');
  }
}

// --------------- attach to window ---------------
window.libOpenFilterSheet = libOpenFilterSheet;
window.libCloseFilterSheet = libCloseFilterSheet;
window.libApplyFilters = libApplyFilters;
window.libResetFilters = libResetFilters;
window.showLibrary = showLibrary;
window.libSetView = libSetView;
window.libOpenCard = libOpenCard;
window.libToggleSearch = libToggleSearch;
window.libSyncChipVisuals = libSyncChipVisuals;
window.libGoToPipeline = libGoToPipeline;
