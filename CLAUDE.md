# CLAUDE.md — Sorted (srtd.io)

> AI assistant guide for the Sorted codebase. Read this before making changes.

---

## Section 1 — Product Identity

**Sorted** (srtd.io) is a social media content operations platform for agencies.
Not a scheduler. A workflow and client trust tool. Deployed as a static site on
GitHub Pages (`guneygaar.github.io`), vanilla JavaScript SPA with Supabase backend.

| Aspect | Details |
|--------|---------|
| Stack | Vanilla JS, HTML, CSS — no framework, no bundler |
| Backend | Supabase (PostgreSQL + Auth + Storage) via R2 worker |
| Testing | Vitest 4.x + jsdom (unit), Playwright (E2E) |
| CI | GitHub Actions (`npm test` on push/PR to `main`) |
| Deployment | GitHub Pages (no build step — files served as-is) |
| Auth | OTP via Supabase Auth (6-digit email code) |

Key features:
- WhatsApp OG preview (`srtd.io/p/XXXX` short links)
- Dual-channel comments (client-visible + internal notes via visibility field)
- Pipeline urgency with owner colors
- Task system inside comment threads
- Newspaper headline dashboard

Team:
- Shubham — Admin (`#C8A84B` gold)
- Chitra — Servicing (`#22D3EE` cyan)
- Pranav — Creative (`#9b87f5` purple)
- Manisha + Shivangini — Clients (`#FF4B4B` red)

---

## Section 2 — File Architecture & Load Order

Scripts load via `<script defer>` in `index.html`. **All share a single global scope (no modules).**

Actual load order from index.html (this order is sacred):

```
 1. 01-config.js             Constants, ROLE_STAGES, ROLE_TABS, ROLE_BUCKETS (218 lines)
 2. 02-session.js            Session globals init — 11 window.* properties (19 lines)
 3. utils.js                 Pure functions: esc(), formatDate(), resolveActor() (testable)
 4. 03-auth.js               OTP auth, session refresh, role activation (354 lines)
 5. 05-api.js                apiFetch(), normalise(), uploadPostAsset(), logActivity() (150 lines)
 6. 10-ui.js                 Toast, tabs, theme, overlays, notifications (1549 lines)
 7. 06-post-create.js        New post modal, draft autosave (429 lines)
 8. render/dashboard.js      Dashboard render + scoreboard (1283 lines, 25 window.* fns)
 9. render/client.js         Client feed render (1744 lines, 16 window.* fns)
10. render/pipeline.js       Pipeline render (1300 lines, 28 window.* fns)
11. render/brief.js          Brief overlay render (475 lines, 6 window.* fns)
12. actions/pcs.js           Post Card System overlay (2318 lines, 89KB, 58 window.* fns)
13. 07-post-load.js          Data loading, realtime poll, merge + schedule render (2534 lines)
14. 08-post-actions.js       Stage changes, admin edit, quickStage(), updatePost() (664 lines)
15. 09-library.js            Library tab filtering & views (1371 lines)
16. 09-approval.js           Public approval view (unauthenticated)
17. 04-router.js             Routing — runs _startRouter() on DOMContentLoaded (LAST, 63 lines)
```

Supporting files:
```
index.html               Single HTML entry point (1647 lines, ~74KB)
styles.css               All styling (6349 lines, ~188KB), dark theme, CSS custom properties
vitest.config.js         Unit test config (jsdom environment)
playwright.config.js     E2E test config
r2-upload-worker.js      Cloudflare R2 upload worker
package.json             Only devDependencies: vitest + jsdom
tests/                   8 unit test files, 133 tests
tests/e2e/               3 Playwright E2E specs
sql/                     Database migration scripts (reference only)
SYSTEM_MAP.md            Detailed architecture reference
```

CRITICAL RULES:
- **04-router.js must always be the LAST script tag**
- render/ and actions/ directories are core — not optional
- Numbered prefixes no longer match load position (10-ui.js loads 6th, not 10th)
- The actual `<script>` order in index.html is the only truth

