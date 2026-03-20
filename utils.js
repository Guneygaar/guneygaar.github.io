/* ===============================================
   utils.js  -  Shared pure utility functions
   Loaded after 02-session.js, before everything else.
=============================================== */

function getTitle(post) { return post.title || post.post_id || 'Untitled'; }
function getPostId(post) { return post.post_id || post.id || ''; }
function getPostById(postId) { return allPosts.find(p => getPostId(p) === postId) || null; }

function parseDate(raw) {
  if (!raw) return null;
  const parts = String(raw).split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];
const MONTHS_LONG = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// "D Mon"  -  no year
function formatDateShort(raw) {
  const d = parseDate(raw);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// "Mon YYYY"  -  for group headers
function formatMonthYear(raw) {
  const d = parseDate(raw);
  if (!d) return 'No Date';
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// "Month YYYY"  -  for calendar headers
function formatMonthYearLong(raw) {
  const d = parseDate(raw);
  if (!d) return 'No Date';
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

// "DAY D Mon" uppercased  -  for schedule date headers
function formatWeekdayDateShort(raw) {
  const d = parseDate(raw);
  if (!d) return 'NO DATE';
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`.toUpperCase();
}

function formatDate(raw) {
  const d = parseDate(raw);
  if (!d) return null;
  const day   = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year  = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function displayDate(raw) {
  return formatDate(raw) || ' - ';
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// IST display formatter  -  display-only, never mutates raw data
function formatIST(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Resolve actor name for write paths  -  URL-path based, strict allowlist
function resolveActor() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('client')) return 'Client';
  if (path.includes('chitra') || path.includes('ops')) return 'Chitra';
  if (path.includes('admin')) return 'Chitra';
  return 'Pranav';
}
