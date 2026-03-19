/* ===============================================
   01-config.js - App-wide constants & colour maps
   Single source of truth for stages and pillars.
=============================================== */
console.log("LOADED:", "01-config.js");

// Global modal state — must exist before any other script runs
if (window._modalOpen === undefined)      window._modalOpen = false;
if (window._deferredRender === undefined) window._deferredRender = false;

const SUPABASE_URL          = 'https://vxokfscjzytpgdrmertk.supabase.co';
const SUPABASE_KEY          = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4b2tmc2Nqenl0cGdkcm1lcnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzE2NzAsImV4cCI6MjA4ODkwNzY3MH0.j1LKb2FOarLIi5DDChiWF_DTihKdLCEQMKdy9M5JQkw';
const APP_URL               = 'https://guneygaar.github.io';
const READY_TO_SEND_TARGET  = 30;
const CLIENT_REQUEST_FORM_URL = '';

// -------------------------------------------------------
// STAGE SYSTEM - single source of truth
// DB values are lowercase. UI reads label/hex from STAGE_META.
// -------------------------------------------------------

// UI (internal) → DB (wire format) mapping
const STAGE_MAP = {
  'in production':        'in_production',
  'awaiting brand input': 'awaiting_brand_input',
  'ready':                'ready',
  'awaiting approval':    'awaiting_approval',
  'scheduled':            'scheduled',
  'published':            'published',
  'parked':               'parked',
  'archive':              'archive',
  'rejected':             'rejected',
};

// DB → UI reverse mapping (auto-generated)
const STAGE_MAP_REV = Object.fromEntries(
  Object.entries(STAGE_MAP).map(([ui, db]) => [db, ui])
);

// Convert UI stage label to DB wire value
function toDbStage(uiStage) {
  const key = (uiStage || '').toLowerCase().trim();
  return STAGE_MAP[key] || key;
}

// Convert DB wire value to UI stage label
function toUiStage(dbStage) {
  const key = (dbStage || '').toLowerCase().trim();
  return STAGE_MAP_REV[key] || key;
}

const STAGE_META = {
  'awaiting brand input': { label: 'Awaiting Brand Input', hex: '#8b5cf6' },
  'in production':        { label: 'In Production', hex: '#f59e0b' },
  'ready':                { label: 'Ready',                hex: '#10b981' },
  'awaiting approval':    { label: 'Awaiting Approval',    hex: '#3b82f6' },
  'scheduled':            { label: 'Scheduled',            hex: '#06b6d4' },
  'published':            { label: 'Published',            hex: '#22c55e' },
  'rejected':             { label: 'Rejected',             hex: '#ef4444' },
  'parked':               { label: 'Parked',               hex: '#64748b' },
  'archive':              { label: 'Archive',              hex: '#64748b' },
};

// Canonical stage order — single source of truth for all dropdowns and rendering
const STAGE_ORDER = [
  'in production',
  'ready',
  'awaiting brand input',
  'awaiting approval',
  'scheduled',
  'published',
  'parked',
  'rejected',
];

// Active DB stages (same order, excludes archive)
const STAGES_DB = STAGE_ORDER;

// Pipeline order (includes archive at end)
const PIPELINE_ORDER = [...STAGE_ORDER, 'archive'];

// Backward-compatible aliases so nothing else needs changing
const STAGE_COLORS  = STAGE_META;   // legacy alias
const STAGE_DISPLAY = Object.fromEntries(
  Object.entries(STAGE_META).map(([k, v]) => [k, v.label])
);

// Helper: returns { hex, label } for any stage string
function stageStyle(raw) {
  const key = (raw || '').toLowerCase().trim();
  return STAGE_META[key] || { hex: '#64748b', label: raw || 'Unknown' };
}

// Read owner directly from post — no derivation
function getPostOwner(post) {
  return (post?.owner || '').trim() || '—';
}
window.getPostOwner = getPostOwner;

// -------------------------------------------------------
// PILLAR SYSTEM
// -------------------------------------------------------

const PILLARS_DB = [
  'leadership',
  'innovation',
  'sustainability',
  'inclusivity',
  'events',
  'announcements',
  'growth',
];

const PILLAR_DISPLAY = {
  'leadership':    'Leadership',
  'innovation':    'Innovation',
  'sustainability':'Sustainability',
  'inclusivity':   'Inclusivity',
  'events':        'Events',
  'announcements': 'Announcements',
  'growth':        'Growth',
};

