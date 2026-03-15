# Architecture Audit — guneygaar.github.io

**Date:** 2026-03-15
**Branch:** main-/-root
**Status:** AUDIT ONLY — no structural changes applied

---

## STEP 1 — File Inventory

| File | Lines | Description |
|------|------:|-------------|
| `01-config.js` | 153 | Constants, stage/pillar metadata, role config |
| `02-session.js` | 14 | Mutable global runtime state variables |
| `03-auth.js` | 232 | OTP authentication, role resolution, login/logout |
| `04-router.js` | 59 | App entry point, URL routing, DOMContentLoaded |
| `05-api.js` | 112 | Supabase REST wrapper (`apiFetch`), normalisation |
| `06-post-create.js` | 218 | New post modal, draft autosave |
| `07-post-load.js` | 988 | Data loading, ALL render functions, stats, filters |
| `08-post-actions.js` | 965 | Stage updates, PCS modal, swipe gestures, drag & drop |
| `09-approval.js` | 110 | Public approval view (standalone page) |
| `10-ui.js` | 437 | Toast, tabs, theme, notifications, zen, snooze, FAB, utils |
| **Total** | **3,287** | |

### Major Functions Per File

**01-config.js**
- `stageStyle(raw)` — returns `{hex, label}` for a stage

**02-session.js**
- Global variables: `allPosts`, `cachedPosts`, `currentRole`, `allTasks`, etc.

**03-auth.js**
- `refreshSession()`, `showLoginOverlay()`, `backToEmail()`
- `sendMagicLink()`, `verifyOTPCode()`, `resolveRoleFromToken()`
- `handleMagicLinkToken()`, `logout()`, `activateRole(role)`
- `applyRoleVisibility()`, `updateActionButton()`, `handleActionButton()`

**04-router.js**
- `_startRouter()` — entry point, URL parsing, session restoration

**05-api.js**
- `getAuthHeaders()`, `apiFetch(path, options)`
- `normalise(rows)`, `uploadPostAsset(file, postId)`, `logActivity()`

**06-post-create.js**
- `saveDraft()`, `loadDraft()`, `clearDraft()`, `startDraftAutosave()`
- `openNewPostModal()`, `closeNewPostModal()`, `submitNewPost()`
- `_populateNewPostDropdowns()`

**07-post-load.js** (LARGEST — 988 lines)
- Data: `loadPosts()`, `loadPostsForClient()`, `startRealtime()`, `stopRealtime()`
- Tasks: `loadTasks()`, `assignTask()`, `markTaskDone()`, `deleteTask()`
- Render orchestration: `renderAll()`, `updateStats()`, `setText()`, `updateBadge()`
- Stats/dashboards: `renderPipelineStrip()`, `renderProductionMeter()`, `renderAdminInsight()`
- Task rendering: `renderTaskBanner()`, `renderAdminTaskPanel()`, `renderTasks()`, `renderTaskStageChips()`
- Helper: `daysInStage()`, `staleLabel()`, `staleClass()`, `getMyTasks()`, `getNextPost()`, `getRelativeDate()`
- Hero card: `renderNextPost()`, `toggleHeroComments()`
- Post cards: `buildPostCard()`, `_postLists` registry
- Pipeline: `renderPipeline()`
- Upcoming: `getUpcoming()`, `renderUpcoming()`
- Library: `renderLibrary()`, `renderLibraryRows()`, `filterLibrary()`, `populateFilterDropdowns()`
- Library views: `switchLibraryView()`, `renderLibraryBoard()`, `renderLibraryCalendar()`
- Client view: `renderClientView()`, `renderClientApproved()`
- Creative: `renderCreativeTracker()`
- Parked: `openParked()`, `closeParked()`