---

## Section 3 — Session State (02-session.js)

All shared state lives on `window.*` — there is no module system.
`02-session.js` declares these 11 globals:

```
window.allPosts        = []           — current post data array
window.cachedPosts     = []           — previously fetched posts
window.currentRole     = 'Admin'      — active user role
window.effectiveRole   = (from localStorage pcs_role_preview)  — admin role preview
window._renderTimer    = null         — debounce timer for render
window._retryCount     = 0            — API retry counter
window._retryTimer     = null         — retry delay timer
window._unreadCount    = 0            — notification badge count
window._realtimeTimer  = null         — poll interval handle
window.allTasks        = []           — task list data
window._modalOpen      = false        — true while any overlay/PCS is open
window._deferredRender = false        — true if render was skipped due to open modal
```

---

## Section 4 — Database Schema

Supabase URL: `vxokfscjzytpgdrmertk.supabase.co`

| Table | Purpose | Key columns (from apiFetch calls) |
|-------|---------|----------------------------------|
| `posts` | Core content items | post_id(text PK), title, stage, owner, content_pillar, location, target_date, linkedin_link, comments, canva_link, status_changed_at, format, caption(text), images(jsonb), client_feedback(text), created_at, updated_at |
| `post_comments` | Dual-channel comment threads | id, post_id, author, author_role, message, visibility, reply_to, attachments(jsonb), mentioned_users(text[]), read(boolean), resolved(boolean), deleted(boolean), created_at |
| `notifications` | Per-role notification feed | id, type, message, read(boolean), created_at, post_id, user_role, actor |
| `tasks` | Assigned tasks (dashboard) | id(bigint), assigned_to, message, due_date, done(boolean), created_at |
| `activity_log` | Audit trail for post mutations | id, post_id, actor, action, old_stage, new_stage, created_at |
| `user_roles` | Email-to-role mapping (read-only) | id(uuid PK), email(unique), role, name |
| `post-assets` (storage) | Uploaded files per post via R2 | path: post-assets/{post_id}/{timestamp}.{ext} |

Client requests use the `posts` table with `REQ-{timestamp}` post IDs.

PostgREST eq. filter is **CASE-SENSITIVE** — always capitalize roles
(`'Creative'` not `'creative'`, `'Admin'` not `'admin'`).

---

## Section 5 — Design System

- Single `styles.css` with CSS custom properties (design tokens).
- Dark theme by default (`data-theme="dark"`).
- Fonts: DM Sans (body, UI), IBM Plex Mono (labels, mono, meta) via Google Fonts.
- Spacing tokens: `--sp-1` (4px) through `--sp-7` (48px).
- No CSS preprocessor.
- 292 uses of `rgba()` in styles.css (shadows, dims, borders).

Core colors (from styles.css `:root`):
```
--gold:     #C8A84B        --green:    #3ECF8E
--red:      #FF4B4B        --amber:    #F6A623
--cyan:     #22D3EE        --purple:   #9b87f5
```

Owner colors:
```
Shubham (Admin):     #C8A84B (gold)
Chitra (Servicing):  #22D3EE (cyan)
Pranav (Creative):   #9b87f5 (purple)
Client:              #FF4B4B (red)
```

Image compression (05-api.js `_compressImage`):
- Post images: max 1200x1200px, quality 0.82, saves as .jpg

---

## Section 6 — Infrastructure

```
R2 Worker:      srtd-r2-upload.ksg-kumarshubhamgune.workers.dev
R2 public URL:  pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev
Upload secret:  srtd2026xK9mN3pQ (in 05-api.js and r2-upload-worker.js)
CORS origin:    srtd.io (r2-upload-worker.js)
Short URLs:     srtd.io/p/XXXX (used in PCS WhatsApp share)
```

---

## Section 7 — Development Workflow

### Running Tests

