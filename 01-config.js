/* ═══════════════════════════════════════════════
   01-config.js — App-wide constants & colour maps
═══════════════════════════════════════════════ */

const SUPABASE_URL          = 'https://vxokfscjzytpgdrmertk.supabase.co';
const SUPABASE_KEY          = 'sb_publishable_PtxwwoAiR96-O0c2vHqsxw_mpm8SrpH';
const APP_URL               = 'https://guneygaar.github.io';
const READY_TO_SEND_TARGET  = 30;
const CLIENT_REQUEST_FORM_URL = '';

const STAGE_COLORS = {
  'published':            { hex: '#22c55e', label: 'Published' },
  'awaiting approval':    { hex: '#3b82f6', label: 'Awaiting Approval' },
  'awaiting brand input': { hex: '#8b5cf6', label: 'Awaiting Brand Input' },
  'ready':                { hex: '#10b981', label: 'Ready' },
  'in production':        { hex: '#f59e0b', label: 'In Production' },
  'revisions needed':     { hex: '#ef4444', label: 'Revisions Needed' },
  'scheduled':            { hex: '#06b6d4', label: 'Scheduled' },
  'parked':               { hex: '#64748b', label: 'Parked' },
  'archive':              { hex: '#64748b', label: 'Archive' },
};

function stageStyle(raw) {
  const key = (raw || '').toLowerCase().trim();
  return STAGE_COLORS[key] || { hex: '#64748b', label: raw || 'Unknown' };
}

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
    { key:'requests',   label:'Requests',       stages:['awaiting brand input'] },
    { key:'revisions',  label:'Revisions',       stages:['revisions needed'], warn:true },
    { key:'production', label:'In Production',   stages:['in production'] },
    { key:'ready',      label:'Ready',           stages:['ready'] },
    { key:'approval',   label:'For Approval',    stages:['awaiting approval'] },
    { key:'scheduled',  label:'Scheduled',       stages:['scheduled'] },
  ],
  Servicing: [
    { key:'waiting',    label:'Waiting for Client', stages:['awaiting brand input','awaiting approval'] },
    { key:'ready',      label:'Ready',               stages:['ready'] },
    { key:'scheduled',  label:'Scheduled',           stages:['scheduled'] },
  ],
  Creative: [
    { key:'requests',   label:'Requests',       stages:['awaiting brand input'] },
    { key:'production', label:'In Production',  stages:['in production'] },
    { key:'revisions',  label:'Revisions',      stages:['revisions needed'], warn:true },
  ],
};

const STRIP_STAGES = [
  { label:'In Production', stages:['in production'],    color:'#f59e0b', tab:'tasks',    bucket:'production' },
  { label:'Revisions',     stages:['revisions needed'], color:'#ef4444', tab:'tasks',    bucket:'revisions', warn:true },
  { label:'Requests',      stages:['awaiting brand input'], color:'#8b5cf6', tab:'tasks', bucket:'requests' },
  { label:'Approval',      stages:['awaiting approval'], color:'#3b82f6', tab:'tasks',   bucket:'approval' },
  { label:'Ready',         stages:['ready'],             color:'#10b981', tab:'tasks',   bucket:'ready', target:true },
  { label:'Scheduled',     stages:['scheduled'],         color:'#06b6d4', tab:'upcoming', bucket:null },
  { label:'Published',     stages:['published'],         color:'#22c55e', tab:'library', bucket:null },
];

const PIPELINE_ORDER = [
  'in production','revisions needed','awaiting brand input',
  'ready','awaiting approval',
  'scheduled','published','parked','archive'
];

const CREATIVE_URGENCY  = ['revisions needed','awaiting brand input','in production'];
const NEXT_POST_URGENCY = ['revisions needed','awaiting brand input','in production','ready','awaiting approval'];

// ── Canonical stage lists (single source of truth) ────────────────────
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

const STAGE_DISPLAY = {
  'awaiting brand input': 'Awaiting Brand Input',
  'in production':        'In Production',
  'revisions needed':     'Revisions Needed',
  'ready':                'Ready',
  'awaiting approval':    'Awaiting Approval',
  'scheduled':            'Scheduled',
  'published':            'Published',
  'parked':               'Parked',
};

// ── Canonical pillar lists ─────────────────────────────────────────────
const PILLARS_DB = [
  'leadership',
  'innovation',
  'sustainability',
  'inclusivity',
  'events',
  'announcements',
];

const PILLAR_DISPLAY = {
  'leadership':    'Leadership',
  'innovation':    'Innovation',
  'sustainability':'Sustainability',
  'inclusivity':   'Inclusivity',
  'events':        'Events',
  'announcements': 'Announcements',
};

const PILLAR_SHORT = {
  'leadership':    'Lead',
  'innovation':    'Innov',
  'sustainability':'Sustain',
  'inclusivity':   'Include',
  'events':        'Event',
  'announcements': 'Announce',
};
