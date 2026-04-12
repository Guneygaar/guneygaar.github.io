# CLAUDE.md — Sorted (srtd.io)

Last updated: 2026-04-12 (notif-thread-surgical). Full history: `CLAUDE-archive-20260411.md`.

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

**profiles** — PK id(uuid). Cols: email(text UNIQUE, FK → user_roles.email), display_name, username(text UNIQUE), title, avatar_url, status(text DEFAULT 'offline'), last_active_at(timestamptz), default_view(text DEFAULT 'dashboard'), timezone(text DEFAULT 'Asia/Kolkata'), notification_email(bool DEFAULT true), notification_digest(bool DEFAULT true), notification_client_comments(bool DEFAULT true), notification_whatsapp(bool DEFAULT false), onboarding_complete(bool DEFAULT false), created_at(timestamptz), updated_at(timestamptz). Cached client-side in `window._profilesCache` by `12-profiles.js`. RLS: SELECT unrestricted, UPDATE own row only.

**click_log** — telemetry sink (session_id, etc.) fed by `_flushClickBuffer`. Storage: R2 bucket `sorted-images`, CDN `https://images.srtd.io/` (legacy `pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev`).

## 3 — FILE MAP

22 versioned resources (1 css + 21 js). `00-appstate.js` + `00-appstate-compat.js` have NO `defer`. `04-router.js` MUST be the LAST script. `actions/pcs-longpress.js` must load AFTER `actions/pcs.js`. `12-profiles.js` must load AFTER `utils.js` and BEFORE `03-auth.js`.

Root:
- `00-appstate.js` — AppState brain, logError, onerror, onunhandledrejection, guardAction, _sessionId
- `00-appstate-compat.js` — illegal-access guards around AppState
- `01-config.js` — constants, ROLE_STAGES, ROLE_TABS, `setStage()` (pure stage mutator + logger)
- `02-session.js` — session globals
- `utils.js` — esc(), formatDate()
- `12-profiles.js` — Profile data loader and helpers. Fetches `profiles` table on login, caches in `window._profilesCache` (keyed by email). Also fetches `user_roles` to build `window._nameToRoleCache` (maps names and emails to roles). Exposes: `getDisplayName(email)`, `getAvatarUrl(email)`, `getProfileByEmail(email)`, `getRoleFor(nameOrEmail)`, `updateLastActive()`, `fetchProfiles()`, `enrichAppStateUser()`, `renderAvatar(emailOrName, role, size, opts)`, `_avatarColors(role)`. All helpers return graceful fallbacks if cache not loaded or fetch failed. `enrichAppStateUser()` sets `AppState.user.displayName`, `.avatarUrl`, `.title`, `.username` from the cached profile after fetch. `getRoleFor()` resolves any name or email to a canonical role string via `_nameToRoleCache`; returns `''` for unknown inputs.
- `03-auth.js` — magic link, OTP, refreshSession (typed errors), cross-tab refresh lock, visibilitychange refresh, normalizeRole, `_teardownClientTokenTimer()` (cleans 50-min client token interval on logout)
- `04-router.js` — routing, deep-link handling (must be LAST script)
- `05-api.js` — apiFetch (no-cache headers, 401 retry), uploadPostAsset, logActivity, normalise
- `06-post-create.js` — new post form, asset input, WhatsApp KV preview seed
- `07-post-load.js` — loadPosts, loadPostsForClient(skipRenderIfUnchanged), mergePosts, startRealtime (agency 15s poll with modal-open fetch-and-stash), startClientRealtime/stopClientRealtime (client 30s poll), _postsFingerprint, _clientPostsFingerprint, _drainPollStash, _renderBackgroundViews, bottom sheets, _cardClickDelegate
- `08-post-actions.js` — quickStage, updatePost, clientApprove, _confirmPublish, _sendStageNotif, _startSaveTimeout/_clearSaveTimeout
- `09-approval.js` — client approval flow, submitApproval
- `09-library.js` — library view (calls `_renderPCS` directly — keep on window.*)
- `10-ui.js` — toasts, notifications panel (v6 redesign — see §4 “Notification panel v6”), switchTab, Action Router, click telemetry flush

render/:
- `render/dashboard.js` — dashboard, scoreboard, runway/stage sheets
- `render/client.js` — client feed, comment input, new request overlay
- `render/pipeline.js` — pipeline view, batch mode, chip + person filters
- `render/brief.js` — brief sheet, dynamic assign dropdown, reassign

