/* ═══════════════════════════════════════════════
   03-auth.js — Authentication & role activation
   Uses 6-digit OTP code (no magic links)
═══════════════════════════════════════════════ */

async function refreshSession() {
  const refreshToken = localStorage.getItem('sb_refresh_token');
  if (!refreshToken) return null;
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
}

function showLoginOverlay() {
  document.getElementById('login-overlay').classList.remove('hidden');
  backToEmail();
}

function backToEmail() {
  document.getElementById('login-email-step').classList.add('active');
  document.getElementById('login-code-step')?.classList.remove('active');
  document.getElementById('login-sent-step')?.classList.remove('active');
  document.getElementById('login-verify-step')?.classList.remove('active');
  document.getElementById('login-error').textContent = '';
}

window.sendMagicLink = async function sendMagicLink() {
  const email = (document.getElementById('login-email-input').value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    document.getElementById('login-error').textContent = 'Please enter a valid email.';
    return;
  }
  const btn = document.querySelector('#login-email-step .btn-modal-primary');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  document.getElementById('login-error').textContent = '';
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
    // Store email for verification step
    localStorage.setItem('gbl_pending_email', email);
    // Show code entry step
    document.getElementById('login-email-step').classList.remove('active');
    const codeStep = document.getElementById('login-code-step');
    if (codeStep) {
      codeStep.classList.add('active');
      document.getElementById('login-code-email-display').textContent = email;
      setTimeout(() => document.getElementById('login-code-input')?.focus(), 100);
    }
  } catch (err) {
    document.getElementById('login-error').textContent = err.message || 'Could not send code. Try again.';
    btn.disabled = false;
    btn.textContent = 'Send Code →';
  }
};

window.verifyOTPCode = async function verifyOTPCode() {
  const email = localStorage.getItem('gbl_pending_email') || '';
  const code  = (document.getElementById('login-code-input')?.value || '').trim();
  if (!code || code.length < 6) {
    document.getElementById('login-code-error').textContent = 'Please enter the 6-digit code.';
    return;
  }
  const btn = document.getElementById('login-verify-code-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  document.getElementById('login-code-error').textContent = '';
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
    localStorage.removeItem('gbl_pending_email');
    await resolveRoleFromToken(accessToken, email);
  } catch (err) {
    document.getElementById('login-code-error').textContent = err.message || 'Incorrect code — try again.';
    btn.disabled = false;
    btn.textContent = 'Verify →';
  }
};

async function resolveRoleFromToken(accessToken, email) {
  try {
    let roles = null;
    const roleRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_roles?select=role,email&limit=10`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` } }
    );
    const roleData = await roleRes.json();
    if (Array.isArray(roleData) && roleData.length > 0) {
      const match = roleData.find(r => (r.email||'').toLowerCase().trim() === email);
      if (match) roles = [match];
    }
    if (!roles || !roles.length) {
      const fallbackRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_roles?email=ilike.${encodeURIComponent(email)}&select=role&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const fallbackData = await fallbackRes.json();
      if (Array.isArray(fallbackData) && fallbackData.length > 0) roles = fallbackData;
    }
    const role = roles?.[0]?.role;
    if (!role) {
      document.getElementById('login-code-error').textContent =
        `No role found for ${email}. Ask your admin.`;
      return;
    }
    localStorage.setItem('gbl_role', role);
    localStorage.setItem('gbl_email', email);
    document.getElementById('login-overlay').classList.add('hidden');
    activateRole(role);
  } catch (err) {
    document.getElementById('login-code-error').textContent = 'Login failed — try again.';
  }
}

async function handleMagicLinkToken(accessToken) {
  // Legacy support — if someone still has an old magic link
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      const newToken = await refreshSession();
      if (newToken) { handleMagicLinkToken(newToken); return; }
      showLoginOverlay(); return;
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
  localStorage.removeItem('gbl_role');
  localStorage.removeItem('gbl_email');
  localStorage.removeItem('gbl_token');
  localStorage.removeItem('sb_access_token');
  localStorage.removeItem('sb_refresh_token');
  localStorage.removeItem('gbl_pending_email');
  stopRealtime();
  document.getElementById('dashboard-view')?.classList.remove('active');
  document.getElementById('client-view')?.classList.remove('active');
  showLoginOverlay();
}

function activateRole(role) {
  currentRole = role;
       document.getElementById('login-overlay').classList.add('hidden');
  updateActionButton();
  if (role === 'Client') {
    document.getElementById('client-view').classList.add('active');
    loadPostsForClient();
  } else {
    document.getElementById('dashboard-view').classList.add('active');
    document.getElementById('topbar-role-label').textContent = role;
    loadPosts();
    loadTasks();
    startRealtime();
    fetchUnreadCount();
  }
}

function applyRoleVisibility() {
  const allowedTabs = ROLE_TABS[currentRole] || [];
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.style.display = allowedTabs.includes(btn.dataset.tab) ? '' : 'none';
  });
  const activePanelId = document.querySelector('.tab-panel.active')?.id;
  const activeTab = activePanelId ? activePanelId.replace('panel-', '') : '';
  if (!allowedTabs.includes(activeTab) && allowedTabs.length > 0) {
    const firstBtn = document.querySelector(`.tab-btn[data-tab="${allowedTabs[0]}"]`);
    if (firstBtn) switchTab(firstBtn);
  }
  updateActionButton();
}

function updateActionButton() {
  const btn = document.getElementById('btn-new-post');
  if (!btn) return;
  btn.textContent = currentRole === 'Client' ? '+ New Request' : '+ New Post';
}

function handleActionButton() {
  if (currentRole === 'Client') {
    scrollToNewRequest();
  } else {
    openNewPostModal();
  }
}
