// Pure JS helpers for CreatePlanWizard / PeriodStep / CarryoverStep. No React.

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseISO(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(y, mo - 1, d);
  if (isNaN(dt.getTime()) || dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function isoOf(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function inferDefaultChannel(workspaceChannels) {
  if (!Array.isArray(workspaceChannels) || workspaceChannels.length === 0) return 'linkedin';
  const active = workspaceChannels.filter(r => r && r.is_active);
  if (active.length === 0) return 'linkedin';
  active.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  return active[0].channel || 'linkedin';
}

export function suggestCarryoverDate(periodStart) {
  const dt = parseISO(periodStart);
  if (!dt) return periodStart;
  let day = dt.getDay(); // 0=Sun..6=Sat
  while (day === 0 || day === 6) {
    dt.setDate(dt.getDate() + 1);
    day = dt.getDay();
  }
  return isoOf(dt);
}

export function formatPeriodTitle(type, start, end) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (!s || !e) return 'Untitled plan';
  if (type === 'monthly') {
    return `${MONTHS_FULL[s.getMonth()]} ${s.getFullYear()}`;
  }
  if (type === 'weekly') {
    const y = s.getFullYear(), m = s.getMonth() + 1, d = s.getDate();
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
    return `Wk ${weekNum} ${dt.getUTCFullYear()}`;
  }
  // custom
  const sameYear = s.getFullYear() === e.getFullYear();
  const currentYear = new Date().getFullYear();
  const omitYear = sameYear && s.getFullYear() === currentYear;
  const left = `${MONTHS_ABBR[s.getMonth()]} ${s.getDate()}`;
  const right = omitYear
    ? `${MONTHS_ABBR[e.getMonth()]} ${e.getDate()}`
    : `${MONTHS_ABBR[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  const leftWithYear = omitYear ? left : `${left}, ${s.getFullYear()}`;
  return `${leftWithYear} - ${right}`;
}

export function validatePeriod(type, start, end) {
  if (!start || !end) return { valid: false, error: 'Pick start and end dates' };
  const s = parseISO(start);
  const e = parseISO(end);
  if (!s || !e) return { valid: false, error: 'Invalid date' };
  if (e.getTime() < s.getTime()) return { valid: false, error: 'End date must be after start date' };
  if (type === 'weekly') {
    const days = Math.round((e.getTime() - s.getTime()) / 86400000);
    if (days !== 6) return { valid: false, error: 'Weekly range must be 7 days' };
  }
  return { valid: true, error: null };
}