actions/:
- `actions/pcs.js` — Post Card System full-page overlay. `toggleTaskResolve` writes/clears `resolved_at` timestamp alongside `resolved` + `resolved_by` on post_comments/internal_notes PATCH.
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
- Before every PATCH: `post._isSaving = true` + `_startSaveTimeout(post, postId)`. On success AND catch paths: `_clearSaveTimeout(post)` then `post._isSaving = false`.
- If a PATCH hangs > 10s (`_SAVE_TIMEOUT_MS`) the timer force-clears the flag, logs `[SAVE TIMEOUT]`, and calls `scheduleRender()`. Force-cleared posts can be saved again immediately. `apiFetch` has no timeout — this is the only indefinite-hang guard. Wired into `quickStage`, `clientApprove`, `_executeStageChange`/`Async`, `updatePost`.

### Client 30s polling (`startClientRealtime` in 07-post-load.js)
- Singleton via `window._clientPollTimer`, installed from `activateRole()` (03-auth.js) and cleared by `stopClientRealtime()` (called by `stopRealtime()` → cascades on logout). `_teardownClientTokenTimer()` clears the 50-min token interval.
- Interval guards (in order): `document.hidden`, `sb_access_token`, `window._isLoadingClientPosts`, active-typing (input/textarea/contenteditable). Any hit → return.
- Delegates to `loadPostsForClient(true)` with `skipRenderIfUnchanged` — re-renders only when `_clientPostsFingerprint(posts.all) !== window._lastClientFp`. Fingerprint extends `_postsFingerprint` with per-post `post_comments.length`.
- `loadPostsForClient` skips overwriting `post.post_comments` when `_commentSaving === true` — object-level lock set by `_handleSubmitComment` (render/client.js) so in-flight optimistic rows aren't clobbered.
- `renderClientView` guards cv click listeners via `cv._clientEventsWired` (cv persists across re-renders, unguarded `addEventListener` stacks on every poll).
- Client @mention roster fetched live from `/user_roles`, cached in `window._clientMentionRoster` via `_fetchClientMentionRoster()`.

### Render pipeline
- `setStage(post, stage)` is a PURE logger — mutates `post.stage`, appends activity log. Does NOT touch `_isSaving`, fire notifications, or render. Safe for rollback.
- `scheduleRender()` DEFERS when `AppState.ui.modalOpen === true` → `window._deferredRender = true`. `_drainDeferredRender()` fires the queued render on modal close + drains the poll stash.
- `_postsFingerprint()` is a cheap hash of `posts.all`. Renderers skip rebuild when unchanged — always mutate via `setAll`. `_renderBackgroundViews()` re-renders dashboard/pipeline/client feed without tearing down PCS. PCS render goes through `_renderPCS()`; `09-library.js` is the one exception.

### Agency poll fetch-and-stash (`startRealtime` in 07-post-load.js)
- 15s agency poll fetches regardless of modal state. If fingerprint differs, stashes the array into `window._postsPollStash` (+ `_postsPollStashFp`). Latest-wins, no queue.
- `_drainPollStash()` reads the stash, clears it, runs `mergePosts(stash)`, `scheduleRender()`, `updateNotifBadge()` — no-op when stash is null.
- `_drainDeferredRender()` calls `_drainPollStash()` unconditionally after its safeRender debounce, so every modal-close drain site also flushes poll data. Drain sites: `forcePCSReset` (actions/pcs.js), `closeAdminEdit` / `closeNewPostModal`, `closeNotifications` / `closePipelineFilter` (10-ui.js), `_lbClose` and client post overlay close (render/client.js).
- Client 30s poll has NO stash — active-typing guard + `_clientPostsFingerprint` are enough.

### Runtime-enriched fields (NOT in DB — added by loadPosts)
- `_commentCount` (int), `_clientCommentAt` (ISO|null) — set after batch comment fetch. `_isRequest` (true) — set on rows merged from `requests`; brief/assign/close/reopen branch on this to route `/requests` vs `/posts`. `_isSaving` (bool) + `_saveTimer` — optimistic save lock. `_commentSaving` (bool) — set by `_handleSubmitComment` during an in-flight insert; `loadPostsForClient` honours it so the optimistic row isn't clobbered.