```bash
npm test              # Run unit tests (vitest run)
npx playwright test   # Run E2E tests
```

### Current Test Counts (as of 2026-04-01)

```
Unit test files:  8 passed (8 total)
Unit tests:       133 passed (133 total)
E2E specs:        3 (client-feed.spec.js, pcs.spec.js, smoke.spec.js)
```

Unit test files:
```
tests/config.test.js        — config integrity
tests/dom-sanity.test.js    — DOM structure checks
tests/normalise.test.js     — API normalisation
tests/notifications.test.js — notification logic
tests/postlookup.test.js    — post lookup logic
tests/role.test.js          — role config checks
tests/timestamp.test.js     — timestamp formatting
tests/utils.test.js         — utility functions
```

### CI Pipeline

GitHub Actions (`.github/workflows/test.yml`) runs `npm test` on every push/PR to `main`. Node 20, npm ci.

### No Build Step

There is **no bundler, transpiler, or build process**. Edit files directly; they are served as-is by GitHub Pages.

---

## Section 8 — Deployment Rules

1. Bump ALL 18 `?v=` strings in index.html together (1 CSS + 17 JS).
   Format: `?v=YYYYMMDDx` (current: `?v=20260329Y`).
   Comment at line 1043: "bump ALL v= strings together on every deploy"
2. No build step — files served as-is by GitHub Pages.
3. Never use raw `fetch()` for Supabase — always use `apiFetch()`.
4. `esc()` lives in `utils.js` — always use it before injecting user data into HTML.

---

## Section 9 — Key Conventions

### Data Conventions
| Data | Format |
|------|--------|
| Stage keys | Lowercase with underscores after normalise(): `in_production`, `awaiting_approval` |
| Pillar keys | Lowercase: `leadership`, `innovation`, `sustainability`, etc. |
| Owner names | Capitalized: `Pranav`, `Chitra`, `Client` |
| Dates | ISO 8601 (`YYYY-MM-DD`) in DB, formatted for display via locale helpers |
| Post IDs | `POST-{timestamp}` or `REQ-{timestamp}` |

### Roles
Four roles with different visibility: `Admin`, `Servicing`, `Creative`, `Client`.
- Role configs are in `01-config.js` (`ROLE_STAGES`, `ROLE_TABS`, `ROLE_BUCKETS`).
- Client role gets a completely separate view (`#client-view`).
- Admin can preview other roles via `effectiveRole` / `pcs_role_preview` localStorage key.

### Security
- All user data **must** be escaped via `esc()` (in `utils.js`) before inserting into HTML.
- Supabase anon key is public (in `01-config.js`); RLS policies protect data server-side.
- `apiFetch()` never calls `logout()` on 401 — attempts one silent token refresh, then throws.
- Upload secret `srtd2026xK9mN3pQ` is in plaintext in `05-api.js` and `r2-upload-worker.js`.

### Optimistic Updates
`quickStage()` and `updatePost()` (in `08-post-actions.js`) update in-memory state first, render immediately, then call the API. On failure, they roll back and show an error toast.

### Modal Guard
`_modalOpen` flag prevents background poll renders from destroying DOM while the user is interacting. All modal close functions call `_drainDeferredRender()` to flush pending updates.

### Realtime Polling (07-post-load.js)
- Data poll every 15 seconds (skipped if tab hidden or modal open).
- Token refresh every 50 minutes.
- Change detection via lightweight fingerprint string (count + ids + stages).

---

## Section 10 — Global Functions Index

### 03-auth.js (3 window functions)
```
window.sendMagicLink          — send OTP email
window.verifyOTPCode          — verify 6-digit OTP
window.resetRolePreview       — clear admin role preview
```

