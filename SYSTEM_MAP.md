# System Map — Hinglish Ops

Architecture reference for the entire codebase. Vanilla JavaScript, no framework, no bundler, Supabase backend.

---

## File Load Order

Scripts load via `<script defer>` in `index.html` (lines 754–763). Execution order:

```
01-config.js      Constants, stage/pillar definitions, role configs
02-session.js     Mutable global state (allPosts, currentRole, flags)
03-auth.js        Auth functions (OTP, session refresh, role activation)
05-api.js         Supabase REST wrapper, normalise(), file upload
10-ui.js          Toast, tabs, theme, overlays, utility helpers (esc, parseDate, etc.)
06-post-create.js New post modal, draft autosave (localStorage)
07-post-load.js   Data loading, realtime poll, ALL render functions
08-post-actions.js Stage updates, modals (PCS, post modal, admin edit)
09-approval.js    Public approval view (unauthenticated)
04-router.js      App entry point — runs _startRouter() on DOMContentLoaded (LAST)
```

Every file depends on the ones above it. All share a single global scope (no modules).

---

## 1. Auth Layer

**File:** `03-auth.js` (232 lines)
**Backend:** Supabase Auth (`/auth/v1/otp`, `/auth/v1/verify`, `/auth/v1/user`)

### Login Flow

```
User enters email
  → sendMagicLink()
    → POST /auth/v1/otp { email, create_user: false }
    → stores email in localStorage('hinglish_pending_email')
    → shows code input step

User enters 6-digit OTP
  → verifyOTPCode()
    → POST /auth/v1/verify { email, token, type: 'email' }
    → stores access_token + refresh_token in localStorage
    → calls resolveRoleFromToken()

resolveRoleFromToken(token, email)
  → GET /rest/v1/user_roles?email=eq.{email}&select=role&limit=1
  → stores role in localStorage('hinglish_role'), email in localStorage('hinglish_email')
  → calls activateRole(role)
```

### Session Refresh

```
refreshSession()
  → POST /auth/v1/token?grant_type=refresh_token
  → updates localStorage('sb_access_token')
  → deduplicates concurrent calls via _refreshInProgress promise
```

Called from:
- `apiFetch()` on 401 response (automatic retry)
- `_startRouter()` on boot (proactive refresh)
- Background timer every 50 minutes (`startRealtime()` in 07-post-load.js)

### localStorage Keys

| Key | Set by | Purpose |
|-----|--------|---------|
| `sb_access_token` | `verifyOTPCode`, `refreshSession` | Supabase JWT |
| `sb_refresh_token` | `verifyOTPCode`, `refreshSession` | Refresh token for silent renewal |
| `hinglish_role` | `resolveRoleFromToken` | User role (Admin/Servicing/Creative/Client) |
| `hinglish_email` | `resolveRoleFromToken` | User email |
| `hinglish_pending_email` | `sendMagicLink` | Temp: email awaiting OTP verification |
| `hinglish_theme` | `toggleTheme` | dark/light preference |
| `hinglish_new_post_draft` | `saveDraft` | Draft post JSON (expires after 24h) |
| `snooze_{postId}` | `confirmSnooze` | Snooze expiry timestamp |

### Role Activation

```
activateRole(role)
  → sets global currentRole
  → if Client: shows #client-view, calls loadPostsForClient()
  → else:      shows #dashboard-view, calls loadPosts(), loadTasks(), startRealtime(), fetchUnreadCount()
```

### Logout

```
logout()
  → removes 6 localStorage keys (tokens, role, email, pending email)
  → calls stopRealtime()
  → hides dashboard/client views
  → shows login overlay
```

---

## 2. Router Boot Sequence

**File:** `04-router.js` (59 lines)
**Entry:** `_startRouter()` runs on DOMContentLoaded (or immediately if DOM already loaded)