const PILLAR_SHORT = {
  'leadership':    'Lead',
  'innovation':    'Innov',
  'sustainability':'Sustain',
  'inclusivity':   'Include',
  'events':        'Events',
  'announcements': 'Announce',
  'growth':        'Growth',
};

// Sanitizer: enforce lowercase before ANY DB write
function sanitizePillar(p) {
  return (p || '').toLowerCase().trim();
}

// Formatter: DB value → Capital Case display label (for dropdowns)
function formatPillarDisplay(p) {
  if (!p) return '';
  const key = sanitizePillar(p);
  return PILLAR_DISPLAY[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

// Formatter: DB value → short label (for subtitles / tight UI)
function getPillarShort(p) {
  if (!p) return '';
  const key = sanitizePillar(p);
  return PILLAR_SHORT[key] || key;
}

// Display-only owner formatter (internal values stay UPPERCASE)
function formatOwner(name) {
  if (!name) return '\u2014';
  return name.charAt(0) + name.slice(1).toLowerCase();
}

// -------------------------------------------------------
// ROLE & WORKFLOW CONFIG
// Only 3 actors: Pranav, Chitra, Client
// Legacy role names (Admin/Servicing/Creative) still flow from auth
// but all map to the same unified config for non-Client users.
// -------------------------------------------------------

// All non-Client roles see all stages (null = no filter)
const ROLE_STAGES = {
  'Admin':     null,
  'Servicing': null,
  'Creative':  null,
};

// All roles get full tab access
const _FULL_TABS = ['tasks','pipeline','library'];
const ROLE_TABS = {
  'Admin':     _FULL_TABS,
  'Servicing': _FULL_TABS,
  'Creative':  _FULL_TABS,
  'Pranav':    _FULL_TABS,
  'Chitra':    _FULL_TABS,
  'Client':    _FULL_TABS,
};

// All non-Client roles see the same stats
const _FULL_STATS = ['s-published','s-approval','s-pipeline','s-ready','s-week','s-total','s-overdue'];
const ROLE_STATS = {
  'Admin':     _FULL_STATS,
  'Servicing': _FULL_STATS,
  'Creative':  _FULL_STATS,
  'Client':    [],
};

// Unified task buckets — same for all non-Client roles
const _UNIFIED_BUCKETS = [
  { key:'production', label:'In Production',stages:['in production'] },
  { key:'requests',   label:'Requests',     stages:['awaiting brand input'] },
  { key:'ready',      label:'Ready',        stages:['ready'] },
  { key:'approval',   label:'For Approval', stages:['awaiting approval'] },
  { key:'scheduled',  label:'Scheduled',    stages:['scheduled'] },
];
const ROLE_BUCKETS = {
  Admin:     _UNIFIED_BUCKETS,
  Servicing: _UNIFIED_BUCKETS,
  Creative:  _UNIFIED_BUCKETS,
};

const STRIP_STAGES = [
  { label:'In Production', stages:['in production'],        color: STAGE_META['in production'].hex,        tab:'tasks',    bucket:'production' },
  { label:'Requests',      stages:['awaiting brand input'], color: STAGE_META['awaiting brand input'].hex, tab:'tasks',    bucket:'requests' },
  { label:'Approval',      stages:['awaiting approval'],    color: STAGE_META['awaiting approval'].hex,    tab:'tasks',    bucket:'approval' },
  { label:'Ready',         stages:['ready'],                color: STAGE_META['ready'].hex,                tab:'tasks',    bucket:'ready', target:true },
  { label:'Scheduled',     stages:['scheduled'],            color: STAGE_META['scheduled'].hex,            tab:'pipeline', bucket:null },
  { label:'Published',     stages:['published'],            color: STAGE_META['published'].hex,            tab:'library',  bucket:null },
];

// Canonical owner list — used by dropdowns, validation, and grid
const ALLOWED_OWNERS = ['Pranav', 'Chitra', 'Client'];

// ── Stage change interceptor — logs every .stage mutation ──
function setStage(post, newStage, source) {
  console.log('STAGE CHANGE →', {
    id: post.id || post.post_id,
    from: post.stage,
    to: newStage,
    source,
    time: Date.now(),
  });
  post.stage = newStage;
}
window.setStage = setStage;

// Stage priority ordering for next-post selection
const STAGE_URGENCY = ['awaiting brand input','in production','ready','awaiting approval'];
