/* ===============================================
   03-auth.js - Authentication & role activation
   Uses 6-digit OTP code (no magic links)
=============================================== */
console.log("LOADED:", "03-auth.js");

function normalizeRole(r) {
  if (!r) return null;
  var map = {
    creative:  'Creative',
    servicing: 'Servicing',
    admin:     'Admin',
    client:    'Client'
  };
  return map[String(r).toLowerCase()] || r;
}
window.normalizeRole = normalizeRole;

let _refreshInProgress = null;

// -- Cross-tab token sync: pick up tokens saved by other tabs --
window.addEventListener('storage', function(e) {
  if (e.key === 'sb_access_token' && !e.newValue) {
    // Another tab cleared the token (logged out or auth_expired)
    if (window._authReady) showLoginOverlay();
  }
});

// Helper: clear all session tokens and show login
function _clearSessionAndLogin() {
  localStorage.removeItem('sb_access_token');
  localStorage.removeItem('sb_refresh_token');
  localStorage.removeItem('hinglish_role');
  localStorage.removeItem('hinglish_email');
  localStorage.removeItem('hinglish_name');
  if (typeof stopRealtime === 'function') stopRealtime();
  if (typeof stopClientRealtime === 'function') stopClientRealtime();
  if (window._tokenRefreshTimer) {
    clearInterval(window._tokenRefreshTimer);
    window._tokenRefreshTimer = null;
  }
  showLoginOverlay();
}
window._clearSessionAndLogin = _clearSessionAndLogin;

async function refreshSession() {
  if (_refreshInProgress) return _refreshInProgress;
  var refreshToken = localStorage.getItem('sb_refresh_token');
  if (!refreshToken) return { error: 'auth_expired' };

  // -- Cross-tab lock: prevent two tabs from using the same refresh token --
  var lockTs = parseInt(localStorage.getItem('_srtd_refresh_lock') || '0', 10);
  if (lockTs && (Date.now() - lockTs) < 10000) {
    // Another tab is refreshing — wait for its result
    _refreshInProgress = new Promise(function(resolve) {
      var oldToken = localStorage.getItem('sb_access_token') || '';
      var attempts = 0;
      var pollId = setInterval(function() {
        attempts++;
        var current = localStorage.getItem('sb_access_token') || '';
        if (current && current !== oldToken) {
          clearInterval(pollId);
          resolve({ token: current });
        } else if (attempts >= 33) { // ~10 seconds at 300ms
          clearInterval(pollId);
          // Other tab may have crashed — fall through to own refresh.
          // Re-read sb_refresh_token from storage in case the other tab
          // rotated it successfully before dying — never use the stale
          // captured value.
          var _freshToken = localStorage.getItem('sb_refresh_token') || refreshToken;
          // Set the lock BEFORE starting our own refresh so concurrent
          // tabs waiting on this same lock slot see it immediately.
          localStorage.setItem('_srtd_refresh_lock', String(Date.now()));
          _doRefresh(_freshToken).then(function(r) {
            localStorage.removeItem('_srtd_refresh_lock');
            resolve(r);
          });
        }
      }, 300);
    });
    _refreshInProgress = _refreshInProgress.finally(function() { _refreshInProgress = null; });
    return _refreshInProgress;
  }

  // Close the race window: SET the cross-tab lock in the SAME synchronous
  // block as the lockTs read above, BEFORE any await. If the set were
  // inside _doRefresh (after `await`), two tabs could both read lockTs as
  // empty and both call _doRefresh with the same refresh_token, triggering
  // Supabase's refresh-token-reuse revocation. Removing the lock lives in
  // the finally below so it always clears regardless of success/throw.
  localStorage.setItem('_srtd_refresh_lock', String(Date.now()));
  _refreshInProgress = _doRefresh(refreshToken);
  try {
    return await _refreshInProgress;
  } finally {
    _refreshInProgress = null;
    localStorage.removeItem('_srtd_refresh_lock');
  }
}

