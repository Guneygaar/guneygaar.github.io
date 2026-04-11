# CLAUDE.md — Sorted (srtd.io)

Last updated: 2026-04-11 (poll-stash). Full history: `CLAUDE-archive-20260411.md`.

## 1 — WHAT IS SORTED

Social media content ops platform for agencies — workflow + client trust, NOT a scheduler.

Stack: Vanilla JS (no framework, no build step), Supabase (PostgREST + auth), Cloudflare Workers + R2, GitHub Pages, Resend (email).

Repo: `github.com/Guneygaar/guneygaar.github.io`. ALL files at REPO ROOT. Never reference `/sorted/` — it does not exist. Subdirs: `render/ actions/ tests/ tests/e2e/ sorted-preview-worker/ sql/ preview/ mockups/`.

Deploy: branch `main-/-root` → `srtd.io` (Cloudflare Pages).

Team: Shubham (Admin), Chitra (Servicing), Pranav (Creative), Manisha + Shivangini (Client).

## 2 — DB SCHEMA

Supabase: `vxokfscjzytpgdrmertk.supabase.co`. Always `apiFetch()`, never raw `fetch()`. PostgREST `eq.` is CASE-SENSITIVE — use Title Case roles (`Admin`, `Servicing`, `Creative`, `Client`).

**posts** — PK `post_id` text
| col | type | notes |
|---|---|---|
| id | uuid | |
| post_id | text | PK |
| title, stage, owner, content_pillar, location, format, caption, canva_link, linkedin_link, internal_notes, client_feedback, linked_post_id, created_by, updated_by | text | |
| target_date | date | |
| created_at, updated_at, status_changed_at | timestamptz | |
| images | jsonb | |

NO `comments` column on posts. Never write to it.

**post_comments** — PK id(uuid). Client-facing. Cols: post_id, author, author_role, message(text), created_at(timestamptz), edited_at(timestamptz), visibility(text), mentioned_users(array), resolved(bool), attachments(jsonb), read(bool), resolved_by, post_title, reply_to(uuid), deleted(bool).

**internal_notes** — PK id(uuid). Agency-only. Same shape as post_comments (including `edited_at`). `visibility` gates which agency roles see it.

**post_comment_reactions** — PK id(uuid). Cols: comment_id(uuid), post_id, author, author_role, emoji, created_at.

**user_roles** — PK id(uuid). Cols: email(unique), role(text), name(text). Access + role source of truth.

**requests** — PK id(text, REQ-*). Cols: title, description, created_by, created_at(timestamp), status(text), content_type, target_date(date), images(jsonb), drive_link. Status: `pending` → `assigned` → `closed`. NO `updated_at` column. Pending rows merged into `AppState.posts.all` with `_isRequest:true`.

**notifications** — PK id(uuid). Cols: user_role(text), post_id, type, message, read(bool), created_at, actor. RLS DISABLED. pg_cron `cleanup-old-notifications` deletes > 30 days at 03:00 UTC.

**activity_log** — PK id. Cols: post_id, actor, action, old_stage, new_stage, created_at, read, updated_by. Stage change history.

**audit_log** — PK id. Cols: post_id, action, old_value, new_value, changed_by, changed_at. Caption edit history. RLS unrestricted.

**error_log** — PK id(uuid). Cols: error_message, error_stack, user_email, user_role, page, action, created_at, app_version. Fed by `window.logError`. RLS DISABLED (keep off).

**tasks** — PK id(bigint). Cols: assigned_to, message, due_date, done(bool), created_at. RLS unrestricted.

**click_log** — telemetry sink (session_id, etc.) fed by `_flushClickBuffer`.

Storage: R2 bucket `sorted-images`. Public CDN `https://images.srtd.io/` (preferred) or legacy `pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev`.

## 3 — FILE MAP

21 versioned resources (1 css + 20 js). `00-appstate.js` + `00-appstate-compat.js` have NO `defer`. `04-router.js` MUST be the LAST script. `actions/pcs-longpress.js` must load AFTER `actions/pcs.js`.

