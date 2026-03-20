# Test Coverage Analysis

## Current State

**Test coverage: 0%.** The codebase has no test files, no test framework, no CI/CD pipeline, and no `package.json`. All 10 JavaScript source files (~4,000 lines of JS logic) are completely untested.

---

## Recommended Testing Setup

Since this is a vanilla JS project (no bundler, no npm), the fastest path to testability is:

1. **Initialize npm** (`npm init`) and install a test framework (e.g., [Vitest](https://vitest.dev/) or [Jest](https://jestjs.io/) with jsdom)
2. **Extract pure logic** from DOM-coupled functions so it can be unit tested independently
3. **Add a CI workflow** (`.github/workflows/test.yml`) to run tests on every push

---

## Priority Areas for Test Coverage

### Priority 1 — Pure utility functions (easy wins, high value)

These functions have zero DOM dependencies and can be tested immediately with minimal setup:

| Function | File | Lines | What to test |
|---|---|---|---|
| `stageStyle(raw)` | `01-config.js` | 61-64 | Lookup by key, case insensitivity, trimming, fallback for unknown stages |
| `normalise(rows)` | `05-api.js` | 63-80 | Field mapping (`content_pillar` → `contentPillar`), empty arrays, missing fields, non-array input |
| `timeAgo(iso)` | `10-ui.js` | 212-219 | Just now, minutes, hours, days, null/empty input, invalid dates |
| `esc(str)` | `10-ui.js` | 324-331 | HTML entity escaping (`&`, `<`, `>`, `"`, `'`), null/undefined input |
| `parseDate(raw)` | `10-ui.js` | 312-316 | Valid dates, invalid strings, null, empty string |
| `formatDate(raw)` | `10-ui.js` | 318-322 | Correct locale format (`en-GB`), null passthrough |
| `getTitle(post)` | `10-ui.js` | 309 | Fallback chain: title → post_id → 'Untitled' |
| `getPostId(post)` | `10-ui.js` | 310 | Fallback: post_id → id → '' |
| `isSnoozed(postId)` | `10-ui.js` | 259-265 | Active snooze, expired snooze, no snooze (requires localStorage mock) |

**Estimated effort:** Low. These can be extracted into a shared `utils.js` and tested in isolation.

---

### Priority 2 — Configuration integrity

The config in `01-config.js` drives the entire app. Snapshot/structural tests would catch accidental breakage:

| What to test | Why |
|---|---|
| `STAGE_META` keys match `STAGES_DB` entries | A typo in a stage key silently breaks filtering, rendering, and workflow logic |
| `STAGE_DISPLAY` is auto-generated correctly from `STAGE_META` | The `Object.fromEntries` derivation could silently break |
| `ROLE_STAGES` values are all valid stage keys | An invalid stage in a role config silently hides posts |
| `ROLE_BUCKETS` stage arrays reference valid `STAGES_DB` values | A misspelled stage means an empty bucket with no error |
| `STRIP_STAGES` colors match their `STAGE_META` hex values | A mismatch causes inconsistent UI colors |
| `PIPELINE_ORDER` contains all stages from `STAGES_DB` | Missing a stage means posts vanish from the pipeline view |

**Estimated effort:** Low. Pure data validation, no mocks needed.

---

### Priority 3 — API layer (`05-api.js`)

The `apiFetch` function is the single gateway to Supabase. Bugs here affect every feature.

| Scenario | What to test |
|---|---|
| Successful request | Returns parsed JSON |
| Empty response body | Returns `[]` instead of crashing on `JSON.parse('')` |
| 401 → refresh succeeds → retry succeeds | Silent recovery works |
| 401 → refresh succeeds → retry still fails | Throws with status, does NOT logout |
| 401 → refresh fails | Shows error banner, throws, does NOT logout |
| Non-401 error (e.g., 500) | Throws with status and body |
| `getAuthHeaders` merges extra headers | Custom headers aren't overwritten |

**Estimated effort:** Medium. Requires mocking `fetch`, `localStorage`, and `showErrorBanner`.

---

### Priority 4 — Authentication flow (`03-auth.js`)

Auth bugs lock users out or leak sessions. Key scenarios:

| Scenario | What to test |
|---|---|
| `sendMagicLink` — valid email | Calls OTP endpoint, transitions to code step |
| `sendMagicLink` — empty/invalid email | Shows error, does not call API |
| `verifyOTPCode` — valid code | Stores tokens, calls `resolveRoleFromToken` |
| `verifyOTPCode` — short code | Shows error |
| `resolveRoleFromToken` — user has role | Stores role, hides overlay, calls `activateRole` |
| `resolveRoleFromToken` — no role found | Shows error message |
| `refreshSession` — deduplication | Multiple concurrent calls return same promise |
| `logout` | Clears all 6 localStorage keys, shows login overlay |

**Estimated effort:** Medium-high. Requires mocking `fetch`, `localStorage`, and DOM elements.

---

### Priority 5 — Post creation & draft management (`06-post-create.js`)

Draft persistence uses `localStorage` and has time-based expiry — easy to get wrong silently.

| Scenario | What to test |
|---|---|
| `saveDraft` | Serializes form fields to localStorage |
| `saveDraft` — empty title AND empty comments | Does NOT save (guard clause) |
| `loadDraft` — valid draft | Populates form fields, returns `true` |
| `loadDraft` — expired draft (>24h) | Removes from storage, returns `false` |
| `loadDraft` — corrupted JSON | Returns `false`, doesn't throw |
| `clearDraft` | Removes key, stops timer |
| `submitNewPost` — missing title | Shows error toast, doesn't call API |
| `submitNewPost` — missing owner | Shows error toast, doesn't call API |
| `submitNewPost` — API failure | Saves draft, re-enables button |

**Estimated effort:** Medium. Requires DOM mocks for form elements.

---

### Priority 6 — Routing (`04-router.js`)

The router determines which view loads. A bug here = blank screen.

| Scenario | What to test |
|---|---|
| `/p/POST-123` path | Calls `showApprovalView('POST-123')` |
| `?approve=POST-123` param | Calls `showApprovalView('POST-123')` |
| `?action=viewApproval&ref=POST-123-hinglish` | Strips `-hinglish` suffix, calls approval view |
| Hash contains `access_token` | Stores refresh token, calls `handleMagicLinkToken` |
| Saved role + valid token | Calls `activateRole` |
| No saved session | Shows login overlay |

**Estimated effort:** Medium. Requires mocking `window.location`, `localStorage`, and downstream functions.

---

### Priority 7 — Stage workflow logic (`08-post-actions.js`)

The `quickStage` function does optimistic updates with rollback — a classic source of race conditions.

| Scenario | What to test |
|---|---|
| `quickStage` — success | Updates in-memory, calls API, logs activity, shows undo toast |
| `quickStage` — API failure | Rolls back in-memory stage, shows error toast |
| `quickStage` — undo callback | Reverses the stage change |
| `_pcsNextAction` mapping | Each stage maps to correct next stage and label |
| `clientApprove` — already approved | Shows toast, doesn't call API |
| `deletePost` — success | Removes from `allPosts`, closes modal |

**Estimated effort:** Medium-high. Requires mocking `apiFetch`, `allPosts` state, and DOM.

---

### Priority 8 — Rendering functions (`07-post-load.js`)

At ~988 lines, this is the largest file. Rendering bugs are visible but hard to catch without snapshot tests.

| What to test | Approach |
|---|---|
| `renderStats` — counter calculations | Unit test the counting logic (extract from DOM writes) |
| `renderTasks` — role-based bucket filtering | Verify correct posts appear in each bucket per role |
| `renderPipeline` — stage grouping | Verify posts are grouped by `PIPELINE_ORDER` |
| `renderUpcoming` — date sorting and "days until" | Verify sort order and relative date display |
| `filterLibrary` — stage/pillar filters | Verify filtering logic returns correct subsets |

**Estimated effort:** High. These functions are tightly coupled to the DOM. Recommend extracting data-transformation logic into testable pure functions and testing those.

---

## XSS Security Testing

The `esc()` function is used throughout for HTML escaping. A dedicated test should verify:

- All five character replacements work (`& < > " '`)
- `null`, `undefined`, and numeric inputs don't throw
- Nested/double escaping doesn't occur
- Template literals in `_buildDesignBlock`, `_buildPCSGrid`, etc. consistently use `esc()` for user data

---

## Summary Table

| Priority | Area | Files | Effort | Impact |
|---|---|---|---|---|
| 1 | Pure utility functions | `01-config`, `05-api`, `10-ui` | Low | High — catches regressions in core logic |
| 2 | Config integrity | `01-config` | Low | High — prevents silent data bugs |
| 3 | API layer | `05-api` | Medium | Critical — single point of failure |
| 4 | Auth flow | `03-auth` | Medium-high | Critical — lockouts, session bugs |
| 5 | Drafts & post creation | `06-post-create` | Medium | Medium — data loss prevention |
| 6 | Routing | `04-router` | Medium | High — blank screen prevention |
| 7 | Stage workflow | `08-post-actions` | Medium-high | High — core business logic |
| 8 | Rendering | `07-post-load` | High | Medium — visual bugs |

## Implementation Status

### Completed

- [x] `npm init` + Vitest + jsdom installed
- [x] `tests/` directory created with 3 test files (47 tests)
- [x] **Priority 1 — Pure utility functions** (`tests/utils.test.js`): `getTitle`, `getPostId`, `parseDate`, `formatDate`, `esc`, `timeAgo`
- [x] **Priority 1 — API normalise** (`tests/normalise.test.js`): field mapping, defaults, fallbacks, non-array input
- [x] **Priority 2 — Config integrity** (`tests/config.test.js`): `stageStyle` + structural validation of `STAGE_META`/`STAGES_DB`/`PIPELINE_ORDER`/`ROLE_STAGES`/`ROLE_BUCKETS`/`STRIP_STAGES`/`PILLARS_DB`
- [x] **Shared utilities extracted** to `utils.js` (removed duplicates from `10-ui.js` and `08-post-actions.js`)
- [x] **GitHub Actions CI** workflow (`.github/workflows/test.yml`) runs tests on push/PR

### Remaining (Priority 3+)

- [ ] Priority 3 — API layer (`apiFetch` with fetch mocking)
- [ ] Priority 4 — Auth flow (OTP, session refresh, logout)
- [ ] Priority 5 — Post creation & draft management
- [ ] Priority 6 — Routing
- [ ] Priority 7 — Stage workflow (`quickStage`, optimistic update + rollback)
- [ ] Priority 8 — Rendering (extract data-transformation logic into testable pure functions)