async function _doRefresh(refreshToken) {
  try {
    var res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    // HTTP 400 from /auth/v1/token is almost always refresh-token REUSE
    // (another tab already rotated this token). The previously-stored
    // sb_access_token is still valid for its TTL window — return it
    // instead of evicting the user. Only a missing access token falls
    // through to auth_expired classification.
    if (res.status === 400) {
      var storedAccess = localStorage.getItem('sb_access_token');
      if (storedAccess) {
        console.warn('[auth] refresh returned 400 (token-reuse race), using stored sb_access_token');
        // Symmetric with the success branch below: push the (peer-rotated)
        // token onto this tab's Realtime WebSocket. Without this, the tab
        // that lost the rotation race keeps its Phoenix socket bound to the
        // JWT it was constructed with; that JWT expires, postgres_changes
        // stop arriving silently (state stays 'joined'), and the UI freezes.
        if (window._supabaseClient &&
            window._supabaseClient.realtime &&
            typeof window._supabaseClient.realtime.setAuth === 'function') {
          try {
            window._supabaseClient.realtime.setAuth(storedAccess);
          } catch(e) {
            console.warn('[auth] realtime setAuth failed (400-race)', e);
          }
        }
        return { token: storedAccess };
      }
      return { error: 'auth_expired' };
    }

    // 401/403: narrow auth_expired to bodies that carry a refresh_token_*
    // error code. Any other 401/403 (unexpected server responses, edge
    // function hiccups, CORS preflight oddities) are treated as transient
    // server errors and will not evict the user.
    if (res.status === 401 || res.status === 403) {
      var body = await res.json().catch(function() { return {}; });
      var code = ((body && (body.error || body.error_code || body.msg)) || '').toString().toLowerCase();
      if (code.indexOf('refresh_token_not_found') !== -1 ||
          code.indexOf('refresh_token_already_used') !== -1 ||
          code.indexOf('invalid_grant') !== -1 ||
          code.indexOf('refresh_token_expired') !== -1) {
        return { error: 'auth_expired' };
      }
      return { error: 'server' };
    }

    if (!res.ok) {
      return { error: 'server' };
    }
    var data = await res.json();
    if (data.access_token) {
      localStorage.setItem('sb_access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('sb_refresh_token', data.refresh_token);
      if (window._supabaseClient &&
          window._supabaseClient.realtime &&
          typeof window._supabaseClient.realtime.setAuth === 'function') {
        try {
          window._supabaseClient.realtime.setAuth(data.access_token);
        } catch(e) {
          console.warn('[auth] realtime setAuth failed', e);
        }
      }
      return { token: data.access_token };
    }
    return { error: 'server' };
  } catch (err) {
    // TypeError = network/DNS/offline failure
    if (err && err.name === 'TypeError') {
      console.warn('[auth] refreshSession network error', err.message);
      return { error: 'network' };
    }
    console.error('[auth] refreshSession failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'refresh-session');
    return { error: 'network' };
  }
  // Lock set + removal moved to refreshSession() so both operations
  // happen in the same synchronous block as the lockTs read.
}

// -- LAYER 3: visibilitychange — refresh token when app regains focus --
if (!window._visibilityRefreshBound) {
  window._visibilityRefreshBound = true;
  document.addEventListener('visibilitychange', async function() {
    if (document.visibilityState !== 'visible') return;
    if (!window._authReady) return;
    if (window.location.hash.includes('access_token')) return;

    var refreshToken = localStorage.getItem('sb_refresh_token');
    if (!refreshToken) return;
    try {
      var _t = localStorage.getItem('sb_access_token');
      if (_t && JSON.parse(atob(_t.split('.')[1])).exp*1000-Date.now() > 600000) return;
    } catch(e) {}
    var result = await refreshSession();
    if (result && result.error === 'auth_expired') {
      _clearSessionAndLogin();
    }
    // On network/server error — do nothing, keep existing session
    // On success — new token already saved by refreshSession()
  });
}

function showLoginOverlay() {
  const el = document.getElementById('login-overlay');
  if (!el) return;
  el.classList.remove('hidden');
  backToEmail();
}

function backToEmail() {
  document.getElementById('login-email-step')?.classList.add('active');
  document.getElementById('login-code-step')?.classList.remove('active');
  document.getElementById('login-sent-step')?.classList.remove('active');
  document.getElementById('login-verify-step')?.classList.remove('active');
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.textContent = '';
}

window.sendMagicLink = async function sendMagicLink() {
  const email = (document.getElementById('login-email-input')?.value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.textContent = 'Please enter a valid email.';
    return;
  }
  const btn = document.querySelector('#login-email-step .btn-modal-primary');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Sending...';
  const errClr = document.getElementById('login-error');
  if (errClr) errClr.textContent = '';
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, create_user: false }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error_description || err.msg || 'Could not send code');
    }
    localStorage.setItem('hinglish_pending_email', email);
    document.getElementById('login-email-step')?.classList.remove('active');
    const codeStep = document.getElementById('login-code-step');
    if (codeStep) {
      codeStep.classList.add('active');
      const disp = document.getElementById('login-code-email-display');
      if (disp) disp.textContent = email;
      setTimeout(() => document.getElementById('login-code-input')?.focus(), 100);
    }
  } catch (err) {
    var msg;
    if (err && err.name === 'TypeError') {
      msg = 'Unable to reach the server. Check your connection and try again.';
    } else if (err && err.message && err.message.indexOf('31 seconds') !== -1) {
      msg = 'Please wait a moment before requesting another code.';
    } else {
      msg = (err && err.message) || 'Could not send code. Please try again.';
    }
    const errMsg = document.getElementById('login-error');
    if (errMsg) errMsg.textContent = msg;
    window.logError && window.logError(err && err.message, err && err.stack, 'send-magic-link');
    btn.disabled = false;
    btn.textContent = 'Send Code ->';
  }
};