**08-post-actions.js** (965 lines)
- Stage: `quickStage()`, `saveStageUpdate()`, `updatePost()`
- Post modal: `openPostModal()`, `closePostModal()`
- Admin edit: `openAdminEdit()`, `closeAdminEdit()`, `saveAdminEdit()`
- Client actions: `clientApprove()`, `showRevisionInput()`, `submitClientRevision()`, `clientAcknowledge()`, `handleClientUpload()`
- Requests: `scrollToNewRequest()`, `submitClientRequest()`, `handleRequestFileUpload()`, `flagIssue()`
- Drag & Drop: `onPcardDragStart()`, `onPcardDragEnd()`, `onStageDrop()`, `handleBucketDrop()`
- Touch drag: `onPcardTouchStart()`, `onPcardTouchMove()`, `onPcardTouchEnd()`
- **PCS (Post Control Screen):** `openPCS()`, `closePCS()`, `_renderPCS()`, `_pcsNext()`
- PCS sub-builders: `_buildStageProgress()`, `_buildDesignBlock()`, `_buildPCSGrid()`, `_renderPCSFooter()`
- PCS actions: `pcsToggleAttach()`, `pcsSaveAttach()`, `pcsDoNextAction()`, `pcsConfirmDelete()`, `pcsDoDelete()`
- PCS helpers: `_pcsNextAction()`, `_loadPCSActivity()`, `_pcsListLabel()`
- **PCS Swipe:** `_pcsAttachSwipe()`, `_pcsTouchStart()`, `_pcsTouchMove()`, `_pcsTouchEnd()`
- Legacy: `deletePost()`, `timeAgo()`, `nudgeClient()`, `copyCaption()`

**09-approval.js**
- `showApprovalView(postId)`, `submitApproval(type, postId, btn)`

**10-ui.js**
- Error banner: `showErrorBanner()`, `hideErrorBanner()`
- Render: `safeRender()`, `scheduleRender()`
- Toast: `showToast()`, `showUndoToast()`, `triggerUndo()`
- Theme: `toggleTheme()`, `applyTheme()` (IIFE)
- Menus: `toggleUserMenu()`, `closeUserMenu()`, `toggleClientMenu()`, `closeClientMenu()`
- Tabs: `switchTab()`, `switchClientTab()`, `goToTab()`, `goToLibraryFiltered()`, `goToPipelineStage()`, `scrollToBucket()`
- Notifications: `fetchUnreadCount()`, `fetchAndRenderNotifications()`, `markAllNotificationsRead()`, `renderNotificationBadge()`, `toggleNotifPanel()`
- Zen: `openZen()`, `closeZen()`
- Snooze: `openSnooze()`, `closeSnooze()`, `confirmSnooze()`, `isSnoozed()`
- Timeline: `openTimeline()`, `closeTimeline()`
- Utils: `getTitle()`, `getPostId()`, `parseDate()`, `formatDate()`, `esc()`, `copyApprovalLink()`
- Insights: `openInsights()`, `closeInsights()`
- FAB: `_fabAttachScroll()`, `_fabOnScroll()`, `toggleFabMenu()`, `closeFabMenu()`
- Requests: `openRequestSheet()`, `closeRequestSheet()`, `submitRequestSheet()`
- **Duplicate:** `timeAgo()` defined in BOTH 08-post-actions.js:306 AND 10-ui.js:212

---

## STEP 2 — Dependency Map

### Load Order (via `<script defer>` in index.html)
```
01-config.js → 02-session.js → 03-auth.js → 05-api.js → 06-post-create.js → 07-post-load.js → 08-post-actions.js → 09-approval.js → 10-ui.js → 04-router.js
```

### Call Flow

