/* ===============================================
   03-auth.js - Authentication & role activation
   Uses 6-digit OTP code (no magic links)
=============================================== */
console.log("LOADED:", "03-auth.js");

function normalizeRole(r) {
  if (!r) return null;
  var map = {
    pranav: 'Creative',
    chitra: 'Servicing',
    shubham: 'Admin',
    manisha: 'Client',
    shivangini: 'Client',
    creative: 'Creative',
    servicing: 'Servicing',
    admin: 'Admin',
    client: 'Client'
  };
  return map[String(r).toLowerCase()] || r;
}
window.normalizeRole = normalizeRole;

function _normaliseRole(r) {
  if (!r) return 'Admin';
  var map = {
    'admin': 'Admin',
    'servicing': 'Servicing',
    'creative': 'Creative',
    'client': 'Client',
    'pranav': 'Pranav',
    'chitra': 'Chitra'
  };
  return map[r.toLowerCase()] || r;
}

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
  clearInterval(window._clientDataTimer); window._clientDataTimer = null;
  clearInterval(window._clientTokenTimer); window._clientTokenTimer = null;
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
    return new Promise(function(resolve) {
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
          // Other tab may have crashed — fall through to own refresh
          _doRefresh(refreshToken).then(resolve);
        }
      }, 300);
    });
  }

  _refreshInProgress = _doRefresh(refreshToken);
  try {
    return await _refreshInProgress;
  } finally {
    _refreshInProgress = null;
  }
}

async function _doRefresh(refreshToken) {
  try {
    localStorage.setItem('_srtd_refresh_lock', String(Date.now()));
    var res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { error: 'auth_expired' };
    }
    if (!res.ok) {
      return { error: 'server' };
    }
    var data = await res.json();
    if (data.access_token) {
      localStorage.setItem('sb_access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('sb_refresh_token', data.refresh_token);
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
  } finally {
    localStorage.removeItem('_srtd_refresh_lock');
  }
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
    const errMsg = document.getElementById('login-error');
    if (errMsg) errMsg.textContent = err.message || 'Could not send code. Try again.';
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
      `${SUPABASE_URL}/rest/v1/user_roles?email=eq.${encodeURIComponent(email)}&select=role,name&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` } }
    );
    const roleData = await roleRes.json();
    const role = Array.isArray(roleData) && roleData[0]?.role;
    if (!role) {
      const el = document.getElementById('login-code-error');
      if (el) el.textContent = `No role found for ${email}. Ask your admin.`;
      return;
    }
    var userName = Array.isArray(roleData) && roleData[0]?.name;
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
  localStorage.removeItem('hinglish_token');
  localStorage.removeItem('sb_access_token');
  localStorage.removeItem('sb_refresh_token');
  localStorage.removeItem('hinglish_pending_email');
  stopRealtime();
  document.getElementById('dashboard-view')?.classList.remove('active');
  document.getElementById('client-view')?.classList.remove('active');
  showLoginOverlay();
}

function activateRole(role) {
  role = normalizeRole(role) || role;
  // Clear stale preview role for non-admin users
  var _dbRole = (role || '').toLowerCase();
  if (_dbRole !== 'admin') {
    localStorage.removeItem('pcs_role_preview');
    window.AppState.user.previewRole = null;
  }

  var rolePreview = localStorage.getItem('pcs_role_preview');
  if (rolePreview && rolePreview !== 'Admin') {
    window.AppState.user.effectiveRole = _normaliseRole(rolePreview);
    window.AppState.user.role = _normaliseRole(rolePreview);
    _buildUserMenu();
    if (typeof switchTab === 'function') switchTab('tasks');
    if (typeof loadPosts === 'function') loadPosts();
    return;
  }

  window.AppState.user.role = role;

  // Client DB role takes absolute priority - real clients always go to client portal
  if ((role || '').toLowerCase() === 'client') {
    window.AppState.user.role = _normaliseRole('Client');
    window.AppState.user.effectiveRole = _normaliseRole('Client');
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
    // Client data poll — 15s interval, same guards as agency startRealtime
    if (!window._clientDataTimer) {
      window._clientDataTimer = setInterval(async function() {
        if (document.hidden) return;
        if (!localStorage.getItem('sb_access_token')) return;
        if (window.AppState.ui.modalOpen) return;
        try {
          if (typeof loadPostsForClient === 'function') loadPostsForClient();
        } catch(err) {
          console.warn('[auth] client data poll failed', err);
          window.logError && window.logError(err && err.message, err && err.stack, 'client-data-poll');
        }
      }, 15000);
    }
    if (!window._clientTokenTimer) {
      window._clientTokenTimer = setInterval(async function() {
        try {
          var result = await refreshSession();
          if (result && result.error === 'auth_expired') {
            _clearSessionAndLogin();
          } else if (result && result.error) {
            console.warn('[auth] client token refresh: ' + result.error);
          }
        } catch(err) {
          console.error('[auth] client token refresh threw', err);
          window.logError && window.logError(err && err.message, err && err.stack, 'client-token-refresh');
        }
      }, 50 * 60 * 1000);
    }
    return;
  }

  // Resolve effectiveRole: Admin can preview other roles via localStorage
  if (role === 'Admin') {
    const preview = localStorage.getItem('pcs_role_preview');
    window.AppState.user.effectiveRole = _normaliseRole((preview && preview !== 'Admin') ? preview : 'Admin');
  } else {
    window.AppState.user.effectiveRole = _normaliseRole(role);
  }
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.add('hidden');
  updateActionButton();
  if (window.AppState.user.effectiveRole === 'Client') {
    document.getElementById('client-view')?.classList.add('active');
    loadPostsForClient();
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

  // Client gets a dedicated slim menu
  if (_roleLower === 'client') {
    html += '<button class="user-menu-item" onclick="openClientRequestForm(); closeUserMenu()" style="color:#C8A84B;">+ New Request</button>';
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

