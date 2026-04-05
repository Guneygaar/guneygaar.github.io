# CLAUDE.md — Sorted (srtd.io)

# Last updated: 2026-04-05

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
Root files: rollback.sql — DB rollback for role standardization (run if production breaks)

## SECTION 3 — FILE LOAD ORDER (sacred — matches index.html exactly)

19 script tags + 1 stylesheet = 20 versioned resources total.
Version format: ?v=YYYYMMDDx. Current: ?v=20260405w

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
07-post-load.js          — post fetching (defer)
08-post-actions.js       — stage changes, admin edit (defer)
09-library.js            — library view (defer)
09-approval.js           — approval flow (defer)
04-router.js             — routing, LAST (defer)

CRITICAL:

- 00-appstate.js + 00-appstate-compat.js have NO defer — load synchronously
- 09-library.js calls _renderPCS() directly — must stay on window.*
- 04-router.js must always be the LAST script tag

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
No rgba for text or borders — solid hex only.
Approved rgba exceptions (must be semi-transparent by design):
  .pcs-more-ov background: rgba(0,0,0,0.62) — "+N more" photo overlay
  .pcs-more-l color: rgba(255,255,255,0.6) — "+N more" label text

Colors:
App bg:          #080808
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
   Count: 20 total (1 stylesheet + 19 scripts). Never change just one.
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
   b. Test count (e.g. 316/316 passing)
   c. Version bump (e.g. ?v=20260405a)
   d. PR URL: https://github.com/Guneygaar/guneygaar.github.io/pull/[number]
   No exceptions. Never push without providing all four.
1. Return ALL output in one single code block
1. When updating a prompt — rewrite ENTIRE prompt from scratch.
   Never say “add this line” — Shubham is on iPhone.
1. Run targeted tests during dev, full suite before push:
   npx vitest run tests/specific.test.js

## SECTION 8 — TESTING

Run: npx vitest run
Single file: npx vitest run tests/filename.test.js
E2E: npx playwright test

Current (verified 2026-04-03):
Unit test files: 13
Unit tests:      316 passing, 0 failing
E2E specs:       7

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
tests/postlookup.test.js
tests/role.test.js
tests/timestamp.test.js
tests/utils.test.js

E2E: tests/e2e/admin-flows.spec.js, client-feed.spec.js, client-flows.spec.js, live-smoke.spec.js, pcs.spec.js, role-flows.spec.js, smoke.spec.js

TEST FILE MAPPING (run targeted tests during development):
  render/client.js      → npx vitest run tests/client-comment.test.js
  actions/pcs.js        → npx vitest run tests/pcs.test.js (future)
  render/pipeline.js    → npx vitest run tests/pipeline.test.js (future)
  render/dashboard.js   → npx vitest run tests/dashboard.test.js (future)
  render/brief.js       → npx vitest run tests/brief.test.js (future)
  00-appstate.js        → npx vitest run tests/appstate-posts.test.js
  03-auth.js            → npx vitest run tests/role.test.js
  10-ui.js              → npx vitest run tests/notifications.test.js
  utils.js              → npx vitest run tests/utils.test.js
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
PREVIEW_SECRET: srtd2026xK9mN3pQ
Pages branch:   main-/-root

## SECTION 10 — KNOWN GOTCHAS

1. Never raw fetch() — always apiFetch()
1. Never mutate AppState.posts.all — always setAll()
1. Never reference /sorted/ — does not exist, files are at root
1. All 20 ?v= strings must bump together — never just one file
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
1. Vitest must pass 316/316 before every push
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
                              releases key in .finally()

10-ui.js:
window._showErrorToast      — show transient error toast to user
window.showToast            — show success/error/info toast (top-level, auto-hoisted)
window.gamSwitchRole        — switch role preview
window.openNotifications, window.closeNotifications, window.loadNotifBadge
window.openPipelineFilter, window.closePipelineFilter, window.applyPipelineFilter

03-auth.js:
window.normalizeRole        — canonical role normalizer (person names → DB roles)
window.sendMagicLink        — send OTP email to user
window.verifyOTPCode        — verify OTP and set session
window.resetRolePreview     — clear role preview, restore Admin

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
window._updateSubtitle, window._pcsTitleEdit,
window.changeStage, window._showPublishSheet, window._removePublishSheet,
window._saveLiUrlInline, window.loadPcsComments, window._showStageConfirm,
window._buildStageProgress, window._buildInlineActions, window._pcsEditLink,
window.pcsCloseAttach, window.pcsSaveAttach, window._loadPCSActivity,
window._buildInfoGrid, window._buildNotes, window._renderAdvanceButton,
window._renderActivityCount, window._removePcsConfirm, window.pcsConfirmDelete,
window.pcsDoDelete, window._pcsAddPhotos, window._pcsHandlePhotoInput,
window._pcsRemovePhoto, window._pcsPhotoMenu, window._pcsSaveAllPhotos,
window._pcsCloseUnifiedMenu, window._pcsEnterEditMode, window._pcsExitEditMode,
window._pcsConfirmRemovePhoto, window._pcsDoRemovePhotoEdit,
window._pcsConfirmClearCaption, window._pcsDoClearing,
window._pcsCaptionMenu, window._pcsCopyCaption, window._pcsConfirmReplace,
window._pcsDoReplace, window._pcsOpenLightbox, window._pcsLbRender,
window._pcsLbNext, window._pcsLbPrev, window._pcsLbClose,
window._pcsLbDownload, window._startCaptionEdit, window._cancelCaptionEdit,
window._saveCaptionEdit, window._sharePostOnWhatsApp, window.submitPcsComment,
window._doSubmitComment, window.toggleTaskResolve, window._initMentionDropup,
window._showTaskAssign, window.submitPcsTask, window._pcsHandleCommentImg,
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
1. LinkedIn URL not saving from publish dialog
   Location: actions/pcs.js ~lines 548-580
   Status: OPEN
1. Role preview (admin to Chitra/Pranav/Client) not showing
   correct view in all cases
   Status: OPEN
1. Session persistence — clients getting logged out
   Check: persistSession in 02-session.js Supabase client config
   Status: OPEN
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