```
_startRouter()
  │
  ├─ URL path matches /p/{postId}?
  │    → showApprovalView(postId)                    [public, no auth]
  │
  ├─ ?approve={postId} query param?
  │    → showApprovalView(postId)                    [public, no auth]
  │
  ├─ ?action=viewApproval&ref={postId} query param?
  │    → showApprovalView(postId, strip -hinglish suffix) [public, no auth]
  │
  ├─ Hash contains access_token? (magic link callback)
  │    → store refresh_token
  │    → handleMagicLinkToken(access_token)
  │      → GET /auth/v1/user to get email
  │      → resolveRoleFromToken() → activateRole()
  │
  ├─ Saved role + token in localStorage?
  │    → try refreshSession() first
  │    → activateRole(savedRole)
  │
  └─ Nothing?
       → showLoginOverlay()
```

### View Routing

The app has 3 mutually exclusive views (controlled by `.active` class):

| View | Element | Roles | Triggered by |
|------|---------|-------|-------------|
| Login | `#login-overlay` | all | `showLoginOverlay()` |
| Dashboard | `#dashboard-view` | Admin, Servicing, Creative | `activateRole(non-Client)` |
| Client | `#client-view` | Client | `activateRole('Client')` |
| Approval | `#approval-view` | public (no auth) | URL match `/p/`, `?approve=`, `?action=viewApproval` |

Dashboard has 4 tabs via bottom nav (`#bottom-nav`):
- **My Tasks** (`#panel-tasks`) — default, role-filtered buckets
- **Pipeline** (`#panel-pipeline`) — all posts grouped by stage
- **Upcoming** (`#panel-upcoming`) — posts with future target dates
- **Library** (`#panel-library`) — all posts, filterable, 3 view modes (list/calendar/board)

---

## 3. API Wrapper

**File:** `05-api.js` (113 lines)
**Backend:** Supabase REST (`/rest/v1/*`)

### apiFetch(path, options)

Single gateway for all Supabase REST calls.

```
apiFetch(path, options)
  → fetch(SUPABASE_URL + '/rest/v1' + path, { ...options, headers: getAuthHeaders() })
  │
  ├─ 401 response?
  │    → refreshSession()
  │    ├─ refresh OK → retry original request
  │    │    ├─ retry OK → return parsed JSON
  │    │    └─ retry fails → throw (NOT logout — may be RLS)
  │    └─ refresh fails → showErrorBanner(), throw
  │
  ├─ Other error (4xx/5xx)?
  │    → throw Error with status + body
  │
  └─ Success?
       → parse response text as JSON (empty → [])
```

**Critical design decision:** apiFetch NEVER calls logout(). A 401 can be transient (Supabase blip, RLS policy, multi-tab token race). Session destruction only happens via explicit user action.

### getAuthHeaders(extra)

```
{
  apikey:        SUPABASE_KEY,        // anon key (public, in source)
  Authorization: Bearer {access_token from localStorage || SUPABASE_KEY},
  Content-Type:  application/json,
  Prefer:        return=representation,
  Accept:        application/json,
  ...extra
}
```

### normalise(rows)

Maps Supabase snake_case columns to camelCase JS properties:

```
r.content_pillar → contentPillar
r.target_date    → targetDate
r.post_link      → postLink
r.created_at     → created_at (kept)
r.updated_at     → updated_at (kept)
r.post_id        → post_id (kept, fallback to r.id)
```

Also spreads `...r` to preserve any extra columns.

### uploadPostAsset(file, postId)

```
POST /storage/v1/object/post-assets/{postId}/{timestamp}.{ext}
→ returns public URL: /storage/v1/object/public/post-assets/{filename}
```

### logActivity({ post_id, actor_name, actor_role, action })

```
POST /rest/v1/activity_log { post_id, actor, action, created_at }
→ fire-and-forget (errors logged to console, not shown to user)
```

---

## 4. Realtime Polling

**File:** `07-post-load.js` (lines 67–107)
**No WebSockets** — uses HTTP polling against Supabase REST.

### startRealtime()

Started by `activateRole()` for non-Client roles.

```
Two intervals run concurrently:

1. DATA POLL — every 15 seconds
   → skip if document.hidden (tab not visible)
   → skip if _modalOpen (user interacting with overlay)
   → GET /posts?select=*&order=created_at.desc
   → normalise(data)
   → compare fingerprint (count + post_id:stage pairs)
   → if changed: update allPosts + cachedPosts, scheduleRender(), fetchUnreadCount()

2. TOKEN REFRESH — every 50 minutes
   → refreshSession()
   → keeps session alive indefinitely without user action
```