window.verifyOTPCode = async function verifyOTPCode() {
  const email = localStorage.getItem('hinglish_pending_email') || '';
  const code  = (document.getElementById('login-code-input')?.value || '').trim();
  if (!code || code.length < 6) {
    const el = document.getElementById('login-code-error');
    if (el) el.textContent = 'Please enter the 6-digit code.';
    return;
  }
  const btn = document.getElementById('login-verify-code-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Verifying...';
  const errEl = document.getElementById('login-code-error');
  if (errEl) errEl.textContent = '';
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, token: code, type: 'email' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error_description || err.msg || 'Invalid code');
    }
    const data = await res.json();
    const accessToken  = data.access_token;
    const refreshToken = data.refresh_token;
    if (!accessToken) throw new Error('No token returned');
    localStorage.removeItem('sb_access_token');
    localStorage.setItem('sb_access_token', accessToken);
    if (refreshToken) localStorage.setItem('sb_refresh_token', refreshToken);
    localStorage.removeItem('hinglish_pending_email');
    await resolveRoleFromToken(accessToken, email);
  } catch (err) {
    if (errEl) errEl.textContent = err.message || 'Incorrect code - try again.';
    window.logError && window.logError(err && err.message, err && err.stack, 'verify-otp');
    btn.disabled = false;
    btn.textContent = 'Verify ->';
  }
};

