/* ===============================================
   05-api.js - Supabase REST wrapper
=============================================== */
console.log("LOADED:", "05-api.js");

function getAuthHeaders(extra = {}) {
  const token = localStorage.getItem('sb_access_token');
  return {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${token || SUPABASE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
    'Accept':        'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma':        'no-cache',
    ...extra,
  };
}

async function apiFetch(path, options = {}, meta) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: getAuthHeaders(options.headers || {}),
  });

  // 401: attempt one silent token refresh then retry.
  // IMPORTANT: never call logout() here  -  a single 401 can be a transient
  // Supabase blip, an RLS policy, or a multi-tab token race. Killing the
  // session on any 401 is the #1 cause of unexpected logouts.
  if (res.status === 401) {
    let result = await refreshSession();
    if (result && result.token) {
      const retry = await fetch(url, {
        ...options,
        headers: getAuthHeaders(options.headers || {}),
      });
      if (retry.ok) {
        const text = await retry.text();
        return text ? JSON.parse(text) : [];
      }
      // Refresh worked but the endpoint still rejected  -  likely RLS, not auth.
      // Throw so the caller can handle it, but do NOT logout.
      const body = await retry.text().catch(() => '');
      throw new Error(`Supabase ${retry.status}: ${body}`);
    }

    // FIX 5: Retry refresh once on server/network errors before surrendering.
    // A single transient hiccup (cellular handoff, Supabase blip) should not
    // force the user into the error banner. Runs BEFORE the existing
    // auth_expired / soft-banner branches below.
    if (result && (result.error === 'server' || result.error === 'network')) {
      await new Promise(function(r) { setTimeout(r, 1500); });
      let retryRefresh = null;
      try { retryRefresh = await refreshSession(); } catch(e) {}
      if (retryRefresh && retryRefresh.token) {
        const retryHeaders = getAuthHeaders(options && options.headers ? options.headers : {});
        const retryOpts = {};
        for (const k in options) { if (options.hasOwnProperty(k)) retryOpts[k] = options[k]; }
        retryOpts.headers = retryHeaders;
        const retryRes = await fetch(url, retryOpts);
        if (retryRes.ok) {
          const retryText = await retryRes.text();
          return retryText ? JSON.parse(retryText) : [];
        }
      }
      // If the second-chance refresh returned auth_expired, promote the
      // classification so the branches below take the right action.
      if (retryRefresh && retryRefresh.error === 'auth_expired') {
        result = retryRefresh;
      }
      // Otherwise fall through to the existing soft-banner/throw path.
    }

    // Refresh failed  -  branch on error type
    if (result && result.error === 'auth_expired') {
      // FIX 3: Background pollers (notif badge, click log, realtime polls)
      // pass { allowLogout: false } and must NOT kick the user out. Only
      // user-initiated actions are allowed to force the login overlay.
      if (!meta || meta.allowLogout !== false) {
        // Genuine auth expiry — clear tokens and force re-login
        if (typeof _clearSessionAndLogin === 'function') _clearSessionAndLogin();
      }
      throw new Error('Supabase 401: session expired');
    }
    // Network or server error — do NOT clear tokens, show soft banner
    console.warn('apiFetch: 401 and refresh failed (' + (result && result.error) + ')');
    showErrorBanner(
      'Connection issue  -  retrying.',
      'Check your internet and try again.'
    );
    throw new Error('Supabase 401: refresh ' + (result && result.error));
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// withRetry — thin one-shot recovery wrapper for transient Supabase
// auth/network hiccups ahead of the Mumbai region migration. On the
// FIRST failure, inspects the error message; if transient (401,
// session expired, Failed to fetch, Load failed, NetworkError, or a
// post-refresh "server"/"network" classification surfaced by apiFetch),
// forces ONE explicit refreshSession() and replays fn exactly once. If
// that refresh itself hit a 500 (server) or network blip, waits 500ms
// and retries the refresh once before replaying fn. On final failure,
// rethrows — the caller's existing try/catch or .catch() path still
// logs to error_log unchanged.
async function withRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    const msg = (err && err.message) || '';
    const transient =
      /401|session expired|Failed to fetch|Load failed|NetworkError|refresh server|refresh network/i
        .test(msg);
    if (!transient) throw err;
    let r = null;
    try { r = await refreshSession(); } catch (e) { /* swallow */ }
    if (r && (r.error === 'server' || r.error === 'network')) {
      await new Promise(function(res) { setTimeout(res, 500); });
      try { r = await refreshSession(); } catch (e) { /* swallow */ }
    }
    return await fn();
  }
}
window.withRetry = withRetry;

