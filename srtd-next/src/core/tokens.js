// Sorted React design tokens. Warm ink palette, claude accent,
// type stacks. Consumed as inline style values. Kept as plain
// JS object for maximum compatibility with React 19 inline
// style prop + tree-shaking.

export const tokens = {
  // Warm ink surfaces
  ink0: '#0E0B08',
  ink1: '#1A1816',
  ink2: '#221E1A',
  ink3: '#28231D',

  // Hairlines
  line: '#2F2822',
  lineSoft: '#241F1A',
  lineWhisper: '#1E1A16',
  lineStrong: '#3D342A',

  // Text hierarchy
  textLoud: '#F2EDE4',
  text: '#C8C0B2',
  textSoft: '#8E8578',
  textWhisper: '#5F584D',
  textGhost: '#3A342C',

  // Accent (terracotta)
  claude: '#C15F3C',
  claudeSoft: '#C15F3C14',
  claudeBorder: '#C15F3C40',

  // Semantic
  good: '#7DBE8A',
  warn: '#D4A15C',
  danger: '#E67463',
  red: '#E45F4C',

  // Owner role colors (from CLAUDE.md §4 design system)
  ownerChitra: '#22D3EE',
  ownerPranav: '#9B87F5',
  ownerClient: '#FF4B4B',

  // Type stacks
  serif: "'Fraunces', Georgia, serif",
  sans: "system-ui, -apple-system, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace"
};
