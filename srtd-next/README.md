# srtd-next

## TypeScript

Strict mode, allowJs:true. NEW files MUST be `.ts` or `.tsx`,
NEVER `.js` or `.jsx`. Existing `.js` files convert to `.ts`
when touched - the migration is incremental, not a big-bang
rewrite. Type checking runs in CI via `npx tsc --noEmit`.

Vanilla repo root stays `.js` (retiring under strangler-fig).
Tooling configs (vite.config, tailwind.config, postcss.config)
stay `.js` per ecosystem convention.

Shared types live next to their canonical data (e.g. Stage
union in `src/shared/constants.ts`). Avoid premature global
type files; types accrete naturally as files convert.

---

Sorted's React runtime. Strangler-fig migration target.

All legacy vanilla JS at the repo root stays untouched until the
corresponding flow is fully ported here and its vanilla counterpart
is deleted.

## Structure

    /srtd-next/
    ├── package.json
    ├── vite.config.js
    ├── src/
    │   ├── core/          (tokens, bridges, stores, ui)
    │   ├── shared/        (cross-flow components, e.g. caption-workspace)
    │   ├── flows/         (create-post, …)
    │   └── index.jsx
    ├── dist/              (built output, committed)
    └── README.md

## Build

    cd srtd-next && npm run build

Produces `dist/sorted-react.js` (IIFE, esbuild-minified). Load it from
the vanilla `index.html` with a matching `?v=` cache-bust.

## Why not at repo root

Root already owns `package.json` for Vitest/Playwright dev deps.
Nesting a separate `package.json` here keeps the React build
fully isolated from root dev tooling and from the live vanilla
app.