### render/dashboard.js (25 window functions)
```
window._safeStage             — safe stage accessor
window.getScoreboardCounts    — count posts per stage
window.getScoreboardData      — build scoreboard data
window.dashPad                — zero-pad numbers
window.updateDashGreeting     — time-based greeting
window.updateDashKicker       — headline kicker text
window.updateDashDeck         — deck subtext
window.updateDashDatetime     — live datetime display
window.renderScoreboard       — render scoreboard section
window._renderDashTaskList    — render task list for role
window.toggleDashTask         — toggle task done state
window.openRunwaySheet        — open runway overlay
window.openPostOverSheet      — open post overview sheet
window.openStageSheet         — open stage detail sheet
window._buildDoThisNowItems   — build priority action items
window.renderDashboard        — main dashboard entry point
window._renderDashboardInner  — inner dashboard render
window.updateBelowFold        — update below-fold sections
window._updateNextScheduled   — next scheduled post widget
window._updateTodaysFocus     — today's focus widget
window._updateLastMove        — last pipeline move widget
window._timeAgo               — relative time string
window._updateUnsaidThing     — unsaid thing widget
window._updateDashTimestamp   — live timestamp update
window.updateDashboardHeader  — dashboard header update
```

### render/client.js (16 window functions)
```
window._openClientCardMenu    — client card context menu
window._restoreAgencyNav      — restore agency navigation
window._clientSetReply        — set reply target
window._clientClearReply      — clear reply target
window._clientFeedHandleImg   — handle image upload in client feed
window.renderClientView       — main client view entry point
window._openClientPostOverlay — open client post detail overlay
window.openClientRequestForm  — open client request form
window._closeReqForm          — close request form
window._reqToggleChip         — toggle request type chip
window._reqSetUrgency         — set request urgency
window._reqPreviewFile        — preview uploaded file
window._reqClearUpload        — clear file upload
window._reqAddPhotos          — add photos to request
window._reqUpdatePhotoCount   — update photo count display
window._reqValidate           — validate request form
```

### render/pipeline.js (28 window functions)
```
window.openPipelineSearch     — open search bar
window.closePipelineSearch    — close search bar
window.updatePipelineCritical — update critical items
window.updatePipelineStageBar — update stage bar
window.filterPipelineStage    — filter by stage
window._applyPFFilter         — apply pipeline filter
window.openSearchResult       — open search result
window.handlePipelineSearch   — handle search input
window.togglePipelineGroup    — toggle stage group
window.togglePipelinePub      — toggle published view
window._pipelineStageKey      — stage key helper
window.buildPipelineCard      — build pipeline card HTML
window.updatePipelineChipCounts — update chip counts
window.updatePersonStripCounts  — update person strip counts
window.filterPipelineByPerson — filter by person
window.filterPipelineByChip   — filter by chip
window.toggleBatchMode        — toggle batch mode
window.toggleBatchCard        — toggle card batch selection
window.updateBatchCount       — update batch count
window.executeBatchAction     — execute batch stage change
window.renderPipeline         — main pipeline entry point
window.updatePipelineHeader   — pipeline header update
window.updatePipelineNarrative — narrative text update
window.filterFromNarrative    — filter from narrative link
window._renderPipelineInner   — inner pipeline render
window.copyChase              — copy chase message
window.fallbackCopy           — fallback clipboard copy
window.chaseAll               — chase all overdue
```

### render/brief.js (6 window functions)
```
window._openBriefSheet        — open brief overlay
window._assignBriefToPranav   — assign brief to Pranav
window._closeBriefConfirm     — close brief with confirm
window._closeBrief            — close brief overlay
window._reopenBrief           — reopen closed brief
window._createPostFromBrief   — create post from brief
```