### Design system
- Zero border-radius on inputs/buttons. NO `rgba()` — use 8-digit hex (#RRGGBBAA). Approved exceptions: `.pcs-more-ov`, `.pcs-more-l`, SVG fill at index.html:1140.
- Colors: bg `#080808`, surface `#0d0d12`, comments bg `#191924`, text `#E8E8E8`/`#AEAEB2`/`#8E8E93`, gold `#C8A84B`, red `#FF4B4B`, green `#3ECF8E`, purple `#9b87f5`, cyan `#22D3EE`, amber `#F6A623`. Owners: Chitra `#22D3EE`, Pranav `#9b87f5`, Client `#FF4B4B`, Shubham `#C8A84B`.
- Fonts: IBM Plex Mono (labels/meta) + DM Sans (body/UI). Dark theme default.
- Use `100dvh`, never `100vh` (iOS Safari address bar).
- Image compression: posts max 1200px q0.82, comments max 800px q0.80, save as .jpg.

### Notification panel (10-ui.js `renderNotifications`)
- `loadNotifications`, `updateNotifBadge`, `markNotifRead`, `markAllNotificationsRead`, `deleteNotification`, `openNotifications`, `closeNotifications` stay stable — tweak visuals in `renderNotifications` / `_buildItem` only.
- Header: mono `<effectiveRole> · SORTED` label + plain-text `Mark read | Close`; greeting row `Hey, <AppState.user.name>` (name gold). Name/role pull ONLY from `AppState.user` — no hardcoded map.
- Tabs (`.notif-chips > .notif-chip`): text-only (All / Mentions / Comments / Moves), counts in `nchip-count-*` spans. Active class reapplied by the renderer on every pass.
- Cards: `.notif-item` is the single card class; published rows get `notif-live-card` as a marker so the tap delegate `closest('.notif-item, .notif-live-card')` still resolves. Background always transparent — read and unread items look identical. Inline `<span class="nnew-dot">` (gold 5px) before the actor name is the ONLY unread indicator. Avatars solid-fill 32px (no border/ring). Published cards render a `.notif-pub-label` eyebrow (`✓ PUBLISHED`) above the main text line.
- Meta row (`.notif-meta`): flex with `gap: 10px`. Layout is `time [LinkedIn] [chip] <.meta-actions>WA trash</.meta-actions>`. LinkedIn sits AFTER the timestamp (not inside `.meta-actions`). `.meta-actions` only wraps the WA + trash icon buttons with an internal `gap: 2px` and `margin-left: auto`, so the icon cluster is always flush-right. No `.notif-meta-sep` dot spans are emitted anywhere — the class is kept as a no-op `display:none` so stale HTML never breaks layout. `.notif-mi-btn` is a 28×28 rounded-6px tap target with `background: #FFFFFF0A` on hover. SVG children are `pointer-events:none`. Panel tap delegate skip list includes `.notif-mi-btn`, `.notif-topbar-btn`, `.notif-li-link`, `.meta-actions`, `.notif-thumb-wrap`, and every thread-view control below. Tapping `.notif-thumb-wrap` ALWAYS navigates to PCS / the client overlay — it never expands the thread drawer, even on comment/mention cards.
- **Expand-in-place thread view** — `renderNotifications` precomputes `_threadCountMap = { [post_id]: non-resolved comment count }` from `window._notifComments` before any `_buildItem` call. Both `'comment'` AND `'mention'` notifications participate in the grouping (`commentGroupMap`) and are expandable. `_buildItem` gates the chip on `(type === 'comment' || type === 'mention') && _threadCountMap[post_id] > 1` and labels the chip with the map value — any post with 2+ visible comments gets a chip regardless of how the notifications were bucketed. Tap on the card body OR the chip toggles `.notif-item.expanded`, mounts the thread HTML, anchors scroll, and marks the notif read on first expand. State persists across `scroll.innerHTML` rebuilds via `window._notifExpandedSet` (Set of notif IDs). Thread HTML is cached per post in `window._notifThreadCache` (cleared at the top of `loadNotifications`).
- Drawer content: `_notifBuildThreadHtml` filters `window._notifComments` by `post_id === n.post_id && !resolved`, sorts DESC by `created_at`, slices to the newest 5, then reverses so display order is chronological within the 5. If `totalCount > 5` a `.thread-overflow` "View all N comments" link is prepended to the drawer and routes through the same open-post handler as `.thread-open-post` (close panel → PCS / client overlay). Each message renders through `_notifThreadMsgHtml` with thread-specific classes (`.thread-msg`, `.thread-av`, `.thread-author`, `.thread-role`, `.thread-time`, `.thread-message`) that are deliberately smaller and tighter than the notification card classes so the drawer reads as a nested conversation, not as more notifications.
- Drawer visuals: `.thread-area` is `#1C1926` + `border: 1px solid #C8A84B1F` + `border-radius: 8px` + `padding: 6px 10px`. `.notif-item.expanded` uses `background: #16161F` + `border-left: 3px solid #C8A84B4D` + `border-radius: 10px` + `padding-bottom: 0` + `margin-bottom: 8px`. `.notif-item.expanded .thread-drawer` uses `max-height: 3000px` + `opacity: 1` so the reply row + "Open full post →" link never clip. `.thread-reply` carries `border-top: 1px solid #C8A84B1A` + `padding: 6px 0 4px` + `margin-top: 4px`. Ultra-compact thread typography (deliberately smaller than notification cards): `.thread-av` 18×18 with `font-size: 7px` on `#000000D9` ink, `.thread-author` 10px, `.thread-role` 7px pill on `#FFFFFF12`, `.thread-time` 8px `#FFFFFF33` in `DM Mono`, `.thread-message` 11px `#FFFFFFA6` line-height 1.3, `.thread-msg` `padding: 4px 0` + `gap: 6px`.
- The drawer contains a `.reply-input` + `.reply-send` row and an `Open full post →` footer link. Replies POST to `/post_comments` ONLY — the JS fan-out is intentionally skipped so `notify-comment` (edge) is the single writer and there are no duplicate notification rows. Reply author is always `AppState.user.name`, author_role is `effectiveRole` title-cased, so the same code path works for both agency and client users. The panel tap delegate skips `.expand-chip`, `.reply-input`, `.reply-send`, `.thread-msg`, `.thread-area`, `.thread-reply`, `.thread-footer`, `.reply-label`, `.meta-actions`, and routes `.thread-open-post` / `.thread-overflow` clicks through `closeNotifications()` + `openPCS` / `_openClientPostOverlay`.
- Tests: structural class names + source patterns (`notif-item`, `notif-live-card`, `nchip-count-*`, grouped key `(n.post_id||'') + '|' + (n.actor||'')`, `notif-resp-time`, day labels, `"left " + n + " comments on "`) are preserved verbatim. 508/508 unit tests still pass.

### Misc gotchas
- `_commentInputHtml()` only renders for `awaiting_approval`/`awaiting_brand_input` and MUST be called inside `_cardHtml()`. `apiFetch()` never calls `logout()` on 401 by design — refresh flow handles it. Silent `.catch(()=>{})` is a bug — always `window.logError`.
- Polling: 15s agency (`startRealtime`), 30s client (`startClientRealtime`), 50min token refresh. Client DB role takes priority over `pcs_role_preview`. Deep link `srtd.io/?open=POST_ID` → `window._pendingOpenPost` fired after loadPosts.
- PCS document-click-close skips close when the active dropdown contains `input[type="date"]`. `_cardClickDelegate` (07-post-load.js) guards `input, textarea, button, [contenteditable="true"], a, [role="button"]` — don't narrow.
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

1. Bump ALL 22 `?v=YYYYMMDDx` strings in `index.html` together (1 stylesheet + 21 scripts). Current: `?v=20260413g`.
2. After every merge: Cloudflare dash → srtd.io → Caching → Purge Everything. Hard refresh every device.
3. Deploy path: merge PR → GitHub Pages publishes from `main-/-root` branch.
4. One PR at a time. TDD mandatory. Never raw `fetch()` — always `apiFetch()`.
5. CLAUDE.md updates in the SAME PR as the code change. Never a separate PR.
6. Every push response must include: files changed, test count, version bump, PR URL.

## 8 — TESTS

Unit: `npx vitest run` — 508/508 passing across 21 test files. E2E: `npx playwright test` — 9 specs (3 critical run in CI only on core-logic file changes). Smoke: `.github/workflows/smoke.yml` runs `live-smoke-schedule.spec.js` every 30 min against production. Required secrets: `SORTED_CLIENT_EMAIL`, `SORTED_ADMIN_EMAIL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `EXPECTED_VERSION`.