```
[ENTRY]
04-router.js → _startRouter()
  ├─ 03-auth.js → handleMagicLinkToken() → resolveRoleFromToken() → activateRole()
  ├─ 03-auth.js → refreshSession()
  ├─ 03-auth.js → activateRole()
  │    ├─ 07-post-load.js → loadPosts() → apiFetch() → normalise() → scheduleRender()
  │    ├─ 07-post-load.js → loadTasks()
  │    ├─ 07-post-load.js → startRealtime()
  │    ├─ 10-ui.js → fetchUnreadCount()
  │    └─ 07-post-load.js → loadPostsForClient() → renderClientView()
  └─ 09-approval.js → showApprovalView()

[RENDER CYCLE]
10-ui.js → scheduleRender() → safeRender() → renderAll()
  ├─ 07-post-load.js → updateStats()
  ├─ 07-post-load.js → renderPipelineStrip()
  ├─ 07-post-load.js → renderProductionMeter()
  ├─ 07-post-load.js → renderAdminInsight()
  ├─ 07-post-load.js → renderTaskBanner()
  ├─ 07-post-load.js → renderAdminTaskPanel()
  ├─ 07-post-load.js → renderCreativeTracker()
  ├─ 07-post-load.js → renderNextPost()
  ├─ 07-post-load.js → renderTasks()
  ├─ 07-post-load.js → renderTaskStageChips()
  ├─ 07-post-load.js → renderPipeline()
  ├─ 07-post-load.js → renderUpcoming()
  ├─ 07-post-load.js → renderLibrary()
  ├─ 07-post-load.js → populateFilterDropdowns()
  └─ 03-auth.js → applyRoleVisibility()

[CARD TAP → PCS MODAL]
07-post-load.js → buildPostCard() → onclick → openPCS()
  └─ 08-post-actions.js → openPCS() → _renderPCS()
       ├─ _buildStageProgress()
       ├─ _buildDesignBlock()
       ├─ _buildPCSGrid()
       └─ _loadPCSActivity() → apiFetch()

[PCS SWIPE]
08-post-actions.js → _pcsAttachSwipe()
  ├─ _pcsTouchStart() / _pcsTouchMove() / _pcsTouchEnd()
  └─ _pcsNext() → _renderPCS()

[STAGE CHANGE]
08-post-actions.js → quickStage() → apiFetch() → scheduleRender()
08-post-actions.js → saveStageUpdate() → apiFetch() → loadPosts()
08-post-actions.js → updatePost() → apiFetch() → refreshSystemViews()

[NEW POST]
06-post-create.js → openNewPostModal() → submitNewPost() → apiFetch() → loadPosts()

[APPROVAL PAGE]
09-approval.js → showApprovalView() → apiFetch()
09-approval.js → submitApproval() → apiFetch()
```

---

## STEP 3 — Architectural Problems

### P1: God Files (Critical)

| Problem | File | Lines |
|---------|------|------:|
| **07-post-load.js does too many things** | 07-post-load.js | 988 |
| Contains: data fetching, realtime polling, task CRUD, ALL render functions, stats computation, 5 different view renderers, client view, creative tracker, filter logic, helper utilities | | |
| **08-post-actions.js does too many things** | 08-post-actions.js | 965 |
| Contains: stage updates, 3 different modal controllers (post modal, admin edit, PCS), drag & drop, touch gestures, PCS swipe, PCS rendering, PCS delete, client approval, file upload, WhatsApp nudge, caption copy | | |

### P2: Duplicated Functions

| Function | Location 1 | Location 2 |
|----------|-----------|------------|
| `timeAgo()` | 08-post-actions.js:306 | 10-ui.js:212 |

Both implementations are identical. The one in 08-post-actions.js should be removed.

### P3: Modal Logic Scattered Across Files

The app has **6 different modal/overlay patterns** spread across 4 files:

| Modal | Open/Close in | Render in |
|-------|---------------|-----------|
| PCS (Post Control Screen) | 08-post-actions.js | 08-post-actions.js |
| Post Detail Modal | 08-post-actions.js | 08-post-actions.js |
| Admin Edit Modal | 08-post-actions.js | 08-post-actions.js |
| New Post Modal | 06-post-create.js | 06-post-create.js |
| Zen Mode | 10-ui.js | 10-ui.js |
| Timeline | 10-ui.js | 10-ui.js |
| Snooze | 10-ui.js | 10-ui.js |
| Insights | 10-ui.js | 10-ui.js |
| Notification Panel | 10-ui.js | 10-ui.js |
| Request Sheet | 10-ui.js | 10-ui.js |
| Parked Sheet | 07-post-load.js | 07-post-load.js |
| Login Overlay | 03-auth.js | (index.html) |

All modals use the same pattern: `element.classList.add('open')` / `document.body.style.overflow = 'hidden'`. This should be a shared utility.

### P4: Functions in Wrong Files

