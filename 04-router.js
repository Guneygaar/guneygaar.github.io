/* ===============================================
   04-router.js - App entry point (loads LAST)
=============================================== */

async function _startRouter() {
  const pathMatch = window.location.pathname.match(/^\/p\/(.+)/);
  if (pathMatch) { showApprovalView(decodeURIComponent(pathMatch[1])); return; }

  const params       = new URLSearchParams(window.location.search);
  const approveShort = params.get('approve');
  const action       = params.get('action');
  const ref          = params.get('ref');

  if (approveShort) { showApprovalView(approveShort); return; }
  if (action === 'viewApproval' && ref) {
    showApprovalView(ref.replace(/-gbl$/i, '')); return;
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
  const savedRole    = localStorage.getItem('gbl_role');
  const refreshToken = localStorage.getItem('sb_refresh_token');

  if (savedRole && (savedToken || refreshToken)) {
    // Try to refresh the session silently first
    if (refreshToken) {
      const newToken = await refreshSession();
      if (newToken) {
        activateRole(savedRole);
        return;
      }
    }
    if (savedToken) {
      activateRole(savedRole);
      return;
    }
  }

  showLoginOverlay();
}

// With defer, DOMContentLoaded may already have fired by the time this script
// runs. Check readyState and invoke immediately if so, otherwise wait.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _startRouter);
} else {
  _startRouter();
}
