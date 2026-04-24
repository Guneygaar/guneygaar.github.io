export const STAGE_LABELS = {
  brief: 'Brief',
  in_production: 'In production',
  ready: 'Ready',
  awaiting_approval: 'Awaiting approval',
  awaiting_brand_input: 'Awaiting input',
  scheduled: 'Scheduled',
  published: 'Published',
  parked: 'Parked',
  rejected: 'Rejected'
};

export const STAGE_TOKEN = {
  brief:                'stage-brief',
  in_production:        'stage-production',
  ready:                'stage-ready',
  awaiting_approval:    'amber',
  awaiting_brand_input: 'stage-input',
  scheduled:            'stage-scheduled',
  published:            'green',
  parked:               'text-soft',
  rejected:             'red'
};

export function ownerToRole(ownerLabel) {
  if (!ownerLabel) return 'creative';
  const k = String(ownerLabel).toLowerCase();
  if (k === 'admin' || k === 'creative' || k === 'servicing' || k === 'client') return k;
  return 'creative';
}

export function titleCase(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function truncate(s, max = 80) {
  if (!s) return '';
  const str = String(s);
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + '\u2026';
}