Root:
- `00-appstate.js` — AppState brain, logError, onerror, onunhandledrejection, guardAction, _sessionId
- `00-appstate-compat.js` — illegal-access guards around AppState
- `01-config.js` — constants, ROLE_STAGES, ROLE_TABS, `setStage()` (pure stage mutator + logger)
- `02-session.js` — session globals
- `utils.js` — esc(), formatDate()
- `03-auth.js` — magic link, OTP, refreshSession (typed errors), cross-tab refresh lock, visibilitychange refresh, normalizeRole, `_teardownClientTokenTimer()` (cleans 50-min client token interval on logout)
- `04-router.js` — routing, deep-link handling (must be LAST script)
- `05-api.js` — apiFetch (no-cache headers, 401 retry), uploadPostAsset, logActivity, normalise
- `06-post-create.js` — new post form, asset input, WhatsApp KV preview seed
- `07-post-load.js` — loadPosts, loadPostsForClient(skipRenderIfUnchanged), mergePosts, startRealtime (agency 15s poll with modal-open fetch-and-stash), startClientRealtime/stopClientRealtime (client 30s poll), _postsFingerprint, _clientPostsFingerprint, _drainPollStash, _renderBackgroundViews, bottom sheets, _cardClickDelegate
- `08-post-actions.js` — quickStage, updatePost, clientApprove, _confirmPublish, _sendStageNotif, _startSaveTimeout/_clearSaveTimeout
- `09-approval.js` — client approval flow, submitApproval
- `09-library.js` — library view (calls `_renderPCS` directly — keep on window.*)
- `10-ui.js` — toasts, notifications panel, switchTab, Action Router, click telemetry flush

render/:
- `render/dashboard.js` — dashboard, scoreboard, runway/stage sheets
- `render/client.js` — client feed, comment input, new request overlay
- `render/pipeline.js` — pipeline view, batch mode, chip + person filters
- `render/brief.js` — brief sheet, dynamic assign dropdown, reassign

actions/:
- `actions/pcs.js` — Post Card System full-page overlay
- `actions/pcs-longpress.js` — long-press bottom sheet for PCS comments (wraps openPCS)

Other: `index.html`, `styles.css`, `r2-upload-worker.js`, `wrangler.toml`, `package.json`, `vitest.config.js`, `playwright.config.js`, `rollback.sql`, `sql/`, `preview/`, `sorted-preview-worker/`, `mockups/`.

## 4 — ARCHITECTURE RULES AND GOTCHAS

### AppState shape (`00-appstate.js`)
```
window.AppState = {
  user:   { name, email, role, effectiveRole, previewRole },
  posts:  { all, cached, loaded, source, parked, activityLogs, activityFetched, setAll(newPosts) },
  pcs:    { open, postId, post, editingTarget, closeTimer, pendingComment,
            lightbox:{images,index}, activeMenu, openedFrom },
  ui:     { modalOpen, deferredRender, activeTab, taskFilter, pipelineFilter,
            nrsUrgency, retryCount, retryTimer, realtimeTimer, unreadCount },
  timers: { tokenRefresh, dashDatetime, renderTimer }
}
```

### Mutation rules — never break
- NEVER `posts.all.push()`, `posts.all[i].x=y`, or `posts.all.splice()`.
- Add: `setAll(posts.all.concat([newPost]))`. Remove: `setAll(posts.all.filter(...))`. Update: `setAll(posts.all.map(...))`.
- `mergePosts` (07-post-load.js) uses `Object.assign` in place on each existing post so every module holding a reference sees the update. It SKIPS any post with `_isSaving === true` — never overwrite optimistic state during a poll.
- `AppState.pcs.post` is the SAME object as the row in `posts.all`. Apply server responses via `Object.assign(post, serverRow)`; do NOT replace the reference.

