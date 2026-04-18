# Srtd React Design System

Quick reference for every component built under `srtd-next/src/`. Source of truth is `tailwind.config.js`; the JS mirror lives in `src/core/theme/index.js` for inline-required contexts (SVG fills, computed numeric styles, icon color props).

**System-governed light + dark.** Default is warm paper (light). `@media (prefers-color-scheme: dark)` flips the whole palette to warm ink that matches vanilla exactly. No runtime toggle in v1 — the OS decides. All tokens are CSS custom properties (`--c-*`); Tailwind colors resolve via `var(--c-*)`.

## Theme

- React modals respect the user's system color scheme via `prefers-color-scheme`.
- Vanilla app (`/index.html` + `styles.css` + all `render/*.js`) remains **dark-only** until migrated. Expect a temporary mismatch on light-scheme devices: the vanilla shell stays dark while the React modal honours light. This is intentional during the strangler-fig transition.
- No class-toggled theme. No runtime switch button. Users change mode in iOS Settings or macOS System Preferences.
- Every token defined in `@layer base { :root }` and overridden inside `@media (prefers-color-scheme: dark) { :root }` — see `src/styles/tailwind.css`.

## Tokens

### Colors (Tailwind utility → CSS var → hex)

| Class | CSS var | Light | Dark |
|---|---|---|---|
| `bg` | `--c-bg` | `#FAF8F3` | `#1A1816` |
| `bg-2` | `--c-bg-2` | `#F4F0E8` | `#201E1A` |
| `bg-3` | `--c-bg-3` | `#EBE6DC` | `#252320` |
| `bg-draft` | `--c-bg-draft` | `#F7EDE0` | `#201810` |
| `bg-pill` | `--c-bg-pill` | `#F0E8DB` | `#201C18` |
| `bg-memo` | `--c-bg-memo` | `#F7EDE0` | `#1E1610` |
| `border-neutral` | `--c-border-neutral` | `#D8D2C4` | `#3A3632` |
| `border-warm` | `--c-border-warm` | `#C9B89C` | `#5A3A2C` |
| `divider-warm` | `--c-divider-warm` | `#D8C8AC` | `#3A3220` |
| `divider-soft` | `--c-divider-soft` | `#E3DCCC` | `#2A2622` |
| `text-loud` | `--c-text-loud` | `#1A1816` | `#F4F3EE` |
| `text-mid` | `--c-text-mid` | `#4A4640` | `#B1ADA1` |
| `text-soft` | `--c-text-soft` | `#7A7670` | `#7A7670` |
| `text-dim` | `--c-text-dim` | `#A8A498` | `#4A4640` |
| `terracotta` | `--c-terracotta` | `#B85430` | `#C15F3C` |
| `terracotta-1 / -2` | gradient stops | `#C15F3C` / `#9E4526` | `#D46840` / `#B85430` |
| `amber` | `--c-amber` | `#C8841A` | `#F6A623` |
| `purple` | `--c-purple` | `#6B4FD9` | `#9B87F5` |
| `green / green-deep` | success / gradient | `#1FA66E` / `#147A4F` | `#3ECF8E` / `#2AA670` |
| `red` | error | `#D83838` | `#FF4B4B` |
| `role-servicing` | Chitra | `#0891A0` | `#22D3EE` |
| `role-admin` | Shubham | `#8E7A2E` | `#C8A84B` |

Light-mode values are darker/deeper so accents remain legible against the warm-paper background. Dark-mode values are lifted from the vanilla styles.css warm-ink palette exactly.

### Fonts

| Utility | Family | When |
|---|---|---|
| `font-sans` | DM Sans | Body prose, buttons, labels, UI chrome |
| `font-serif` | Fraunces | Headings, drafts, primary inputs (feels like writing) |
| `font-mono` | IBM Plex Mono | Meta labels, counters, eyebrows (`✦ IMPORT BRIEF`) |

### Font size (vanilla-faithful scale, not Tailwind defaults)

`2xs` 7px · `xs` 8px · `sm` 9px · `base` 13px · `lg` 14px · `xl` 16px.

### Letter spacing

`tracking-tight` `-.01em` · `tracking-wide` `.04em` · `tracking-wider` `.08em` · `tracking-widest` `.14em`.

### Radii

`rounded-pill` 100px · `rounded-card` 12px · `rounded-block` 10px · `rounded-sm2` 8px · `rounded-input` 14px · `rounded-chip` 0px · `rounded-bubble` 16/16/4/16.

### Spacing

`pb-safe-b` applies `padding-bottom: env(safe-area-inset-bottom, 0px)` so overlays never tuck under the iOS home-indicator bar.

### Shadows

`shadow-memo` terracotta-tinted ring · `shadow-overlay` 0 30px 80px modal drop.

### Animations

`animate-memorized-pulse` (2s, one-shot) · `animate-cw-dot-pulse` (1.4s, loop) · `animate-slide-up` / `animate-slide-down` (280ms, ease).

### Gradients

All gradient stops resolve to `var(--c-*)`, so the gradient itself flips palette with system preference.

`bg-terracotta-grad` · `bg-green-grad` · `bg-memo-grad` · `bg-brief-grad`.

## Patterns

- **Overlay.** `fixed inset-0 z-[1501] bg-bg flex flex-col animate-slide-up`. Backdrop = sibling at `z-[1500] bg-black/80`. Never nest inside another stacking-context parent.
- **Card.** `bg-bg-2 border border-divider-soft rounded-card p-4`. Draft: `bg-bg-draft border-border-warm`. Frozen: `animate-memorized-pulse`.
- **Chip.** `className="btn-chip"` (component class). `btn-chip-dim` (disabled) · `btn-chip-primary` (filled terracotta).
- **Input pill.** `bg-bg-pill rounded-pill flex items-center gap-2 px-4 py-2` + textarea (`border-0 bg-transparent font-serif`).
- **Meter pill / Brief pin.** Small rounded-pill with icon + label; collapsed ~36px tall; tap expands to full card.

## Rules

1. **No hex inline** outside `src/core/theme/index.js`. Grep gate: `grep -rE '#[0-9A-Fa-f]{3,8}' src/` should only hit `core/theme/`.
2. **No `style={{}}` for static styling.** Tailwind utilities only. Dynamic-only (computed widths, lucide icon colors) may use `style={{}}` with values from `core/theme/index.js` — they flow through `var(--c-*)` and therefore respect the active theme.
3. **Mono for labels, sans for prose, serif for drafts.** Don't mix serif inside UI chrome.
4. **Match vanilla visual language exactly in dark mode.** Before shipping a component, diff it against the vanilla equivalent at 3 viewport widths.
5. **Dark + light.** No `dark:` variants needed in JSX — tokens auto-flip.
6. **Colors by role, not hex.** `bg-bg-2` not `bg-[#201E1A]`.
7. **Canvas / SVG fill contexts** that can't consume `var()` should call `getResolvedColor('terracotta')` which reads the currently active computed value from `:root`.

## Migration status (B5.5a.5-pre)

- Tailwind v3 installed in `srtd-next/` with system-governed light + dark tokens.
- `src/styles/tailwind.css` declares both palettes as CSS custom props inside `@layer base`.
- `src/core/theme/index.js` exposes var references (`cssVar`, `colors`, `getResolvedColor`) + static utilities (`costToINR`, `formatINR`, `fonts`).
- **Component migration is per-file follow-up.** This PR ships the foundation only. The 11 create-post components + shared/caption-workspace still render via inline styles from `core/tokens.js`. Both modules coexist until each component is migrated one-by-one with per-PR visual verification.
