# pcs-next

Sorted's React runtime. Strangler-fig migration target.

All legacy vanilla JS at the repo root stays untouched until the
corresponding flow is fully ported here and its vanilla counterpart
is deleted.

## Status

PR A1 — folder skeleton only. No build tool, no React, no JS.

## Planned structure (future PRs will populate)

    /pcs-next/
    ├── package.json       (PR A2)
    ├── vite.config.js     (PR A3)
    ├── src/
    │   ├── core/          (PR A6-A8)
    │   ├── flows/         (PR B1+)
    │   └── index.js       (PR A3)
    ├── dist/              (built output, committed from PR A3)
    └── README.md

## Build

    Not yet. See PR A2 and PR A3.

## Why not at repo root

Root already owns `package.json` for Vitest/Playwright dev deps.
Nesting a separate `package.json` here keeps the React build
fully isolated from root dev tooling and from the live vanilla
app.
