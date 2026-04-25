// Stage + pillar + owner label maps + role labels. All values are
// ASCII. No unicode dashes or smart quotes.

export const STAGE_LABELS = {
  brief:                 'Brief',
  in_production:         'In production',
  ready:                 'Ready',
  awaiting_brand_input:  'Awaiting brand input',
  awaiting_approval:     'Awaiting approval',
  scheduled:             'Scheduled',
  published:             'Published',
  rejected:              'Rejected',
  parked:                'Parked'
};

export const STAGE_COLOR_VAR = {
  brief:                 '--c-stage-brief',
  in_production:         '--c-stage-production',
  ready:                 '--c-stage-ready',
  awaiting_brand_input:  '--c-stage-input',
  awaiting_approval:     '--c-stage-approval',
  scheduled:             '--c-stage-scheduled',
  published:             '--c-stage-published',
  rejected:              '--c-stage-rejected',
  parked:                '--c-stage-parked'
};

// Agency stage order mirrors vanilla 01-config.js PIPELINE_RENDER_ORDER
// (brief, awaiting_approval, awaiting_brand_input, scheduled, ready,
// in_production) plus published / rejected / parked which Plan surfaces
// as Board rows but vanilla pipeline.js does not.
export const STAGE_ORDER_BOARD_AGENCY = [
  'brief',
  'awaiting_brand_input',
  'in_production',
  'ready',
  'awaiting_approval',
  'scheduled',
  'published'
];

// Client stage order is the safe subset of usePosts' CLIENT_ALLOWED_STAGES
// minus 'brief' (rendered via BriefsAssignedSection above the Board) and
// 'in_production' (vanilla 07-post-load.js:380-385 only surfaces
// in_production rows to clients when comments exist on them - Plan does
// not surface in_production as a Board row for clients).
export const STAGE_ORDER_BOARD_CLIENT = [
  'awaiting_brand_input',
  'awaiting_approval',
  'scheduled',
  'published'
];

// Back-compat: existing imports of STAGE_ORDER_BOARD continue to work
// (defaults to the agency list). Board.jsx + List.jsx pick the right
// list based on planStore.role.
export const STAGE_ORDER_BOARD = STAGE_ORDER_BOARD_AGENCY;

export const PILLAR_LABELS = {
  innovation:      'Innovation',
  announcements:   'Announcements',
  leadership:      'Leadership',
  sustainability:  'Sustainability',
  events:          'Events',
  inclusivity:     'Inclusivity',
  growth:          'Growth'
};

export const PILLAR_COLOR_VAR = {
  innovation:      '--c-pillar-innovation',
  announcements:   '--c-pillar-announcements',
  leadership:      '--c-pillar-leadership',
  sustainability:  '--c-pillar-sustainability',
  events:          '--c-pillar-events',
  inclusivity:     '--c-pillar-inclusivity',
  growth:          '--c-pillar-growth'
};

export const PILLAR_GRAD_CLASS = {
  innovation:      'plan-pillar-grad-innovation',
  announcements:   'plan-pillar-grad-announcements',
  leadership:      'plan-pillar-grad-leadership',
  sustainability:  'plan-pillar-grad-sustainability',
  events:          'plan-pillar-grad-events',
  inclusivity:     'plan-pillar-grad-inclusivity',
  growth:          'plan-pillar-grad-growth'
};

export const OWNER_COLOR_VAR = {
  Admin:      '--c-role-admin',
  Servicing:  '--c-role-servicing',
  Creative:   '--c-role-creative',
  Client:     '--c-role-client'
};

export const OWNER_LABELS = {
  Admin:      'Admin',
  Servicing:  'Servicing',
  Creative:   'Creative',
  Client:     'Client'
};

export const FORMAT_LABELS = {
  Photo:     'Photo',
  Carousel:  'Carousel',
  Video:     'Video',
  Creative:  'Creative',
  Text:      'Text'
};

export const FORMAT_COLOR_VAR = {
  Photo:     '--c-stage-production',
  Carousel:  '--c-amber',
  Video:     '--c-terracotta',
  Creative:  '--c-role-servicing',
  Text:      '--c-text-dim'
};