### stopRealtime()

Called by `logout()`. Clears both interval timers.

### Change Detection

```
_postsFingerprint(posts):
  "count|id1:stage1|id2:stage2|..."

Lightweight string comparison instead of full JSON.stringify.
Only triggers re-render when post count, IDs, or stages actually change.
```

---

## 5. UI Render Pipeline

### Render Scheduling

**File:** `10-ui.js` (lines 18–36)

```
scheduleRender()
  ├─ _modalOpen is true?
  │    → set _deferredRender = true, return (skip render)
  └─ else
       → clearTimeout(_renderTimer)
       → _renderTimer = setTimeout(safeRender, 60ms)

safeRender()
  → try { renderAll() } catch { console.error }

_drainDeferredRender()
  → if _deferredRender: clear flag, schedule safeRender in 60ms
  → called by every modal close function
```

### _modalOpen Guard

Prevents background poll renders from destroying DOM nodes while user is interacting.

| Sets `_modalOpen = true` | Sets `_modalOpen = false` |
|--------------------------|---------------------------|
| `openPCS()` | `closePCS()` |
| `openPostModal()` | `closePostModal()` |
| `openAdminEdit()` | `closeAdminEdit()` |
| `openNewPostModal()` | `closeNewPostModal()` |
| — | `submitNewPost()` (on success) |
| — | `saveStageUpdate()` → `closePostModal()` |

All close functions also call `_drainDeferredRender()` to flush pending updates.

### renderAll()

**File:** `07-post-load.js` (lines 157–192)

Only renders the **active tab** to avoid unnecessary DOM churn:

```
renderAll()
  │
  ├─ ALWAYS: updateStats(), applyRoleVisibility()
  │
  ├─ activeTab === 'tasks'?
  │    → renderPipelineStrip(), renderProductionMeter()
  │    → renderAdminInsight(), renderTaskBanner(), renderAdminTaskPanel()
  │    → renderCreativeTracker(), renderNextPost()
  │    → renderTasks(), renderTaskStageChips()
  │
  ├─ activeTab === 'pipeline'?
  │    → renderPipeline()
  │
  ├─ activeTab === 'upcoming'?
  │    → renderUpcoming()
  │
  └─ activeTab === 'library'?
       → renderLibrary(), populateFilterDropdowns()
```

`switchTab()` calls `safeRender()` directly so the new tab gets rendered immediately.

### Render Function Index

| Function | Container | Roles | Purpose |
|----------|-----------|-------|---------|
| `updateStats()` | hidden stat elements | all | Counter values (published, pipeline, overdue, etc.) |
| `renderPipelineStrip()` | `#pipeline-strip` | Admin | Top-level stage counts (currently hidden) |
| `renderProductionMeter()` | `#prod-meter-section` | Admin | Ready/target progress bar |
| `renderAdminInsight()` | `#admin-insight-section` | Admin | Bottleneck + velocity summary pills |
| `renderTaskBanner()` | `#task-banner-section` | Servicing, Creative | Assigned tasks from `/tasks` table |
| `renderAdminTaskPanel()` | `#admin-task-section` | Admin | Task assignment form + open/done lists |
| `renderCreativeTracker()` | `#admin-insight-section` | Creative | Weekly/monthly production stats |
| `renderNextPost()` | `#next-post-section` | Admin, Servicing, Creative | Hero card — most urgent post |
| `renderTasks()` | `#tasks-container` | all | Bucketed post cards by role config |
| `renderTaskStageChips()` | `#task-stage-chips` | all | Filterable stage chip bar |
| `renderPipeline()` | `#pipeline-container` | Admin | All posts grouped by PIPELINE_ORDER |
| `renderUpcoming()` | `#upcoming-wrap` | Admin, Servicing | Future-dated posts grouped by date |
| `renderLibrary()` | library views | all | Dispatches to list/calendar/board view |
| `renderLibraryRows()` | `#library-list-view` | all | Flat list of all posts |
| `renderLibraryCalendar()` | `#library-calendar-view` | all | Posts grouped by month |
| `renderLibraryBoard()` | `#library-board-view` | all | Posts grouped by pillar |
| `renderClientView()` | client sections | Client | Input needed + approval + published tables |

