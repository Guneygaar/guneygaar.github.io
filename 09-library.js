/* ===============================================
   09-library.js  -  Library tab: data + filters
   Part A: data loading, filter state, filter sheet
=============================================== */
console.log("LOADED:", "09-library.js");

// --------------- state ---------------
var _libPosts = null;
var _libLinkedIn = {};
var _libFilterWired = false;
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

  var li = await apiFetch('/linkedin_posts?select=*');
  _libLinkedIn = {};
  if (li && li.length) {
    for (var i = 0; i < li.length; i++) {
      _libLinkedIn[li[i].post_id] = li[i];
    }
  }
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
}

// --------------- open / close filter sheet ---------------
function libOpenFilterSheet() {
  var el = document.getElementById('lib-filter-sheet-overlay');
  if (el) el.classList.add('open');
}

function libCloseFilterSheet() {
  var el = document.getElementById('lib-filter-sheet-overlay');
  if (el) el.classList.remove('open');
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
      strip.classList.add('show');
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
      strip.classList.remove('show');
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

// --------------- attach to window ---------------
window.libOpenFilterSheet = libOpenFilterSheet;
window.libCloseFilterSheet = libCloseFilterSheet;
window.libApplyFilters = libApplyFilters;
window.libResetFilters = libResetFilters;
