# CLAUDE.md — Hinglish Ops

> AI assistant guide for the Hinglish Ops codebase. Read this before making changes.

---

## Project Overview

**Hinglish Ops** is a content management dashboard for the Hinglish Agency, deployed as a static site on GitHub Pages (`guneygaar.github.io`). It is a vanilla JavaScript SPA with no framework, no bundler, and a Supabase backend.

| Aspect | Details |
|--------|---------|
| Stack | Vanilla JS, HTML, CSS — no framework |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Testing | Vitest 4.x + jsdom |
| CI | GitHub Actions (`npm test` on push/PR to `main`) |
| Deployment | GitHub Pages (no build step — files served as-is) |
| Auth | OTP via Supabase Auth (6-digit email code) |

---

## File Structure & Load Order

Scripts load via `<script defer>` in `index.html`. **All share a single global scope (no modules).**

```
01-config.js        Constants, stage/pillar definitions, role configs
02-session.js       Mutable global state (allPosts, currentRole, flags)
03-auth.js          OTP auth, session refresh, role activation
04-router.js        App entry point — runs _startRouter() on DOMContentLoaded (LAST)
05-api.js           Supabase REST wrapper, normalise(), file upload, logActivity()
06-post-create.js   New post modal, draft autosave (localStorage)
07-post-load.js     Data loading, realtime poll, ALL render functions (~3K lines, largest file)
08-post-actions.js  Stage updates, PCS modal, admin edit, drag/drop, swipe
09-approval.js      Public approval view (unauthenticated)
09-library.js       Library tab filtering & views (board, calendar, list)
10-ui.js            Toast, tabs, theme, overlays, utility helpers
utils.js            Pure functions extracted for testability
```

Supporting files:
```
index.html          Single HTML entry point (~64KB)
styles.css          All styling (~180KB), dark theme, CSS custom properties
vitest.config.js    Test config (jsdom environment)
package.json        Only devDependencies: vitest + jsdom
tests/              3 test files, 47 tests
sql/                Database migration scripts (reference only)
SYSTEM_MAP.md       Detailed architecture reference
```

---

## Development Workflow

### Running Tests

```bash
npm test          # Run all tests (vitest run)
```

Tests are in `tests/` — currently covering config integrity, utility functions, and API normalisation.

### CI Pipeline

GitHub Actions (`.github/workflows/test.yml`) runs `npm test` on every push/PR to `main`. Node 20, npm ci.

### No Build Step

There is **no bundler, transpiler, or build process**. Edit files directly; they are served as-is by GitHub Pages.

---

## Key Conventions

### File Naming
- **Numbered prefixes** (`01-` to `10-`) indicate load order — every file depends on those loaded before it.
- `utils.js` is the exception (loaded independently for testability).

### Data Conventions
| Data | Format |
|------|--------|
| Stage keys | Lowercase with spaces: `in production`, `awaiting approval`, `revisions needed` |
| Pillar keys | Lowercase: `leadership`, `innovation`, `sustainability`, etc. |
| Owner names | Capitalized: `Pranav`, `Chitra`, `Client` |
| Dates | ISO 8601 (`YYYY-MM-DD`) in DB, formatted for display via locale helpers |
| Post IDs | `POST-{timestamp}` or `REQ-{timestamp}` |

### Global State
All shared state lives on `window.*` — there is no module system:
- `window.allPosts` — current post data array
- `window.currentRole` — active user role
- `window._modalOpen` — prevents renders while overlay is open

### Security
- All user data **must** be escaped via `esc()` before inserting into HTML (XSS prevention).
- Supabase anon key is public (in `01-config.js`); RLS policies protect data server-side.
- `apiFetch()` never calls `logout()` on 401 — only explicit user action destroys sessions.

### Roles
Four roles with different visibility: `Admin`, `Servicing`, `Creative`, `Client`.
- Role configs are in `01-config.js` (`ROLE_STAGES`, `ROLE_TABS`, `ROLE_BUCKETS`).
- Client role gets a completely separate view (`#client-view`).

### Optimistic Updates
`quickStage()` and `updatePost()` update in-memory state first, render immediately, then call the API. On failure, they roll back and show an error toast.

### Modal Guard
`_modalOpen` flag prevents background poll renders from destroying DOM while the user is interacting. All modal close functions call `_drainDeferredRender()` to flush pending updates.

### Realtime Polling
- Data poll every 15 seconds (skipped if tab hidden or modal open).
- Token refresh every 50 minutes.
- Change detection via lightweight fingerprint string (count + id:stage pairs).

---

## Styling

- Single `styles.css` with CSS custom properties (design tokens).
- Dark theme by default (`data-theme="dark"`).
- Fonts: DM Sans (body), IBM Plex Mono (code) via Google Fonts.
- Spacing tokens: `--sp-1` (4px) through `--sp-7` (48px).
- No CSS preprocessor.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `posts` | Core content items with stage, owner, pillar, dates |
| `tasks` | Assigned tasks (Admin creates, assignees complete) |
| `activity_log` | Audit trail for all post mutations |
| `user_roles` | Email-to-role mapping (read-only from app) |
| `post-assets` (storage) | Uploaded files per post |

SQL migrations are in `sql/` for reference.

---

## Architecture Reference

For detailed function-level documentation, see `SYSTEM_MAP.md`. It covers:
- Auth flow and localStorage keys
- Router boot sequence
- API wrapper behavior
- Render pipeline and function index
- All database write paths
- Stage workflow diagram
- Role-based access matrix
- Overlay/modal z-index stack

---

## Output Format

After completing any task, always provide a final summary in a single code block covering:
- What was changed
- What files were affected
- What manual steps are needed (if any)
- Any assumptions made

## Report Format

When asked for an audit, test, verification, or any summary report, always return the full report in a single code block so it can be copied easily.

---

## Common Pitfalls

1. **Don't use ES modules** — all code runs in global scope via `<script defer>`. No `import`/`export`.
2. **Don't add a bundler** — the project deliberately avoids build tools.
3. **Escape user data** — always use `esc()` before injecting into HTML strings.
4. **Respect load order** — a file can only reference globals set by files with lower numbers.
5. **Don't call `logout()` from API error handlers** — 401s can be transient; only user action should destroy sessions.
6. **Guard renders with `_modalOpen`** — never call `renderAll()` while a modal is open; use `scheduleRender()` which checks the flag.
7. **Update `allPosts` in memory** when making changes — the optimistic update pattern requires it for responsive UI.
8. **Log all mutations** — every post write should call `logActivity()` for the audit trail.
