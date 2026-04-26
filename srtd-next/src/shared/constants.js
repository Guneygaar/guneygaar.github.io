// Shared, app-wide constants. The Plan-feature constants under
// flows/plan/shared/constants.js stay there; this file is for values
// that need to be addressable from outside the Plan feature (api/,
// hooks/, etc.) without dragging the Plan namespace.
//
// Canonical post stages, derived from STAGE_LABELS in
// flows/plan/shared/constants.js (kept in sync). 'published' and
// 'rejected' are excluded because they represent terminal states
// the Plan grid + create-plan wizard intentionally hide. 'parked'
// stays in: parked posts can still be carried over.

export const STAGES_FOR_PLAN = [
  'brief',
  'awaiting_brand_input',
  'in_production',
  'ready',
  'awaiting_approval',
  'scheduled',
  'parked'
];
