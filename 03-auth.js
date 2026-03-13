/* ═══════════════════════════════════════════════
   03-auth.js — Authentication & role activation
═══════════════════════════════════════════════ */

function showLoginOverlay() {
  document.getElementById('login-overlay').classList.remove('hidden');
  backToEmail();
}

function backToEmail() {
  document.getElementById('login-email-step').classList.add('active');
  document.getElementById('login-sent-step').classList.remove('active');
  document.getElementById('login-verify-step').classList.remove('active');
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
      body: JSON.stringify({
        email,
        create_user: false,
        options: { emailRedirectTo: APP_URL }
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error_description || err.msg || 'Send failed');
    }
    document.getElementById('login-sent-email').textContent = email;
    document.getElementById('login-email-step').classList.remove('active');
    document.getElementById('login-sent-step').classList.add('active');
  } catch (err) {
    document.getElementById('login-error').textContent = err.message || 'Could not send link. Try again.';
    btn.disabled = false;
    btn.textContent = 'Send Login Link →';
  }
};

async function handleMagicLinkToken(accessToken) {
  document.getElementById('login-overlay').classList.remove('hidden');
  ['login-email-step','login-sent-step'].forEach(id =>
    document.getElementById(id).classList.remove('active'));
  document.getElementById('login-verify-step').classList.add('active');

  try {
    console.log('[GBL Auth] Fetching user from Supabase...');
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` },
    });
    const user = await userRes.json();
    localStorage.setItem("sb_access_token", accessToken);
    console.log('[GBL Auth] User response:', user);

    const email = (user.email || '').toLowerCase().trim();
    if (!email) throw new Error('No email returned from Supabase auth');
    console.log('[GBL Auth] Email detected:', email);

    console.log('[GBL Auth] Querying user_roles table...');
    let roles = null;
    let roleRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_roles?select=role,email&limit=10`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` } }
    );
    let roleData = await roleRes.json();
    console.log('[GBL Auth] All user_roles rows visible to this user:', roleData);

    if (Array.isArray(roleData) && roleData.length > 0) {
      const match = roleData.find(r => (r.email||'').toLowerCase().trim() === email);
      if (match) roles = [match];
    }

    if (!roles || !roles.length) {
      console.log('[GBL Auth] No match yet — trying direct email filter with anon key...');
      const fallbackRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_roles?email=ilike.${encodeURIComponent(email)}&select=role&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const fallbackData = await fallbackRes.json();
      console.log('[GBL Auth] Fallback query result:', fallbackData);
      if (Array.isArray(fallbackData) && fallbackData.length > 0) roles = fallbackData;
    }

    const role = roles?.[0]?.role;
    console.log('[GBL Auth] Final role resolved:', role);

    if (!role) {
      console.warn('[GBL Auth] No role found for email:', email);
      document.getElementById('login-verify-step').innerHTML =
        `<div style="text-align:center;padding:var(--sp-6) 0;color:var(--c-red)">
           No role assigned for <strong>${email}</strong>.<br>
           <span style="font-size:13px;color:var(--text3)">Ask your admin to add you to user_roles.</span>
           <br><br>
           <button class="btn-modal-ghost" onclick="backToEmail()">← Try again</button>
         </div>`;
      return;
    }

    localStorage.setItem('gbl_role', role);
    localStorage.setItem('gbl_email', email);
    localStorage.setItem('gbl_token', accessToken);
    document.getElementById('login-overlay').classList.add('hidden');
    history.replaceState(null, '', window.location.pathname + window.location.search);
    console.log('[GBL Auth] Activating role:', role);
    activateRole(role);

  } catch (err) {
    console.error('[GBL Auth] Error during login:', err);
    document.getElementById('login-verify-step').innerHTML =
      `<div style="text-align:center;padding:var(--sp-6) 0;color:var(--c-red)">
         Sign-in failed: ${err.message}<br><br>
         <button class="btn-modal-ghost" onclick="backToEmail()">← Try again</button>
       </div>`;
  }
}

function logout() {
  localStorage.removeItem('gbl_role');
  localStorage.removeItem('gbl_email');
  localStorage.removeItem('gbl_token');
  stopRealtime();
  document.getElementById('dashboard-view').classList.remove('active');
  document.getElementById('client-view').classList.remove('active');
  showLoginOverlay();
}

function activateRole(role) {
  currentRole = role;
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