| Function | Current File | Should Be In |
|----------|-------------|-------------|
| `renderClientView()`, `renderClientApproved()` | 07-post-load.js | Separate client view file |
| `renderCreativeTracker()` | 07-post-load.js | Role-specific UI file |
| `openParked()`, `closeParked()` | 07-post-load.js | 10-ui.js or separate modal file |
| `renderAdminInsight()` | 07-post-load.js | Role-specific UI file |
| `renderAdminTaskPanel()`, `renderTaskBanner()` | 07-post-load.js | Task-specific file |
| `assignTask()`, `markTaskDone()`, `deleteTask()` | 07-post-load.js | Task CRUD belongs near api.js |
| `scrollToNewRequest()`, `submitClientRequest()` | 08-post-actions.js | 06-post-create.js or client file |
| `deletePost()` | 08-post-actions.js | Could be in api layer |
| `timeAgo()` | 08-post-actions.js | Already in 10-ui.js (duplicate) |
| `applyRoleVisibility()`, `updateActionButton()` | 03-auth.js | 10-ui.js (UI concern) |
| `handleActionButton()` | 03-auth.js | 10-ui.js |

### P5: Event Listeners Attached in Multiple Places

| Pattern | Locations |
|---------|-----------|
| `document.body.style.overflow = 'hidden'` | Set in 11+ places across 4 files. No central lock/unlock. |
| PCS touch listeners | Re-attached every time `openPCS()` is called via `_pcsAttachSwipe()` (has removeEventListener guard, so not a leak — but fragile) |
| FAB scroll listener | Attached in `_fabAttachScroll()`, re-attached on every tab switch |
| DOMContentLoaded | Listened in both 04-router.js and 10-ui.js |
| Library board touch swipe | Attached inline via `container.ontouchstart/end` every render |

### P6: Global State Sprawl

All state lives as top-level `let`/`const` variables across files:

| Variable | File | Used By |
|----------|------|---------|
| `allPosts`, `cachedPosts`, `currentRole` | 02-session.js | Everywhere |
| `allTasks` | 02-session.js | 07-post-load.js |
| `_renderTimer`, `_retryCount` | 02-session.js | 10-ui.js |
| `_pcs` (object) | 08-post-actions.js | PCS functions |
| `_swipe` (object) | 08-post-actions.js | PCS swipe |
| `_dragPostId`, `_isDragging`, etc. | 08-post-actions.js | Drag functions |
| `_taskFilter` | 07-post-load.js | Task rendering |
| `_currentLibraryView` | 07-post-load.js | Library rendering |
| `_snoozePostId` | 10-ui.js | Snooze functions |
| `_undoFn`, `_undoTimer` | 10-ui.js | Undo toast |
| `_parkedPosts` | 07-post-load.js (on `window`) | openParked |
| `_postLists` | 07-post-load.js | PCS navigation |

### P7: Swipe Gesture Still Present

`08-post-actions.js` lines 439–588 contain full PCS swipe-to-next and swipe-to-close logic. The `_pcsAttachSwipe()` is still called in `openPCS()` (line 429). If swipe was supposed to be removed, this code is still active.

### P8: Inline HTML Generation

Nearly all render functions build HTML via template literals with manual `${esc()}` calls. This is consistent but:
- Very long single-line HTML strings (e.g., `renderNextPost()` is essentially one 1200-char line)
- No component abstraction
- Hard to maintain

---

## STEP 4 — Proposed Minimal Architecture

