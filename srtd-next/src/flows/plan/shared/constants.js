// Stage + pillar + owner label maps + role labels. All values are
// ASCII. No unicode dashes or smart quotes.

export const STAGE_LABELS = {
  brief_done:            'Brief done',
  in_production:         'In production',
  awaiting_brand_input:  'Awaiting brand input',
  awaiting_approval:     'Awaiting approval',
  scheduled:             'Scheduled',
  published:             'Published',
  rejected:              'Rejected',
  parked:                'Parked'
};

export const STAGE_COLOR_VAR = {
  brief_done:            '--c-stage-brief',
  in_production:         '--c-stage-production',
  awaiting_brand_input:  '--c-stage-input',
  awaiting_approval:     '--c-stage-approval',
  scheduled:             '--c-stage-scheduled',
  published:             '--c-stage-published',
  rejected:              '--c-stage-rejected',
  parked:                '--c-stage-parked'
};

export const STAGE_ORDER_BOARD = [
  'awaiting_approval',
  'in_production',
  'scheduled',
  'published',
  'brief_done',
  'rejected',
  'parked'
];

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
