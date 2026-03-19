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

const STAGE_META = {
  'awaiting brand input': { label: 'Awaiting Brand Input', hex: '#8b5cf6' },
  'in production':        { label: 'In Production (WIP)', hex: '#f59e0b' },
  'revisions needed':     { label: 'Revisions Needed',     hex: '#ef4444' },
  'ready':                { label: 'Ready',                hex: '#10b981' },
  'awaiting approval':    { label: 'Awaiting Approval',    hex: '#3b82f6' },
  'scheduled':            { label: 'Scheduled',            hex: '#06b6d4' },
  'published':            { label: 'Published',            hex: '#22c55e' },
  'parked':               { label: 'Parked',               hex: '#64748b' },
  'archive':              { label: 'Archive',              hex: '#64748b' },
};

// Canonical ordered list of active DB stage values (excludes archive)
const STAGES_DB = [
  'awaiting brand input',
  'in production',
  'revisions needed',
  'ready',
  'awaiting approval',
  'scheduled',
  'published',
  'parked',
];

// Workflow order for pipeline display
const PIPELINE_ORDER = [
  'in production',
  'revisions needed',
  'awaiting brand input',
  'ready',
  'awaiting approval',
  'scheduled',
  'published',
  'parked',
  'archive',
];

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

// Helper: derive responsible owner from stage (single source of truth)
// PRANAV = production, CHITRA = scheduling, CLIENT = approval
function getResponsibleOwner(post) {
  const s = (post?.stage || '').toLowerCase().trim();
  if (s === 'in production' || s === 'revisions needed') return 'PRANAV';
  if (s === 'ready') return 'CHITRA';
  if (s === 'awaiting approval' || s === 'awaiting brand input') return 'CLIENT';
  return null; // scheduled, published, parked, unknown
}
window.getResponsibleOwner = getResponsibleOwner;

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
// -------------------------------------------------------

const ROLE_STAGES = {
  'Admin':     null,
  'Servicing': ['awaiting approval','ready','scheduled'],
  'Creative':  ['in production','revisions needed','awaiting brand input'],
};

const ROLE_TABS = {
  'Admin':     ['tasks','pipeline','upcoming','library'],
  'Servicing': ['tasks','upcoming','library'],
  'Creative':  ['tasks','library'],
  'Client':    [],
};

const ROLE_STATS = {
  'Admin':     ['s-published','s-approval','s-pipeline','s-ready','s-week','s-total','s-overdue'],
  'Servicing': ['s-approval','s-ready','s-week'],
  'Creative':  ['s-creative-requests','s-creative-revisions','s-creative-gap'],
  'Client':    [],
};

const ROLE_BUCKETS = {
  Admin: [
    { key:'requests',   label:'Requests',     stages:['awaiting brand input'] },
    { key:'revisions',  label:'Revisions',    stages:['revisions needed'], warn:true },
    { key:'production', label:'In Production',stages:['in production'] },
    { key:'ready',      label:'Ready',        stages:['ready'] },
    { key:'approval',   label:'For Approval', stages:['awaiting approval'] },
    { key:'scheduled',  label:'Scheduled',    stages:['scheduled'] },
  ],
  Servicing: [
    { key:'waiting',    label:'Waiting for Client', stages:['awaiting brand input','awaiting approval'] },
    { key:'ready',      label:'Ready',               stages:['ready'] },
    { key:'scheduled',  label:'Scheduled',           stages:['scheduled'] },
  ],
  Creative: [
    { key:'requests',   label:'Requests',     stages:['awaiting brand input'] },
    { key:'production', label:'In Production',stages:['in production'] },
    { key:'revisions',  label:'Revisions',    stages:['revisions needed'], warn:true },
  ],
};

const STRIP_STAGES = [
  { label:'In Production', stages:['in production'],        color: STAGE_META['in production'].hex,        tab:'tasks',    bucket:'production' },
  { label:'Revisions',     stages:['revisions needed'],     color: STAGE_META['revisions needed'].hex,     tab:'tasks',    bucket:'revisions', warn:true },
  { label:'Requests',      stages:['awaiting brand input'], color: STAGE_META['awaiting brand input'].hex, tab:'tasks',    bucket:'requests' },
  { label:'Approval',      stages:['awaiting approval'],    color: STAGE_META['awaiting approval'].hex,    tab:'tasks',    bucket:'approval' },
  { label:'Ready',         stages:['ready'],                color: STAGE_META['ready'].hex,                tab:'tasks',    bucket:'ready', target:true },
  { label:'Scheduled',     stages:['scheduled'],            color: STAGE_META['scheduled'].hex,            tab:'upcoming', bucket:null },
  { label:'Published',     stages:['published'],            color: STAGE_META['published'].hex,            tab:'library',  bucket:null },
];

// Canonical owner list — used by dropdowns, validation, and grid
const ALLOWED_OWNERS = ['Pranav', 'Chitra', 'Admin'];

// ── Stage change interceptor — logs every .stage mutation ──
function setStage(post, newStage, source) {
  console.log('STAGE CHANGE →', {
    id: post.id || post.post_id,
    from: post.stage,
    to: newStage,
    source,
    time: Date.now(),
    stack: new Error().stack
  });
  post.stage = newStage;
}
window.setStage = setStage;

const CREATIVE_URGENCY  = ['revisions needed','awaiting brand input','in production'];
const NEXT_POST_URGENCY = ['revisions needed','awaiting brand input','in production','ready','awaiting approval'];