```
core/
  config.js          ← 01-config.js (unchanged)
  session.js         ← 02-session.js (unchanged)
  router.js          ← 04-router.js (unchanged)
  api.js             ← 05-api.js (unchanged)

auth/
  auth.js            ← 03-auth.js (auth only: OTP, refresh, login/logout)

ui/
  modal.js           ← NEW: shared open/close/overlay pattern
  toast.js           ← extract from 10-ui.js (showToast, showUndoToast)
  tabs.js            ← extract from 10-ui.js (switchTab, goToTab, etc.)
  theme.js           ← extract from 10-ui.js (toggleTheme, applyTheme)
  fab.js             ← extract from 10-ui.js (FAB scroll, menu)
  notifications.js   ← extract from 10-ui.js (badge, panel, fetch)
  utils.js           ← esc(), getTitle(), getPostId(), parseDate(), formatDate(), timeAgo()

features/
  posts/
    post-create.js   ← 06-post-create.js (clean — keep as-is)
    post-card.js     ← buildPostCard(), _postLists registry
    post-actions.js  ← quickStage(), updatePost(), deletePost()

  pcs/
    pcs-modal.js     ← openPCS(), closePCS(), _renderPCS(), _pcsNext()
    pcs-builders.js  ← _buildStageProgress(), _buildDesignBlock(), _buildPCSGrid()
    pcs-swipe.js     ← swipe gesture code (or DELETE if swipe is deprecated)

  modals/
    post-modal.js    ← openPostModal(), closePostModal(), saveStageUpdate()
    admin-edit.js    ← openAdminEdit(), closeAdminEdit(), saveAdminEdit()
    zen.js           ← openZen(), closeZen()
    timeline.js      ← openTimeline(), closeTimeline()
    snooze.js        ← openSnooze(), closeSnooze(), confirmSnooze()
    insights.js      ← openInsights(), closeInsights()
    request-sheet.js ← openRequestSheet(), closeRequestSheet(), submitRequestSheet()

  tasks/
    task-crud.js     ← loadTasks(), assignTask(), markTaskDone(), deleteTask()
    task-render.js   ← renderTaskBanner(), renderAdminTaskPanel()

  dashboard/
    stats.js         ← updateStats(), renderPipelineStrip(), renderProductionMeter()
    hero.js          ← renderNextPost(), toggleHeroComments()
    admin-insight.js ← renderAdminInsight(), openParked(), closeParked()
    creative.js      ← renderCreativeTracker()

  views/
    tasks-view.js    ← renderTasks(), renderTaskStageChips(), filterTasksByChip()
    pipeline-view.js ← renderPipeline()
    upcoming-view.js ← renderUpcoming(), getUpcoming()
    library-view.js  ← renderLibrary(), filterLibrary(), renderLibraryRows/Board/Calendar()
    client-view.js   ← renderClientView(), renderClientApproved(), client actions

  approval/
    approval.js      ← 09-approval.js (clean — keep as-is)

  drag/
    drag-drop.js     ← all drag & drop + touch drag code
```

### Migration Priority (safest first)

1. **Extract `utils.js`** — pure functions, zero risk
2. **Remove duplicate `timeAgo()`** from 08-post-actions.js
3. **Extract `task-crud.js`** — clean CRUD boundary
4. **Split 07-post-load.js** — render functions into view-specific files
5. **Split 08-post-actions.js** — PCS into own module, modals separated
6. **Extract shared modal helper** — `openOverlay(id)` / `closeOverlay(id)`

---

## STEP 5 — Safety Check (Current State)

| Feature | Status | Notes |
|---------|--------|-------|
| Card tap opens PCS | **Working** | `buildPostCard()` → `onclick="openPCS(…)"` → `08-post-actions.js:openPCS()` |
| Overlay closes PCS | **Working** | `closePCS()` removes `.open` class |
| PCS animation | **Working** | CSS transitions on `.pcs-screen`, slide-in on `_pcsNext()` |
| Swipe gesture | **Still present** | `_pcsAttachSwipe()` called in `openPCS()` line 429. Horizontal swipe-to-next and vertical swipe-to-close are fully active. |
| Console errors | **None expected** | All functions guarded with `if (!el) return` patterns |

**Warning:** PCS swipe gestures are still fully wired. If the intent is to have no swipe, lines 439–588 of `08-post-actions.js` and the `_pcsAttachSwipe()` call on line 429 need to be removed.

---

## STEP 6 — Summary

### 1. JS File List
10 files, 3,287 total lines. Two god files: `07-post-load.js` (988 lines) and `08-post-actions.js` (965 lines).

### 2. Function Ownership Map
See Step 1 above — 100+ functions mapped to their files.

### 3. Architectural Problems Found
- **P1:** Two god files doing 10+ unrelated things each
- **P2:** Duplicate `timeAgo()` function
- **P3:** 11+ modal/overlay patterns with no shared helper
- **P4:** 15+ functions living in the wrong file
- **P5:** Event listeners attached in fragile/repeated patterns
- **P6:** 12+ global state variables scattered across files
- **P7:** Swipe gesture code still active (if deprecation was intended)
- **P8:** All HTML built via long template literal strings

### 4. Recommended Restructuring Plan
See Step 4 above. The key principle: **split by feature, not by layer**. Each feature (PCS, tasks, library, etc.) gets its own file. Shared utilities and modal patterns get extracted first as the safest changes.

---

*This audit is read-only. No code has been moved or modified.*