### Card Construction

All post cards are built by `buildPostCard(post, listKey)` → returns HTML string with inline `onclick="openPCS(id, listKey)"`.

Cards are registered in `_postLists[listKey]` for PCS navigation.

### refreshSystemViews()

Called from PCS inline edits (`updatePost()`). Renders only the active tab (same optimization as `renderAll`).

---

## 6. Database Write Paths

All writes go through `apiFetch()` → Supabase REST API. Every write also calls `logActivity()` for audit trail.

### Posts Table (`/posts`)

#### CREATE

| Trigger | Function | File | Payload |
|---------|----------|------|---------|
| New Post modal → Create | `submitNewPost()` | `06-post-create.js:151` | `{ post_id: 'POST-{ts}', title, owner, content_pillar, location, stage, target_date, comments, post_link }` |
| Client request form | `submitClientRequest()` | `08-post-actions.js:208` | `{ post_id: 'REQ-{ts}', title: 'Client Request — {date}', stage: 'awaiting brand input', owner: email, comments }` |
| FAB → New Request sheet | `submitRequestSheet()` | `10-ui.js:410` | `{ post_id: 'REQ-{ts}', title, stage: 'Awaiting Brand Input', owner, comments, target_date }` |

#### UPDATE (PATCH)

| Trigger | Function | File | Fields updated |
|---------|----------|------|----------------|
| Hero card quick actions | `quickStage(postId, newStage)` | `08-post-actions.js:5` | `{ stage, updated_at }` |
| Post modal → Save | `saveStageUpdate()` | `08-post-actions.js:55` | `{ stage, comments, post_link, updated_at }` + owner/target_date if Admin |
| Admin edit → Save | `saveAdminEdit()` | `08-post-actions.js:103` | `{ title, owner, content_pillar, location, stage, target_date, comments, post_link, updated_at }` |
| PCS inline field edit | `updatePost(postId, field, value)` | `08-post-actions.js:795` | Single field + `updated_at` (auto-saves on blur/change) |
| PCS → Attach design link | `pcsSaveAttach(postId)` | `08-post-actions.js:755` | `{ post_link, updated_at }` via `updatePost` |
| PCS → Next Action button | `pcsDoNextAction()` | `08-post-actions.js:779` | stage via `quickStage` |
| Client → Approve | `clientApprove(postId)` | `08-post-actions.js:131` | `{ stage: 'scheduled', updated_at }` |
| Client → Request revision | `submitClientRevision(postId)` | `08-post-actions.js:155` | `{ stage: 'revisions needed', comments, updated_at }` |
| Client → Acknowledge | `clientAcknowledge(postId)` | `08-post-actions.js:170` | `{ stage: 'in production', updated_at }` |
| Client → Upload asset | `handleClientUpload()` | `08-post-actions.js:182` | `{ post_link: url, stage: 'in production', updated_at }` |
| Public approval → Approve | `submitApproval('approved')` | `09-approval.js:96` | `{ stage: 'scheduled', updated_at }` |
| Public approval → Revision | `submitApproval('revision_submit')` | `09-approval.js:78` | `{ stage: 'revisions needed', comments, updated_at }` |
| Creative → Flag issue | `flagIssue(postId)` | `08-post-actions.js:240` | `{ comments: '⚑ {msg}', updated_at }` |

#### DELETE

| Trigger | Function | File |
|---------|----------|------|
| Admin edit → Delete button | `deletePost(postId)` | `08-post-actions.js:287` |
| PCS → ⋯ menu → Delete | `pcsDoDelete()` | `08-post-actions.js:953` |

Both require confirmation. Admin-only in practice (PCS menu shows for all but only Admin/Servicing can edit).

### Tasks Table (`/tasks`)

| Method | Function | File |
|--------|----------|------|
| `POST /tasks` | `assignTask()` | `07-post-load.js:118` |
| `PATCH /tasks?id=eq.{id}` | `markTaskDone(id)` | `07-post-load.js:137` |
| `DELETE /tasks?id=eq.{id}` | `deleteTask(id)` | `07-post-load.js:150` |

### Activity Log Table (`/activity_log`)

