/* ===============================================
   03-auth.js - Authentication & role activation
   Uses 6-digit OTP code (no magic links)
=============================================== */
console.log("LOADED:", "03-auth.js");

let _refreshInProgress = null;

async function refreshSession() {
  if (_refreshInProgress) return _refreshInProgress;
  const refreshToken = localStorage.getItem('sb_refresh_token');
  if (!refreshToken) return null;
  _refreshInProgress = (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem('sb_access_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('sb_refresh_token', data.refresh_token);
        return data.access_token;
      }
    } catch (_) {}
    return null;
  })();
  try {
    return await _refreshInProgress;
  } finally {
    _refreshInProgress = null;
  }
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
    localStorage.setItem('sb_access_token', accessToken);
    if (refreshToken) localStorage.setItem('sb_refresh_token', refreshToken);
    localStorage.removeItem('hinglish_pending_email');
    await resolveRoleFromToken(accessToken, email);
  } catch (err) {
    if (errEl) errEl.textContent = err.message || 'Incorrect code - try again.';
    btn.disabled = false;
    btn.textContent = 'Verify ->';
  }
};

async function resolveRoleFromToken(accessToken, email) {
  try {
    const roleRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_roles?email=eq.${encodeURIComponent(email)}&select=role&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` } }
    );
    const roleData = await roleRes.json();
    const role = Array.isArray(roleData) && roleData[0]?.role;
    if (!role) {
      const el = document.getElementById('login-code-error');
      if (el) el.textContent = `No role found for ${email}. Ask your admin.`;
      return;
    }
    localStorage.setItem('hinglish_role', role);
    localStorage.setItem('hinglish_email', email);
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.classList.add('hidden');
    activateRole(role);
  } catch (err) {
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
        const newToken = await refreshSession();
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
  var rolePreview = localStorage.getItem('pcs_role_preview');
  if (rolePreview && rolePreview !== 'Admin') {
    window.effectiveRole = rolePreview;
    window.currentRole = rolePreview;
    if (typeof switchTab === 'function') switchTab('tasks');
    if (typeof loadPosts === 'function') loadPosts();
    return;
  }

  currentRole = role;

  // Client DB role takes absolute priority - real clients always go to client portal
  if ((role || '').toLowerCase() === 'client') {
    window.currentRole = 'Client';
    window.effectiveRole = 'Client';
    var loginOv = document.getElementById('login-overlay');
    if (loginOv) loginOv.classList.add('hidden');
    document.getElementById('client-view')?.classList.add('active');
    if (typeof loadPostsForClient === 'function') loadPostsForClient();
    return;
  }

  // Resolve effectiveRole: Admin can preview other roles via localStorage
  if (role === 'Admin') {
    const preview = localStorage.getItem('pcs_role_preview');
    effectiveRole = (preview && preview !== 'Admin') ? preview : 'Admin';
  } else {
    effectiveRole = role;
  }
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.add('hidden');
  updateActionButton();
  if (effectiveRole === 'Client') {
    document.getElementById('client-view')?.classList.add('active');
    loadPostsForClient();
  } else {
    document.getElementById('dashboard-view')?.classList.add('active');
    const lbl = document.getElementById('topbar-role-label');
    if (lbl) lbl.textContent = effectiveRole;
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
  // Show/hide exit-preview bar
  if (typeof updateExitPreviewBar === 'function') updateExitPreviewBar();
  // Update FAB visibility after role change
  setTimeout(function() { if (typeof updateFabVisibility === 'function') updateFabVisibility(); }, 0);

  if ((window.effectiveRole || '').toLowerCase() === 'client') {
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
  let html = '';
  // Role-switch section (Admin only) - shown first
  if (currentRole === 'Admin' ||
      localStorage.getItem('hinglish_role') === 'Admin' ||
      localStorage.getItem('hinglish_role') === 'admin') {
    const roles = ['Admin', 'Pranav', 'Chitra', 'Client'];
    html += '<div class="um-section-label">View</div>';
    html += '<div class="um-role-options">';
    roles.forEach(r => {
      const active = r === effectiveRole ? ' active' : '';
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
  btn.textContent = effectiveRole === 'Client' ? '+ New Request' : '+ New Post';
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var role = (window.effectiveRole ||
      localStorage.getItem('hinglish_role') || '').toLowerCase();
    if (role === 'client') {
      if (typeof switchTab === 'function') switchTab('tasks');
    }
  }, 500);
});