### _isSaving lock + 10-second safety net (08-post-actions.js)
- Before every PATCH: set `post._isSaving = true` and call `_startSaveTimeout(post, postId)`.
- On BOTH success and catch paths: `_clearSaveTimeout(post)` then `post._isSaving = false`.
- If a PATCH hangs > 10s (`_SAVE_TIMEOUT_MS = 10000`) the timer force-clears `_isSaving`, logs `[SAVE TIMEOUT]`, and calls `scheduleRender()`. A force-cleared post can be saved again immediately.
- `apiFetch` has NO timeout and NO AbortController — this timer is the only protection against indefinite hangs. Wired into `quickStage`, `clientApprove`, `_executeStageChange`/`Async`, `updatePost`.

### Client 30s polling (`startClientRealtime` in 07-post-load.js)
- Installed from `activateRole()` at 03-auth.js for every Client path; singleton via `window._clientPollTimer`. Cleared by `stopClientRealtime()`, which is called from `stopRealtime()` — so `logout()` / `_clearSessionAndLogin()` teardowns cascade automatically.
- Interval body guards IN ORDER: `document.hidden`, `sb_access_token`, `window._isLoadingClientPosts` (in-flight), and an active-typing check (`document.activeElement` is INPUT / TEXTAREA / contentEditable). Any guard hit → return without fetching.
- Delegates to `loadPostsForClient(true)`. The boolean `skipRenderIfUnchanged` flag makes the fetch re-render only when `_clientPostsFingerprint(posts.all) !== window._lastClientFp`. Initial load (no arg) renders unconditionally and seeds `_lastClientFp`.
- `_clientPostsFingerprint` extends `_postsFingerprint` with per-post `post_comments.length` so new comments trigger re-render (not just stage flips).
- `loadPostsForClient` skips overwriting `post.post_comments` for any post currently flagged `_commentSaving === true` (object-level lock set by `_handleSubmitComment` in render/client.js). This protects the optimistic comment row from poll clobber.
- `_teardownClientTokenTimer()` in 03-auth.js clears the 50-min client token interval on logout (previously leaked across logout/login cycles).
- `renderClientView` wires cv click listeners exactly ONCE via `cv._clientEventsWired` (render/client.js ~L2073). cv is persistent across re-renders (only innerHTML swaps), so unguarded `addEventListener` used to stack on every poll and break symmetric toggles like `_clientToggleComments`. Always guard cv-level listeners.
- Client @mention roster is fetched live from `/user_roles?select=name,email,role` on first render, cached in `window._clientMentionRoster` via `_fetchClientMentionRoster()` (render/client.js). `_clientToggleMention` and `_handleSubmitComment`'s mention-notification loop both read from that cache — no more hardcoded roster arrays.

### Render pipeline
- `setStage(post, stage)` is a PURE logger — mutates `post.stage` and appends to activity log. It does NOT touch `_isSaving`, does NOT fire notifications, does NOT render. Safe for rollback paths.
- `scheduleRender()` DEFERS when `AppState.ui.modalOpen === true`, flipping `window._deferredRender = true`. `_drainDeferredRender()` fires the queued render on modal close AND drains the agency poll stash via `_drainPollStash()`.
- `_postsFingerprint()` is a cheap hash of `posts.all`. Renderers skip rebuild when the fingerprint is unchanged — always mutate via `setAll` so the fingerprint changes.
- `_renderBackgroundViews()` re-renders dashboard + pipeline + client feed without tearing down PCS — call after a successful PATCH.
- PCS render goes through `_renderPCS()`. Do not mutate PCS DOM from other modules. `09-library.js` is the one exception (opens PCS without the router).