async function resolveRoleFromToken(accessToken, email) {
  try {
    const roleRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=role,display_name&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` } }
    );
    const roleData = await roleRes.json();
    const role = Array.isArray(roleData) && roleData[0]?.role;
    if (!role) {
      const el = document.getElementById('login-code-error');
      if (el) el.textContent = `No role found for ${email}. Ask your admin.`;
      return;
    }
    var userName = Array.isArray(roleData) && roleData[0]?.display_name;
    if (userName) window.AppState.user.name = userName;
    if (userName) localStorage.setItem('hinglish_name', userName);
    window.AppState.user.email = email;
    var normalizedRole = normalizeRole(role) || role;
    localStorage.setItem('hinglish_role', normalizedRole);
    localStorage.setItem('hinglish_email', email);
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.classList.add('hidden');
    activateRole(normalizedRole);
  } catch (err) {
    console.error('[auth] resolveRoleFromToken failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'resolve-role-token');
    const el = document.getElementById('login-code-error');
    if (el) el.textContent = 'Login failed - try again.';
  }
}

async function handleMagicLinkToken(accessToken, _retried) {
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      if (!_retried) {
        const result = await refreshSession();
        var newToken = result && result.token;
        if (newToken) { handleMagicLinkToken(newToken, true); return; }
      }
      showLoginOverlay();
      return;
    }
    const user  = await userRes.json();
    const email = (user.email || '').toLowerCase().trim();
    localStorage.setItem('sb_access_token', accessToken);
    await resolveRoleFromToken(accessToken, email);
  } catch (err) {
    console.error('[auth] handleMagicLinkToken failed', err);
    window.logError && window.logError(err && err.message, err && err.stack, 'handle-magic-link');
    showLoginOverlay();
  }
}

function logout() {
  localStorage.removeItem('hinglish_role');
  localStorage.removeItem('hinglish_email');
  localStorage.removeItem('hinglish_name');
  localStorage.removeItem('hinglish_token');
  localStorage.removeItem('sb_access_token');
  localStorage.removeItem('sb_refresh_token');
  localStorage.removeItem('hinglish_pending_email');
  stopRealtime();
  if (typeof stopClientRealtime === 'function') stopClientRealtime();
  if (window._tokenRefreshTimer) {
    clearInterval(window._tokenRefreshTimer);
    window._tokenRefreshTimer = null;
  }
  document.getElementById('dashboard-view')?.classList.remove('active');
  document.getElementById('client-view')?.classList.remove('active');
  showLoginOverlay();
}

function activateRole(role) {
  role = normalizeRole(role) || role;

  // Proactive token refresh for all roles (50 min). Single canonical
  // timer — the legacy AppState.timers.tokenRefresh (07-post-load.js)
  // and window._clientTokenTimer (03-auth.js client branch) duplicates
  // were removed. Installed at the top so every activateRole branch
  // (admin, client, agency, preview) gets the timer before any early
  // return. refreshSession() is internally deduped via _refreshInProgress.
  if (window._tokenRefreshTimer) clearInterval(window._tokenRefreshTimer);
  window._tokenRefreshTimer = setInterval(async function() {
    if (document.hidden) return;
    if (!localStorage.getItem('sb_refresh_token')) return;
    try {
      var r = await refreshSession();
      if (r && r.error === 'auth_expired') {
        if (typeof _clearSessionAndLogin === 'function') _clearSessionAndLogin();
      }
    } catch(e) { console.warn('[auth] Proactive refresh failed:', e); }
  }, 50 * 60 * 1000);

  // Load workspaces row once per session so every AI feature gate
  // (writer / qc / chat / email_brief) can read window.AppState.workspace
  // synchronously without a network call. Fire-and-forget: activateRole
  // continues immediately so the render path is never blocked on it.
  if (typeof loadWorkspaceSettings === 'function') {
    loadWorkspaceSettings();
  }

  // Clear stale preview role for non-admin users
  var _dbRole = (role || '').toLowerCase();
  if (_dbRole !== 'admin') {
    localStorage.removeItem('pcs_role_preview');
    window.AppState.user.previewRole = null;
  }

  var rolePreview = localStorage.getItem('pcs_role_preview');
  if (rolePreview && rolePreview !== 'Admin') {
    window.AppState.user.effectiveRole = normalizeRole(rolePreview) || 'Admin';
    window.AppState.user.role = normalizeRole(rolePreview) || 'Admin';
    _buildUserMenu();
    // Preview branch handles its own fetchProfiles/updateLastActive so
    // 04-router.js can drop its duplicate post-activateRole call. Without
    // these lines, the preview branch would return without populating the
    // profiles cache, breaking avatar rendering across the dashboard.
    if (typeof fetchProfiles === 'function') {
      try { fetchProfiles(); } catch(e) { console.warn('[auth] fetchProfiles error:', e); }
    }
    if (typeof updateLastActive === 'function') {
      try { updateLastActive(); } catch(e) { console.warn('[auth] updateLastActive error:', e); }
    }
    if (typeof switchTab === 'function') switchTab('tasks');
    if (typeof loadPosts === 'function') loadPosts();
    return;
  }

  window.AppState.user.role = role;

  // Client DB role takes absolute priority - real clients always go to client portal
  if ((role || '').toLowerCase() === 'client') {
    window.AppState.user.role = 'Client';
    window.AppState.user.effectiveRole = 'Client';
    var fab = document.getElementById('fab');
    var fab2 = document.getElementById('main-fab-btn');
    var nav = document.getElementById('bottom-nav');
    if (fab) fab.style.display = 'none';
    if (fab2) fab2.style.display = 'none';
    if (nav) nav.style.display = 'none';
    document.body.classList.add('client-mode');
    _buildUserMenu();
    var loginOv = document.getElementById('login-overlay');
    if (loginOv) loginOv.classList.add('hidden');
    document.getElementById('client-view')?.classList.add('active');
    if (typeof loadPostsForClient === 'function') loadPostsForClient();
    if (typeof fetchProfiles === 'function') {
      try { fetchProfiles(); } catch(e) { console.warn('[auth] fetchProfiles error:', e); }
    }
    if (typeof updateLastActive === 'function') {
      try { updateLastActive(); } catch(e) { console.warn('[auth] updateLastActive error:', e); }
    }
    if (typeof startClientRealtime === 'function') startClientRealtime();
    // Proactive token refresh is installed once at the top of
    // activateRole() via window._tokenRefreshTimer — no client-specific
    // timer needed here. The legacy window._clientTokenTimer duplicate
    // was removed so every role goes through one refresh code path.
    return;
  }

  // Resolve effectiveRole: Admin can preview other roles via localStorage
  if (role === 'Admin') {
    const preview = localStorage.getItem('pcs_role_preview');
    window.AppState.user.effectiveRole = normalizeRole((preview && preview !== 'Admin') ? preview : 'Admin') || 'Admin';
  } else {
    window.AppState.user.effectiveRole = normalizeRole(role) || 'Admin';
  }
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.add('hidden');
  updateActionButton();
  if (typeof fetchProfiles === 'function') {
    try { fetchProfiles(); } catch(e) { console.warn('[auth] fetchProfiles error:', e); }
  }
  if (typeof updateLastActive === 'function') {
    try { updateLastActive(); } catch(e) { console.warn('[auth] updateLastActive error:', e); }
  }
  if (window.AppState.user.effectiveRole === 'Client') {
    document.getElementById('client-view')?.classList.add('active');
    loadPostsForClient();
    if (typeof startClientRealtime === 'function') startClientRealtime();
  } else {
    document.getElementById('dashboard-view')?.classList.add('active');
    const lbl = document.getElementById('topbar-role-label');
    if (lbl) lbl.textContent = window.AppState.user.effectiveRole;
    loadPosts();
    loadTasks();
    startRealtime();
    updateNotifBadge();
  }
  // Update dashboard greeting after role is set
  var greetEl = document.getElementById('dash-edition');
  if (greetEl && typeof getDashGreeting === 'function') {
    greetEl.innerHTML = getDashGreeting();
  }
  // Build the : menu contents (role-switch shown only for Admin)
  _buildUserMenu();
  // Update FAB visibility after role change
  setTimeout(function() { if (typeof updateFabVisibility === 'function') updateFabVisibility(); }, 0);

  if ((window.AppState.user.effectiveRole || '').toLowerCase() === 'client') {
    if (typeof switchTab === 'function') switchTab('tasks');
    return;
  }
  if (typeof switchTab === 'function') switchTab('tasks');
}

// Escape failsafe  -  callable from console if UI is ever unreachable
window.resetRolePreview = function() {
  localStorage.removeItem('pcs_role_preview');
  location.reload();
};

function _buildUserMenu() {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  var _roleLower = (window.AppState.user.effectiveRole || window.AppState.user.role || '').toLowerCase();
  let html = '';

  // My Profile item (all roles)
  var _profAv = (typeof renderAvatar === 'function') ? renderAvatar(window.AppState.user.email || '', _roleLower, 20) : '';
  html += '<button class="user-menu-item" onclick="openProfilePanel(); closeUserMenu()">' + _profAv + ' My Profile</button>';
  html += '<button class="user-menu-item" onclick="openScratchpadPanel();closeUserMenu();"><span style="font-size:14px;margin-right:8px;">\uD83D\uDCDD</span> Scratchpad</button>';
  html += '<div class="um-divider"></div>';

  // Client gets a dedicated slim menu
  if (_roleLower === 'client') {
    html += '<button class="user-menu-item" onclick="openClientRequestForm(); closeUserMenu()" style="color:#C8A84B;">+ New Brief</button>';
    html += '<div class="um-divider"></div>';
    html += '<button class="user-menu-item" onclick="toggleTheme(); closeUserMenu()"><span id="theme-icon">\u2600</span> Dark / Light</button>';
    html += '<div class="um-divider"></div>';
    html += '<button class="user-menu-item danger" onclick="logout()" style="color:#FF4B4B;">\u21A9 Sign Out</button>';
    menu.innerHTML = html;
    return;
  }

  // Role-switch section (Admin only) - shown first
  if (window.AppState.user.role === 'Admin' ||
      localStorage.getItem('hinglish_role') === 'Admin' ||
      localStorage.getItem('hinglish_role') === 'admin') {
    const roles = ['Admin', 'Creative', 'Servicing', 'Client'];
    html += '<div class="um-section-label">View</div>';
    html += '<div class="um-role-options">';
    roles.forEach(r => {
      const active = r === window.AppState.user.effectiveRole ? ' active' : '';
      html += `<button class="um-role-btn${active}" onclick="gamSwitchRole('${r}')">${r}</button>`;
    });
    html += '</div><div class="um-divider"></div>';
  }
  // Preferences
  html += '<div class="um-section-label">Preferences</div>';
  html += '<button class="user-menu-item" onclick="toggleTheme(); closeUserMenu()"><span id="theme-icon">\u2600</span> Dark / Light</button>';
  html += '<button class="user-menu-item" id="btn-refresh" onclick="loadPosts(); closeUserMenu()">\u21BA Refresh</button>';
  html += '<div class="um-divider"></div>';
  html += '<button class="user-menu-item danger" onclick="logout()">\u21A9 Sign Out</button>';
  menu.innerHTML = html;
}

function applyRoleVisibility() {
  // All roles see all tabs  -  no role-based filtering
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.style.display = '';
  });
  updateActionButton();
}

function updateActionButton() {
  const btn = document.getElementById('btn-new-post');
  if (!btn) return;
  btn.textContent = window.AppState.user.effectiveRole === 'Client' ? '+ New Request' : '+ New Post';
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var role = (window.AppState.user.effectiveRole ||
      localStorage.getItem('hinglish_role') || '').toLowerCase();
    if (role === 'client') {
      if (typeof switchTab === 'function') switchTab('tasks');
    }
  }, 500);
});

