// Data mappings: UI labels ↔ DB values.
//
// Source of truth for stage check constraint (per Supabase audit):
//   brief, brief_done, in_production, ready, awaiting_approval,
//   awaiting_brand_input, scheduled, published, parked, rejected
//
// Owner check constraint values: Creative, Servicing, Client, Admin

// UI display label → DB value
export const STAGE_UI_TO_DB = {
  'Brief':                 'brief',
  'Brief done':            'brief_done',
  'In production':         'in_production',
  'Ready':                 'ready',
  'Awaiting approval':     'awaiting_approval',
  'Awaiting brand input':  'awaiting_brand_input',
  'Scheduled':             'scheduled',
  'Published':             'published',
  'Parked':                'parked',
  'Rejected':              'rejected'
};

// DB value → UI label (reverse map, computed once)
export const STAGE_DB_TO_UI = Object.fromEntries(
  Object.entries(STAGE_UI_TO_DB).map(([ui, db]) => [db, ui])
);

// Owner role values — DB constraint requires title case
export const OWNERS = ['Admin', 'Servicing', 'Creative', 'Client'];

// Format is free text in DB; these are the UI-curated options
export const FORMATS = ['Photo', 'Carousel', 'Video', 'Creative', 'Text'];

// Content pillars used by GBL client. Stored lowercase in DB,
// displayed as Title Case in the UI.
export const PILLARS = [
  'Announcements',
  'Events',
  'Growth',
  'Inclusivity',
  'Innovation',
  'Leadership',
  'Sustainability'
];

// UI label → DB value (lowercase)
export const PILLAR_UI_TO_DB = Object.fromEntries(
  PILLARS.map(p => [p, p.toLowerCase()])
);

// GBL operational locations. Stored as-is in DB.
export const LOCATIONS = [
  'Mumbai',
  'Sakarwadi',
  'Sameerwadi',
  'Press',
  'Other'
];

// Helper: is a URL a Canva link? (routing drive_link vs canva_link)
export function isCanvaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /(^|\.)canva\.com\//i.test(url);
}