### Agency poll fetch-and-stash (`startRealtime` in 07-post-load.js)
- The 15s agency poll NO LONGER skips while a modal is open. It fetches, normalises, and if the fingerprint differs, stashes the fresh array in `window._postsPollStash` (+ `window._postsPollStashFp`). Latest-wins, no queue — subsequent polls overwrite the stash.
- `_drainPollStash()` in 07-post-load.js reads the stash, clears it, runs `mergePosts(stash)`, `scheduleRender()`, and `updateNotifBadge()`. It is a no-op when the stash is null.
- `_drainDeferredRender()` in 10-ui.js now calls `_drainPollStash()` unconditionally after its existing safeRender debounce — so every modal-close site that drains also picks up stashed poll data.
- Drain sites (all call `_drainDeferredRender` after setting `modalOpen = false`): `forcePCSReset` (actions/pcs.js:156), `closeAdminEdit` (08-post-actions.js:195), `closeNewPostModal` (06-post-create.js:231), `closeNotifications` (10-ui.js), `closePipelineFilter` (10-ui.js), `_lbClose` (render/client.js), client post overlay close + back-to-notifs paths (render/client.js).
- The client 30s poll (`startClientRealtime`) still has NO stash. It uses the active-typing guard + `_clientPostsFingerprint` to avoid clobbering open inputs, and does not need a modal gate.

### Runtime-enriched fields (NOT in DB — added by loadPosts)
- `_commentCount` (int), `_clientCommentAt` (ISO | null) — set after batch comment fetch.
- `_isRequest` (true) — set on rows merged from `requests`. Brief / assign / close / reopen all branch on this to route API calls to `/requests` vs `/posts`.
- `_isSaving` (bool) — optimistic save lock.
- `_saveTimer` — timer handle set by `_startSaveTimeout`, deleted by `_clearSaveTimeout`.
- `_commentSaving` (bool) — set by `_handleSubmitComment` (render/client.js) while a client comment POST is in flight; `loadPostsForClient` honours it and will not overwrite that post's `post_comments` until the insert resolves.

