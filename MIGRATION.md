# MIGRATION.md — React strangler-fig invariants

**SUNSET CLAUSE.** This file is deleted when all three migrations in the active sequence below are complete: `render/client.js` removed from the repo, the notifications panel React surface shipped and `10-ui.js renderNotifications` removed, and `window.ENABLE_REACT_NEW_POST` on by default with `06-post-create.js` removed.

This file is reference, not status. PR history, current sprint state, and per-fix audit notes do not belong here.

## ACTIVE SEQUENCE (locked)

1. **Client feed** — `render/client.js`, ~3,057 lines. 5-PR strangler-fig: feed shell + post card → composer + comment submit → comment CRUD → overlays → cleanup.
2. **Create Post form** — `06-post-create.js`. Flip `window.ENABLE_REACT_NEW_POST` after the React surface ships and stabilises. Caption Workspace (`srtd-next/src/shared/caption-workspace/`, already React) is the in-form integration point.
3. **Notifications panel** — vanilla `10-ui.js renderNotifications` (v6 redesign). Touches shared 10-ui.js infrastructure (toasts, switchTab, click telemetry, action router); migrate last so the team's React experience is highest before touching cross-cutting code.

## OUT OF SCOPE (do not migrate)

- **Dashboard** — `render/dashboard.js`. Rebuilt fresh as a new React surface on a separate track. Not a strangler-fig migration.
- **Pipeline** — `render/pipeline.js`. Stays vanilla indefinitely.
- **Library** — `09-library.js`. Stays vanilla. Already routes through React PCS via `window.openPCS`.
- **Brief sheet** — `render/brief.js`. Deferred indefinitely. Revisit only after the active sequence ships.
- **Insights** — stays as-is. Not migrated.
- **Foundational plumbing** — `00-appstate.js`, `00-appstate-compat.js`, `01-config.js` through `05-api.js`, `07-post-load.js`, `08-post-actions.js`, `12-profiles.js`. Never migrated. React calls into this layer via the bridge contracts below.

## ALREADY REACT (do not duplicate)

PCS (`srtd-next/src/flows/pcs/`, always-on since #964), Plan (`srtd-next/src/flows/plan/`, shipped #1109), Caption Workspace (`srtd-next/src/shared/caption-workspace/`), PCS History tab (`HistoryFeed.jsx`).

## STRANGLER-FIG INVARIANTS

1. **Both paths must boot.** While any vanilla render file in the active sequence still exists, both vanilla and React paths for that surface must remain functional for the role they serve. A boot-time error in either path is a P0 regression.

2. **No "dead weight" deletions during transition.** If code looks unused, it is not unused until proven so. A previous fix removed a `switchTab('tasks')` call from `activateRole`'s agency tail because it appeared redundant under React. It broke 8 PCS E2E tests on the `?plan_react=0` boot path. Before any deletion: search for the symbol across both `?plan_react=0` and `?plan_react=1` boot paths, and run the full E2E group for the affected role on both flags.

3. **Strangler-fig deletes happen last, in their own PR.** A migration PR adds the React surface and gates it. A separate cleanup PR removes the vanilla equivalent — only after the React surface has shipped, the gate has been on by default for the role for at least one sprint, and no boot path references the old code.

## BRIDGE CONTRACTS — DO NOT MOVE OR RENAME

- **`sorted:role-ready` CustomEvent.** Fired by `_dispatchRoleReady()` in `03-auth.js` at the end of every `activateRole()` branch. React listens via `appState.ts`. Renaming or moving the dispatch breaks all React mounting.
- **`sorted:posts-updated` CustomEvent.** Fired by `mergePosts` in `07-post-load.js` after every `setAll`. React Plan realtime spine subscribes via `srtd-next/src/flows/plan/store/realtimeBridge.js`.
- **`sorted:notifications-updated` CustomEvent.** Fired by `_recomputeBadgeLocal` in `10-ui.js` (single choke point). React subscribes via the same bridge.
- **`window.apiFetch` bridge.** React calls Supabase via `window.apiFetch`, not direct Supabase JS imports. Keeps auth and session handling in one place during transition.
- **CustomEvent dispatch pattern only.** Vanilla→React communication is one-way via CustomEvent. Do not introduce new `window.*` function references that React components call directly. Adds coupling that must be unwound at sunset.

## TEST FLAG CONVENTION

- `?plan_react=1` exercises the React path. `?plan_react=0` exercises the vanilla path.
- E2E admin-flows Group A uses `?plan_react=1`. Group B uses `?plan_react=0`. Never add `?plan_react=0` to Group A tests.
- Every migration PR runs both groups before merge. A regression on either flag blocks merge.

## NEW FILE RULES

- New files in `srtd-next/` are `.ts` or `.tsx` only. No new `.js` or `.jsx`. Strict TypeScript with `allowJs` tolerates legacy JS but does not invite new JS.
- No new files in `render/`. The vanilla render layer is in cleanup, not active development.

## PR SCOPING

- Each migration PR moves one logical surface or sub-surface. The 5-PR client-feed breakdown (feed shell + post card → composer + comment submit → comment CRUD → overlays → cleanup) is the template scope size.
- The cleanup PR (last in any surface's sequence) is the only PR that deletes vanilla code. It does nothing else.
- Migration PRs are prone to "while we're in here" creep. Per the MULTI-FIX PR RULE in CLAUDE.md, every distinct change needs its own justification.
