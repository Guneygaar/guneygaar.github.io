/* ═══════════════════════════════════════════════
   04-router.js — App entry point (loads LAST)
   Stable router with single-run protection
═══════════════════════════════════════════════ */

let _routerStarted = false;

async function _startRouter() {

  if (_routerStarted) return;
  _routerStarted = true;

  try {

    /* -------------------------------
       1. Direct approval links
    -------------------------------- */

    const pathMatch = window.location.pathname.match(/^\/p\/(.+)/);
    if (pathMatch) {
      showApprovalView(decodeURIComponent(pathMatch[1]));
      return;
    }

    const params       = new URLSearchParams(window.location.search);
    const approveShort = params.get('approve');
    const action       = params.get('action');
    const ref          = params.get('ref');

    if (approveShort) {
      showApprovalView(approveShort);
      return;
    }

    if (action === 'viewApproval' && ref) {
      showApprovalView(ref.replace(/-gbl$/i, ''));
      return;
    }

    /* -------------------------------
       2. Magic link login
    -------------------------------- */

    const hash = window.location.hash;

    if (hash && hash.includes('access_token=')) {

      const hashParams = new URLSearchParams(hash.slice(1));
      const token   = hashParams.get('access_token');
      const refresh = hashParams.get('refresh_token');

      if (token) {

        if (refresh) {
          localStorage.setItem('sb_refresh_token', refresh);
        }

        handleMagicLinkToken(token);
        return;
      }
    }

    /* -------------------------------
       3. Existing session
    -------------------------------- */

    const savedToken   = localStorage.getItem('sb_access_token');
    const savedRole    = localStorage.getItem('gbl_role');
    const refreshToken = localStorage.getItem('sb_refresh_token');

    if (savedRole && (savedToken || refreshToken)) {

      if (refreshToken) {

        try {

          const newToken = await refreshSession();

          if (newToken) {

            activateRole(savedRole);

            if (typeof loadPosts === 'function') {
              await loadPosts();
            }

            if (typeof startRealtime === 'function') {
              startRealtime();
            }

            return;
          }

        } catch (err) {
          console.warn('Session refresh failed');
        }
      }

      if (savedToken) {

        activateRole(savedRole);

        if (typeof loadPosts === 'function') {
          await loadPosts();
        }

        if (typeof startRealtime === 'function') {
          startRealtime();
        }

        return;
      }
    }

    /* -------------------------------
       4. No session
    -------------------------------- */

    showLoginOverlay();

  } catch (err) {

    console.error('Router startup failed', err);
    showLoginOverlay();

  }

}

/* --------------------------------
   Safe DOM start
-------------------------------- */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _startRouter);
} else {
  _startRouter();
}
