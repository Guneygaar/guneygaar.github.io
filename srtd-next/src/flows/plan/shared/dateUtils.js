// Date helpers. All calendars are Monday-first. Pure ASCII.

const DOW_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DOW_SUN_FIRST = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function parseISODate(v) {
  if (!v) return null;
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatYYYYMMDD(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayNumber(d) { return d ? d.getDate() : ''; }

export function dowShortMonFirst(d) {
  if (!d) return '';
  const idx = (d.getDay() + 6) % 7;
  return DOW_SHORT[idx];
}

export function dowShortSunFirst(d) {
  if (!d) return '';
  return DOW_SUN_FIRST[d.getDay()];
}

export function monthAbbr(d) {
  if (!d) return '';
  return MONTHS[d.getMonth()];
}

// Week-of (Monday-start). Returns { start: Date, end: Date } for
// the week containing d.
export function weekRangeMonFirst(d) {
  if (!d) return null;
  const day = d.getDay();
  const offsetFromMon = (day + 6) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offsetFromMon);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start, end };
}

export function weekKey(d) {
  const r = weekRangeMonFirst(d);
  if (!r) return '';
  return formatYYYYMMDD(r.start);
}

export function formatWeekHeader(weekStart, weekEnd) {
  if (!weekStart || !weekEnd) return '';
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  if (sameMonth) {
    return `Week of ${weekStart.getDate()} - ${weekEnd.getDate()} ${monthAbbr(weekEnd)}`;
  }
  return `Week of ${weekStart.getDate()} ${monthAbbr(weekStart)} - ${weekEnd.getDate()} ${monthAbbr(weekEnd)}`;
}

export function formatTime12(d) {
  if (!d) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = String(m).padStart(2, '0');
  return `${h}:${mm} ${ampm}`;
}

// Calendar grid helper - returns day number labels and leading offset
// for a month-start date. Monday-first.
export function buildMonthGrid(monthStart) {
  if (!monthStart) return { leading: 0, days: [] };
  const y = monthStart.getFullYear();
  const m = monthStart.getMonth();
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const days = [];
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(y, m, i));
  return { leading, days };
}

export function daysBetweenInclusive(a, b) {
  if (!a || !b) return 0;
  const ms = 86400000;
  const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.floor((bUtc - aUtc) / ms));
}

// Age in whole days from an ISO/Date stamp to now. Clamped to >= 0.
export function daysSince(iso) {
  if (!iso) return 0;
  const then = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(then.getTime())) return 0;
  const ms = Date.now() - then.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function daysBetween(isoStart, isoEnd) {
  if (!isoStart) return 0;
  const s = isoStart instanceof Date ? isoStart : new Date(isoStart);
  const e = isoEnd ? (isoEnd instanceof Date ? isoEnd : new Date(isoEnd)) : new Date();
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  return Math.max(0, Math.floor((e.getTime() - s.getTime()) / 86400000));
}

export function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';

  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';

  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';

  const day = Math.floor(hr / 24);
  if (day < 7) return day + 'd ago';

  if (day < 30) return Math.floor(day / 7) + 'w ago';

  if (day < 365) return Math.floor(day / 30) + 'mo ago';

  return Math.floor(day / 365) + 'y ago';
}