function normalise(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({
    ...r,
    title:         r.title          || '',
    stage:         (r.stage || '').toLowerCase().trim().replace(/\s+/g, '_'),
    owner:         r.owner          || '',
    contentPillar: (r.content_pillar || '').toLowerCase().trim(),
    location:      r.location       || '',
    targetDate:    r.target_date    || '',
    postLink:      r.canva_link     || '',
    linkedinUrl:   r.linkedin_link  || '',
    caption:       r.caption        || '',
    client_feedback: r.client_feedback || '',
    images:        Array.isArray(r.images) ? r.images : (r.images ? [r.images] : []),
    format:        r.format         || '',
    post_id:       r.post_id        || r.id || '',
    created_at:    r.created_at     || '',
    updated_at:    r.updated_at     || '',
    caption:       r.caption        || '',
  }));
}

async function _compressImage(file) {
  return new Promise(function(resolve) {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var MAX_W = 1200;
        var MAX_H = 1200;
        var w = img.width;
        var h = img.height;
        if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
        if (h > MAX_H) { w = Math.round(w * MAX_H / h); h = MAX_H; }
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) {
          var compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
          resolve(compressed);
        }, 'image/jpeg', 0.82);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadPostAsset(file, postId) {
  file = await _compressImage(file);
  var ext = file.name.split('.').pop();
  var filename = 'post-assets/' + postId + '/' + Date.now() + '.' + ext;
  var workerUrl = 'https://srtd-r2-upload.ksg-kumarshubhamgune.workers.dev/upload'
    + '?filename=' + encodeURIComponent(filename);
  var res = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      'X-Upload-Secret': 'srtd2026xK9mN3pQ',
    },
    body: file,
  });
  if (!res.ok) throw new Error('Upload ' + res.status);
  var data = await res.json();
  return data.url;
}

// Fetches the workspaces row for the active workspace and stashes
// the result on window.AppState.workspace so every AI feature gate can
// read it without making a network call. Called once from activateRole()
// (03-auth.js) right after the post-login token refresh timer is wired,
// BEFORE any render function runs. Fire-and-forget: never blocks login,
// never shows a toast, and swallows errors into an empty object so the
// app degrades gracefully if workspaces is unreachable. Slug-keyed for now
// — workspace.id (uuid) is the stable identity column for child writes.
async function loadWorkspaceSettings() {
  try {
    const rows = await withRetry(function() { return apiFetch(
      '/workspaces?slug=eq.default&select=*&limit=1',
      {},
      { allowLogout: false }
    ); });
    window.AppState.workspace = (Array.isArray(rows) && rows[0]) ? rows[0] : {};
  } catch (err) {
    window.AppState.workspace = window.AppState.workspace || {};
    window.logError && window.logError(err && err.message, err && err.stack, 'load-workspace-settings');
  }
}

async function logActivity({ post_id, actor, actor_role, action, old_stage, new_stage }) {
  console.log('[logActivity] called:', { post_id, actor, action, old_stage, new_stage });
  var token = localStorage.getItem('sb_access_token');
  if (!token) { console.log('[logActivity] SKIPPED - no auth token'); return; }
  try {
    await apiFetch('/activity_log', {
      method: 'POST',
      body: JSON.stringify({
        post_id:    post_id || null,
        actor:      actor   || 'Unknown',
        action:     action  || '',
        created_at: new Date().toISOString(),
        old_stage:  old_stage || null,
        new_stage:  new_stage || null,
      }),
    });
    console.log('[logActivity] SUCCESS:', post_id, action);
  } catch (err) {
    console.warn('[logActivity] FAILED:', post_id, action, err.message || err);
    window.logError && window.logError(err && err.message, err && err.stack, 'log-activity');
  }
}