### actions/pcs.js (58 window functions)
```
window.openPCS / closePCS / forcePCSReset           — PCS lifecycle
window._renderPCS                                    — main PCS render (~307 lines)
window._updateSubtitle / _pcsTitleEdit               — title/subtitle editing
window.changeStage                                   — stage change from PCS
window._showPublishSheet / _removePublishSheet       — publish confirmation
window._saveLiUrlInline                              — save LinkedIn URL (46 lines)
window.loadPcsComments                               — load dual-channel comments (343 lines)
window._showStageConfirm                             — stage change confirmation
window._buildStageProgress / _buildInlineActions     — PCS UI builders
window._pcsEditLink / pcsCloseAttach                 — link editing
window._loadPCSActivity                              — load activity log
window._buildInfoGrid                                — post info grid (~81 lines)
window._buildNotes / _renderAdvanceButton            — notes + advance button
window._renderActivityCount / _removePcsConfirm      — activity count + confirm
window.pcsConfirmDelete                              — delete post
window._pcsAddPhotos / _pcsPhotoMenu                 — photo management
window._pcsCaptionMenu / _pcsCopyCaption             — caption menu
window._pcsConfirmReplace / _pcsDoReplace            — caption replace
window._pcsOpenLightbox / _pcsLbRender / _pcsLbNext  — lightbox
window._pcsLbPrev / _pcsLbClose / _pcsLbDownload     — lightbox controls
window._startCaptionEdit / _cancelCaptionEdit        — caption editing
window._sharePostOnWhatsApp                          — WhatsApp share (~230 lines)
window.toggleTaskResolve                             — toggle task resolved
window._initMentionDropup                            — @mention dropdown
window._showTaskAssign / submitPcsTask               — task assignment
window._pcsRenderImgPreviews / _pcsRemoveCommentImg  — comment image previews
window._pcsSetReply / _pcsClearReply                 — reply system
window._pcsCopyComment / _pcsConfirmDeleteComment    — comment actions
```

### Non-window top-level functions (~229 across all files)
These are declared with `function name()` or `async function name()` in global scope.
Key ones in 08-post-actions.js: `quickStage()`, `updatePost()`, `openAdminEdit()`,
`closeAdminEdit()`, `saveAdminEdit()`, `clientApprove()`, `submitClientRequest()`,
`deletePost()`, `handleOwnerChange()`, `refreshSystemViews()`.

---

## Section 11 — Common Pitfalls

1. **Don't use ES modules** — all code runs in global scope via `<script defer>`. No `import`/`export`.
2. **Don't add a bundler** — the project deliberately avoids build tools.
3. **Escape user data** — always use `esc()` (in `utils.js`) before injecting into HTML strings.
4. **Respect load order** — the `<script>` order in index.html is the source of truth, not the file prefix numbers.
5. **Don't call `logout()` from API error handlers** — 401s can be transient; only user action should destroy sessions.
6. **Guard renders with `_modalOpen`** — never call `renderAll()` while a modal is open; use `scheduleRender()` which checks the flag.
7. **Update `allPosts` in memory** when making changes — the optimistic update pattern requires it for responsive UI.
8. **Log all mutations** — every post write should call `logActivity()` for the audit trail.
9. **Bump all 18 `?v=` strings together** — never change just one file's cache buster.
10. **PostgREST is case-sensitive** — role values must be capitalized in API filters.
11. **04-router.js must be last** — it runs `_startRouter()` on DOMContentLoaded.
12. **actions/pcs.js calls window.* functions from 09-library.js** — these must stay on window.

---

## Section 12 — Architecture Reference

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

## Section 13 — Output Format

After completing any task, always provide a final summary in a single code block covering:
- What was changed
- What files were affected
- What manual steps are needed (if any)
- Any assumptions made

## Report Format

When asked for an audit, test, verification, or any summary report, always return the full report in a single code block so it can be copied easily.

---

## Section 14 — Self-Maintenance Rule

CLAUDE.md MUST be updated in every PR that changes code — no exceptions.

After every code change, update:
- File list if any file was added or removed
- Line counts if files grew or shrank significantly
- Test count to actual passing count after running vitest
- `?v=` version string to latest deployed value
- Global functions index if any window.* added or removed
- Any section that contradicts the new code

CLAUDE.md is committed in the SAME PR as the code change.
A stale CLAUDE.md is worse than no CLAUDE.md.
