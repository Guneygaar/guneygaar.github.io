# SORTED — Codebase Architecture Guide
# For Claude Code — Read this first on every session

## TECH STACK
- Vanilla JS frontend
- Supabase backend (REST API via apiFetch)
- GitHub Pages deployment (Guneygaar/guneygaar.github.io, main/root branch)
- Cloudflare CDN + Workers + KV + R2
- No build step. No bundler. Raw JS files.

## FILE ARCHITECTURE

### Core files (load order matters):
- 00-appstate.js — AppState brain (loads FIRST)
- 00-appstate-compat.js — illegal access guards (loads SECOND)
- 01-config.js — constants and config
- 02-session.js — session initialization
- 03-auth.js — authentication and role management
- 04-router.js — routing and session restore
- 05-api.js — apiFetch wrapper
- 06-post-create.js — post creation
- 07-post-load.js — post fetching and rendering engine
- 08-post-actions.js — post actions (stage changes etc)
- 09-library.js — library view
- 09-approval.js — approval flow
- 10-ui.js — UI utilities and notifications
- utils.js — shared utilities
- render/dashboard.js — dashboard rendering
- render/client.js — client feed rendering
- render/pipeline.js — pipeline rendering
- render/brief.js — brief rendering
- actions/pcs.js — Post Card System (PCS) overlay

## APPSTATE — SINGLE SOURCE OF TRUTH

All state lives in window.AppState. Never use bare globals.

### Structure:
window.AppState = {
  user: {
    name,           // was: currentUserName
    email,          // was: currentUserEmail
    role,           // was: currentRole
    effectiveRole,  // was: effectiveRole
    previewRole     // was: _previewRole
  },
  posts: {
    all,            // was: allPosts — READ ONLY via .find/.filter/.map
    cached,         // was: cachedPosts
    loaded,         // was: _postsLoaded
    setAll(posts)   // ONLY way to write posts — enforces immutability
  },
  pcs: {
    open, postId, post, editingTarget,
    closeTimer, pendingComment,
    lightbox: { images, index },
    activeMenu      // was: _pcsActiveMenu
  },
  ui: {
    modalOpen,      // was: _modalOpen
    unreadCount,    // was: _unreadCount
    deferredRender, activeTab, taskFilter,
    pipelineFilter, nrsUrgency,
    retryCount, retryTimer, realtimeTimer
  },
  timers: {
    tokenRefresh,   // was: _tokenRefreshTimer
    dashDatetime,
    renderTimer     // was: _renderTimer
  }
};

### MUTATION RULES (CRITICAL):
Never mutate AppState.posts.all directly.
Always use setAll with immutable patterns:

// Add a post:
window.AppState.posts.setAll(
  window.AppState.posts.all.concat([newPost])
);

// Remove a post:
window.AppState.posts.setAll(
  window.AppState.posts.all.filter(p => getPostId(p) !== postId)
);

// Update a post property:
window.AppState.posts.setAll(
  window.AppState.posts.all.map(function(p) {
    return getPostId(p) === postId
      ? Object.assign({}, p, { stage: 'published' })
      : p;
  })
);

// NEVER do this:
window.AppState.posts.all.push(post)     // ILLEGAL
window.AppState.posts.all[idx].x = y    // ILLEGAL
window.AppState.posts.all.splice(idx,1) // ILLEGAL

## DESIGN SYSTEM
- Zero border-radius on inputs/buttons
- No rgba for text or borders — solid hex only
- Fonts: IBM Plex Mono (mono), DM Sans (sans)
- Text: #E8E8E8 (primary), #AEAEB2 (secondary), #8E8E93 (tertiary)
- Backgrounds: #080808 (app), #191924 (comments)
- Gold: #C8A84B | Red: #FF4B4B | Green: #3ECF8E | Purple: #9b87f5
- Owner colors: Chitra=#22D3EE, Pranav=#9b87f5, Client=#FF4B4B

## DEPLOYMENT RULES
- Version bump ALL 20 ?v= strings together on every deploy
- Purge Cloudflare after every merge
- One PR at a time
- Never revert without checking cache first
- No rgba for text or borders

## TESTING
- 152 Vitest tests (unit)
- Playwright E2E tests
- Run: npx vitest run
- All must pass before merge

## INFRASTRUCTURE
- Supabase: vxokfscjzytpgdrmertk.supabase.co
- R2 bucket: sorted-images
- R2 Worker: srtd-r2-upload.ksg-kumarshubhamgune.workers.dev
- OG Worker: srtd-og-inject
- KV: sorted-whatsapp-previews
- Resend FROM: hinglish@srtd.io

## KNOWN REMAINING LEGACY
- index.html inline script still has:
  window._modalOpen, window._postsLoaded,
  window.allTasks, window._pcsNoteVisibility
  (to be migrated in future PRs)
- tests/e2e/client-feed.spec.js still references
  window.allPosts (e2e test — low priority)
