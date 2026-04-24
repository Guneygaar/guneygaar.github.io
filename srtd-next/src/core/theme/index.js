// JS-side mirror of the Tailwind token set. Import from here for
// inline-required contexts (SVG fills, lucide icon color props,
// computed numeric styles). For normal styling use Tailwind
// utilities (className="bg-bg-2 text-text-mid font-serif").
//
// Values resolve to `var(--c-*)` so they flip between the light
// and dark palettes declared in src/styles/tailwind.css when the
// user changes their system `prefers-color-scheme`. For JS
// contexts that need a real hex string at runtime (canvas, chart
// libs, inline SVG fill attributes that don't honour var()),
// call `getResolvedColor('terracotta')` which reads the currently
// active computed value from :root.

export const cssVar = (name) => `var(--c-${name})`;

export const colors = {
  bg:             cssVar('bg'),
  bg2:            cssVar('bg-2'),
  bg3:            cssVar('bg-3'),
  bgDraft:        cssVar('bg-draft'),
  bgPill:         cssVar('bg-pill'),
  bgMemo:         cssVar('bg-memo'),

  borderNeutral:  cssVar('border-neutral'),
  borderWarm:     cssVar('border-warm'),
  dividerWarm:    cssVar('divider-warm'),
  dividerSoft:    cssVar('divider-soft'),

  textLoud:       cssVar('text-loud'),
  textMid:        cssVar('text-mid'),
  textSoft:       cssVar('text-soft'),
  textDim:        cssVar('text-dim'),

  terracotta:     cssVar('terracotta'),
  terracotta1:    cssVar('terracotta-1'),
  terracotta2:    cssVar('terracotta-2'),
  amber:          cssVar('amber'),
  purple:         cssVar('purple'),
  green:          cssVar('green'),
  greenDeep:      cssVar('green-deep'),
  red:            cssVar('red'),
  roleServicing:  cssVar('role-servicing'),
  roleAdmin:      cssVar('role-admin'),
  stageBrief:      cssVar('stage-brief'),
  stageProduction: cssVar('stage-production'),
  stageReady:      cssVar('stage-ready'),
  stageInput:      cssVar('stage-input'),
  stageApproval:   cssVar('stage-approval'),
  stageScheduled:  cssVar('stage-scheduled'),
  stagePublished:  cssVar('stage-published'),
  stageRejected:   cssVar('stage-rejected'),
  stageParked:     cssVar('stage-parked'),
  roleCreative:    cssVar('role-creative'),
  roleClient:      cssVar('role-client'),
};

// Read a concrete hex value from the current theme. Usable in
// canvas/chart/SVG-fill contexts that cannot consume var(...).
// Returns '' if the var is missing or the DOM is not available.
export function getResolvedColor(name) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';
  try {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(`--c-${name}`)
      .trim();
  } catch (e) {
    return '';
  }
}

export const fonts = {
  sans:  '"DM Sans", sans-serif',
  serif: 'Fraunces, serif',
  mono:  '"IBM Plex Mono", monospace',
};

// Anthropic pricing per million tokens (USD). Input and output
// priced separately; INR conversion lives alongside so cost chips
// can render a single number without re-deriving the rate.
const PRICE_INPUT_PER_MTOK  = 3;
const PRICE_OUTPUT_PER_MTOK = 15;
const USD_TO_INR            = 100;

export function costToINR(inputTokens, outputTokens) {
  const usd = (Number(inputTokens)  || 0) * PRICE_INPUT_PER_MTOK  / 1e6
            + (Number(outputTokens) || 0) * PRICE_OUTPUT_PER_MTOK / 1e6;
  return usd * USD_TO_INR;
}

export function formatINR(v) {
  if (!v || v < 1) return '\u20B9' + (Number(v) || 0).toFixed(2);
  if (v < 1000)    return '\u20B9' + Math.round(v);
  return '\u20B9' + Math.round(v).toLocaleString('en-IN');
}