| Method | Function | File |
|--------|----------|------|
| `POST /activity_log` | `logActivity()` | `05-api.js:98` |
| `GET /activity_log` | `fetchUnreadCount()`, `fetchAndRenderNotifications()`, `openTimeline()`, `_loadPCSActivity()` | `10-ui.js`, `08-post-actions.js` |
| `PATCH /activity_log?read=eq.false` | `markAllNotificationsRead()` | `10-ui.js:197` |

### Storage (`/storage/v1/object/post-assets/`)

| Method | Function | File |
|--------|----------|------|
| `POST /storage/v1/object/post-assets/{postId}/{ts}.{ext}` | `uploadPostAsset(file, postId)` | `05-api.js:82` |

### User Roles Table (`/user_roles`)

| Method | Function | File |
|--------|----------|------|
| `GET /user_roles?email=eq.{email}` | `resolveRoleFromToken()` | `03-auth.js:128` |

Read-only from the app. Managed externally.

---

## Optimistic Update Pattern

`quickStage()` is the primary example:

```
1. Find post in allPosts, save oldStage
2. Set post.stage = newStage (optimistic)
3. scheduleRender() → UI updates immediately
4. await apiFetch PATCH (network call)
5a. Success → showUndoToast with rollback callback
5b. Failure → post.stage = oldStage, scheduleRender(), show error toast
```

`updatePost()` in PCS uses same pattern (optimistic memory update → API call → toast).

---

## Overlay / Modal Stack

All overlays use `display: none` by default, `display: flex` when `.open` class added.

| Overlay | z-index | Open fn | Close fn | Sets _modalOpen |
|---------|---------|---------|----------|-----------------|
| `.modal-overlay` (new-post, post-modal) | 500 | `openNewPostModal()`, `openPostModal()` | `closeNewPostModal()`, `closePostModal()` | Yes |
| `#pcs-overlay` | 800 | `openPCS()` | `closePCS()` | Yes |
| `#admin-edit-overlay` | 8500 | `openAdminEdit()` | `closeAdminEdit()` | Yes |
| `#timeline-overlay` | 9000 | `openTimeline()` | `closeTimeline()` | No |
| `#zen-overlay` | 9100 | `openZen()` | `closeZen()` | No |
| `#snooze-overlay` | 9200 | `openSnooze()` | `closeSnooze()` | No |
| `.parked-overlay` | 9300 | `openParked()` | `closeParked()` | No |
| `#insights-overlay` | (in CSS) | `openInsights()` | `closeInsights()` | No |
| `#request-sheet-overlay` | (in CSS) | `openRequestSheet()` | `closeRequestSheet()` | No |
| `.pcs-confirm-overlay` | 1200 | `pcsConfirmDelete()` (dynamic DOM) | Cancel button removes element | No |

---

## Role-Based Access

Defined in `01-config.js`:

### ROLE_STAGES — which stages a role can see in "My Tasks"

```
Admin:     null (all stages)
Servicing: ['awaiting approval', 'ready', 'scheduled']
Creative:  ['in production', 'revisions needed', 'awaiting brand input']
Client:    (separate view, no task filtering)
```

### ROLE_TABS — which tabs appear in bottom nav

```
Admin:     ['tasks', 'pipeline', 'upcoming', 'library']
Servicing: ['tasks', 'upcoming', 'library']
Creative:  ['tasks', 'library']
Client:    [] (no tabs — uses separate client view)
```

### ROLE_BUCKETS — how "My Tasks" groups posts

```
Admin:     Requests | Revisions | In Production | Ready | For Approval | Scheduled
Servicing: Waiting for Client | Ready | Scheduled
Creative:  Requests | In Production | Revisions
```

---

## Stage Workflow

```
awaiting brand input  ──→  in production  ──→  ready  ──→  awaiting approval  ──→  scheduled  ──→  published
        ↑                       ↑                                    │
        │                       │                                    ↓
        └───────────────────────┴──────────────── revisions needed ──┘

                                                  parked (any stage can park)
                                                  archive (terminal)
```

Stage colors and labels are in `STAGE_META` (01-config.js). The `stageStyle(raw)` helper normalizes any input string to the correct `{ hex, label }`.

`_pcsNextAction(stageLC)` maps each stage to its "next action" button label and target stage for the PCS view.
