# CLAUDE.md — Sorted (srtd.io)

# Last updated: 2026-04-09

# All facts verified from actual codebase

## SECTION 1 — PRODUCT IDENTITY

Sorted (srtd.io) — social media content ops platform for agencies.
Not a scheduler. A workflow and client trust tool.

Team:

- Shubham — Admin (#C8A84B gold)
- Chitra — Servicing (#22D3EE cyan)
- Pranav — Creative (#9b87f5 purple)
- Manisha — Client, thakur.manisha@somaiya.com (#FF4B4B red)
- Shivangini — Client, shivangini.j@somaiya.com (#FF4B4B red)

## SECTION 2 — REPO STRUCTURE

Repo: github.com/Guneygaar/guneygaar.github.io
Branch: main-/-root. Deployed at srtd.io.
ALL files at REPO ROOT. No /sorted/ subdirectory. Never reference /sorted/.
Subdirs: render/ actions/ tests/ tests/e2e/ sorted-preview-worker/ sql/ preview/ mockups/
Root config files:
  rollback.sql          — DB rollback for role standardization (run if production breaks)
  package.json          — npm dependencies (vitest, playwright, jsdom)
  vitest.config.js      — unit test config (jsdom environment)
  playwright.config.js  — e2e test config (Chromium headless)
  wrangler.toml         — Cloudflare Workers config (R2 upload worker)
  r2-upload-worker.js   — R2 asset upload worker source

## SECTION 3 — FILE LOAD ORDER (sacred — matches index.html exactly)

20 script tags + 1 stylesheet = 21 versioned resources total.
Version format: ?v=YYYYMMDDx. Current: ?v=20260409a

styles.css               — all styles
00-appstate.js           — AppState brain, NO defer, loads FIRST
00-appstate-compat.js    — illegal access guards, NO defer
01-config.js             — constants, ROLE_STAGES, ROLE_TABS (defer)
02-session.js            — session globals (defer)
utils.js                 — esc(), formatDate() (defer)
03-auth.js               — auth + role management (defer)
05-api.js                — apiFetch, uploadPostAsset() (defer)
10-ui.js                 — UI utilities, notifications (defer)
06-post-create.js        — post creation (defer)
render/dashboard.js      — dashboard render (defer)
render/client.js         — client feed render (defer)
render/pipeline.js       — pipeline render (defer)
render/brief.js          — brief render (defer)
actions/pcs.js           — Post Card System overlay (defer)
actions/pcs-longpress.js — Long-press menu for PCS comments (defer)
07-post-load.js          — post fetching (defer)
08-post-actions.js       — stage changes, admin edit (defer)
09-library.js            — library view (defer)
09-approval.js           — approval flow (defer)
04-router.js             — routing, LAST (defer)

CRITICAL:

- 00-appstate.js + 00-appstate-compat.js have NO defer — load synchronously
- 09-library.js calls _renderPCS() directly — must stay on window.*
- 04-router.js must always be the LAST script tag
- actions/pcs-longpress.js must load AFTER actions/pcs.js (wraps openPCS)

## SECTION 4 — APPSTATE

Defined in 00-appstate.js. Loads before everything else.

window.AppState = {
user: { name, email, role, effectiveRole, previewRole },
posts: {
all: [],
cached: [],
loaded: false,
source: null,
parked: [],
activityLogs: [],
activityFetched: false,
setAll: function(newPosts) — ONLY way to update posts.all
},
pcs: {
open, postId, post, editingTarget, closeTimer,
pendingComment, lightbox: {images, index}, activeMenu,
openedFrom
},
ui: {
modalOpen, deferredRender, activeTab, taskFilter,
pipelineFilter, nrsUrgency, retryCount, retryTimer,
realtimeTimer, unreadCount
},
timers: { tokenRefresh, dashDatetime, renderTimer }
}

MUTATION RULES — NEVER BREAK:
NEVER: posts.all.push() / posts.all[i].x=y / posts.all.splice()
Add:    setAll(posts.all.concat([newPost]))
Remove: setAll(posts.all.filter(…))
Update: setAll(posts.all.map(…))

## SECTION 5 — DATABASE SCHEMA

Supabase: vxokfscjzytpgdrmertk.supabase.co
Always use apiFetch() — never raw fetch().
PostgREST eq. is CASE-SENSITIVE — always capitalize roles.
(‘Creative’ not ‘creative’, ‘Admin’ not ‘admin’)

Verified from Supabase information_schema on 2026-04-03.

posts: id(uuid), post_id(text PK), title(text), stage(text),
owner(text), content_pillar(text), location(text),
target_date(date), linkedin_link(text), internal_notes(text),
created_at(timestamptz), updated_at(timestamptz),
created_by(text), updated_by(text), canva_link(text),
status_changed_at(timestamp), format(text), caption(text),
images(jsonb), client_feedback(text), linked_post_id(text)
NOTE: posts.comments column does NOT exist — removed. Never reference it.

post_comments: id(uuid PK), post_id(text), author(text),
author_role(text), message(text), created_at(timestamptz),
visibility(text), mentioned_users(ARRAY), resolved(boolean),
attachments(jsonb), read(boolean), resolved_by(text),
post_title(text), reply_to(uuid), deleted(boolean)
PURPOSE: Client-facing comments. Everything here is visible to client.
No visibility filtering needed — all comments here are public to the
post participants.

internal_notes: id(uuid PK), post_id(text), post_title(text),
author(text), author_role(text), message(text), visibility(text),
mentioned_users(ARRAY), resolved(boolean), resolved_by(text),
reply_to(uuid), attachments(jsonb), read(boolean), deleted(boolean),
created_at(timestamptz)
PURPOSE: Agency-only notes. Client can NEVER see these.
Visibility field controls which agency roles see it.

notifications: id(uuid PK), user_role(text), post_id(text),
type(text), message(text), read(boolean), created_at(timestamptz),
actor(text)
RLS: DISABLED
CLEANUP: pg_cron job 'cleanup-old-notifications' should run daily
at 3 AM UTC to DELETE rows older than 30 days. Run this SQL in
Supabase Dashboard SQL Editor after deploy:
  SELECT cron.schedule('cleanup-old-notifications', '0 3 * * *',
    $$DELETE FROM notifications
      WHERE created_at < NOW() - INTERVAL '30 days'$$);
ROUTING MATRIX (approved 2026-04-06, wired same day):
  EVENT                     ADMIN  SERV.  CREAT. CLIENT
  Client comments            YES    YES    YES    NO
  Client approves            YES    YES    YES    NO
  Client submits request     YES    YES    NO     NO
  → Brief                   YES    NO     YES    NO
  → In Production           YES    NO     YES    NO
  → Ready                   YES    YES    NO     NO
  → Awaiting Approval       YES    NO     NO     YES
  → Awaiting Brand Input    YES    YES    NO     YES
  → Scheduled               YES    YES    YES    NO
  → Published               YES    YES    YES    YES
  Batch stage move           YES    NO     NO     YES
  Email notifications will be built on top of this matrix.

activity_log: id(uuid PK), post_id(text), actor(text), action(text),
old_stage(text), new_stage(text), created_at(timestamptz),
read(boolean), updated_by(text)
PURPOSE: Records every stage change in post lifecycle.
NOTE: CLAUDE.md previously documented wrong column names
(changed_by/changed_at). Actual columns are actor/created_at.
Code is correct.

audit_log: id(uuid PK), post_id(text), action(text),
old_value(text), new_value(text), changed_by(text),
changed_at(timestamptz)
PURPOSE: Records caption edit history — before and after values.
RLS: UNRESTRICTED

error_log: id(uuid auto), error_message(text), error_stack(text),
user_email(text), user_role(text), page(text), action(text),
created_at(default now()), app_version(text)
PURPOSE: All app errors logged automatically via window.logError.
RLS: DISABLED — must stay disabled

tasks: id(bigint PK), assigned_to(text), message(text),
due_date(text), done(boolean), created_at(timestamptz)
PURPOSE: Tasks assigned between team members inside comment threads.
RLS: UNRESTRICTED

user_roles: id(uuid PK), email(text unique), role(text), name(text)
PURPOSE: Controls who has access and what role they have.

requests: id(text PK), title(text), description(text),
created_by(text), created_at(timestamp), status(text),
content_type(text), target_date(date), images(jsonb),
drive_link(text)
PURPOSE: Client brief requests submitted via the New Request form.
Now the PRIMARY destination for client submissions (was posts table).
Status values: pending → assigned → closed.
On assign, Chitra creates a new post linked to the request.
Entries with status=pending are fetched by loadPosts() and merged
into AppState.posts.all with _isRequest:true flag.
RLS: UNRESTRICTED

post_comment_reactions: id(uuid PK), comment_id(uuid), post_id(text),
author(text), author_role(text), emoji(text), created_at(timestamptz)
PURPOSE: Emoji reactions on comments. Currently unused by Sorted core UI.

linkedin_posts: Hinglish Ops insights only — not used by Sorted core workflow.
linkedin_daily_followers: Hinglish Ops follower tracking — not used by Sorted core workflow.
linkedin_daily_visitors: Hinglish Ops visitor tracking — not used by Sorted core workflow.

Storage: post-assets bucket via R2 worker
R2 public URL: pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev

## SECTION 6 — DESIGN SYSTEM (locked — never deviate)

Zero border-radius on inputs and buttons.
No rgba() anywhere — use 8-digit hex (#RRGGBBAA) for transparency.
All 451+ rgba() values converted to hex in PR#TBD (2026-04-08).
130 off-palette hex colors consolidated to design system in PR#TBD (2026-04-08).
Approved rgba exceptions (must be semi-transparent by design):
  .pcs-more-ov background: rgba(0,0,0,0.62) — "+N more" photo overlay
  .pcs-more-l color: rgba(255,255,255,0.6) — "+N more" label text
  SVG fill in index.html L1140 — kept as rgba for SVG compat

Colors:
App bg:          #080808
Surface:         #0d0d12
Comments bg:     #191924
Client comments: #0d0d12
Internal notes:  #111008
Text primary:    #E8E8E8
Text secondary:  #AEAEB2
Text muted:      #8E8E93
Gold:            #C8A84B
Red:             #FF4B4B
Green:           #3ECF8E
Purple:          #9b87f5
Cyan:            #22D3EE
Amber:           #F6A623

Owner colors:
Chitra:  #22D3EE
Pranav:  #9b87f5
Client:  #FF4B4B
Shubham: #C8A84B

Fonts: IBM Plex Mono (labels, mono, meta) + DM Sans (body, UI)
Spacing tokens: –sp-1 (4px) through –sp-7 (48px)
Theme: dark default (data-theme=“dark”)

Image compression:
Post images:    max 1200px, quality 0.82, saves as .jpg
Comment images: max 800px, quality 0.80, saves as .jpg

Photo grid: object-fit:cover + object-position:center center
(fills cells edge-to-edge, no black bars — LinkedIn collage style)
Old .pcs-photo-x removed — use edit mode .pcs-edit-x only

PCS overlay: full page (not bottom sheet), slides right-to-left
  position:fixed inset, width/height 100%, background #080808
  Entry: translateX(100%) → translateX(0), 280ms ease
  Exit: translateX(0) → translateX(100%), 280ms ease
  Photos label row sits flush against photo grid (0px gap)

## SECTION 7 — DEPLOYMENT RULES (never skip any step)

1. Bump ALL 20 ?v= strings in index.html together
   Format: ?v=YYYYMMDDx (e.g. ?v=20260401f)
   Count: 21 total (1 stylesheet + 20 scripts). Never change just one.
1. After EVERY merge purge Cloudflare immediately:
   dash.cloudflare.com -> srtd.io -> Caching -> Purge Everything
1. Hard refresh all devices BEFORE testing
1. ONE PR at a time — never start new until previous merged
1. TDD mandatory — write tests BEFORE every feature
1. HTML mockup first for any UI change
1. Never use raw fetch() — always use apiFetch()
1. Never open /pull/new/[branch] — always open a proper PR
1. Every prompt ends with PR URL:
   https://github.com/Guneygaar/guneygaar.github.io/pull/[number]
1. Every push MUST include all four of these in the response:
   a. Summary of every file changed and what changed in each
   b. Test count (e.g. 444/444 passing)
   c. Version bump (e.g. ?v=20260405a)
   d. PR URL: https://github.com/Guneygaar/guneygaar.github.io/pull/[number]
   No exceptions. Never push without providing all four.
1. Return ALL output in one single code block
1. When updating a prompt — rewrite ENTIRE prompt from scratch.
   Never say “add this line” — Shubham is on iPhone.
1. Run targeted tests during dev, full suite before push:
   npx vitest run tests/specific.test.js

Pre-release manual checks (do before every client-facing deploy):
- Login via magic link OTP works
- Session persists after hard refresh
- Logout clears state and redirects to login

## SECTION 8 — TESTING

Run: npx vitest run
Single file: npx vitest run tests/filename.test.js
E2E: npx playwright test

CI (.github/workflows/test.yml):
  Job 1 `test`          — vitest unit suite on every push/PR to
                          main + main-/-root. Always runs.
  Job 2 `check-e2e-paths` — uses dorny/paths-filter@v3 to detect
                          changes in core logic files.
  Job 3 `e2e-critical`  — runs after unit job passes AND only when
                          core logic files changed; executes 3
                          critical Playwright specs headless in
                          Chromium with a 2-minute cap:
                            tests/e2e/client-flows.spec.js
                            tests/e2e/pcs.spec.js
                            tests/e2e/admin-flows.spec.js
                          live-smoke.spec.js (real creds) and
                          role-flows/smoke are NOT run in CI.

Test tiers (CI path filtering):
  CSS-only changes (styles.css)        → unit tests only (vitest)
  JS template changes (render/*.js,    → unit tests only (vitest)
    actions/pcs.js, index.html bumps)
  Core logic changes (03-auth.js,      → full suite: unit + e2e
    05-api.js, 06-post-create.js,
    08-post-actions.js, 09-approval.js)
  E2e-critical is SKIPPED when none of the 5 core files are in
  the PR diff. This saves ~2 min CI time on CSS/template PRs.

Post-deploy smoke (.github/workflows/smoke.yml):
  Schedule: '*/30 * * * *' (every 30 min) + workflow_dispatch.
  Spec: tests/e2e/live-smoke-schedule.spec.js (6 tests) hits the
    real srtd.io + Supabase. Checks: site reachable, expected
    version served, all 21 versioned assets return 200, Supabase
    REST reachable, client can open a post + comments render,
    error_log has <3 rows in last 30 min.
  Required GitHub secrets for smoke workflow:
    SORTED_CLIENT_EMAIL, SORTED_ADMIN_EMAIL, SUPABASE_URL,
    SUPABASE_ANON_KEY, EXPECTED_VERSION
  These must be set in GitHub repo Settings → Secrets → Actions
  before the smoke workflow will run correctly. Tests whose
  required env vars are missing skip with a console.warn rather
  than failing the whole suite.

Current (verified 2026-04-09):
Unit test files: 21
Unit tests:      508 passing, 0 failing
E2E specs:       9

Files:
tests/appstate-compat.test.js
tests/appstate-posts.test.js
tests/client-comment.test.js
tests/comments-separation.test.js
tests/config.test.js
tests/dom-sanity.test.js
tests/error-handling.test.js
tests/normalise.test.js
tests/notifications.test.js
tests/notif-render.test.js
tests/postlookup.test.js
tests/role.test.js
tests/timestamp.test.js
tests/utils.test.js
tests/action-router.test.js
tests/guard-handlers.test.js
tests/critical-handlers.test.js
tests/defensive-guards.test.js
tests/session-resilience.test.js
tests/post-create.test.js
tests/deeplink.test.js

E2E: tests/e2e/admin-flows.spec.js, client-feed.spec.js, client-flows.spec.js, live-smoke.spec.js, live-smoke-schedule.spec.js, notif-panel.spec.js, pcs.spec.js, role-flows.spec.js, smoke.spec.js
pcs.spec.js updated for post-redesign selectors: TEST 1 activates Client tab before asserting #pcs-comments-list; TEST 3 activates Client tab before asserting #pcs-comment-input + #pcs-send-btn-client; TEST 4 now asserts the #pcs-stage-pill label (advance button removed); TEST 5 targets #pcs-photo-grid-wrap img and the route handler stubs picsum.photos with a 1×1 PNG; TEST 7 targets #pcs-stage-pill dropdown; TEST 8 invokes window.pcsConfirmDelete() via page.evaluate.
role-flows.spec.js TEST 11 fixture: owner changed 'Pranav' → 'Creative' (DB role) to match pipeline.js isMine check after Phase 3.5 role standardization.
notif-render.test.js _notifRelTime "Yesterday" test: setHours(10,0,0,0) → setHours(0,1,0,0) so the date is always >24h ago regardless of current time (the diff < 86400 guard in _notifRelTime returns "X hr ago" before reaching the day comparison if the gap is under 24h).

TEST FILE MAPPING (run targeted tests during development):
  render/client.js      → npx vitest run tests/client-comment.test.js
  actions/pcs.js        → npx vitest run tests/pcs.test.js (future)
  render/pipeline.js    → npx vitest run tests/pipeline.test.js (future)
  render/dashboard.js   → npx vitest run tests/dashboard.test.js (future)
  render/brief.js       → npx vitest run tests/brief.test.js (future)
  00-appstate.js        → npx vitest run tests/appstate-posts.test.js
  03-auth.js            → npx vitest run tests/role.test.js
  10-ui.js              → npx vitest run tests/notifications.test.js tests/notif-render.test.js
  utils.js              → npx vitest run tests/utils.test.js
  04-router.js + 07-post-load.js (deep-link) → npx vitest run tests/deeplink.test.js
  Full suite before push: npx vitest run

AppState mock pattern for new test files:
window.AppState = {
user: { name:‘Test’, email:‘test@test.com’,
role:‘Admin’, effectiveRole:‘Admin’, previewRole:null },
posts: { all:[], cached:[], loaded:false,
setAll:function(p){ window.AppState.posts.all=p; } },
pcs: { open:false, postId:null, activeMenu:null },
ui: { modalOpen:false, unreadCount:0 },
timers: {}
}

## SECTION 9 — INFRASTRUCTURE

R2 bucket:      sorted-images
R2 public URL:  pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev
R2 Worker:      srtd-r2-upload.ksg-kumarshubhamgune.workers.dev
OG Worker:      srtd-og-inject (route: srtd.io/preview/*)
OG source:      sorted-preview-worker/src/index.js
KV:             sorted-whatsapp-previews
WhatsApp preview: generated at post creation time (06-post-create.js, render/brief.js)
                  Fire-and-forget POST to OG Worker /generate-preview endpoint
                  Worker builds OG HTML via buildOgHtml(), stores in KV by shortCode + slug
                  Redirect uses ?id=POST_ID for direct post_id lookup (not title slug)
                  preview/index.html supports both ?id=POST_ID (direct) and ?p=SLUG (legacy)
                  ok/index.html and no/index.html were deleted (2026-04-05) — preview/index.html
                  is the only client-facing page. All Worker redirects and client feed Copy
                  Approval Link point to preview/ or srtd.io/p/SHORTCODE. The Worker /ok* /no*
                  handler block has also been removed.
                  Zero Supabase egress for previews — Worker + KV only
Resend FROM:    hinglish@srtd.io
Short URLs:     srtd.io/p/XXXX via Cloudflare Page Rule
Deep-link:      srtd.io/?open=POST_ID — logs in then opens PCS for that post
                04-router.js stores in window._pendingOpenPost, renderAll()
                in 07-post-load.js fires openPCS after posts load + clears flag.
                Edge functions (notify-comment, notify-stage, notify-request) in
                Supabase should use https://srtd.io/?open=${postId} for "View Post"
                button URLs. Edge functions live in Supabase only — not in this repo.
PREVIEW_SECRET: srtd2026xK9mN3pQ
Pages branch:   main-/-root

## SECTION 10 — KNOWN GOTCHAS

1. Never raw fetch() — always apiFetch()
1. Never mutate AppState.posts.all — always setAll()
1. Never reference /sorted/ — does not exist, files are at root
1. All 21 ?v= strings must bump together — never just one file
1. 00-appstate.js + 00-appstate-compat.js have NO defer attribute
1. Client comment input only renders for awaiting_approval
   and awaiting_brand_input — not all stages
1. _commentInputHtml() MUST be called inside _cardHtml()
   or the input will never exist in the DOM
1. PostgREST eq. is case-sensitive —
   ‘Creative’ not ‘creative’, ‘Admin’ not ‘admin’
1. 09-library.js calls _renderPCS() directly — stays on window.*
1. 04-router.js must always be LAST script tag
1. apiFetch() never calls logout() on 401 — by design
1. AppState.ui.modalOpen guards render — do not bypass
1. 15-second poll interval, 50-minute token refresh
1. Client DB role takes absolute priority over pcs_role_preview
1. Silent .catch(function(){}) is a bug — always use window.logError
1. Vitest must pass 508/508 before every push
1. Posts get _commentCount (int) and _clientCommentAt (ISO string or null)
   after loadPosts() — these are runtime-enriched fields, not DB columns
1. Requests from requests table get _isRequest:true flag after loadPosts().
   Brief sheet, assign, close, and reopen all check this flag to route
   API calls to /requests instead of /posts. Do not remove this flag.

## SECTION 11 — GLOBAL FUNCTIONS

00-appstate.js:
window.logError             — log error to Supabase error_log table
window.onerror              — global error handler → logError
window.onunhandledrejection — global promise rejection handler → logError
window.guardAction          — per-key in-flight guard for async handlers;
                              usage: guardAction('key', () => asyncFn());
                              skips re-entry while key is in-flight,
                              catches errors → logError + showToast,
                              also pushes failure entries into
                              window._clickBuffer with success:false,
                              releases key in .finally()
window._sessionId           — unique session identifier minted once at
                              page load (sess_<ts>_<rand6>), used as
                              session_id on every click_log row

10-ui.js (click telemetry):
window._clickBuffer         — array of pending click_log entries; the
                              Action Router pushes one per dispatch,
                              guardAction pushes failures
_flushClickBuffer           — drains _clickBuffer to POST /click_log
                              every 5s via apiFetch; failures now
                              console.warn so RLS/permission errors
                              are visible in devtools. On beforeunload
                              the remainder is POSTed via
                              fetch(keepalive:true) with full
                              apikey + Authorization headers
                              (sendBeacon cannot set headers so
                              Supabase would always reject it).

10-ui.js:
window._showErrorToast      — show transient error toast to user
window.showToast            — show success/error/info toast (top-level, auto-hoisted)
window.gamSwitchRole        — switch role preview
window.openNotifications, window.closeNotifications
window.openPipelineFilter, window.closePipelineFilter, window.applyPipelineFilter

03-auth.js:
window.normalizeRole        — canonical role normalizer (person names → DB roles)
window.sendMagicLink        — send OTP email to user
window.verifyOTPCode        — verify OTP and set session
window.resetRolePreview     — clear role preview, restore Admin
window._clearSessionAndLogin — clear all tokens + show login overlay
window._authReady           — boolean, true after _startRouter completes
window._visibilityRefreshBound — guard to bind visibilitychange once

01-config.js:
window.setStage             — stage transition helper

06-post-create.js:
window._initPostAssetInput  — initialize post asset file input
window._renderNewPostAssetGrid — render asset preview grid
window.clearPostAsset       — clear selected post asset

07-post-load.js:
window.isPostStale          — check if post data is stale

08-post-actions.js:
window._sendStageNotif      — send stage-change notifications to recipients
window._confirmPublish      — publish post with LinkedIn URL
window._skipPublish         — publish post without URL

09-approval.js:
(top-level functions auto-hoisted: clientApprove)

09-library.js:
window.libOpenPostCard, window.libOpenFilterSheet, window.libCloseFilterSheet,
window.libApplyFilters, window.libResetFilters, window.showLibrary,
window.libSetView, window.libOpenCard, window.libToggleSearch,
window.libSyncChipVisuals, window.libGoToPipeline

render/dashboard.js:
window._safeStage, window.getScoreboardCounts, window.getScoreboardData,
window.dashPad, window.updateDashGreeting, window.updateDashKicker,
window.updateDashDeck, window.updateDashDatetime, window.renderScoreboard,
window._renderDashTaskList, window.toggleDashTask, window.openRunwaySheet,
window.openPostOverSheet, window.openStageSheet, window._buildDoThisNowItems,
window.renderDashboard, window._renderDashboardInner, window.updateBelowFold,
window._updateNextScheduled, window._updateTodaysFocus, window._updateLastMove,
window._timeAgo, window._updateUnsaidThing, window._updateDashTimestamp,
window.updateDashboardHeader

render/client.js:
window._openClientCardMenu, window._restoreAgencyNav,
window._clientSetReply, window._clientClearReply,
window._clientRemoveImg, window._clientFeedHandleImg,
window._clientToggleMention, window._clientInsertMention,
window.renderClientView, window._openClientPostOverlay,
window.openClientRequestForm, window._closeReqForm,
window._reqToggleChip, window._reqSetUrgency, window._reqPreviewFile,
window._reqClearUpload, window._reqAddPhotos, window._reqUpdatePhotoCount,
window._reqValidate

render/pipeline.js:
window.openPipelineSearch, window.closePipelineSearch,
window.updatePipelineCritical, window.updatePipelineStageBar,
window.filterPipelineStage, window._applyPFFilter, window.openSearchResult,
window.handlePipelineSearch, window.togglePipelineGroup,
window.togglePipelinePub, window._pipelineStageKey, window.buildPipelineCard,
window.updatePipelineChipCounts, window.updatePersonStripCounts,
window.filterPipelineByPerson, window.filterPipelineByChip,
window.toggleBatchMode, window.toggleBatchCard, window.updateBatchCount,
window.executeBatchAction, window.renderPipeline, window.updatePipelineHeader,
window.updatePipelineNarrative, window.filterFromNarrative,
window._renderPipelineInner, window.copyChase, window.fallbackCopy,
window.chaseAll, window.pcsPipelineFilter

render/brief.js:
window._openBriefSheet, window._assignBriefToPranav,
window._closeBriefConfirm, window._closeBrief,
window._reopenBrief, window._createPostFromBrief

actions/pcs.js:
window._pcsLbImages, window._pcsLbIdx, window._pcsActiveTab, window._pcsDateChange,
window.openPCS, window.closePCS, window.forcePCSReset,
window._renderPCS, window._pcsTabSwitch, window._pcsChipDrop,
window._pcsTitleEdit,
window.changeStage, window._showPublishSheet, window._removePublishSheet,
window._saveLiUrlInline, window.loadPcsComments, window._showStageConfirm,
window._buildDriveLinkCard,
window._removePcsConfirm, window.pcsConfirmDelete,
window.pcsDoDelete, window._pcsAddPhotos, window._pcsHandlePhotoInput,
window._pcsRemovePhoto, window._pcsPhotoMenu, window._pcsSaveAllPhotos,
window._pcsCloseUnifiedMenu, window._pcsEnterEditMode, window._pcsExitEditMode,
window._pcsConfirmRemovePhoto, window._pcsDoRemovePhotoEdit,
window._pcsConfirmClearCaption, window._pcsDoClearing,
window._pcsCopyCaption, window._pcsConfirmReplace,
window._pcsDoReplace, window._pcsOpenLightbox, window._pcsLbRender,
window._pcsLbNext, window._pcsLbPrev, window._pcsLbClose,
window._pcsLbDownload, window._startCaptionEdit, window._cancelCaptionEdit,
window._saveCaptionEdit, window._sharePostOnWhatsApp, window.submitPcsComment,
window._doSubmitComment, window.toggleTaskResolve, window._initMentionDropup,
window._showTaskAssign, window.submitPcsTask, window._pcsHandleCommentImg,
window._pcsTogglePlusMenu, window._pcsLongpressRemoveMenu,
window._pcsRenderImgPreviews, window._pcsRemoveCommentImg,
window._pcsSetReply, window._pcsClearReply, window._pcsCopyComment,
window._pcsConfirmDeleteComment, window._pcsDoDeleteComment

## SECTION 12 — CURRENT KNOWN BUGS

1. Brief/request submission writing to non-existent 'comments' column
   Location: 10-ui.js _nrsSubmit(), render/brief.js _assignBriefToPranav(),
   09-approval.js changes_submit — all wrote 'comments' to posts table
   Status: FIXED (PR#633) — changed to client_feedback in all 3 locations
1. Approved posts not highlighted after refresh in client feed
   Location: render/client.js approved-strip was display:none, only shown in-session
   Status: FIXED (PR#TBD) — strip now renders with stage==='scheduled', solid bg #0a1a12
1. No back button when PCS opens from dashboard bottom sheet
   Location: actions/pcs.js, render/dashboard.js openPostOverSheet()
   Status: FIXED (PR#TBD) — added AppState.pcs.openedFrom, back arrow in PCS topbar
1. Notifications: loadNotifications case mismatch — panel always empty
   Location: 10-ui.js loadNotifications(), setNotifFilter(), markAllNotificationsRead()
   queried with lowercase role but data stored Title Case (PostgREST case-sensitive)
   Status: FIXED (PR#TBD) — title-case role in all 3 functions
1. Notifications: missing actor + read:false on client feed comment inserts
   Location: render/client.js lines 1000-1017 (Servicing + Admin notifs),
   line 1028 (mention notif used email instead of name)
   Status: FIXED (PR#TBD) — added actor: name + read:false to all 3
1. Notifications: missing read:false on PCS + pipeline notification inserts
   Location: actions/pcs.js _doSubmitComment (comment + mention notifs),
   render/pipeline.js executeBatchAction (batch stage notif — also missing actor)
   Status: FIXED (PR#TBD) — added read:false to all, actor to pipeline batch
1. Notifications: no stage-change notifications for most transitions
   Location: 08-post-actions.js, 09-approval.js, render/pipeline.js
   14 of 16 stage transitions had zero notifications
   Status: FIXED (PR#TBD) — added _sendStageNotif helper + notifications
   to all stage change functions per product rules
1. Dead posts.comments references in normalise(), brief.js, approval.js
   Location: 05-api.js normalise() mapped r.comments (dead column),
   render/brief.js read post.comments instead of post.client_feedback,
   09-approval.js read post.image (singular) instead of post.images[0]
   Status: FIXED (PR#638) — removed dead column from normalise(),
   brief.js reads client_feedback, approval.js reads images[0]
1. Brief sheet reads non-existent post.comments column
   Location: render/brief.js _openBriefSheet() and _createPostFromBrief()
   Status: FIXED (PR#639) — changed to client_feedback || description
1. Caption save fails when audit_log POST crashes
   Location: actions/pcs.js _saveCaptionEdit() — single try/catch for PATCH + audit
   Status: FIXED (PR#639) — split into two independent try/catch blocks
1. Badge timer keeps firing after session expiry
   Location: 10-ui.js notifBadgeTimer setInterval — no session guard
   Status: FIXED (PR#639) — added localStorage token check before firing
1. Stale token causes error banner on login
   Location: 03-auth.js verifyOTPCode() — old sb_access_token not cleared
   Status: FIXED (PR#639) — clear stale token before setting fresh one
1. Batch action removed Admin from notification recipients
   Location: render/pipeline.js executeBatchAction() — both branches returned ['Client'] only
   Status: FIXED (PR#639) — added 'Admin' to both branches
1. _pcsDateChange DOM crash — activeMenu.remove() on detached element
   Location: actions/pcs.js _pcsDateChange() — blur event detaches element before remove
   Status: FIXED (PR#640) — added parentNode guard before remove()
1. Client comments not surfaced for Chitra in pipeline
   Location: 07-post-load.js comment fetch, render/pipeline.js COMMENTED group
   Status: FIXED (PR#640) — enriched with _clientCommentAt, sorted by
   recency, amber dot on cards with client comments
1. LinkedIn publish flow — 6 bugs fixed in one PR
   (a) linkedin_link never saved on confirm — _confirmPublish
       (08-post-actions.js:447) looked for input IDs
       'publish-li-input-{pid}' and 'li-url-input-{pid}' but
       _showPublishSheet (actions/pcs.js:734) creates
       id="pcs-li-url-input". Input always null, URL always ''.
       FIXED: added 'pcs-li-url-input' as first fallback.
   (b) No URL validation — any string accepted as LinkedIn URL.
       FIXED: added linkedin.com domain check before save;
       rejects non-LinkedIn URLs with toast.
   (c) Ghost overlay — _confirmPublish never called
       _removePublishSheet(), so the publish sheet stayed in DOM
       as a floating backdrop after publish completed.
       FIXED: added _removePublishSheet() call before closePCS().
   (d) Confirm/Skip buttons had no id attributes — confirm button
       could not be disabled during publish (btn always null),
       Skip button had no guard against double-tap.
       FIXED: added id="confirm-publish-btn-{pid}" and
       id="skip-publish-btn-{pid}" to _showPublishSheet buttons.
   (e) _skipPublish had no in-flight guard — rapid taps fired
       multiple quickStage calls, each sending 4 notifications
       (N taps = N x 4 notification rows).
       FIXED: reads skip button, early-returns if disabled,
       disables + shows "Skipping..." on first tap.
   (f) _sendStageNotif dedup guard used Date.now() in key —
       calls >1ms apart bypassed the guard (effectively useless).
       FIXED: removed Date.now() from key, added 5-second
       setTimeout to clear the guard. Same post + same stage
       within 5 seconds = blocked.
   (g) libSaveLinkedInUrl (09-library.js) was dead code — not
       exported to window.*, used wrong PK column (id vs post_id).
       FIXED: deleted entirely.
   Location: 08-post-actions.js, actions/pcs.js, 09-library.js
   Status: FIXED (PR#TBD)
1. Role preview (admin to Chitra/Pranav/Client) not showing
   correct view in all cases
   Status: OPEN
1. Notification tap on new_request opens PCS instead of brief sheet
   Location: 10-ui.js openNotifications() tap handler — notifType
   'new_request' fell through to openPCS() because data-is-brief
   was never emitted by _buildItem() and the tap handler did not
   check notifType. _buildItem only emitted data-notif-type but
   the routing logic relied on data-is-brief which was always
   absent.
   Status: FIXED (PR#TBD) — tap handler isBrief now also matches
   data-notif-type === 'new_request'. _buildItem emits
   data-is-brief="1" on new_request notification items so the
   attribute is present for any code that checks it. Routes to
   _openBriefSheet(pid) which correctly handles REQ- post_ids
   via _isRequest flag.
1. Session persistence — clients getting logged out
   Check: persistSession in 02-session.js Supabase client config
   Status: FIXED (PR#TBD) — resolved by permanent silent sessions
   (typed errors, cross-tab lock, visibilitychange handler)
1. Client request form: 15 rgba() violations, multi-select chips,
   no photo size/count limits, fixed-height textarea, dead .nrs-* CSS,
   all inline styles, no field 01 number label
   Location: render/client.js _ensureReqOverlay() + helper functions
   Status: FIXED (PR#TBD) — all rgba replaced with hex, single-select
   chips, max 5 photos / 5MB limit, auto-grow textarea, field 01 numbered,
   drive link field added (unwired to DB), button styles updated
1. Client requests writing to posts table instead of requests table
   Location: 08-post-actions.js submitClientRequest()
   Status: FIXED (PR#TBD) — now writes to requests table with proper
   columns (id, title, description, content_type, target_date, images,
   drive_link, created_by, status). loadPosts() fetches pending requests
   and merges into AppState with _isRequest:true flag. Brief sheet reads
   content_type and drive_link as direct fields. Assign creates a new
   post linked to the request. Close/reopen patches requests table.
1. Comment delete restricted to Admin only — authors cannot delete own comments
   Location: actions/pcs.js lines 952 and 1040 — delete button render
   condition was (_roleLower === 'admin') only
   Status: FIXED (PR#TBD) — changed to (c.author === _name || _roleLower === 'admin')
   so comment authors can delete their own comments, Admin can delete any
1. Client feed comments had no delete button — only REPLY and COPY
   Location: render/client.js _singleCommentHtml() — no DELETE action
   Status: FIXED (PR#TBD) — added DELETE button visible when
   c.author === window.AppState.user.name OR effectiveRole is Admin.
   Reuses _pcsConfirmDeleteComment(). Admin can delete any comment.
1. Client feed comment timestamp and role label nearly invisible
   Location: render/client.js _singleCommentHtml() — color:#333 on #080808 bg
   Status: FIXED (PR#TBD) — changed to #8E8E93 (design system muted text).
   Also replaced 2 rgba() violations: stroke rgba(255,255,255,0.25) → #3a3a3a,
   avatar bg rgba(255,255,255,0.06) → #111111. Dynamic _hexToRgb() avatar kept.
1. NRS owner fallback writes person name 'Pranav' to DB
   Location: 10-ui.js line 1330 — owner field fallback was || 'Pranav'
   Status: FIXED (PR#TBD) — changed fallback to 'Creative' (DB role)
1. iOS keyboard ghost input — fixed bottom nav overlays client feed
   comment input when keyboard opens, and tapping input does not
   scroll it into view
   Location: render/client.js renderClientView() — no visualViewport
   handling, no focus scrollIntoView on comment inputs
   Status: FIXED (PR#660) — added _wireCommentInputFocus() that
   attaches a focus listener to every [id^="comment-input-"] input to
   scrollIntoView (center, smooth) after a 300ms delay so keyboard
   finishes opening first. Called at the end of renderClientView.
1. Client cannot comment — taps on input blocked on iOS
   Location: render/client.js _wireKeyboardPushNav() translated
   #bottom-nav (z:100, fixed) up by keyboardHeight on visualViewport
   resize, painting nav pixels on top of the static-flow comment
   input row and intercepting taps; _openClientPostOverlay built
   cardHtml without _commentInputHtml() so overlay opened with no
   input in DOM; overlay root had user-select:none which can cause
   flaky iOS Safari input behaviour
   Status: FIXED (PR#661) — removed _wireKeyboardPushNav() entirely
   (scrollIntoView alone handles positioning correctly), removed
   user-select:none/-webkit-user-select:none from #client-post-overlay
   style, and added _commentInputHtml(post) to the overlay cardHtml
   build so the input exists in DOM immediately on open.
1. Client comment input still unclickable after previous fix —
   tapping the input in the client post overlay does nothing on
   both mobile and desktop
   Location: 07-post-load.js _cardClickDelegate at line 2562 —
   document-level click listener matched [data-post-id] on the
   comment &lt;input&gt; itself (render/client.js:643) and called
   _openClientPostOverlay(pid) on every tap, tearing down the
   overlay and destroying the input before focus landed
   Status: FIXED (PR#662) — added a guard at the top of
   _cardClickDelegate that early-exits when e.target.tagName is
   INPUT, TEXTAREA, or BUTTON. render/client.js untouched; the
   data-post-id attribute is left intact in case it is relied on
   elsewhere.
1. PCS comment-footer bar visually overlapping the post image on
   desktop (thin dark strip abutting photo bottom edge)
   Location: styles.css — #pcs-pane-client uses flex:1 but its
   parent .pc-scroll-body is a block container with overflow-y:
   auto, so flex:1 on the pane is ignored as a flex item. The
   pane collapses to content height and the input-row footer
   stacks directly against the bottom of #pcs-photo-grid-wrap.
   Status: FIXED (PR#662) — added a desktop-only @media
   (min-width:768px) rule setting min-height:60vh on
   #pcs-pane-client and #pcs-pane-internal. Mobile layout is
   untouched. Not converting .pc-scroll-body to a flex container
   — too many children would be affected.
1. Comment delete fails with "invalid input syntax for type uuid:
   empty string" on the just-posted comment in the client feed
   Location: render/client.js _handleSubmitComment line 948 built
   an optimistic commentObj without an id field and appended it
   to post.post_comments without patching back the server UUID,
   so _singleCommentHtml rendered the DELETE button with an empty
   id interpolated into its onclick
   Status: FIXED (PR#TBD) — after the POST to /post_comments
   resolves, pull the created row's id from the response
   (apiFetch default Prefer: return=representation, see
   05-api.js:12) and assign it to commentObj.id. Optimistic
   append and rendering remain unchanged; only commentObj.id
   is patched silently in memory.
1. _cardClickDelegate guard too narrow — only blocked INPUT,
   TEXTAREA, BUTTON by tagName, so taps on links, contenteditable
   fields, custom [role=button] elements, and children of native
   buttons (e.g. a span inside a <button>) fell through and
   triggered card-open logic on [data-post-id] ancestors.
   Location: 07-post-load.js:2563 _cardClickDelegate guard.
   Status: FIXED (PR#TBD) — replaced tagName checks with
   e.target.closest('input, textarea, button, [contenteditable="true"],
   a, [role="button"]') so interactive elements and their children
   are reliably skipped.
1. Optimistic client comment could end up in the DOM with no
   UUID if the POST response returned no id, leaving a ghost
   comment that the DELETE button could never remove.
   Location: render/client.js _handleSubmitComment after the
   POST /post_comments resolve — previously only patched id when
   present, with no fallback branch.
   Status: FIXED (PR#TBD) — if _createdId is falsy, splice
   commentObj out of post.post_comments, remove the last list
   child from the DOM, showToast('Failed to sync comment.
   Please try again.', 'error') and return before firing any
   notifications. Prevents headless comments with empty id.
1. _handleSubmitComment had no in-flight guard — rapid Enter
   could create N duplicate client comment POSTs and N duplicate
   notification fanouts before the first POST resolved; optimistic
   path pushed a new commentObj into post.post_comments on every
   tap, ghosting the UI.
   Location: render/client.js _handleSubmitComment lines 931-1082.
   Status: FIXED (PR#TBD) — reads/sets data-submitting="true" on
   the comment input AND on the data-action="submitComment" send
   button, disables the button, and clears both in a .finally()
   after the POST chain. Early returns (empty message, missing
   input) do not set the flag and do not need to clear.
1. clientAcknowledge had no in-flight guard, no btn param, and no
   button disable — double-tap on "acknowledge" sent two PATCHes
   and two notification fanouts simultaneously. Catch block only
   toasted, never called logError.
   Location: 08-post-actions.js clientAcknowledge() lines 242-254.
   Status: FIXED (PR#TBD) — wrapped entire function body in
   window.guardAction('client-acknowledge-' + postId, …) so
   concurrent invocations are dropped at the guard. Catch block
   now also calls window.logError with action 'client-acknowledge'.
1. 7 MEDIUM-risk async handlers lacked in-flight guards and
   could double-submit on rapid tap (async hardening PR 3).
   Status: FIXED (PR#TBD) —
   (a) submitPcsComment wrapped in guardAction('submit-pcs-comment-'
       + postId) so sync prep work (mention parse, image slice,
       AppState mutation) can't re-run on second tap.
   (b) _pcsDoDeleteComment wrapped in guardAction('pcs-delete-
       comment-' + commentId).
   (c) pcsDoDelete wrapped in guardAction('pcs-delete-post-' + id)
       using window._pcs.postId; admin role + postId guards moved
       ahead of the guard.
   (d) loadPcsComments protected by dedicated window._pcsCommentsLoading
       flag (not guardAction — matches loadPosts load-guard pattern);
       set true before fetch, cleared in finally.
   (e) submitApproval wrapped in guardAction('submit-approval-' +
       postId) so protection is independent of whether caller passed
       btn. Both catch blocks now call window.logError with actions
       'submit-approval-changes' and 'submit-approval-approved'.
   (f) assignTask wrapped in guardAction('add-task'); deleteTask
       wrapped in guardAction('delete-task-' + id) to prevent
       duplicate inserts/deletes.
   (g) _saveCaptionEdit wrapped in guardAction('save-caption-' +
       postId) covering both the /posts PATCH and the /audit_log
       POST plus the in-memory AppState update.
1. Missing logError on user-visible failure catches (async
   hardening PR 4). Six toasting-but-silent catches were missing
   error_log writes.
   Status: FIXED (PR#TBD) —
   (a) saveAdminEdit: added logError('save-admin-edit') after
       existing showToast + btn re-enable.
   (b) deletePost: bare `catch {}` upgraded to catch(err) and
       logError('delete-post') added.
   (c) _confirmPublish: already had logError('publish-post') from
       earlier pass — left intact.
   (d) flagIssue: bare `catch {}` upgraded to catch(err) and
       logError('flag-issue') added.
   (e) loadPcsComments: already had both logError('load-pcs-
       comments') + showToast('Failed to load comments') from
       earlier pass — left intact.
   (f) toggleTaskResolve: had logError('toggle-task-resolve')
       but no user feedback. Added showToast('Failed to update
       task', 'error') to the catch block.
1. Four dead-function onclick handlers in index.html (Phase 4
   audit) — buttons silently did nothing when tapped
   Location: index.html:486 closeClientMenu() (undefined);
   index.html:1255 showSearch() (undefined);
   index.html:1319 insApplyCustom() (undefined);
   index.html:1447 insShareReport() (undefined).
   Status: FIXED (PR#TBD) — line 486: changed closeClientMenu()
   to closeUserMenu() (defined in 10-ui.js:125). Lines 1255,
   1319, 1447: removed dead onclick attributes and added TODO
   comments above each button so they are not silent dead
   buttons. No behavior change needed — these buttons were
   already no-ops in production.
1. Notification panel rebuild (PR 1 of 4) — bottom-sheet shell
   replaced with full-page overlay; dead code pruned; actor
   plumbed; tabs collapsed ALL/ACTION/INFO → NEEDS YOU/UPDATES.
   Scope:
   (a) 10-ui.js: deleted dead typeClass/stagePills/getActions/
       formatTime/parseActor helpers inside renderNotifications;
       deleted loadNotifBadge() (stale global, no callers);
       removed notif-client-badge target (element never existed
       in HTML) from updateNotifBadge + markAllNotificationsRead;
       added actor to /notifications SELECT so avatar no longer
       relies on message first-word regex.
   (b) 10-ui.js: renderNotifications fully rewritten — class-
       driven markup only (no inline style= attributes), uses
       solid hex per design tokens. Emits .notif-item wrappers
       with data-notif-id + data-post-id + ntype-* color bar
       class. Builds summary chips (chip-urgent, chip-reply,
       chip-live, chip-allclear) from AppState.posts.all with
       no new fetch. Tab counts on #ntab-needs-count /
       #ntab-updates-count. Per-tab empty states with
       "CAUGHT UP" (needs) and "APPROVED THIS WEEK" stat
       (updates).
   (c) 10-ui.js: _notifRelTime() added ("just now" / "X min
       ago" / "X hr ago" / "Yesterday \xB7 H:MM am/pm" / full
       date for older).
   (d) 10-ui.js: openNotifications — overlay is now solid
       #0a0a0f with align-items:stretch, panel is a flex
       column at 100% height with .notif-topbar (fixed),
       .notif-scroll (flex:1), .notif-tabs (fixed bottom).
       Delegated click moved from .notif-post-card-tap →
       .notif-item so the whole row taps through.
   (e) 10-ui.js: markAllNotificationsRead — uses Title-cased
       role (same logic as loadNotifications) for the PATCH,
       clears both ntab-*-count spans, calls window.logError
       on failure with action 'mark-all-notifications-read',
       fires a success toast.
   (f) index.html L389–420: #panel-updates markup rebuilt —
       .notif-topbar (role label + hey + mark-all-btn +
       .notif-summary), .notif-scroll, .notif-tabs with two
       .ntab buttons (NEEDS YOU / UPDATES).
   (g) styles.css: deleted legacy .notif-panel/.notif-list
       block (old L529-567) and dead L4217-4304 .notif-item/
       .notif-avatar/.notif-msg/.notif-meta/.notif-stage-pill
       system. New class system inserted at L4023+:
       #panel-updates flex column, .notif-topbar,
       .notif-topbar-row, .notif-role-label, .notif-hey,
       .mark-all-btn, .notif-summary + .summary-chip +
       .chip-dot + .chip-urgent/.chip-reply/.chip-live/
       .chip-allclear, .notif-tabs + .ntab + .ntab-count,
       .notif-scroll, .notif-day-label, .notif-item +
       ntype-comment/approval/live/stage/overdue left bars
       (with @keyframes notif-pulse), .notif-row, .notif-av +
       av-n-client/chitra/pranav/shubham/system,
       .notif-body/.notif-msg/.notif-time/.notif-unread-dot,
       .notif-post-card/.notif-post-thumb/.notif-post-info/
       .notif-post-title/.notif-post-arrow, .notif-stage-pill
       + nsp-approval/input/ready/scheduled/published/
       production, .notif-live-card/.notif-live-thumb/
       .notif-live-title/.notif-live-sub, .notif-overdue-
       badge, .notif-empty-state + .notif-empty-icon +
       .notif-empty-title/.notif-empty-sub/.notif-empty-stat.
       All solid hex, no rgba, no design-system violations.
   (h) L5800 .av-client rule KEPT (originally flagged as a
       duplicate, but actions/pcs.js:882 uses it with
       .pcs-avatar — deleting would break PCS client avatars.
       After deleting the 4217-4304 block, L5800 is no longer
       a duplicate, it's the sole definition).
   (i) Tests: tests/notifications.test.js updated ("all 5" →
       "all 4" badges twice, tap handler regex switched from
       .notif-post-card-tap to .notif-item). New file
       tests/notif-render.test.js adds 49 tests covering
       _notifRelTime, bucket types, _notifTypeClass,
       _notifActorClass, _notifStagePillClass, summary chip
       wiring, markAllNotificationsRead source shape,
       openNotifications overlay shape, and a dead-code
       removal audit (loadNotifBadge/getActions/typeClass/
       stagePills/parseActor/formatTime/notif-client-badge/
       .nftab all absent).
   Status: FIXED (PR#TBD) — 433/433 passing. Bumped to
   ?v=20260406a across all 20 resources.
1. Notification panel — four follow-up fixes after PR 1.
   (a) Close button missing from the full-page overlay.
       Added .notif-close-btn (18px DM Sans X) as a third
       child of .notif-topbar-row wired to
       closeNotifications() (index.html), plus matching
       styles.css rule (no-border text button, #555566,
       hovers to #F0F0F2).
   (b) Timestamp wiring verified — loadNotifications already
       SELECTs created_at, renderNotifications calls
       _notifRelTime(n.created_at), and the .notif-time
       div is emitted for every item. .notif-time CSS
       matches spec (IBM Plex Mono 8px #555566 .05em). No
       code change, but confirmed end-to-end.
   (c) Day-label spacing tightened: .notif-day-label
       padding 14px 20px 8px -> 10px 20px 6px; .notif-summary
       padding-bottom 14px -> 8px for tighter chip-to-list
       rhythm.
   (d) Bottom tab bar breathing room: .ntab padding
       12px 0 -> 14px 0 18px so label sits above iPhone
       Safari's browser bar. Added padding-bottom:
       env(safe-area-inset-bottom, 0px) to .notif-tabs so
       the row never overlaps the iPhone home indicator.
   Status: FIXED (PR#TBD) — 433/433 unit + 40/40 CI e2e
   passing. Bumped to ?v=20260406b.
1. Notification panel rebuild (PR 2 of 4) — CSS replacement,
   new item layout at Instagram density, horizontal scroll
   filter chips replacing NEEDS YOU / UPDATES bottom tabs.
   Scope:
   (a) styles.css: entire L4023-4398 notification panel CSS
       block replaced. All new classes target the approved
       mockup. Panel structure rule changed from
       #panel-updates to #notif-overlay #panel-updates so
       the flex column layout only applies when the panel
       is mounted inside the overlay (keeps .tab-panel
       hide-on-other-tabs working). Header now has two rows:
       row1 (role label + close X), row2 (hey + mark-all).
       New .notif-chips horizontal scroll container with six
       .notif-chip buttons (ALL / APPROVAL / COMMENTS /
       OVERDUE / LIVE / STAGE MOVES), scrollbar-hidden.
       .notif-chip.active uses neutral #141420 background;
       colored variants .nchip-red/cyan/amber/green apply
       per-filter tint only when active. New single-row
       .notif-item at 56px min-height with 10/14/10/18 px
       padding, 11px DM Sans text with 2-line webkit-clamp,
       inline 11px gray timestamp via .notif-time-inline,
       inline 8px amber OVERDUE badge via
       .notif-overdue-inline, 44x44 .notif-thumb-wrap/
       .notif-thumb on the right edge, 34x34 .notif-av on
       the left with new nav-* palette. Left color bar is
       still driven by ntype-comment/approval/live/stage/
       overdue (with pulse on overdue). New .notif-live-card
       for type:published, tinted #091410 green with
       VIEW ON LINKEDIN sub. Empty state matches the #notif-
       empty element. All solid hex with 8-digit alpha
       suffixes (#FF4B4B14 etc.) — zero rgba().
   (b) index.html L389-423: #panel-updates body replaced.
       .notif-topbar now has .notif-topbar-row1 (role +
       close) and .notif-topbar-row2 (hey + mark-all),
       then .notif-chips with six data-filter buttons,
       then a 1px divider, then .notif-scroll list, then
       #notif-empty state. Bottom .notif-tabs gone.
   (c) 10-ui.js: _notifFilter renamed to _notifChipFilter
       (default 'all'). setNotifFilter() removed entirely.
       _NOTIF_NEEDS_TYPES / _NOTIF_UPDATES_TYPES removed.
       _notifStagePillClass removed (post cards no longer
       carry stage pills). _notifActorClass rewired from
       av-n-* to nav-* prefix. New _notifChipMatch(filter,
       n, post) predicate drives chip filtering (all /
       approval / comment / live / stage / overdue).
       renderNotifications body rewritten to single-row
       density layout with inline timestamp. For
       type:published rows the live-card HTML replaces the
       item. Chip counts (nchip-all/approval/comment/
       overdue-count) written to after filter application.
       Click delegation in openNotifications now also
       matches .notif-live-card (closest('.notif-item,
       .notif-live-card')) and skips .notif-chips,
       .mark-all-btn, .notif-close-btn. A new _chipsWired
       guard attaches a delegated listener to #notif-chips
       so chip taps flip active class + filter state + call
       renderNotifications directly (no action-router hop).
       markAllNotificationsRead clears nchip-*-count (unread
       ones) instead of ntab-*-count.
   (d) 10-ui.js router: case 'notif-filter' removed — chips
       have their own delegated listener on the panel, no
       data-action attribute is used.
   (e) Tests: action-router.test.js dropped the notif-filter
       router case test (36 -> 35). notifications.test.js
       tap handler regexes updated for the comma selector
       '.notif-item, .notif-live-card'. notif-render.test.js
       rewritten for the new API: _notifRelTime (6),
       _notifIsOverdue (5), _notifTypeClass (8),
       _notifActorClass (3), _notifChipMatch (7),
       renderNotifications wiring (8 incl. chip counts,
       live-card branch, no inline styles), markAll source
       audit (5), openNotifications overlay shape (6 incl.
       .notif-item/.notif-live-card tap selector + chip
       wiring), dead code audit (2 PR1+PR2 combined). Total
       50 tests in notif-render.
   Status: FIXED (PR#TBD) — 433/433 unit + 40/40 CI e2e
   passing. Bumped to ?v=20260406c.
1. Notification panel rebuild (PR 3 of 4) — exact pixel
   CSS, chips ALL/MENTIONS/COMMENTS/MOVES/LIVE, grouped
   comments, comment preview fetch, live card fixed,
   timestamps fixed, stage labels human readable, overdue
   removed entirely.
   Scope:
   (a) styles.css: notification panel CSS block (L4023-)
       replaced in full with the approved mockup values.
       New .notif-topbar has a right-edge gradient fade
       (52x38 ::after) that hints the chips scroll past
       LIVE. Chip palette swapped to nch-gold/cyan/purple/
       green (red/amber dropped). Day label padding at
       8px/18px/6px. .notif-item gained align-self:flex-
       start margin-top:2px on .notif-av so the avatar
       keeps its position as the body grows to two lines.
       New .notif-preview (9px italic) + .notif-more (8px
       cyan) selectors render the comment preview row and
       the "+N more" suffix under grouped comments.
       .notif-live-card rebuilt to match .notif-item
       layout exactly — 34px avatar on LEFT, 44px thumbnail
       on RIGHT, min-height:56px, 10/14/10/18 padding,
       #091410 background with 3px #3ECF8E left bar.
       ntype-overdue + notif-overdue-inline + notif-
       overdue-badge rules all deleted. All solid hex.
   (b) index.html L389-411: #panel-updates rewritten.
       Two-row topbar (role label + close, hey + mark-all),
       then .notif-chips with 5 buttons ALL / MENTIONS /
       COMMENTS / MOVES / LIVE. Count spans now use
       nchip-count-{all,mentions,comments,moves}. The
       dividing 1px line is a .notif-hdr-line element.
       Old .notif-tabs (NEEDS YOU / UPDATES) removed.
       Empty state div removed from HTML — it is injected
       into #notif-list-scroll by renderNotifications.
       The close-x and mark-all buttons use
       data-action="close-notifications" /
       data-action="mark-all-read".
   (c) 10-ui.js: notifications section (L300-) rewritten
       end to end. New _NOTIF_MOVES_TYPES +
       _NOTIF_STAGE_LABELS. New _notifActionText(n) strips
       the leading actor word from n.message and replaces
       raw stage keys (brief/awaiting_approval/
       awaiting_brand_input/in_production/scheduled/ready/
       brief_done/published) with human labels (Brief /
       Awaiting Approval / Needs Input / In Production /
       Scheduled / Ready / Brief Done / Published).
       _notifTypeClass signature changed from (n, post) to
       (n, isMention) — overdue detection deleted, new
       ntype-mention class when isMention is true.
       _notifChipMatch(filter, n, mentionSet) swapped
       approval/comment/live/stage/overdue buckets for
       mentions/comments/moves/live. loadNotifications()
       now batch-fetches /post_comments?post_id=in.(...)
       for every comment notification and stores rows in
       window._notifComments so mention detection and
       preview text don't need a second round-trip.
       renderNotifications() detects mentions from
       c.mentioned_users (array column on post_comments),
       groups comments by (post_id + actor + toDateString)
       and collapses duplicates ("Manisha left 3 comments
       on Post" + "+2 more" suffix on the preview row).
       Day buckets are today / yesterday / earlier by
       toDateString compare. Live card branch uses the
       new .notif-live-card markup with a left 34x34
       .notif-live-av ("✓ POST IS LIVE" tag,
       actor · time · VIEW ON LINKEDIN → sub) and a right
       44x44 .notif-thumb on the right. Double-dot bug
       fixed by building the sub line explicitly from
       actor + time + VIEW ON LINKEDIN string, not from
       n.message.
       markAllNotificationsRead clears the new chip-count
       spans (nchip-count-*). openNotifications passes
       filter values all/mentions/comments/moves/live
       through to _notifChipFilter; tap handler still
       matches '.notif-item, .notif-live-card' and skips
       .notif-chips/.mark-all-btn/.notif-close-btn.
   (d) Action Router: new cases close-notifications and
       mark-all-read wire the two data-action="..." header
       buttons through guardAction.
   (e) Tests: notif-render.test.js fully rewritten for the
       new API — _notifActionText (5), _notifTypeClass new
       signature (6), _notifChipMatch new filters (7),
       renderNotifications wiring (8 incl. day buckets,
       grouped-comment template, chip-count ids, live-card
       branch, post_comments batch fetch, mentioned_users
       reference), markAll audit (5 incl. new chip-count
       ids), openNotifications overlay (5 incl. chip
       wiring + tap selector), dead-code audit (5 incl.
       isOverdue/ntype-overdue/_notifIsOverdue/OVERDUE and
       the old chip ids/palette). _notifRelTime + the
       _notifActorClass tests kept unchanged. Total 50
       tests.
   Status: FIXED (PR#TBD) — 433/433 unit + 40/40 CI e2e
   passing. Bumped to ?v=20260406d.
1. Notification panel rebuild (PR 4 of 4) — six targeted
   bug fixes after the PR 3 audit. No new features, no
   CSS changes.
   (a) 10-ui.js _notifRelTime (L305-330) rewritten:
       wraps new Date() in try/catch, drops the
       .replace(' ','T').replace('+00','Z') hack, tolerates
       a negative diff (clock skew), and returns
       Today/Yesterday/{d M} timeStr using getHours()+
       getMinutes() manually (toLocaleTimeString was
       returning an empty string in some locales / Safari
       builds).
   (b) 10-ui.js live-card sub line (L559) now filters +
       joins non-empty segments
         [actor, ts, 'VIEW ON LINKEDIN →']
           .filter(s => s && s.length > 0).join(' · ')
       so an empty ts no longer produces "actor ·  · VIEW".
   (c) 10-ui.js _buildItem postTitle (L543) adds a fallback
       that extracts the title from n.message when the
       post is missing from AppState.posts.all:
         'Actor published Title' -> slice after 'published '
         'Title is now live'     -> slice before ' is now live'
         fallback                -> whole message.
       Live cards for posts that dropped out of the loaded
       working set now have a readable title.
   (d) 10-ui.js idList (L417) no longer double-quotes
       comment post_ids; PostgREST `in.(...)` wants bare
       values. MENTIONS chip count was 0 because the old
       `"id1","id2"` encoding failed the IN match and
       returned zero comment rows.
   (e) 10-ui.js currentUserName (L459) falls back to
       AppState.user.email when .name is not yet set, so
       mention detection still works right after login.
   (f) 08-post-actions.js _sendStageNotif (L17) adds a
       synchronous double-fire guard: a
       window._lastNotifKey = postId|stage|Date.now() match
       rejects the second call made in the same tick. Stops
       accidental double-inserts when two code paths fire
       for one event within the same synchronous call stack.
   (g) 10-ui.js renderNotifications (L498) filters out any
       row whose n.actor lowercases to 'system' — these are
       noise in the panel, not useful to users. The rows
       stay in Supabase.
   index.html untouched, no version bump.
   Status: FIXED (PR#TBD) — 433/433 unit + 40/40 CI e2e
   passing. Same ?v=20260406d.
1. Notification panel — final PR. Five wired features,
   zero dummy buttons.
   (a) Read/unread state: opacity:0.45 on .notif-item.read
       deleted entirely. Read/unread difference is now ONLY
       the gold unread dot (position:absolute top-right,
       7px circle, display:none when .read). Zero visual
       dimming. CSS .notif-unread-dot with pointer-events:
       none so it never intercepts taps.
   (b) Individual mark as read: tap handler in
       openNotifications (10-ui.js) now calls
       item.classList.add('read') immediately after
       markNotifRead(notifId) for instant dot removal
       without re-render.
   (c) WhatsApp share: each notification item with a
       post_id gets a "↗ WHATSAPP" action button wired
       via data-action="notif-wa" through the Action Router
       to window._sharePostOnWhatsApp(pid) (existing
       function in actions/pcs.js:2115). Builds the
       srtd.io/p/XXXX preview URL and opens wa.me.
   (d) Individual delete: new deleteNotification(id) in
       10-ui.js — optimistic removal from _notifData,
       fade-out DOM animation (opacity+maxHeight 320ms),
       updateNotifBadge(), then DELETE /notifications?id=
       eq.{id}. Wired via data-action="notif-delete"
       through the Action Router with guardAction.
   (e) Response time: for type=scheduled notifications
       (client approved), finds the paired
       awaiting_approval row in _notifData for the same
       post_id and diffs created_at timestamps. Renders
       as <span class="notif-resp-time"> · replied in
       X min</span> in green inline with the action text.
   (f) Back to notifications from PCS: tap handler sets
       window._notifOpenedPCS = true before opening PCS.
       actions/pcs.js _renderPCS prepends a
       .pcs-back-notif-btn ("← NOTIFICATIONS") to the
       PCS topbar when the flag is true. Button closes
       PCS and reopens notification panel after 150ms.
       closePCS() resets the flag so the button doesn't
       persist on next normal PCS open.
   (g) pg_cron auto cleanup: NOT a code change — requires
       manual SQL in Supabase Dashboard:
         SELECT cron.schedule(
           'cleanup-old-notifications',
           '0 3 * * *',
           $$DELETE FROM notifications
             WHERE created_at < NOW() - INTERVAL '30 days'$$
         );
       Documented in CLAUDE.md Section 5 and here for
       Shubham to run after merge.
   (h) Action Router: two new cases added —
       notif-wa (guardAction → _sharePostOnWhatsApp) and
       notif-delete (guardAction → deleteNotification).
   (i) CSS: .notif-unread-dot, .notif-actions,
       .notif-action-btn (.nab-wa, .nab-del),
       .notif-action-sep, .notif-resp-time,
       .pcs-back-notif-btn added. Zero rgba, all solid hex.
   Status: FIXED (PR#TBD) — 433/433 unit + 40/40 CI e2e
   passing. Bumped to ?v=20260406e.
1. Scroll hijacking on mobile — body stays locked after
   closing runway-sheet or stage-sheet bottom sheets
   Location: 07-post-load.js openRunwaySheet() and
   openStageSheet() set document.body.style.overflow =
   'hidden' on open, but the close handlers (X button
   onclick and backdrop click) only set display='none'
   on the sheet without resetting body overflow.
   Same bug duplicated in render/dashboard.js for the
   identical openRunwaySheet() and openStageSheet().
   Total: 8 close paths missing overflow reset across
   2 files (4 in 07-post-load.js, 4 in dashboard.js).
   Status: FIXED (PR#TBD) — added document.body.style.overflow=''
   to all 8 close handlers. 444/444 unit passing.
   Bumped to ?v=20260406k.
1. updateNotifBadge fires apiFetch with no session token check
   Location: 10-ui.js updateNotifBadge() — called from timers
   and direct invocations with no guard for valid session token.
   Same pattern in _flushClickBuffer (5s interval),
   loadNotifications, and startRealtime 15s poll callback.
   Status: FIXED (PR#TBD) — added
   if (!localStorage.getItem('sb_access_token')) return;
   to updateNotifBadge, _flushClickBuffer, loadNotifications
   (all in 10-ui.js), and startRealtime poll callback
   (07-post-load.js). 454/454 unit passing.
1. _pcsDoDeleteComment passes empty UUID to Supabase
   Location: actions/pcs.js _pcsDoDeleteComment() — no validation
   that commentId is non-empty before PATCH call. Same pattern in
   toggleTaskResolve (pcs.js), _saveLiUrlInline (pcs.js),
   _closeBrief (brief.js), _reopenBrief (brief.js).
   Status: FIXED (PR#TBD) — added type+empty validation guards
   to all 5 functions. 454/454 unit passing.
1. _pcsDateChange re-renders PCS during closePCS teardown
   Location: actions/pcs.js _pcsDateChange() line 533-534 —
   updatePost() and openPCS() fire even when PCS is closing,
   causing NotFoundError on detached DOM.
   Status: FIXED (PR#TBD) — wrapped updatePost+openPCS in
   if (window.AppState.pcs.open) guard. 454/454 unit passing.
   Bumped to ?v=20260407a.
1. Permanent silent sessions — 3 layers + 1 bonus fix
   LAYER 1: refreshSession() now returns typed error objects:
     { token } on success, { error: 'auth_expired' } on 400/401/403,
     { error: 'server' } on 5xx, { error: 'network' } on TypeError.
     All 5 callers updated to branch on error type. auth_expired →
     _clearSessionAndLogin(). network/server → keep tokens, soft
     banner. Never clear tokens on a network error.
   Location: 03-auth.js (refreshSession, _doRefresh, client timer,
     handleMagicLinkToken), 05-api.js (apiFetch 401 handler),
     04-router.js (_startRouter), 07-post-load.js (non-client timer)
   LAYER 2: Cross-tab refresh lock via localStorage _srtd_refresh_lock.
     Before calling /auth/v1/token, checks if another tab holds the
     lock (<10s). If so, polls for new token instead of sending own
     refresh. Prevents Supabase token reuse revocation. Also added
     storage event listener for cross-tab logout sync.
   Location: 03-auth.js
   LAYER 3: visibilitychange listener with _authReady guard.
     Fires refreshSession() immediately when tab regains focus.
     Guarded by window._authReady (set at end of _startRouter).
     On auth_expired → _clearSessionAndLogin(). On network →
     do nothing, keep session.
   Location: 03-auth.js (listener), 04-router.js (_authReady flag)
   BONUS: clientApprove wrapped in guardAction to prevent double-tap.
     submitApproval PATCH payload aligned with clientApprove (added
     status_changed_at + updated_by:'Client').
   Location: 08-post-actions.js (clientApprove), 09-approval.js
     (submitApproval)
   Status: FIXED (PR#TBD) — 479/479 unit passing.
   Bumped to ?v=20260407b.
1. Session persistence — clients getting logged out
   Check: persistSession in 02-session.js Supabase client config
   Status: FIXED (PR#TBD) — resolved by permanent silent sessions
   (Layer 1-3 above). No Supabase JS client exists; all auth is
   hand-rolled. The root cause was: refreshSession returned null
   for all failures, no visibilitychange handler, no cross-tab
   lock. All three gaps now closed.
1. New post form: format field never sent to DB, drive_link field
   missing entirely, 17 rgba violations in NPS CSS block
   Location: 06-post-create.js submitNewPost() payload, index.html
   new-post-overlay, styles.css NPS block (L4880-5111)
   Status: FIXED (PR#TBD) — format added to payload, drive_link
   field added to form HTML + payload + draft clear, all 17 rgba
   replaced with solid hex in NPS CSS + 1 in HTML. 487/487 unit
   passing. Bumped to ?v=20260407c.
1. Assign brief PATCH sends updated_at to requests table
   Location: render/brief.js line 367 — _assignBriefToPranav()
   PATCH to /requests included updated_at which does not exist
   on the requests table. PostgREST rejected with PGRST204.
   Status: FIXED (PR#TBD) — removed updated_at from the PATCH
   payload. Only { status: 'assigned' } is sent now.
1. PCS chip dropdown closes immediately on iOS Safari
   Location: actions/pcs.js lines 532 and 596 — _pcsChipDrop()
   set window.AppState.pcs.activeMenu synchronously. The
   document-level click listener (line 26) saw activeMenu as
   non-null in the same tick and closed it because the chip
   button is not inside the dropdown.
   Status: FIXED (PR#TBD) — wrapped both activeMenu assignments
   in setTimeout(0) so activeMenu is set after the click event
   finishes bubbling. 508/508 unit passing.
   Bumped to ?v=20260407f.

1. Brief panel visual redesign — HTML rewrite to approved mockup
   Location: render/brief.js _openBriefSheet() HTML string
   Old layout used rgba() colors, no numbered sections, no WhatsApp
   share button, no assigned-to card, no sticky footer with close.
   Status: FIXED (PR#TBD) — full HTML rewrite of _openBriefSheet().
   New layout: sticky top nav (back / BRIEF / WhatsApp share),
   title block with stage badge + assignment status, numbered
   sections (01 The Brief, 02 Reference Photos, 03 Assigned To),
   drive link pill, chitra note preserved, sticky bottom footer
   with action buttons + close. All rgba replaced with solid hex
   or 8-digit hex alpha. Zero logic changes — same onclick
   handlers, same data references, same function calls. All
   other functions untouched. 500/500 unit passing.
   Bumped to ?v=20260407f.
1. Client feed @mention dropdown missing client users
   Location: render/client.js lines 899-903 and 1032-1035 —
   _ROSTER hardcoded to 3 agency members, so @Manisha and
   @Shivangini were silently ignored in the mention dropdown
   and mention notifications were never sent for them.
   Status: FIXED (PR#TBD) — added { name:'Manisha', role:'Client' }
   and { name:'Shivangini', role:'Client' } to both _ROSTER arrays
   (dropdown at line 899 and notification lookup at line 1032).
   Self-filter at line 905 already works by name comparison.
   Notification user_role is read from _member.role which is
   'Client' for both — correct for the notifications table.
1. PCS @mention dropdown missing client users (agency cannot tag clients)
   Location: actions/pcs.js _AGENCY_MEMBERS at line 2509 —
   hardcoded to 3 agency members only. Mention notifications
   at line 2435 also used _AGENCY_MEMBERS so @Manisha and
   @Shivangini were silently ignored in PCS comments.
   Status: FIXED (PR#TBD) — added { name:'Manisha', role:'Client' }
   and { name:'Shivangini', role:'Client' } to _AGENCY_MEMBERS.
   _showTaskAssign (line 2584) filtered to exclude role 'Client'
   so task assignment remains agency-only. Notification user_role
   at line 2446 reads _member.role ('Client') — correct.

1. Codebase-wide rgba() violations — 451 occurrences across 13 files
   Location: styles.css (297), index.html (25), preview/index.html (10),
   10-ui.js (8 incl. dynamic insGetRgba pattern), render/client.js (35
   incl. dynamic _hexToRgb pattern), render/pipeline.js (12),
   render/dashboard.js (15), render/brief.js (6), actions/pcs.js (22),
   07-post-load.js (15), 09-approval.js (6), 09-library.js (3),
   06-post-create.js (1), mockups/pcs-fullpage.html (1).
   Status: FIXED (PR#TBD) — all rgba() converted to 8-digit hex
   (#RRGGBBAA) or 6-digit hex (for alpha ≥ 0.9). insGetRgba() replaced
   with insGetHexA(alpha) using _hexAlpha helper. render/client.js
   _hexToRgb() deleted (dead code after conversion). Approved exceptions
   kept: .pcs-more-ov, .pcs-more-l, SVG fill in index.html L1140,
   mockup photo overlay. 508/508 unit passing.
   Bumped to ?v=20260408b.
1. 100vh causes overflow on iOS Safari — address bar not excluded
   Location: styles.css — #dashboard-view height:100vh (L711),
   #dashboard-view min-height:100vh (L716), #client-view
   min-height:100vh (L1317), #approval-view min-height:100vh (L1524)
   Status: FIXED (PR#TBD) — changed all four values from 100vh to
   100dvh (dynamic viewport height). 508/508 unit passing.
   Bumped to ?v=20260408b.
1. Design system colour consolidation — 89% of CSS colours off-palette
   Location: styles.css — 130 one-off hex values across dark backgrounds,
   gray text, and near-white colours were not using design system colours.
   CSS custom properties (--bg, --surface, --surface2, --surface3, --muted,
   --muted2, --text2, --text-tertiary) also pointed to non-standard values.
   Status: FIXED (PR#TBD) — 130 replacements across styles.css:
   Dark backgrounds: #0d0d0d/#0f0f0f→#080808, #111111/#111318/#141414/
   #141420/#0a0a0f/#0c0c18/#0e0e16/#0f0f16/#0f0f1a/#10101a→#0d0d12,
   #191919/#1a1a1a/#1a1a28/#1a1a2a/#1a1a2e/#1c1c28/#1c1c2a/#1c1c2c/
   #1e1e2e/#222235/#252525/#222222/#28283a/#2a2a36/#2a2a3a/#2a2a2a/
   #1e1e26→#191924. Gray text: #555/#555555/#555566/#636366/#888/#777/
   #444/#333→#8E8E93, #aaa/#BBBBBB→#AEAEB2, #ccc/#e8e2d9→#E8E8E8.
   Near-white: #F0F0F0→#E8E8E8. LinkedIn: #0A66C2→#0a66c2 (lowercase).
   CSS tokens updated: --surface=#0d0d12, --surface2=#191924,
   --surface3=#191924, --muted=#8E8E93, --muted2=#191924,
   --text2=#AEAEB2, --text-tertiary=#8E8E93, --bg=#0d0d12.
   Not changed: #1b1f23 (client-mode external brand), #9090A0/#52525c/
   #6e6e80/#302a4a/#333344 (specialized UI accents), all 8-digit hex
   alpha values, rgba() approved exceptions, SVG values, mockups, tests.
   508/508 unit passing. Bumped to ?v=20260408c.
1. Internal notes ALL chip shows only visibility=all notes
   Location: actions/pcs.js line 1198-1199 — filteredNotes filter
   used strict equality (visibility === 'all') when ALL chip active,
   hiding notes with visibility admin/servicing/creative.
   Status: FIXED (PR#TBD) — changed to bypass filter entirely when
   _activeVis === 'all', so ALL chip shows every note regardless of
   visibility tag. 508/508 unit passing.
   Bumped to ?v=20260408d.
1. Missing .pcs-reply-bar CSS class — reply bar unstyled
   Location: index.html:913 and :939 use class="pcs-reply-bar" on
   #pcs-client-reply-indicator and #pcs-note-reply-indicator, but
   styles.css had no .pcs-reply-bar rule. The class name did not
   match .pcs-reply-indicator-bar (the only styled variant).
   Status: FIXED (PR#TBD) — added .pcs-reply-bar rule to styles.css
   (display:none default, flex when JS sets display:flex, gold left
   border, dark background, mono font). 508/508 unit passing.
   Bumped to ?v=20260408d.
1. Drive link empty state shown when no URL exists
   Location: actions/pcs.js lines 248-250 — showed "+ Add drive link"
   empty state to agency users (canManage) even when post had no
   drive_link. Drive links should only be added at post creation.
   Status: FIXED (PR#TBD) — removed the else-if canManage branch.
   #pcs-drive-link-wrap now only shows when driveUrl is truthy;
   otherwise display:none regardless of role. 508/508 unit passing.
   Bumped to ?v=20260408d.
1. Dashboard CLIENT metric row text wraps on narrow screens
   Location: render/dashboard.js lines 358-365 — the clickable
   approval/input count spans lacked white-space:nowrap, causing
   the CLIENT row to be taller than other metric rows on narrow
   viewports.
   Status: FIXED (PR#TBD) — added white-space:nowrap to both
   approval and input <span> elements. 508/508 unit passing.
   Bumped to ?v=20260408d.
1. PCS photo grid rewrite — hero-driven responsive layout
   Location: actions/pcs.js _buildPhotoGrid() + styles.css photo grid
   rules. Old system had 5 fixed-height layouts (pcs-pg-1 through
   pcs-pg-5) with .pcs-pcell/.pcs-pcell.hero CSS grid cells.
   Status: FIXED (PR#TBD) — simplified to 4 layouts using
   padding-bottom aspect ratio technique instead of fixed px heights.
   Removed: .pcs-pg-4, .pcs-pg-5, .pcs-pcell, .pcs-pcell.hero,
   _cell() helper, mobile safari min-height hacks for pg-2/3/4/5.
   New classes: .pcs-pg-3plus (4+ images), .pcs-pg-inner (absolute
   positioned flex container), .pcs-pg-hero (60% left column),
   .pcs-pg-col (right column), .pcs-pg-sm (small cells),
   .pcs-pg-2-inner/.pcs-pg-2-cell (2-image layout).
   Layout: 1 img = 100% square, 2 imgs = 50% side-by-side,
   3 imgs = 60% hero left + 2 stacked right, 4+ = same as 3 with
   "+N more" overlay on last cell. .pcs-more-ov updated to
   rgba(8,8,8,0.72) + backdrop-filter:blur(2px). .pcs-more-n
   weight 700 size 22px. .pcs-more-l now IBM Plex Mono.
   Edit mode selector updated to match new cell classes.
   508/508 unit passing. Bumped to ?v=20260408e.
1. Client feed photo grid — responsive aspect-ratio layout
   Location: render/client.js _imgGridHtml() + styles.css
   Old system had fixed px heights: img-trio 130px+130px=260px,
   img-quad 150px+150px=300px. Not responsive on narrow screens.
   Status: FIXED — replaced fixed heights with CSS aspect-ratio.
   img-trio: grid-template-rows:1fr 1fr + aspect-ratio:5/3
   img-quad: grid-template-rows:1fr 1fr + aspect-ratio:1/1
   Removed max-height:400px from .img-trio/.img-quad in styles.css
   (kept on .img-duo). +N overlay updated to rgba(8,8,8,0.72) +
   backdrop-filter:blur(2px) to match PCS grid overlay style.
   n=1 (img-single) and n=2 (img-duo) layouts unchanged.
   wrap() helper, lightbox wiring, border-radius values unchanged.
   508/508 unit passing. Bumped to ?v=20260408f.
1. PCS reply bar missing cancel/X button
   Location: actions/pcs.js _pcsSetReply() line 2716 — innerHTML
   only contained '<span>Replying to {author}</span>' with no way
   to dismiss the reply bar. _pcsClearReply() existed (line 2739)
   and worked correctly but had no UI trigger.
   Status: FIXED (PR#TBD) — added .pcs-reply-cancel X button to
   _pcsSetReply innerHTML, wired to _pcsClearReply(zone). Added
   input refocus (pcs-comment-input or pcs-note-input) to
   _pcsClearReply after clearing state. .pcs-reply-cancel CSS
   already existed at styles.css:6433. 508/508 unit passing.
   Bumped to ?v=20260408g.
1. PCS date picker closes before user can select a date
   Location: actions/pcs.js line 26-34 — document-level click
   listener closed activeMenu when click landed outside the
   dropdown div. Native date picker UI (calendar on desktop,
   wheel on mobile) is rendered by the browser outside the DOM,
   so any interaction with it triggered the close listener.
   _pcsDateChange (line 606-611) already removes the dropdown
   itself after a date is selected.
   Status: FIXED (PR#TBD) — added guard at line 30:
   if (menu.querySelector('input[type="date"]')) return;
   Skips auto-close when the active dropdown contains a date
   input. _pcsDateChange handles cleanup after selection.
   Tapping the chip again closes and reopens correctly.
   508/508 unit passing. Bumped to ?v=20260408h.
1. PCS date picker — desktop calendar not opening + mobile save silent
   Location: actions/pcs.js _pcsChipDrop date branch (line 540) and
   _pcsDateChange (line 609).
   Desktop: dateInp.focus() does not open Chrome calendar — need
   showPicker(). Mobile: updatePost has _isSaving guard that silently
   drops the call if a previous save is in-flight.
   Status: FIXED (PR#TBD) — added try{dateInp.showPicker()}catch(e){}
   after focus() to auto-open calendar on desktop. In _pcsDateChange,
   added dateValue empty guard, _isSaving clear before updatePost,
   and 300ms setTimeout on openPCS re-render. Test regex window
   widened from 600→800 chars. 508/508 unit passing.
   Bumped to ?v=20260408i.
1. PCS date picker onchange never fires — dropdown destroyed mid-selection
   Location: actions/pcs.js document click listener (line 26) and
   _pcsChipDrop date branch (line 533).
   Root cause: showPicker() opens Chrome calendar. When user clicks
   a date, Chrome fires document click BEFORE firing onchange on the
   input. The document click listener destroyed the dropdown, detaching
   the input, so onchange never reached _pcsDateChange.
   Previous fix (setTimeout(0) deferral) masked the problem — the
   date input guard from the first fix was never actually merged.
   Status: FIXED (PR#TBD) — replaced the setTimeout(0) deferral
   with a proper date input guard:
   if (menu.querySelector('input[type="date"]')) return;
   When the active dropdown contains a date input, the document
   click listener exits immediately — no removal, no deferral.
   _pcsDateChange (line 614) handles dropdown cleanup after
   selection. Removed setTimeout(0) wrapper entirely — direct
   menu.remove() + activeMenu = null for non-date dropdowns.
   showPicker() (line 542) retained from prior fix for desktop.
   508/508 unit passing. Bumped to ?v=20260408m.
1. PCS date picker — date never saved (pcs.open flag never set)
   Location: actions/pcs.js _pcsDateChange() line 618 guards the
   updatePost + openPCS calls behind window.AppState.pcs.open.
   But pcs.open was initialized false in 00-appstate.js:32 and
   NEVER set to true anywhere. openPCS() set ui.modalOpen = true
   (line 70) but never set pcs.open = true. The entire save block
   inside _pcsDateChange was dead code — dropdown closed, date
   value silently dropped every time.
   Status: FIXED (PR#TBD) — added window.AppState.pcs.open = true
   in openPCS() (line 71, right after modalOpen = true), and
   window.AppState.pcs.open = false in forcePCSReset() (line 151,
   right after modalOpen = false). closePCS() delegates to
   forcePCSReset so both paths are covered. _pcsDateChange guard
   unchanged — it was correct, the flag was just never set.
   508/508 unit passing. Bumped to ?v=20260408n.
1. PCS dead code cleanup — 12 dead functions, 347 net lines removed
   Location: actions/pcs.js, 10-ui.js, index.html, styles.css
   Scope:
   (a) Deleted 12 dead functions from actions/pcs.js that were
       defined but never called from _renderPCS or any live code
       path: _buildStageProgress, _buildInfoGrid,
       _buildInlineActions, _buildNotes, _renderAdvanceButton,
       _renderActivityCount, _updateSubtitle, _pcsCaptionMenu,
       _pcsEditLink, pcsCloseAttach, pcsSaveAttach,
       _loadPCSActivity. Also deleted _ADVANCE_SEQ,
       _ADVANCE_LABELS, _ADVANCE_CLS constants and
       _pcsEditingTarget state variable.
   (b) Deleted togglePCSActivity dead function from 10-ui.js.
   (c) Deleted #pcs-activity-body div from index.html (was
       display:none permanently, nothing wrote to it).
   (d) Removed 2 dead pcsCloseAttach calls from live code:
       _pcsTitleEdit L757 and _showStageConfirm L1277 — both
       were no-ops since the attach editor elements (created by
       _buildInlineActions) were never in the DOM.
   (e) Fixed stray "11" count badge — #pcs-comments-count and
       #pcs-notes-count spans were being set to display:inline
       by loadPcsComments, making them visible as standalone
       elements in the client/internal panes. Removed the
       display toggle so they stay display:none always. Tab
       badges (#pcs-tab-client-count, #pcs-tab-notes-count)
       already show the count inside the tab label.
   (f) Normalized chip fonts — added font-family:'IBM Plex
       Mono',monospace to .pcs-chip (had none, was inheriting).
       Changed .pcs-chip-drop-item and .pcs-photo-label from
       'Courier New' to 'IBM Plex Mono'. Changed .pcs-ibar-hint
       from 'Courier New' to 'IBM Plex Mono'. 5 remaining
       Courier New refs in styles.css: .pcs-stage-pill,
       .pcs-od-pill, .pcs-tab, .pcs-wa-btn (not changed, will
       be addressed in font consolidation PR).
   (g) Replaced inline styles on PCS input bars with CSS
       classes. Client and internal note input bars in
       index.html now use .pcs-ibar-wrap/.client/.notes,
       .pcs-ibar-pill, .pcs-ibar-plus, .pcs-ibar-input,
       .pcs-ibar-send, .pcs-ibar-hint CSS classes. Updated
       CSS class values to exactly match previous inline styles
       (border colors, backgrounds, box-shadows, scrollbar,
       opacity, transition). Zero visual change.
   actions/pcs.js reduced from 2831 to 2493 lines (−338).
   Status: FIXED (PR#TBD) — 508/508 unit passing, 40/40 e2e.
   Bumped to ?v=20260408o.
1. PCS visual redesign Part 1 — top section, caption pane, desktop
   Location: actions/pcs.js, index.html, styles.css
   Scope:
   (a) Topbar simplified: stage pill + overdue badge removed from
       topbar-right. Replaced with WhatsApp icon button (same
       SVG and handler as _sharePostOnWhatsApp, same visibility
       condition as _buildWAHtml). Close X, back, back-to-notifs
       buttons unchanged.
   (b) Photo header row: stage pill + overdue badge moved here
       (left side). Same HTML, same onclick handler, same isAdmin
       check for dropdown arrow. Right side: ADD/EDIT/SAVE text
       buttons replace the ··· unified menu trigger. ADD calls
       _pcsAddPhotos, EDIT calls _pcsEnterEditMode (only when
       imgs.length > 0), SAVE calls _pcsSaveAllPhotos (only when
       imgs.length > 0). All canManage-gated, same conditions.
   (c) 3-dot menu trigger button removed from HTML. The
       _pcsPhotoMenu function itself is NOT deleted — only its
       trigger button. Caption actions now exposed inline.
   (d) Chips row replaced with dot-separated metadata text.
       _buildChipsRow output changed from bordered pill buttons
       to plain text spans (.pcs-mv) with dot separators (.pcs-dot).
       Every if/else condition, every canEdit/canManage check,
       every onclick handler preserved exactly. Owner color mapping:
       servicing→cyan, creative→purple, client→amber. Date:
       overdue→red, has date→bright (#F0F0F2). Old .pcs-chip*
       CSS classes replaced with .pcs-meta-row, .pcs-mv, .pcs-dot.
   (e) Caption pane: Edit/Copy/Clear action row added below
       WhatsApp section. Calls _startCaptionEdit, _pcsCopyCaption,
       _pcsConfirmClearCaption — exact same functions as 3-dot
       menu used. Clear button only when post.caption truthy.
       canManage-gated. Done button always rendered, calls
       closePCS() — same as Close X.
   (f) Separator normalization: all PCS structural borders
       changed to 1px solid #323244 (tab bar, metadata row,
       caption section, photo empty state).
   (g) Title-metadata coupling: title padding-bottom 4px,
       metadata padding-top 4px. Only separator is below metadata
       before tab bar.
   (h) Desktop max-width: #pcs-screen max-width:480px with
       margin:0 auto. #pcs-overlay stays full-screen. Bottom
       confirm sheet (.pcs-bottom-confirm) centered at 480px.
   Zero business logic changes. Zero data flow changes.
   508/508 unit passing, 40/40 e2e passing.
   Status: FIXED (PR#TBD). Bumped to ?v=20260408p.
1. PCS comment visual redesign Part 2A — Instagram-style rendering
   Location: actions/pcs.js, actions/pcs-longpress.js (new),
   index.html, styles.css
   Scope:
   (a) _renderClientThread and _renderNoteThread rewritten:
       DELETE/COPY action row removed from comment HTML. Only
       visible "Reply" text remains below each comment (calls
       exact same _pcsSetReply function). Heart SVG placeholder
       added on right side (visual only, not wired to DB).
       data-comment-id and data-author attributes added to
       comment div for long-press handler to read.
   (b) Thread grouping: comments grouped by parent_id. Top-level
       comment + last reply always visible. Middle replies hidden
       behind "View N more replies" expand link. Orphaned replies
       render as top-level. Uses .pcs-thread-group wrapper.
   (c) Same changes applied to internal notes (_renderNoteThread).
       All note-specific features preserved: .pcs-vis-tag,
       .pcs-mention-badge, .pcs-task-assignee, resolved accordion.
   (d) Task checkbox: ☐/☑ emoji replaced with SVG dotted circles.
       Unchecked = hollow dotted circle. Checked = green dotted
       circle with checkmark polyline. onclick calls exact same
       toggleTaskResolve(). "Resolved by" label added below done
       tasks when resolved_by is truthy.
   (e) Long-press bottom sheet: new file actions/pcs-longpress.js.
       500ms touch-hold on .pcs-comment-item/.pcs-note-item shows
       bottom sheet with Copy/Reply/Delete + Resolve task (for
       tasks only). All buttons call exact same existing functions.
       Delete permission: author === name || admin. Desktop
       fallback via contextmenu event. Haptic vibrate(12).
   (f) Plus button menu: + button in both input bars now shows
       Task/Image popover instead of directly opening file picker.
       Image calls exact same file input click. Task calls exact
       same submitPcsComment(isTask=true) or _showTaskAssign().
   (g) Reply tag moved inside input pill: old .pcs-reply-bar
       removed from HTML. New .pcs-reply-tag inline element added
       inside .pcs-ibar-pill showing "Author ·" with X dismiss.
       _pcsSetReply and _pcsClearReply updated for new element IDs.
   (h) CSS overhaul: comment items no border-bottom (whitespace
       only). Avatar 30px (up from 28). Author 13px/700 #F0F0F2.
       Text 13.5px #C0C0C8. Avatar colors solid hex backgrounds
       (no alpha). .pcs-comment-reply no border-left. New classes:
       .pcs-thread-group, .pcs-expand-link, .pcs-expand-line,
       .pcs-expand-text, .pcs-comment-reply-btn, .pcs-comment-react,
       .pcs-react-icon, .pcs-resolved-label, .pcs-lp-backdrop,
       .pcs-lp-menu, .pcs-lp-item, .pcs-lp-cancel, .pcs-lp-delete,
       .pcs-lp-resolve, .pcs-plus-menu, .pcs-plus-item,
       .pcs-reply-tag, .pcs-reply-tag-x. Zero rgba(). All hex.
   New file: actions/pcs-longpress.js. Script count: 21 (20+1).
   Zero business logic changes. Zero new DB calls. Zero new API
   endpoints. All onclick handlers call exact same functions.
   508/508 unit passing, 40/40 e2e passing.
   Status: FIXED (PR#TBD). Bumped to ?v=20260409a.

## SECTION 13 — STABILITY ROADMAP

Ph0 Safety            — DONE
Ph1 File Architecture — DONE (render/ + actions/ extracted)
Ph2 AppState          — DONE (all globals migrated)
Ph3 Error Handling    — DONE (logError, _showErrorToast, onerror, onunhandledrejection, 8 silent catches fixed, Pass 3 pipeline, Pass 4 PCS — 12 fixes, 3 alert→toast, Pass 5 dashboard — 4 fixes + 1 post-load fix, Pass 6 post-load — 12 fixes + 4 duplicate function overwrites fixed, Pass 7 auth — 6 fixes incl. silent refreshSession catch)
Ph3.5 Role Standardization — DONE (Phase A: normalizeRole() added, rollback.sql created; Phase B: config wire cut — ALLOWED_OWNERS, ROLE_TABS, notification recipients, HTML option values all use DB roles; Phase C: DB write payloads — owner fields in brief.js, post-load.js, post-create.js all use DB roles; Phase D: owner read checks — pipeline.js isMine/filter checks + pcs.js chip color all use DB role names Creative/Servicing)
Ph4 Event Delegation  — IN PROGRESS (Group A: bottom nav done — global action router in 10-ui.js, 4 inline onclicks on .nav-item replaced with data-action; Group B: PCS tabs done — 3 inline onclicks on .pcs-tab replaced with data-action="pcs-tab", router guard reworked to skip interactive descendants instead of blocking all PCS; Group C: PCS visibility chips done — 4 inline onclicks on .pcs-vis-chip replaced with data-action="pcs-vis" data-vis=..., router routes to setPcsVisibility(actionEl, dataset.vis); Group D: notification filter tabs done — 3 inline onclicks on .nftab replaced with data-action="notif-filter" data-filter=..., router routes to setNotifFilter(dataset.filter, actionEl); Group E: insights metric buttons done — 4 inline onclicks on .ins-mt replaced with data-action="ins-metric" data-metric=..., router routes to insSetMetric(dataset.metric, actionEl); Group F: insights range chips done — 3 inline onclicks on .ins-chip replaced with data-action="ins-range" data-range=..., router routes to insSetRange(dataset.range, actionEl); Group G: insights period chips done — 3 inline onclicks on .ins-chip replaced with data-action="ins-period" data-period=..., router routes to insSetPostsPeriod(dataset.period, actionEl); Group H: insights lens buttons done — 3 inline onclicks on .ins-lens-btn replaced with data-action="ins-lens" data-lens=..., router routes to insSetLens(dataset.lens, actionEl); Group I: library view tabs done — 3 inline onclicks on .lib-vt replaced with data-action="lib-view" data-view=..., router routes to libSetView(dataset.view, actionEl); Group J: NRS urgency chips done — 3 inline onclicks on .nrs-urg-opt replaced with data-action="nrs-urg" data-urgency=..., router routes to nrsSetUrg(actionEl, dataset.urgency); Group K: insights main tabs done — 3 inline onclicks on .ins-main-tab replaced with data-action="ins-main-tab" data-tab=..., router routes to insSetMainTab(dataset.tab, actionEl); Group L (final): overlay backdrop close patterns done — 8 inline onclick="if(event.target===this)closeX()" backdrop handlers on admin-edit, parked, zen, snooze, timeline, insights, pcs, and pipeline-filter overlays replaced with data-action="overlay-close" data-close="closeX", router guards e.target===actionEl and dispatches window[dataset.close]())
Ph5 Optimistic UI     — IN PROGRESS (client comments done; guardAction shared utility added to 00-appstate.js as foundation for async hardening; Action Router in 10-ui.js now wraps all 14 cases with guardAction, wraps switch in try/catch, and guards listener attach with window._routerBound)
Ph6 PWA               — PENDING
Ph7 Light Mode        — PENDING
Ph8 React             — FUTURE

New features allowed only after Phase 5 complete.

## SECTION 14 — SELF-MAINTENANCE RULE

CLAUDE.md MUST be updated in every single PR — no exceptions.
CLAUDE.md is committed in the SAME PR as the code change.
Never open a separate PR just for CLAUDE.md.

After every PR update:

- File list if any file was added or removed
- Test count — run npx vitest run and use actual number
- ?v= version to latest deployed string
- Global functions if any window.* added or removed
- Bug status — mark FIXED with PR number if resolved
- Roadmap phase status if anything completed

A stale CLAUDE.md is worse than no CLAUDE.md.

## SECTION 15 — FUTURE FEATURES

These features are designed and approved but not yet built.
Do not build any of these until explicitly instructed.

### Post Message Board (Consolidated Feedback)
- A 4th tab in PCS overlay: CAPTION / CLIENT / INTERNAL / BOARD
- Single text area per post for consolidated client feedback
- Visible to client + all agency roles
- Client writes once — replaces scattered comment feedback
- Triggers notification to Admin + Chitra + Pranav on submit
- Stored in post_comments with type='board'
- Requested by Shivangini (client) on 2026-04-03

### Multi-Level Approval Chains
- Configurable per client — 1, 2, or 3 approval layers
- Layer 1: Reviewer (e.g. Manisha) — reviews and approves first
- Layer 2: Approver (e.g. Shivangini) — gives final sign-off
- TAT tracked automatically between each layer
- Notification at each layer change
- Requested by Manisha (client) on 2026-04-02

### RLS Security for Multi-Client
- Enable RLS on requests and tasks tables before onboarding second client
- Client A must never see Client B's requests or tasks
- Implement when second client is onboarded