### Design system
- Zero border-radius on inputs/buttons. NO `rgba()` — use 8-digit hex (#RRGGBBAA). Approved exceptions: `.pcs-more-ov`, `.pcs-more-l`, SVG fill at index.html:1140.
- Colors: bg `#080808`, surface `#0d0d12`, comments bg `#191924`, text `#E8E8E8`/`#AEAEB2`/`#8E8E93`, gold `#C8A84B`, red `#FF4B4B`, green `#3ECF8E`, purple `#9b87f5`, cyan `#22D3EE`, amber `#F6A623`. Owners: Chitra `#22D3EE`, Pranav `#9b87f5`, Client `#FF4B4B`, Shubham `#C8A84B`.
- Fonts: IBM Plex Mono (labels/meta) + DM Sans (body/UI). Dark theme default.
- Use `100dvh`, never `100vh` (iOS Safari address bar).
- Image compression: posts max 1200px q0.82, comments max 800px q0.80, save as .jpg.

### Misc gotchas
- `_commentInputHtml()` only renders for stages `awaiting_approval` + `awaiting_brand_input` and MUST be called inside `_cardHtml()` or the input never exists.
- `apiFetch()` never calls `logout()` on 401 by design — refresh flow handles it.
- Silent `.catch(()=>{})` is a bug — always `window.logError`.
- 15-second poll interval (agency, startRealtime). 30-second poll interval (client, startClientRealtime). 50-minute token refresh.
- Client DB role takes absolute priority over `pcs_role_preview`.
- Deep link: `srtd.io/?open=POST_ID` → stored in `window._pendingOpenPost`, fired after loadPosts.
- PCS document-click-close listener skips close when the active dropdown contains `input[type="date"]` (native calendar interaction).
- `_cardClickDelegate` (07-post-load.js) guards `e.target.closest('input, textarea, button, [contenteditable="true"], a, [role="button"]')` — don't narrow the guard.
- Image download: `_pcsLbDownload` + `_pcsSaveAllPhotos` must strip BOTH `https://images.srtd.io/` and legacy `pub-*.r2.dev` prefix before hitting the R2 worker `/download?key=`.

## 5 — AUTH AND ROLES

DB roles (canonical, Title Case): `Admin`, `Servicing`, `Creative`, `Client`. Person names NEVER go to the DB.

- `effectiveRole` = the canonical DB role the app acts as, possibly overridden by admin preview.
- `normalizeRole(x)` canonicalizes any person name / casing to a DB role.
- Client activation: skips `startRealtime()` and instead calls `startClientRealtime()` (30-second client poll, see §4).
- Admin preview: set `AppState.user.previewRole` (stored as `pcs_role_preview` in localStorage) to render as another role without touching the DB. A real Client DB role ALWAYS wins.
- `switchTab(tabOrEl)` accepts a string (`'dashboard'`, `'pipeline'`, `'tasks'`, `'client'`) OR a DOM element from click delegation. The `pipeline` branch triggers `loadPosts()` with a `_isFetchingPosts` guard to prevent double fetches on rapid tab spam.
- Sessions: `refreshSession()` returns typed errors: `{token}` | `{error:'auth_expired'|'server'|'network'}`. Network errors KEEP tokens. Cross-tab refresh lock via `localStorage._srtd_refresh_lock` prevents Supabase token-reuse revocation. `visibilitychange` listener guarded by `window._authReady` refreshes on tab focus.
- Magic-link flow clears stale `sb_access_token` BEFORE writing the fresh token.

## 6 — EDGE FUNCTIONS AND WORKERS

Edge functions live in Supabase — NOT in this repo. Do not try to edit them from here. "View Post" links use `https://srtd.io/?open=${postId}`.

- **notify-stage** — fires on stage change. Fans out email + in-app notification per the routing matrix (Admin / Servicing / Creative / Client).
- **notify-comment** — fires on `post_comments` insert. Notifies mentioned users + subscribed roles.
- **notify-request** — fires on `requests` insert. Notifies Admin + Servicing with brief content.
- **notify-digest** — scheduled daily digest email per role listing pending items.

Cloudflare Workers:
- **srtd-og-inject** — route `srtd.io/preview/*`. Source: `sorted-preview-worker/src/index.js`. Serves WhatsApp OG HTML from KV `sorted-whatsapp-previews`. Previews seeded fire-and-forget by `06-post-create.js` and `render/brief.js` POSTing to `/generate-preview`. Lookup `?id=POST_ID` (direct) or `?p=SLUG` (legacy). Shared secret `PREVIEW_SECRET=srtd2026xK9mN3pQ`. Short URL: `srtd.io/p/XXXX` via Cloudflare Page Rule. Zero Supabase egress.
- **srtd-r2-upload** — `srtd-r2-upload.ksg-kumarshubhamgune.workers.dev`. Handles uploads and `/download?key=` (sets `Content-Disposition: attachment`). Source: `r2-upload-worker.js`.

R2: bucket `sorted-images`. CDN custom domain `images.srtd.io` (preferred). Legacy `pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev` still works.

Email: Resend, FROM `hinglish@srtd.io`.

## 7 — DEPLOY RULES

1. Bump ALL 21 `?v=YYYYMMDDx` strings in `index.html` together (1 stylesheet + 20 scripts). Current: `?v=20260411g`.
2. After every merge: Cloudflare dash → srtd.io → Caching → Purge Everything. Hard refresh every device.
3. Deploy path: merge PR → GitHub Pages publishes from `main-/-root` branch.
4. One PR at a time. TDD mandatory. Never raw `fetch()` — always `apiFetch()`.
5. CLAUDE.md updates in the SAME PR as the code change. Never a separate PR.
6. Every push response must include: files changed, test count, version bump, PR URL.

## 8 — TESTS

Unit: `npx vitest run` — 508/508 passing across 21 test files. E2E: `npx playwright test` — 9 specs (3 critical run in CI only on core-logic file changes). Smoke: `.github/workflows/smoke.yml` runs `live-smoke-schedule.spec.js` every 30 min against production. Required secrets: `SORTED_CLIENT_EMAIL`, `SORTED_ADMIN_EMAIL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `EXPECTED_VERSION`.
