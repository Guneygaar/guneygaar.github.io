# CLAUDE.md — Sorted (srtd.io)
# Last updated: 2026-04-01

## SECTION 1 — PRODUCT IDENTITY
Sorted (srtd.io) — social media content ops platform for agencies.
Not a scheduler. A workflow and client trust tool.

Team:
- Shubham — Admin (#C8A84B)
- Chitra — Servicing (#22D3EE)
- Pranav — Creative (#9b87f5)
- Manisha — Client, thakur.manisha@somaiya.com (#FF4B4B)
- Shivangini — Client, shivangini.j@somaiya.com (#FF4B4B)

## SECTION 2 — REPO STRUCTURE
Repo: github.com/Guneygaar/guneygaar.github.io
Branch: main-/-root. Deployed at srtd.io.
ALL files at REPO ROOT. No /sorted/ subdirectory. Never reference /sorted/.
Subdirs: render/ actions/ tests/ tests/e2e/ sorted-preview-worker/ sql/ ok/ no/ preview/

## SECTION 3 — FILE LOAD ORDER (sacred — matches index.html exactly)
19 script tags total. Version format: ?v=YYYYMMDDx. Current: ?v=20260401f

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
- 00-appstate.js + 00-appstate-compat.js have NO defer
- 09-library.js calls _renderPCS() directly — must stay on window.*
- 04-router.js must always be LAST

## SECTION 4 — APPSTATE
window.AppState = {
  user: { name, email, role, effectiveRole, previewRole },
  posts: {
    all[], cached[], loaded, source, parked[],
    activityLogs[], activityFetched,
    setAll(fn) — ONLY way to update posts.all
  },
  pcs: { open, postId, post, editingTarget, closeTimer,
         pendingComment, lightbox:{images,index}, activeMenu },
  ui: { modalOpen, deferredRender, activeTab, taskFilter,
        pipelineFilter, nrsUrgency, retryCount, retryTimer,
        realtimeTimer, unreadCount },
  timers: { tokenRefresh, dashDatetime, renderTimer }
}

MUTATION RULES — NEVER BREAK:
  NEVER: posts.all.push() / posts.all[i].x=y / posts.all.splice()
  Add:    setAll(posts.all.concat([newPost]))
  Remove: setAll(posts.all.filter(...))
  Update: setAll(posts.all.map(...))

## SECTION 5 — DATABASE SCHEMA
Supabase: vxokfscjzytpgdrmertk.supabase.co
Always use apiFetch() — never raw fetch().
PostgREST eq. is CASE-SENSITIVE — always capitalize roles.

posts: post_id(PK), title, stage, owner, content_pillar,
  location, target_date, linkedin_link, comments, canva_link,
  status_changed_at, format, caption, images(jsonb), client_feedback

post_comments: id, post_id, author, author_role, message,
  visibility, reply_to, attachments(jsonb), mentioned_users(text[]),
  read, resolved, deleted, created_at, post_title

internal_notes: id, post_id, post_title, author, author_role,
  message, visibility, mentioned_users(text[]), resolved,
  resolved_by, reply_to, attachments(jsonb), read, deleted, created_at

notifications: id, type, message, read, created_at,
  post_id, user_role, actor — RLS DISABLED

user_roles: id(uuid PK), email(unique), role, name

tasks: id(bigint), assigned_to, message, due_date, done, created_at

activity_log: id, post_id, action, old_stage, new_stage,
  changed_by, changed_at

error_log: id(uuid auto), error_message, error_stack,
  user_email, user_role, page, action,
  created_at(default now()), app_version — RLS DISABLED

## SECTION 6 — DESIGN SYSTEM (locked)
Zero border-radius on inputs/buttons. No rgba — solid hex only.

Colors:
  #080808 app bg    #191924 comments bg
  #0d0d12 client    #111008 internal notes
  #E8E8E8 text      #AEAEB2 secondary    #8E8E93 muted
  #C8A84B gold      #FF4B4B red          #3ECF8E green
  #9b87f5 purple    #22D3EE cyan         #F6A623 amber

Owner colors: Chitra=#22D3EE Pranav=#9b87f5 Client=#FF4B4B Shubham=#C8A84B
Fonts: IBM Plex Mono (mono/labels) + DM Sans (body/UI)
Image compression: posts=max1200px/0.82/.jpg comments=max800px/0.80/.jpg

## SECTION 7 — DEPLOYMENT RULES
1. Bump ALL 19 ?v= strings together — never just one
2. After merge → purge Cloudflare:
   dash.cloudflare.com → srtd.io → Caching → Purge Everything
3. Hard refresh all devices before testing
4. ONE PR at a time
5. TDD — write tests before every feature
6. Never raw fetch() — always apiFetch()
7. Every prompt ends with PR URL:
   https://github.com/Guneygaar/guneygaar.github.io/pull/[number]
8. Return ALL output in one single code block
9. Rewrite entire prompt when updating — never say "add this line"
10. Run targeted tests during dev, full suite before push

## SECTION 8 — TESTING
Run: npx vitest run
Single file: npx vitest run tests/filename.test.js
E2E: npx playwright test

Current: 12 files, 269 passing, 0 failing
E2E: 3 specs (client-feed, pcs, smoke)

Files: appstate-compat, appstate-posts, client-comment,
comments-separation, config, dom-sanity, normalise,
notifications, postlookup, role, timestamp, utils

AppState mock pattern:
  window.AppState = {
    user: { name:'Test', email:'test@test.com',
            role:'Admin', effectiveRole:'Admin', previewRole:null },
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
1.  Never raw fetch() — always apiFetch()
2.  Never mutate AppState.posts.all — always setAll()
3.  Never reference /sorted/ — does not exist
4.  All 19 ?v= strings must bump together
5.  00-appstate.js + 00-appstate-compat.js have NO defer
6.  Client comment input only renders for awaiting_approval
    and awaiting_brand_input — not all stages
7.  _commentInputHtml() MUST be called inside _cardHtml()
8.  PostgREST eq. is case-sensitive — 'Creative' not 'creative'
9.  09-library.js calls _renderPCS() directly — stays on window.*
10. 04-router.js must always be LAST script tag
11. apiFetch() never calls logout() on 401 — by design
12. AppState.ui.modalOpen guards render — do not bypass
13. 15-second poll interval, 50-minute token refresh
14. Client DB role takes absolute priority over pcs_role_preview
15. Silent .catch(function(){}) is a bug — always log errors
16. Vitest must pass 269/269 before every push

## SECTION 11 — GLOBAL FUNCTIONS

03-auth.js:
  window.sendMagicLink, window.verifyOTPCode, window.resetRolePreview

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
  window.chaseAll

render/brief.js:
  window._openBriefSheet, window._assignBriefToPranav,
  window._closeBriefConfirm, window._closeBrief,
  window._reopenBrief, window._createPostFromBrief

actions/pcs.js:
  window.openPCS, window.closePCS, window.forcePCSReset,
  window._renderPCS, window._updateSubtitle, window._pcsTitleEdit,
  window.changeStage, window._showPublishSheet, window._removePublishSheet,
  window._saveLiUrlInline, window.loadPcsComments, window._showStageConfirm,
  window._buildStageProgress, window._buildInlineActions, window._pcsEditLink,
  window.pcsCloseAttach, window.pcsSaveAttach, window._loadPCSActivity,
  window._buildInfoGrid, window._buildNotes, window._renderAdvanceButton,
  window._renderActivityCount, window._removePcsConfirm, window.pcsConfirmDelete,
  window.pcsDoDelete, window._pcsAddPhotos, window._pcsHandlePhotoInput,
  window._pcsRemovePhoto, window._pcsPhotoMenu, window._pcsSaveAllPhotos,
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
1. LinkedIn URL not saving from publish dialog (actions/pcs.js ~548-580) OPEN
2. Notifications firing inconsistently OPEN
3. Role preview not showing correct view in all cases OPEN
4. Session persistence — clients getting logged out OPEN

## SECTION 13 — STABILITY ROADMAP
Ph0 Safety            — DONE
Ph1 File Architecture — DONE
Ph2 AppState          — DONE
Ph3 Error Handling    — IN PROGRESS (error_log table created in Supabase)
Ph4 Event Delegation  — PENDING
Ph5 Optimistic UI     — IN PROGRESS (client comments done)
Ph6 PWA               — PENDING
Ph7 Light Mode        — PENDING
Ph8 React             — FUTURE

## SECTION 14 — SELF-MAINTENANCE RULE
Update CLAUDE.md in EVERY PR — same commit, never separate PR.
After every change update:
- Test count (run npx vitest run, use actual number)
- ?v= version to latest
- Global functions if any window.* added/removed
- Bug status — mark FIXED with PR number
- Roadmap phase if completed
A stale CLAUDE.md is worse than no CLAUDE.md.
