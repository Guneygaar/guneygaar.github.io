// Shared, app-wide constants. The Plan-feature constants under
// flows/plan/shared/constants.js stay there; this file is for
// values that need to be addressable from outside the Plan feature.
//
// Stage union mirrors STAGE_ORDER in vanilla 01-config.js:40.
// Single source of truth lives in vanilla today; when 01-config.js
// converts, import Stage from there instead.

export type Stage =
  | 'brief'
  | 'in_production'
  | 'ready'
  | 'awaiting_brand_input'
  | 'awaiting_approval'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'parked';

// Plan grid + create-plan wizard intentionally hide 'published'
// and 'rejected' (terminal states). 'parked' stays in - parked
// posts can still be carried over.
export const STAGES_FOR_PLAN: readonly Stage[] = [
  'brief',
  'awaiting_brand_input',
  'in_production',
  'ready',
  'awaiting_approval',
  'scheduled',
  'parked'
] as const;
