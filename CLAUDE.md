# CLAUDE.md — Sorted (srtd.io)

post_comments writes: author must be AppState.user.email, author_role must be Title-Case, attachments must follow normalizeAttachments invariant (see Composer.jsx onSend).

Last updated: 2026-04-26 (PR-2 — Plan view UI in React. New `srtd-next/src/flows/plan/views/PlanView.jsx` renders the active plan as a date-x-channel sheet grid scoped to `[data-plan-root]` (max-w-430 container, IBM Plex Mono / Fraunces / DM Sans only, every color via CSS vars from `tokens.css`). PageHeader shows workspace eyebrow + Fraunces 16px plan title with ChevronLeft/Right `loadAdjacentPlan('prev'|'next')` (toast `No earlier plan` / `No later plan. Create plan? (PR-3)` when no neighbor); StatusRow renders plan_status pill + `v{current_version}` chip; MetaLine `{N} concepts - {K} channels [- sent {relative}]`; ProgressBar segments `draft` (--c-text-dim) / `aligned` (--c-green) / `changes_requested` (--c-stage-input) / `spawned` (--c-text-soft). Sticky ActionBar (top:44px) hosts ghost buttons `History ({version_count})`, `Comments ({unresolved})`, `Share`, plus a role-aware primary CTA: Servicing/Creative/Admin -> `Send for alignment` (terracotta gradient) / disabled `Awaiting client` while `awaiting_alignment` / disabled `Plan aligned` once aligned; Client sees `Changes` (bordered) + `Align month` (terracotta) only while `awaiting_alignment`. SheetGrid hides Sat/Sun by default, ColumnHeader exposes a `Show weekends` ghost toggle; rows render DateCol (DOW eyebrow + day number IBM Plex Mono 18px) plus ConceptCell per channel (concept text DM Sans 13px + `cell_status` pill). Empty cells get a dashed `+ Add concept` affordance for non-Client roles which inserts an optimistic plan_cells row (rollback + toast on error); Client rows with no content are hidden; multiple position>0 cells stack vertically with an extra `+ Add concept` link. BottomNav replaces the prior 3-tab Dashboard/Plan/Inbox strip with 5 tabs (`Plan` BookOpen / `Board` LayoutGrid / `List` ListIcon / `Calendar` CalendarDays / `Insights` BarChart3, lucide w-4 + IBM Plex Mono 8px tracking-widest, active tab `--c-terracotta-1` font-weight 600, safe-area-inset-bottom respected). New API module `srtd-next/src/flows/plan/api/planTablesApi.js` wraps the PR-1 schema (plans / plan_cells / plan_versions / plan_comments / workspace_channels) — every read goes through `apiFetch` with `allowLogout:false`, every write uses `Prefer: return=representation`. `planStore.js` gains a plan slice (`plan`, `planCells`, `planVersions`, `planComments`, `workspaceChannels`, `showWeekends`, `planLoading`, `planError`, `planSheet`, `activeCell`, `activeCellPostId`) plus actions `loadPlan`, `refreshPlanCells`, `loadAdjacentPlan`, `addPlanCell`, `updatePlanCell` (debounced 800ms on textarea), `sendPlanForAlignment` (writes `plans.plan_status='awaiting_alignment'`, bumps `current_version`, snapshots cells into `plan_versions.snapshot_jsonb`, enqueues a single `notifications` row), `alignPlan` (Client — patches plan to `aligned`, marks every non-spawned cell `cell_status='spawned'`, refetches), `requestChanges(cellIds, message)` (per-cell PATCH to `changes_requested`, bumps version, optional plan-level comment, single Servicing notification), `addPlanComment` (cell-scoped or plan-level, optimistic with temp id rollback). PCS integration: `cell_status IN ('spawned','linked')` AND `posts.plan_cell_id` matches -> `openInPcs(post, allPosts.filter(p=>!!p.plan_cell_id))` (existing PCS bridge, no new component); otherwise tap mounts `PlanCellSheet` (concept textarea readonly for Client / debounced + Save for Servicing, channel + date label, plan_comments thread filtered by `plan_cell_id` ascending, comment input wired to `addPlanComment({planCellId, message})`). Five new slide-up sheets in `srtd-next/src/flows/plan/sheets/PlanSheets.jsx` — `HistoryPanel`, `CommentsPanel`, `ConfirmSendSheet`, `ConfirmAlignSheet`, `ChangesSheet`, `PlanCellSheet` — share a `SlideUp` shell (backdrop `rgba(0,0,0,.5)` z-2500, panel z-2501, max-w-430, 16px top corners, max-h 85vh, `prefers-reduced-motion` skips slide animation, Escape closes, Tab focus trap, safe-area-inset-bottom honored). `Menu.jsx` VIEWS now lead with `{key:'plan', label:'Plan', Icon:BookOpen}`; `Plan.jsx` adds `VIEW_TITLES.plan='Plan'`, suppresses the eyebrow when `currentView==='plan'` (TopBar reads `Plan` only, no eyebrow), routes `case 'plan': return <PlanView />` from `ViewContainer`, and the new TabBar replaces the legacy Dashboard/Plan/Inbox strip. Realtime: `realtimeBridge.js` gains `startPlanCellsBridge` / `stopPlanCellsBridge` — opens channel `'srtd-plan-cells'` against the global `window._supabaseClient` (initialised by 07-post-load.js `_initSupabaseRealtimeClient`), listens to `plan_cells *` and `plan_comments *` postgres_changes, debounces 400ms into `refreshPlanCells()`, refetches on `visibilitychange`. Bridge respects the same pause/resume contract as the posts bridge (any `activeSheet` OR `planSheet` pauses; PCS overlay still pauses via existing branch). Bridge never imports `@supabase/supabase-js`. Mockup "View as" toggle: confirmed absent from `Menu.jsx` (no removal needed). Bundle rebuilt: `dist/sorted-react.js` 623.11 kB / `dist/style.css` 38.10 kB. `window.SortedReact.version` bumped `0.9.31 -> 0.9.32`. 28 `?v=` strings bumped `20260426d -> 20260426e`. NO new deps, NO Worker changes, NO SQL changes. Prior entry: PR-1 — Plan feature schema foundation (sql/011-plan-foundation.sql). New tables: `plans` (workspace_id, title, period_start/end, plan_status enum draft|awaiting_alignment|aligned|changes_requested|archived, share_token unique, current_version + aligned_version, aligned_at/by, created_by/at, updated_at), `plan_cells` (plan_id FK cascade, cell_date, channel enum linkedin|instagram|twitter|tiktok|facebook|youtube, concept text, reference_image_url, cell_status enum draft|aligned|changes_requested|spawned|linked, position int, UNIQUE plan_id+date+channel+position), `plan_versions` (plan_id FK cascade, version_number, snapshot_jsonb, trigger_event enum sent_for_alignment|changes_requested|aligned|manual_snapshot, triggered_by + name + role, notes, UNIQUE plan_id+version_number), `plan_comments` (plan_id FK cascade, plan_cell_id nullable FK cascade, version_number, author/role/email/user_id, is_external bool, message, resolved + resolved_by/at, reply_to nullable FK self cascade). `posts` gains `plan_cell_id uuid` nullable FK to `plan_cells(id)` ON DELETE SET NULL with partial index `posts_plan_cell_idx WHERE plan_cell_id IS NOT NULL`. All user FKs reference `profiles(id)`. Schema already applied to live Supabase 2026-04-26 via Supabase MCP — `sql/011-plan-foundation.sql` is parity-only documentation + replay reference. NO frontend changes, NO Worker changes, NO React bundle rebuild. 28 `?v=` strings bumped `20260426c → 20260426d`. Note: task spec named the file `sql/010-plan-foundation.sql` but `sql/010-drop-posts-internal-notes.sql` already shipped in PR-3.15, so this migration takes the next free slot at `sql/011`. Prior entry: PR-3.15 expansion — PostDeleteConfirm.jsx replaces native window.confirm in PcsDetailSheet. New file `srtd-next/src/flows/pcs/components/PostDeleteConfirm.jsx` is a centered overlay (z-index 2799 backdrop / 2800 dialog) with backdrop tap + Escape + Cancel button dismissal, busy-state lockout, and stable test hooks `data-testid="post-delete-confirm"`, `post-delete-confirm-cancel`, `post-delete-confirm-confirm`. Headline `Delete this post?`, subline `This cannot be undone.`, preview row showing post title in a `bg-bg-2` chip. PcsDetailSheet wires the delete button (admin-only) to `setDeleteConfirmOpen(true)`; `onDeleteConfirmed` runs the existing `deletePost(post.post_id)` flow with the original logging / toast / `pcsFlow.close()` ordering preserved. 5 vanilla-DOM e2e selectors rewired to React in `tests/e2e/pcs.spec.js`: TEST 1 title via `#pcs-react-overlay h1` + tabs via `button` text "Comments"; TEST 3 input via `[data-composer] textarea` and send via `[data-composer] [aria-label="Send"]`; TEST 4 stage label via `header button` text "READY"; TEST 5 photos via `#pcs-react-overlay .overflow-x-auto img`; TEST 7 stage picker rewritten for the BottomSheet shape (PR-2.2) — taps the stage button, asserts `[data-field="stage"]` SheetRow + at least one option button, then dismisses via `div.fixed.inset-0.bg-black/50` backdrop. TEST 8 rewritten for the new modal — opens `[aria-label="Post details"]` then `[data-testid="pcs-detail-delete-trigger"]`, asserts modal visibility + post-title preview, cancels via test-id, asserts modal unmounts and PCS overlay stays open. TEST 9 (library bypass) converted to `test.skip()` with TODO PR-3.16 — 09-library.js libOpenPostCard still calls vanilla `_renderPCS` instead of routing through `window.openPCS` / `pcsFlow.open`, so the React overlay is unreachable from the library tile path; re-enable once the library bridge migrates. Result: pcs.spec.js 8 pass + 1 skip; admin-flows.spec.js 8 pass; client-flows.spec.js 23 pass; vitest 552/552 green. 28 `?v=` strings bumped `20260426b → 20260426c`. `window.SortedReact.version` bumped `0.9.30 → 0.9.31`. React bundle rebuilt at `dist/sorted-react.js` 581.90 kB; `dist/style.css` 38.10 kB. NO new deps, NO Worker changes, NO SQL changes. PR-3.15 fix-up (b) archived to `CLAUDE-archive-20260411.md`: addressed `posts.internal_notes` column DROP (sql/010 parity) and the inert `#pcs-overlay` regression by adding the `id` prop to `srtd-next/src/core/ui/Overlay.jsx` and wiring `#pcs-react-overlay` from PCS.jsx. PR-3.15, PR-3.15 fix-up (b), PR-3.14, PR-3.13.1 v2 archived in full to `CLAUDE-archive-20260411.md`.

## 1 — WHAT IS SORTED

Social media content ops platform for agencies — workflow + client trust, NOT a scheduler.

Stack: Vanilla JS (no framework, no build step), Supabase (PostgREST + auth + Realtime), Cloudflare Workers + R2, GitHub Pages, Resend (email). Client-side Realtime uses `@supabase/supabase-js@2.45.4` loaded as a UMD bundle from jsDelivr (see `index.html`); all REST traffic still flows through `apiFetch()`, the SDK is ONLY used for the Realtime WebSocket.

Repo: `github.com/Guneygaar/guneygaar.github.io`. ALL files at REPO ROOT. Never reference `/sorted/` — it does not exist. Subdirs: `render/ actions/ tests/ tests/e2e/ sorted-preview-worker/ sql/ preview/ mockups/`.

Deploy: branch `main-/-root` → `srtd.io` (Cloudflare Pages).

Team: Shubham (Admin), Chitra (Servicing), Pranav (Creative), Manisha + Shivangini (Client).

## 2 — DB SCHEMA

Supabase: `ozptjplxbyswclolbxyn.supabase.co`. Always `apiFetch()`, never raw `fetch()`. PostgREST `eq.` is CASE-SENSITIVE — use Title Case roles (`Admin`, `Servicing`, `Creative`, `Client`).

**posts** — PK `post_id` text
| col | type | notes |
|---|---|---|
| id | uuid | |
| post_id | text | PK |
| title, stage, owner, content_pillar, location, format, caption, canva_link, linkedin_link, internal_notes, client_feedback, linked_post_id, created_by, updated_by | text | |
| target_date | date | |
| created_at, updated_at, status_changed_at | timestamptz | |
| images | jsonb | |
| owner_user_id | uuid | nullable FK to `user_roles.id` (Apr 18 migration). PostgREST embed `select=*,owner_user_id(id,name,email,role)` returns the joined user or null. `owner` text column preserved as the legacy role label. |

NO `comments` column on posts. Never write to it.

**user_roles.role** values are lowercase (`admin`, `creative`, `servicing`, `client`). The posts.owner text column still carries Title-Case labels because of the legacy CHECK constraint (`Admin`, `Servicing`, `Creative`, `Client`); normalise with `normalizeRole()` before writing.

**post_comments** — PK id(uuid). Client-facing. Cols: post_id, author, author_role, message(text), created_at(timestamptz), edited_at(timestamptz), visibility(text), mentioned_users(array), resolved(bool), resolved_at(timestamptz), attachments(jsonb), read(bool), resolved_by, post_title, reply_to(uuid), deleted(bool).

**internal_notes** — PK id(uuid). Agency-only. Same shape as post_comments (including `edited_at` + `resolved_at`). `visibility` gates which agency roles see it.

**post_comment_reactions** — PK id(uuid). Cols: comment_id(uuid), post_id, author, author_role, emoji, created_at.

**user_roles** — PK id(uuid). Cols: email(unique), role(text), name(text). Access + role source of truth.

**requests** — PK id(text, REQ-*). Cols: title, description, created_by, created_at(timestamp), status(text), content_type, target_date(date), images(jsonb), drive_link. Status: `pending` → `assigned` → `closed`. NO `updated_at` column. Pending rows merged into `AppState.posts.all` with `_isRequest:true`.

**notifications** — PK id(uuid). Cols: user_role(text), post_id, type, message, read(bool), created_at, actor. RLS DISABLED. pg_cron `cleanup-old-notifications` deletes > 30 days at 03:00 UTC.

**activity_log** — PK id. Cols: post_id, actor, action, old_stage, new_stage, created_at, read, updated_by. Stage change history.

**audit_log** — PK id. Cols: post_id, action, old_value, new_value, changed_by, changed_at. Caption edit history. RLS unrestricted.

**error_log** — PK id(uuid). Cols: error_message, error_stack, user_email, user_role, page, action, created_at, app_version. Fed by `window.logError`. RLS DISABLED (keep off).

**tasks** — PK id(bigint). Cols: assigned_to, message, due_date, done(bool), created_at. RLS unrestricted.

**profiles** — PK id(uuid). Cols: email(text UNIQUE, FK → user_roles.email), display_name, username(text UNIQUE), title, avatar_url, status(text DEFAULT 'offline'), last_active_at(timestamptz), default_view(text DEFAULT 'dashboard'), timezone(text DEFAULT 'Asia/Kolkata'), notification_email(bool DEFAULT true), notification_digest(bool DEFAULT true), notification_client_comments(bool DEFAULT true), notification_whatsapp(bool DEFAULT false), onboarding_complete(bool DEFAULT false), scratchpad(text DEFAULT ''), created_at(timestamptz), updated_at(timestamptz). Cached client-side in `window._profilesCache` by `12-profiles.js`. RLS: SELECT unrestricted, UPDATE own row only.

**click_log** — telemetry sink (session_id, etc.) fed by `_flushClickBuffer`. Storage: R2 bucket `sorted-images`, CDN `https://images.srtd.io/` (legacy `pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev`).

## 3 — FILE MAP

28 versioned resources (2 css + 26 js) — including `/srtd-next/dist/sorted-react.js` and `/srtd-next/dist/style.css`. Load order: `00-appstate.js` + `00-appstate-compat.js` have NO `defer`. `04-router.js` MUST be LAST. `actions/pcs-longpress.js` loads AFTER `actions/pcs.js`. `12-profiles.js` loads AFTER `utils.js` and BEFORE `03-auth.js`. React bundle loads AFTER `ai-config.js`.

Root:
- `00-appstate.js` — AppState brain, logError, onerror, onunhandledrejection, guardAction, _sessionId
- `00-appstate-compat.js` — illegal-access guards around AppState
- `01-config.js` — constants, ROLE_STAGES, ROLE_TABS, `setStage()` (pure stage mutator + logger)
- `02-session.js` — session globals
- `utils.js` — esc(), formatDate()
- `12-profiles.js` — Profile loader / cache + scratchpad. Caches `profiles` in `window._profilesCache` and builds `_nameToRoleCache` + `_nameToEmailCache` from `user_roles`. Exposes `getDisplayName`, `getAvatarUrl`, `getProfileByEmail`, `getRoleFor`, `updateLastActive`, `fetchProfiles`, `enrichAppStateUser`, `renderAvatar`, `openProfilePanel` / `closeProfilePanel`, `saveProfile`, `handleAvatarUpload` (validates <5 MB, compresses 400×400 JPEG q0.80, uploads to R2 `profile-pictures/{sanitizedEmail}.jpeg`, cache-busts `?t=`). Scratchpad `#scratchpad-panel` runs debounced auto-save (`_scratchPerformSave` 1500 ms after typing stops; one retry 3000 ms after failure; status states `'', 'saving', 'saved', 'retrying', 'failed'`). `closeScratchpadPanel` flushes pending saves.
- `03-auth.js` — magic link, OTP, refreshSession (typed errors, 400-is-token-reuse recovery), cross-tab refresh lock, visibilitychange refresh, normalizeRole, single canonical `window._tokenRefreshTimer` (50-min proactive refresh, installed at top of activateRole, torn down in logout / _clearSessionAndLogin)
- `04-router.js` — routing, deep-link handling (must be LAST script)
- `05-api.js` — apiFetch (no-cache headers, 401 retry), uploadPostAsset, logActivity, normalise
- `06-post-create.js` — new post form, asset input, WhatsApp KV preview seed. Caption field `#new-post-caption` is manual-only; ⤢ `#npc-expand-btn` opens `openCaptionWorkspace(mode, {postId:null, initialCaption, onUse, onClose})` in detached mode, routing "Use this" back through `onUse`. Word meter `#npc-word-meter` colors 80–100 green / 101–125 amber / 126+ red; cost chip reads `window._captionWS.sessionCost` via `window._cwFormatINR`. On submit, fire-and-forget PATCH stamps detached ai_usage rows with the new `post_id`.
- `07-post-load.js` — `loadPosts(fromPoll)`, `loadPostsForClient(skipRenderIfUnchanged, fromPoll)`, `mergePosts`, `startRealtime` (installs agency Realtime then 10 s poll fallback), `startAgencyRealtime` / `stopAgencyRealtime`, `_agencyRealtimeRefresh` (400 ms debounce; stashes into `_postsPollStash` when modal open), `_onAgencyNotificationInsert`, `startClientRealtime` / `stopClientRealtime`, `_initSupabaseRealtimeClient`, `_clientRealtimeRefresh`, `_onClientNotificationInsert`, `_postsFingerprint`, `_clientPostsFingerprint`, `_drainPollStash`, `_renderBackgroundViews`, bottom sheets, `_cardClickDelegate`.
- `08-post-actions.js` — quickStage, updatePost, clientApprove, _confirmPublish, _sendStageNotif, _startSaveTimeout/_clearSaveTimeout
- `09-approval.js` — client approval flow, submitApproval
- `09-library.js` — library view (calls `_renderPCS` directly — keep on window.*)
- `10-ui.js` — toasts, notifications panel (v6 redesign — see §4 “Notification panel v6”), switchTab, Action Router, click telemetry flush
- `ai-config.js` — defines `window.AI_CONFIG` (workerUrl, secret, model) — single source of truth for every AI feature
- `/srtd-next/dist/sorted-react.js` — React runtime bundle (strangler-fig). IIFE, non-module, loads after `ai-config.js`. Feature flag `window.ENABLE_REACT_NEW_POST` gates consumption (off until PR B2). See §9.

render/:
- `render/dashboard.js` — dashboard, scoreboard, runway/stage sheets
- `render/client.js` — client feed, comment input, new request overlay
- `render/pipeline.js` — pipeline view, batch mode, chip + person filters
- `render/brief.js` — brief sheet, dynamic assign dropdown, reassign. `_openBriefSheet` is async; renders Sections 01 Brief / 02 Discussion / 03 Reference Photos / 04 Assigned To. Discussion helpers: `_briefBuildDiscussionHtml`, `_briefCommentRowHtml`, `_briefAvatarHtml` (falls back to `getAvatarUrl` → role-colored initial), `_briefRoleColor`. `window._briefSubmitComment(postId)` does optimistic insert + count bump, POSTs `/post_comments` (author = `AppState.user.name`, normalized role), rolls back on failure. Enter submits / Shift+Enter newline. `_assignBrief` normalizes person name through `normalizeRole()` before writing `posts.owner` (`posts_owner_check` allows `{Admin, Servicing, Creative, Client}`). For `_isRequest` rows the new post is created BEFORE the request PATCHes to `status=assigned`. WhatsApp share via `window._shareBriefOnWhatsApp(postId)`.

actions/:
- `actions/pcs.js` — Post Card System full-page overlay. `toggleTaskResolve` writes/clears `resolved_at` timestamp alongside `resolved` + `resolved_by` on post_comments/internal_notes PATCH.
- `actions/pcs-longpress.js` — long-press bottom sheet for PCS comments (wraps openPCS)
- `actions/pcs-claude-caption.js` — Caption Claude Workspace full-screen overlay. Exposes `window.openCaptionWorkspace(mode, context)` and `window._captionWS`. Supports detached mode (`postId:null`) for the Create Post ⤢ flow.
- `actions/pcs-polish.js` — reply polish widget for the PCS composer
- `actions/pcs-select.js` — PCS selection/batch helpers

Other: `index.html`, `styles.css`, `r2-upload-worker.js`, `wrangler.toml`, `package.json`, `vitest.config.js`, `playwright.config.js`, `rollback.sql`, `sql/`, `preview/`, `sorted-preview-worker/`, `mockups/`.

## 4 — ARCHITECTURE RULES AND GOTCHAS

### Plan React realtime spine
- Plan React realtime: vanilla owns Supabase channels; React subscribes to window events `sorted:posts-updated` and `sorted:notifications-updated` via `srtd-next/src/flows/plan/store/realtimeBridge.js`. Sheets/PCS pause updates via `pauseRealtime`/`resumeRealtime`. `mergePosts` (07-post-load.js) dispatches the posts event after every `setAll`; `_recomputeBadgeLocal` (10-ui.js) is the single choke point for the notifications event. Bridge never imports `@supabase/supabase-js` and never opens its own channel.

### Cloudflare cache invariant — `index.html` must NEVER be cached
- `index.html` is the cache-busting anchor for every versioned asset. If Cloudflare serves stale `index.html`, browsers reuse old `?v=` query strings → deploys ship but no one sees them.
- Rule (manual, in Cloudflare dashboard zone level — NOT in `wrangler.toml`/Workers): `srtd.io` → Caching → Cache Rules → URL Path equals `/index.html` → Bypass cache.
- `.github/workflows/cloudflare-purge.yml` purges everything on each push to `main-/-root` as fallback, but the Cache Rule is the primary defence — purges race with traffic, rules do not. Re-create immediately if removed.

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
- Before every PATCH: `post._isSaving = true` + `_startSaveTimeout(post, postId)`. On success AND catch paths: `_clearSaveTimeout(post)` then `post._isSaving = false`.
- If a PATCH hangs > 10s (`_SAVE_TIMEOUT_MS`) the timer force-clears the flag, logs `[SAVE TIMEOUT]`, and calls `scheduleRender()`. Force-cleared posts can be saved again immediately. `apiFetch` has no timeout — this is the only indefinite-hang guard. Wired into `quickStage`, `clientApprove`, `_executeStageChange`/`Async`, `updatePost`.

### Client Realtime subscriptions (`startClientRealtime` in 07-post-load.js)
- No polling — single Supabase Realtime WebSocket on channel `'srtd-client'` (via `_initSupabaseRealtimeClient` → `window._supabaseClient`) with four `postgres_changes` listeners: `posts *`, `requests *`, `post_comments *` → debounced refresh; `notifications INSERT` (filter `user_role=eq.Client`) → `updateNotifBadge()` direct.
- Singleton + cleanup: `_clientRealtimeChannel` + `_supabaseClient` cleared on `stopClientRealtime()`; `stopRealtime()` cascades on logout.
- `_clientRealtimeRefresh` debounces 400 ms → `loadPostsForClient(true, true)`. Guards (in order): `document.hidden`, `sb_access_token`, `_isLoadingClientPosts`, active-typing. `fromPoll=true` threads `{allowLogout:false}` through apiFetch.
- Visibility reconnect: single `visibilitychange` listener gated on `_clientRealtimeVisBound`. If channel state isn't `joined`/`joining` on focus, tears down + re-subscribes; does NOT fetch on focus — first delivered event triggers refresh.
- Notification badge: 20 s `notifBadgeTimer` skips when effectiveRole is `Client`; the Realtime INSERT handler fires `updateNotifBadge()` directly.
- Required Supabase setup (already applied): `ALTER PUBLICATION supabase_realtime ADD TABLE {posts, requests, post_comments, notifications}`. RLS off on `notifications`; `user_role=eq.Client` is a server-side broadcast filter, not RLS.
- `loadPostsForClient` skips overwriting `post.post_comments` when `_commentSaving === true`. `_handleSubmitComment` runs `decodeHtmlEntities(input.value)` BEFORE deriving the POST body so escapes don't round-trip. `renderClientView` guards cv click listeners via `cv._clientEventsWired`. Client @mention roster cached in `window._clientMentionRoster` via `_fetchClientMentionRoster()`.

### Render pipeline
- `setStage(post, stage)` is a PURE logger — mutates `post.stage`, appends activity log. Does NOT touch `_isSaving`, fire notifications, or render. Safe for rollback.
- `scheduleRender()` DEFERS when `AppState.ui.modalOpen === true` → `window._deferredRender = true`. `_drainDeferredRender()` fires the queued render on modal close + drains the poll stash.
- `_postsFingerprint()` is a cheap hash of `posts.all`. Renderers skip rebuild when unchanged — always mutate via `setAll`. `_renderBackgroundViews()` re-renders dashboard/pipeline/client feed without tearing down PCS. PCS render goes through `_renderPCS()`; `09-library.js` is the one exception.

### Agency Realtime subscriptions (`startAgencyRealtime` in 07-post-load.js)
- Realtime-first / polling-fallback. `startRealtime()` opens channel `'srtd-agency'` then installs the legacy 10 s `realtimeTimer` interval, which short-circuits (`if (window._agencyRealtimeChannel) return;`) when the channel is live. The interval stays wired as a safety net for SDK / WebSocket failure.
- Four `postgres_changes` listeners mirror the client shape: `posts *` / `requests *` / `post_comments *` → `_agencyRealtimeRefresh()`; `notifications INSERT` (filter `user_role=eq.<effectiveRole>` title-cased) → `_onAgencyNotificationInsert()` → `updateNotifBadge()`.
- `_agencyRealtimeRefresh` debounces 400 ms. Guards: `document.hidden`, `sb_access_token`. Modal-open branch: fetches `/posts?select=*&order=created_at.desc` and pushes into `_postsPollStash` (+ fp), no merge/render — see drain-stash contract. Modal-closed branch: `loadPosts(true)` with `{allowLogout:false}`, skips skeleton + success toast + error banners.
- Visibility reconnect: same shape as client (gated on `_agencyRealtimeVisBound`). `stopRealtime()` cascades to both stops on logout. `notifBadgeTimer` (20 s, regex-pinned for tests) short-circuits when `_agencyRealtimeChannel` is set OR effectiveRole is Client. Required Supabase publication setup matches client (already applied).
- Liveness: `_realtimeLastEventAt` stamped on every event; 60 s watchdog restarts realtime + catches up if channel state is `joined` but no event in 180 s.

### Agency drain-stash contract (`_postsPollStash` in 07-post-load.js)
- Writers: `_agencyRealtimeRefresh()` modal-open branch (Realtime path, primary), the 10 s `startRealtime()` poll fallback modal-open branch (legacy path, only active when Realtime dropped).
- Reader: `_drainPollStash()` reads the stash, clears it, runs `mergePosts(stash)`, `scheduleRender()`, `updateNotifBadge()` — no-op when stash is null.
- Trigger: `_drainDeferredRender()` calls `_drainPollStash()` unconditionally after its `safeRender` debounce, so every modal-close drain site also flushes stash data. Drain sites: `forcePCSReset` (actions/pcs.js), `closeAdminEdit` / `closeNewPostModal`, `closeNotifications` / `closePipelineFilter` (10-ui.js), `_lbClose` and client post overlay close (render/client.js).
- Latest-wins, no queue — stash is cleared before `mergePosts` runs.
- Client Realtime path has NO stash — `startClientRealtime` never fetches posts during a modal; active-typing guard + `loadPostsForClient(true, true)` fingerprint check handle all refresh cases.

### Runtime-enriched fields (NOT in DB — added by loadPosts)
- `_commentCount` (int), `_clientCommentAt` (ISO|null) — set after batch comment fetch. `_isRequest` (true) — set on rows merged from `requests`; brief/assign/close/reopen branch on this to route `/requests` vs `/posts`. `_isSaving` (bool) + `_saveTimer` — optimistic save lock. `_commentSaving` (bool) — set by `_handleSubmitComment` during an in-flight insert; `loadPostsForClient` honours it so the optimistic row isn't clobbered.

### Design system
- Zero border-radius on inputs/buttons. NO `rgba()` — use 8-digit hex (#RRGGBBAA). Approved exceptions: `.pcs-more-ov`, `.pcs-more-l`, SVG fill at index.html:1140.
- Colors: bg `#080808`, surface `#0d0d12`, comments bg `#191924`, text `#E8E8E8`/`#AEAEB2`/`#8E8E93`, gold `#C8A84B`, red `#FF4B4B`, green `#3ECF8E`, purple `#9b87f5`, cyan `#22D3EE`, amber `#F6A623`. Owners: Chitra `#22D3EE`, Pranav `#9b87f5`, Client `#FF4B4B`, Shubham `#C8A84B`.
- Fonts: IBM Plex Mono (labels/meta) + DM Sans (body/UI). Dark theme default.
- Use `100dvh`, never `100vh` (iOS Safari address bar).
- Image compression: posts max 1200px q0.82, comments max 800px q0.80, save as .jpg.

### Notification panel (10-ui.js `renderNotifications`)
- Stable API: `loadNotifications`, `updateNotifBadge`, `markNotifRead`, `markAllNotificationsRead`, `deleteNotification`, `openNotifications`, `closeNotifications`. Visual tweaks belong in `renderNotifications` / `_buildItem` only.
- Card class is `.notif-item` (published rows also get `notif-live-card` marker). Background always transparent; unread indicated only by inline `<span class="nnew-dot">`. Avatars solid-fill 32 px. Tabs (`.notif-chips > .notif-chip`): All / Mentions / Comments / Moves with counts in `nchip-count-*` spans. Meta row layout: `time [LinkedIn] [chip] .meta-actions(WA, trash)` — `.meta-actions` is flush-right with `margin-left:auto`. Tap delegate skip list: `.notif-mi-btn`, `.notif-topbar-btn`, `.notif-li-link`, `.meta-actions`, `.notif-thumb-wrap`, plus every thread-view control. Tapping `.notif-thumb-wrap` ALWAYS opens PCS / client overlay — never the drawer.
- Expand-in-place thread view: `renderNotifications` precomputes `_threadCountMap = { [post_id]: non-resolved count }` from `window._notifComments`. `_buildItem` gates the chip on `(type === 'comment' || type === 'mention') && _threadCountMap[post_id] > 1`. Tap on card body OR chip toggles `.notif-item.expanded`, mounts thread HTML, marks read on first expand. State persists in `window._notifExpandedSet`; thread HTML cached in `window._notifThreadCache` (cleared at top of `loadNotifications`).
- Drawer content: `_notifBuildThreadHtml` filters `window._notifComments` by `post_id === n.post_id && !resolved`, sorts DESC, slices newest 5, reverses for chronological display. If `totalCount > 5` a `.thread-overflow` "View all N comments" link is prepended.
- Replies POST to `/post_comments` ONLY — JS fan-out skipped; `notify-comment` edge fn is the single notification writer. Author = `AppState.user.name`, author_role = `effectiveRole` title-cased.
- Tests guard structural class names + source patterns (`notif-item`, `notif-live-card`, `nchip-count-*`, grouped key `(n.post_id||'') + '|' + (n.actor||'')`, `notif-resp-time`, day labels, `"left " + n + " comments on "`). Drawer typography + visual tokens (warm-ink card / terra accents / DM Mono micro labels) live in CSS; do not duplicate in this file.

### Session resilience (05-api.js + 03-auth.js) — 401 hardening
- `apiFetch(path, options, meta)` accepts optional third arg `meta`. `meta.allowLogout === false` disables `_clearSessionAndLogin()` on `auth_expired` so a transient 401 in a background poll CANNOT evict the user. User-initiated actions default to `allowLogout: true`.
- Background pollers thread `{ allowLogout: false }`: `updateNotifBadge`, `_flushClickBuffer`, agency `startRealtime` poll branches, and `loadPostsForClient(true, true)`. `fromPoll` boolean threads `_apiMeta` through internal apiFetch calls (posts, requests, post_comments).
- Second-chance refresh: after first `refreshSession()` returns `{error:'server'|'network'}`, apiFetch waits 1500 ms and retries once. On success, replays original; on failure, soft-banner + throw. `auth_expired` classification from the retry is honoured.
- `window._tokenRefreshTimer` is the single canonical 50-minute proactive refresh installed at the top of `activateRole()` (03-auth.js) for every branch (admin, agency, admin-preview, client). Torn down in `logout()` / `_clearSessionAndLogin()`. Old duplicates (`AppState.timers.tokenRefresh`, `window._clientTokenTimer`) were deleted.
- `_doRefresh` narrows `auth_expired`: HTTP 400 → refresh-token REUSE race (another tab rotated first), recovered by returning the currently-stored `sb_access_token`. 401/403 only map to `auth_expired` when body carries `refresh_token_not_found` / `refresh_token_already_used` / `refresh_token_expired` / `invalid_grant`. Other 401/403 → `{error:'server'}` so second-chance refresh fires. Fixes multi-tab eviction during legit token rotations.
- `sendMagicLink` catch classifies `TypeError` as network failure with a friendly Safari-aware message; rate-limit "31 seconds" copy becomes "Please wait a moment before requesting another code."

### Misc gotchas
- `_commentInputHtml()` renders only for `awaiting_approval`/`awaiting_brand_input` and MUST be called inside `_cardHtml()`. `apiFetch()` never calls `logout()` on 401 — refresh flow owns that. Silent `.catch(()=>{})` is a bug — always `window.logError`.
- Timers: 10 s agency `startRealtime` poll + 20 s agency `notifBadgeTimer` are Realtime fallbacks (short-circuit on `_agencyRealtimeChannel`; the badge timer ALSO short-circuits on Client effectiveRole). 5 s click-log flush. 50 min token refresh. Realtime WebSockets are the primary data path for both roles; legacy intervals stay as cold-start / disconnect safety nets. Client DB role beats `pcs_role_preview`.
- Deep link `srtd.io/?open=POST_ID` → `window._pendingOpenPost` after loadPosts. Drain handler in `07-post-load.js` (renderAll, ~L1054) is stage-aware: brief / `_isRequest` → `window._openBriefSheet(_pid)`; Client effectiveRole → `window._openClientPostOverlay(_pid)`; otherwise → `openPCS(_pid)`. Mirrors `_cardClickDelegate`.
- Pipeline brief chip: `index.html#stage-strip` includes a `<div class="stage-chip brief" data-stage="brief" style="display:none;">` chip with `chip-count-brief`. `render/pipeline.js updatePipelineChipCounts` writes the count and toggles visibility (>0 shows, =0 hides). `dotColors.brief = '#C8A84B'` provides the gold marker. Pipeline search (`handlePipelineSearch`) and the pipeline filter sheet (`openPipelineFilter` + `_pfChip` in 10-ui.js) both include `'brief'` in their stage arrays and label/color maps so brief cards are searchable and filterable from the strip overlay.
- Notification tap routing: `10-ui.js _buildItem` sets `data-is-brief="1"` on `n.type === 'new_request' || n.type === 'brief'`. The notification panel tap delegate uses that flag to call `_openBriefSheet(_tPid)` instead of `openPCS(_tPid)` for the matching rows.
- PCS document-click-close skips close when the active dropdown contains `input[type="date"]`. `_cardClickDelegate` (07-post-load.js) guards `input, textarea, button, [contenteditable="true"], a, [role="button"]` — don't narrow.
- Image download: `_pcsLbDownload` + `_pcsSaveAllPhotos` must strip BOTH `https://images.srtd.io/` and legacy `pub-*.r2.dev` prefix before hitting the R2 worker `/download?key=`.

## 5 — AUTH AND ROLES

DB roles (canonical, Title Case): `Admin`, `Servicing`, `Creative`, `Client`. Person names NEVER go to the DB.

- `effectiveRole` = the canonical DB role the app acts as, possibly overridden by admin preview.
- `normalizeRole(x)` canonicalizes any person name / casing to a DB role.
- Client activation: skips `startRealtime()` and instead calls `startClientRealtime()` (Supabase Realtime WebSocket — no polling; see §4).
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
- **srtd-og-inject** — route `srtd.io/preview/*`. Source: `sorted-preview-worker/src/index.js`. Serves WhatsApp OG HTML from KV `sorted-whatsapp-previews`. Previews seeded fire-and-forget by `06-post-create.js` and `render/brief.js` POSTing to `/generate-preview`. Lookup `?id=POST_ID` (direct) or `?p=SLUG` (legacy). Shared secret `PREVIEW_SECRET=srtd2026xK9mN3pQ`. Short URL: `srtd.io/p/XXXX` via Cloudflare Page Rule. Zero Supabase egress. **Invariant:** `handlePreview` checks `env.PREVIEWS_KV.get(shortId)` first and, on a cold Supabase-backed miss, populates KV via `ctx.waitUntil(env.PREVIEWS_KV.put(shortId, html, { expirationTtl: 2592000 }))` so the next hit never re-queries Supabase.
- **srtd-r2-upload** — `srtd-r2-upload.ksg-kumarshubhamgune.workers.dev`. Handles uploads and `/download?key=` (sets `Content-Disposition: attachment`). Source: `r2-upload-worker.js`.

ai_usage lifecycle invariant (`srtd-ai-worker/src/index.js`): every Anthropic call writes a `pending` row with an estimated cost BEFORE firing, then PATCHes to `status='complete'` (real `tokens_input`/`tokens_output`/`actual_cost_usd`; `cost_usd` mirrors `actual_cost_usd` for back-compat) on success, or `status='failed'` on throw / non-200. INSERT/UPDATE failures log without breaking the response. `/ai/month-cost` is a stub returning `{ success: true, month_cost_inr: null }` — month spend reads from `ai_usage` client-side.

File-upload invariant (`srtd-ai-worker/src/index.js`): `POST /ai/upload` (multipart, X-AI-Secret gated) stores PDFs / images (10 MB cap) in R2 bucket `sorted-ai` (binding `AI_ASSETS`) under `uploads/<workspace_id>/<post_id>/<ts>-<sanitised-name>`. The returned `key` is passed back as `file_key` + `media_type` in `/ai/complete` and injected as a `document` (PDF) or `image` block into the FIRST user message. `ai_usage.file_key` (sql/006) records the attached key. `useWebSearch` is hardcoded `false` across every feature.

product_knowledge table = on-demand product specs fetched by product_name or aliases. Only loaded for writer + chat features. Never loaded for qc, angles, email_brief.

R2: bucket `sorted-images`. CDN custom domain `images.srtd.io` (preferred). Legacy `pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev` still works.

Email: Resend, FROM `hinglish@srtd.io`.

## 7 — DEPLOY RULES

1. Bump ALL 28 `?v=YYYYMMDDx` strings in `index.html` together (2 stylesheets + 26 scripts). Current: `?v=20260426c`. The Supabase JS SDK `<script>` tag sits above the versioned block and is pinned to an external jsDelivr URL — do NOT add a `?v=` to it.
2. After every merge: Cloudflare dash → srtd.io → Caching → Purge Everything. Hard refresh every device.
3. Deploy path: merge PR → GitHub Pages publishes from `main-/-root` branch.
4. One PR at a time. TDD mandatory. Never raw `fetch()` — always `apiFetch()`.
5. CLAUDE.md updates in the SAME PR as the code change. Never a separate PR.
6. Every push response must include: files changed, test count, version bump, PR URL.

## ONE PR RULE — NON-NEGOTIABLE
Before writing any fix prompt or creating any branch, always run:
  gh pr list --state open --base main-/-root
If ANY open PR exists, stop immediately and tell Shubham:
  "PR #[number] ([title]) is still open. Merge or close it before I create a new one."
No exceptions — not for critical fixes, not for small changes, not for hotfixes.
One open PR maximum at all times.

## PR CONFLICT GUARD — NON-NEGOTIABLE
Before creating any branch:
1. Run: git fetch origin && git diff --name-only origin/main-/-root HEAD
2. If any file in the planned PR was modified in main-/-root since the last fetch, stop and report the conflicting files. Do not proceed until Shubham confirms.
3. Never branch off anything except origin/main-/-root directly.
4. Never bump ?v= version strings to a letter already used by an open PR. Read open PRs first, then pick the next unused letter.
5. If in doubt about conflict state, run a dry-run merge check: git merge --no-commit --no-ff origin/main-/-root, then git merge --abort. Report any conflicts before touching a single file.

## 8 — TESTS

Unit: `npx vitest run` — 563/563 passing across 22 test files. E2E: `npx playwright test` — 9 specs (3 critical run in CI only on core-logic file changes). Smoke: `.github/workflows/smoke.yml` runs `live-smoke-schedule.spec.js` every 30 min against production. Required secrets: `SORTED_CLIENT_EMAIL`, `SORTED_ADMIN_EMAIL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `EXPECTED_VERSION`.

## 9 — REACT MIGRATION (strangler-fig)

`/srtd-next/` hosts the React runtime, vendor-isolated from the vanilla repo root. Feature flags: `window.ENABLE_REACT_NEW_POST` (Create Post FAB) and `window.ENABLE_REACT_PCS` (always-on as of #964 / 2026-04-19). Bundle ships after `ai-config.js` in `index.html`. Build: `cd srtd-next && npm run build` produces `dist/sorted-react.js` (IIFE, esbuild-minified) + `dist/style.css` (Tailwind, Preflight DISABLED so vanilla isn't reset). Folder renamed from `/pcs-next/` in B5.5a.4. Tailwind v3 design tokens bind to CSS custom properties in `src/styles/tailwind.css` (`@layer base { :root }` light + `@media (prefers-color-scheme: dark) { :root }` dark); `tailwind.config.js` uses `darkMode:'media'` so every utility auto-flips with system setting. Tokens + fonts + cost helpers exposed at `window.SortedReact.theme`. Pre-PR-3.15 migration history (B5.5a series, PR-1 / PR-2 / PR-2.2 / PR-3.8) archived to `CLAUDE-archive-20260411.md`.

Create Post status: Import Brief wired for Paste (all roles → admin path opens Caption Workspace, non-admin appends to internal_notes), Gmail (Admin only, bridges through Worker `/gmail/list` + `/gmail/brief`), Upload-a-file (Admin stub). Draft persistence: `localStorage['sorted_create_post_draft_v1']`, 800 ms debounced save, restore banner (Restore / Start fresh / ✕). All Create Post events push into `window._clickBuffer` for the shared 30-s flush.

Caption Workspace lives at `srtd-next/src/shared/caption-workspace/` — `CaptionWorkspace.jsx` (full-screen overlay z-index 9600), `store.js` (Zustand), `api.js` (wraps `/ai/complete`, `calcCostINR` + `formatINR` mirror USD×100 math), `systemPrompts.js` (`buildWritePrompt` brief-first). v1 MVP supports `write` (3 numbered options via `splitOptions`) and `chat`; Polish/QC/Rewrite/ai_memory deferred. Bridge `srtd-next/src/core/bridges/captionWorkspace.js` calls `useCaptionWorkspaceStore.getState().open(...)`. App.jsx mounts `<CaptionWorkspace />` at body-level. Worker hardening: `srtd-ai-worker/src/index.js` defensively strips any message with role !== 'user'|'assistant' (prevents Anthropic 400 regressions).

PCS React surface lives at `/srtd-next/src/flows/pcs/`. Always-on since #964 (2026-04-19); the vanilla `<div id="pcs-overlay">` in `index.html` is inert dead markup. React Overlay accepts an optional `id` prop (PR-3.15 fix-up) so PCS.jsx renders `<Overlay id="pcs-react-overlay" zIndex={1501}>` distinct from the dormant vanilla shell. Library tile bypass (`09-library.js libOpenPostCard`) is the ONE remaining vanilla call site — calls `_renderPCS(postId)` directly, NOT `window.openPCS` / `pcsFlow.open`; migrating to the React bridge is queued for PR-3.16.

**Invariants:**
- `post_comments.attachments` can arrive JSON-encoded TWICE. `srtd-next/src/flows/pcs/utils/attachments.js normalizeAttachments()` runs `JSON.parse` in a loop up to two times — never collapse to a single parse.
- Reaction writes via `addReaction(commentId, emoji, createdBy)` / `removeReaction(...)` where `createdBy` is the email, stored in `post_comment_reactions.created_by`. Legacy `author` / `author_role` columns are no longer written from React.
- Title edits are inline (`<h1>` flips to `<input>` with terracotta border on `canEdit`); commit via `useOptimisticPatch` + `reseedOgPreview`. Vanilla `_pcsTitleEdit` is untouched.
- Field editors use `FullScreenEditor` primitive (PR 2.2) — fixed inset-0, z-index 2600, slide-up, body-scroll lock, Esc closes. Stage/Owner/Date/Format/Pillar/Location all open via `PcsDetailSheet` (BottomSheet, z-index 2700) which expands the matching SheetRow. Backdrop tap (`div.fixed.inset-0.bg-black/50`) dismisses.
- Post hard-delete (admin-only) opens `<PostDeleteConfirm>` (`srtd-next/src/flows/pcs/components/PostDeleteConfirm.jsx`, z-index 2800 dialog / 2799 backdrop) — replaces the prior native `window.confirm()` call. Test hooks: `data-testid="pcs-detail-delete-trigger"` on the Danger Zone button, `data-testid="post-delete-confirm"` on the dialog, `post-delete-confirm-cancel` + `post-delete-confirm-confirm` on its buttons. Confirm invokes `deletePost(post_id)` and `pcsFlow.close()`; busy-state lockout disables backdrop / Escape / Cancel during the in-flight write.
- Composer wraps its root in `[data-composer]`; textarea is ref-only (no id), send button reachable via `[data-composer] [aria-label="Send"]`. Tabs.jsx renders text-only buttons ("Comments" / "Internal" / "Activity") with no `data-tab` attribute. KickerRow stage label is `<button>{stageLabel.toUpperCase()}</button>` in `<header>` with no id.
- Pre-PR-3.15 React PR history (B5.5a series, PR-1 / PR-2 / PR-2.2 / PR-3.8) archived in full to `CLAUDE-archive-20260411.md`.
