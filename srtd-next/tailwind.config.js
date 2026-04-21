/** @type {import('tailwindcss').Config} */
// Srtd React design tokens — bound to CSS custom properties so a
// single `prefers-color-scheme: dark` media query flips the whole
// palette between warm-paper (light) and warm-ink (dark). Colors
// here resolve to `var(--c-*)`; the actual hex values live in
// src/styles/tailwind.css inside `@layer base { :root }` +
// `@media (prefers-color-scheme: dark) { :root }`. See
// DESIGN_SYSTEM.md for the full rationale.
//
// The React bundle ships onto the same page as vanilla; Preflight
// is OFF so Tailwind never resets <h1>/<body>/etc.

export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'media',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        bg:               'var(--c-bg)',
        'bg-2':           'var(--c-bg-2)',
        'bg-3':           'var(--c-bg-3)',
        'bg-draft':       'var(--c-bg-draft)',
        'bg-pill':        'var(--c-bg-pill)',
        'bg-memo':        'var(--c-bg-memo)',
        'border-neutral': 'var(--c-border-neutral)',
        'border-warm':    'var(--c-border-warm)',
        'divider-warm':   'var(--c-divider-warm)',
        'divider-soft':   'var(--c-divider-soft)',
        'divider-subtle': 'var(--c-divider-subtle)',
        'text-loud':      'var(--c-text-loud)',
        'text-mid':       'var(--c-text-mid)',
        'text-soft':      'var(--c-text-soft)',
        'text-dim':       'var(--c-text-dim)',
        terracotta:       'var(--c-terracotta)',
        'terracotta-1':   'var(--c-terracotta-1)',
        'terracotta-2':   'var(--c-terracotta-2)',
        amber:            'var(--c-amber)',
        purple:           'var(--c-purple)',
        green:            'var(--c-green)',
        'green-deep':     'var(--c-green-deep)',
        red:              'var(--c-red)',
        'role-servicing': 'var(--c-role-servicing)',
        'role-admin':     'var(--c-role-admin)',
        'stage-brief':      'var(--c-stage-brief)',
        'stage-production': 'var(--c-stage-production)',
        'stage-ready':      'var(--c-stage-ready)',
        'stage-input':      'var(--c-stage-input)',
        'stage-scheduled':  'var(--c-stage-scheduled)',
        'role-creative':    'var(--c-role-creative)',
        'role-client':      'var(--c-role-client)',
      },
      fontFamily: {
        sans:  ['"DM Sans"', 'sans-serif'],
        serif: ['Fraunces', 'serif'],
        mono:  ['"IBM Plex Mono"', 'monospace'],
      },
      fontSize: {
        '2xs':  ['7px',   { lineHeight: '1.2' }],
        'xs':   ['8px',   { lineHeight: '1.3' }],
        'sm':   ['9px',   { lineHeight: '1.4' }],
        'base': ['13px',  { lineHeight: '1.55' }],
        'lg':   ['14px',  { lineHeight: '1.6' }],
        'xl':   ['16px',  { lineHeight: '1.3' }],
      },
      letterSpacing: {
        tight:  '-.01em',
        wide:   '.04em',
        wider:  '.08em',
        widest: '.14em',
      },
      borderRadius: {
        pill:   '100px',
        bubble: '16px 16px 4px 16px',
        card:   '12px',
        block:  '10px',
        chip:   '0px',
        sm2:    '8px',
        input:  '14px',
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
      },
      boxShadow: {
        memo:    '0 0 20px 4px rgba(193,95,60,0.25)',
        overlay: '0 30px 80px -20px rgba(0,0,0,.8)',
      },
      keyframes: {
        'memorized-pulse': {
          '0%':   { boxShadow: '0 0 0 0 rgba(193,95,60,0.4)',    transform: 'scale(0.98)' },
          '50%':  { boxShadow: '0 0 20px 4px rgba(193,95,60,0.25)', transform: 'scale(1)' },
          '100%': { boxShadow: '0 0 0 0 rgba(193,95,60,0)',       transform: 'scale(1)' },
        },
        'cw-dot-pulse': {
          '0%,80%,100%': { opacity: '0.2' },
          '40%':         { opacity: '1' },
        },
        'slide-up':   { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        'slide-down': { '0%': { transform: 'translateY(0)' },    '100%': { transform: 'translateY(100%)' } },
      },
      animation: {
        'memorized-pulse': 'memorized-pulse 2s ease-out',
        'cw-dot-pulse':    'cw-dot-pulse 1.4s infinite',
        'slide-up':        'slide-up 280ms ease',
        'slide-down':      'slide-down 280ms ease',
      },
      backgroundImage: {
        'terracotta-grad': 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))',
        'green-grad':      'linear-gradient(180deg, var(--c-green), var(--c-green-deep))',
        'memo-grad':       'linear-gradient(180deg, var(--c-bg-memo) 0%, var(--c-bg) 100%)',
        'brief-grad':      'linear-gradient(180deg, var(--c-bg-memo) 0%, var(--c-bg-2) 100%)',
      },
    },
  },
  plugins: [
    function scrollbarNone({ addUtilities }) {
      addUtilities({
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
        '.scrollbar-none::-webkit-scrollbar': {
          display: 'none',
        },
      });
    },
  ],
};
