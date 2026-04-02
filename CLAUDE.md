# CLAUDE.md — Sorted (srtd.io)

# Last updated: 2026-04-02

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
Subdirs: render/ actions/ tests/ tests/e2e/ sorted-preview-worker/ sql/ ok/ no/ preview/ mockups/

## SECTION 3 — FILE LOAD ORDER (sacred — matches index.html exactly)

19 script tags + 1 stylesheet = 20 versioned resources total.
Version format: ?v=YYYYMMDDx. Current: ?v=20260402c

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
pendingComment, lightbox: {images, index}, activeMenu
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

posts: post_id(PK), title, stage, owner, content_pillar,
location, target_date, linkedin_link, canva_link,
status_changed_at, format, caption, images(jsonb), client_feedback

post_comments: id, post_id, author, author_role, message,
visibility, reply_to, attachments(jsonb), mentioned_users(text[]),
read, resolved, deleted, created_at, post_title

internal_notes: id, post_id, post_title, author, author_role,
message, visibility, mentioned_users(text[]), resolved,
resolved_by, reply_to, attachments(jsonb), read, deleted, created_at

notifications: id, type, message, read, created_at,
post_id, user_role, actor
RLS: DISABLED

user_roles: id(uuid PK), email(unique), role, name

tasks: id(bigint), assigned_to, message, due_date, done, created_at

activity_log: id, post_id, action, old_stage, new_stage,
changed_by, changed_at

error_log: id(uuid auto), error_message, error_stack,
user_email, user_role, page, action,
created_at(default now()), app_version
RLS: DISABLED — must stay disabled

Storage: post-assets bucket via R2 worker

## SECTION 6 — DESIGN SYSTEM (locked — never deviate)

Zero border-radius on inputs and buttons.
No rgba for text or borders — solid hex only.

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
1. Return ALL output in one single code block
1. When updating a prompt — rewrite ENTIRE prompt from scratch.
   Never say “add this line” — Shubham is on iPhone.
1. Run targeted tests during dev, full suite before push:
   npx vitest run tests/specific.test.js

## SECTION 8 — TESTING

Run: npx vitest run
Single file: npx vitest run tests/filename.test.js
E2E: npx playwright test

Current (verified 2026-04-01):
Unit test files: 13
Unit tests:      297 passing, 0 failing
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
1. Vitest must pass 297/297 before every push

## SECTION 11 — GLOBAL FUNCTIONS

00-appstate.js:
window.logError             — log error to Supabase error_log table
window.onerror              — global error handler → logError
window.onunhandledrejection — global promise rejection handler → logError

10-ui.js:
window._showErrorToast      — show transient error toast to user

03-auth.js:
window.sendMagicLink        — send OTP email to user
window.verifyOTPCode        — verify OTP and set session
window.resetRolePreview     — clear role preview, restore Admin

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

1. LinkedIn URL not saving from publish dialog
   Location: actions/pcs.js ~lines 548-580
   Status: OPEN
1. Notifications firing inconsistently
   Status: OPEN — partially fixed, needs full audit
1. Role preview (admin to Chitra/Pranav/Client) not showing
   correct view in all cases
   Status: OPEN
1. Session persistence — clients getting logged out
   Check: persistSession in 02-session.js Supabase client config
   Status: OPEN

## SECTION 13 — STABILITY ROADMAP

Ph0 Safety            — DONE
Ph1 File Architecture — DONE (render/ + actions/ extracted)
Ph2 AppState          — DONE (all globals migrated)
Ph3 Error Handling    — DONE (logError, _showErrorToast, onerror, onunhandledrejection, 8 silent catches fixed, Pass 3 pipeline, Pass 4 PCS — 12 fixes, 3 alert→toast, Pass 5 dashboard — 4 fixes + 1 post-load fix, Pass 6 post-load — 12 fixes + 4 duplicate function overwrites fixed, Pass 7 auth — 6 fixes incl. silent refreshSession catch)
Ph4 Event Delegation  — PENDING
Ph5 Optimistic UI     — IN PROGRESS (client comments done)
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
