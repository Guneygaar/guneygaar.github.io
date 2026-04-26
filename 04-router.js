/* ===============================================
   04-router.js - App entry point (loads LAST)
=============================================== */
console.log("LOADED:", "04-router.js");

async function _startRouter() {
  const pathMatch = window.location.pathname.match(/^\/p\/(.+)/);
  if (pathMatch) { showApprovalView(decodeURIComponent(pathMatch[1])); return; }

  const params       = new URLSearchParams(window.location.search);
  const approveShort = params.get('approve');
  const action       = params.get('action');
  const ref          = params.get('ref');

  if (approveShort) { showApprovalView(approveShort); return; }
  if (action === 'viewApproval' && ref) {
    showApprovalView(ref.replace(/-hinglish$/i, '')); return;
  }

  const openPost = params.get('open');
  // Plan React deep-link routing. When ?plan_react=1 is set, route the
  // ?open=POST_ID through the React PCS bridge (regular posts) or the
  // vanilla _openBriefSheet (briefs above Plan z-index 1400; brief sheet
  // is z-index 9500). Vanilla drain in 07-post-load.js renderAll would
  // open vanilla openPCS UNDERNEATH Plan, which is wrong. So we skip
  // setting window._pendingOpenPost for the plan_react case; instead we
  // queue into window._planReactPendingOpen and let srtd-next/src/index.jsx
  // drain it after mount (race-safe vs activateRole + React mount).
  let _planReactOn = false;
  try { _planReactOn = params.get('plan_react') !== '0'; } catch (e) {}
  if (openPost && _planReactOn) {
    window._planReactPendingOpen = openPost;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('open');
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  } else if (openPost) {
    window._pendingOpenPost = openPost;
  }

  const hash = window.location.hash;
  if (hash && hash.includes('access_token=')) {
    const hashParams = new URLSearchParams(hash.slice(1));
    const token = hashParams.get('access_token');
    const refresh = hashParams.get('refresh_token');
    if (token) {
      if (refresh) localStorage.setItem('sb_refresh_token', refresh);
      handleMagicLinkToken(token);
      return;
    }
  }

  const savedToken   = localStorage.getItem('sb_access_token');
  const savedRole    = localStorage.getItem('hinglish_role');
  const refreshToken = localStorage.getItem('sb_refresh_token');

  if (savedRole && (savedToken || refreshToken)) {
    var savedName = localStorage.getItem('hinglish_name');
    if (savedName) window.AppState.user.name = savedName;
    var savedEmail = localStorage.getItem('hinglish_email');
    if (savedEmail) window.AppState.user.email = savedEmail;
    if (savedRole) window.AppState.user.effectiveRole = savedRole;
    // Try to refresh the session silently first.
    //
    // NOTE: activateRole() already calls fetchProfiles() internally on
    // every branch (client, agency, admin, preview). The duplicate
    // fetchProfiles() calls that used to live in this function after
    // activateRole() were firing /profiles TWICE on
    // every session resume — removed now that activateRole() owns the
    // profile-cache warmup for all paths.
    if (refreshToken) {
      const result = await refreshSession();
      if (result && result.token) {
        activateRole(savedRole);
        window._authReady = true;
        return;
      }
      if (result && result.error === 'auth_expired') {
        // Genuine expiry — clear and show login
        if (typeof _clearSessionAndLogin === 'function') _clearSessionAndLogin();
        window._authReady = true;
        return;
      }
      // Network/server error — keep tokens, try with stale token
      if (savedToken) {
        activateRole(savedRole);
        window._authReady = true;
        return;
      }
      // No saved token and refresh failed with network error — show soft banner
      showErrorBanner('Connection issue', 'Check your internet and try again.');
      showLoginOverlay();
      window._authReady = true;
      return;
    }
    if (savedToken) {
      activateRole(savedRole);
      window._authReady = true;
      return;
    }
  }

  showLoginOverlay();
  window._authReady = true;
}

// With defer, DOMContentLoaded may already have fired by the time this script
// runs. Check readyState and invoke immediately if so, otherwise wait.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _startRouter);
} else {
  _startRouter();
}
