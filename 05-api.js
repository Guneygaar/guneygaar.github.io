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
    ...extra,
  };
}

async function apiFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: getAuthHeaders(options.headers || {}),
  });

  // 401: attempt one silent token refresh then retry.
  // IMPORTANT: never call logout() here — a single 401 can be a transient
  // Supabase blip, an RLS policy, or a multi-tab token race. Killing the
  // session on any 401 is the #1 cause of unexpected logouts.
  if (res.status === 401) {
    const newToken = await refreshSession();
    if (newToken) {
      const retry = await fetch(url, {
        ...options,
        headers: getAuthHeaders(options.headers || {}),
      });
      if (retry.ok) {
        const text = await retry.text();
        return text ? JSON.parse(text) : [];
      }
      // Refresh worked but the endpoint still rejected — likely RLS, not auth.
      // Throw so the caller can handle it, but do NOT logout.
      const body = await retry.text().catch(() => '');
      throw new Error(`Supabase ${retry.status}: ${body}`);
    }
    // Refresh failed — token might be genuinely expired.
    // Show a soft session-expired notification without destroying tokens.
    // The user can manually log out or refresh the page.
    console.warn('apiFetch: 401 and refresh failed — session may have expired');
    showErrorBanner(
      'Your session may have expired.',
      'Please refresh the page to log in again.'
    );
    throw new Error('Supabase 401: session expired');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

function normalise(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({
    title:         r.title          || '',
    stage:         r.stage          || '',
    owner:         r.owner          || '',
    contentPillar: r.content_pillar || '',
    location:      r.location       || '',
    targetDate:    r.target_date    || '',
    postLink:      r.post_link      || '',
    comments:      r.comments       || '',
    format:        r.format         || '',
    post_id:       r.post_id        || r.id || '',
    created_at:    r.created_at     || '',
    updated_at:    r.updated_at     || '',
    ...r,
  }));
}

async function uploadPostAsset(file, postId) {
  const ext      = file.name.split('.').pop();
  const filename = `${postId}/${Date.now()}.${ext}`;
  const url      = `${SUPABASE_URL}/storage/v1/object/post-assets/${filename}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type':  file.type,
      'Cache-Control': '3600',
    }),
    body: file,
  });
  if (!res.ok) throw new Error(`Upload ${res.status}`);
  return `${SUPABASE_URL}/storage/v1/object/public/post-assets/${filename}`;
}

async function logActivity({ post_id, actor_name, actor_role, action }) {
  try {
    await apiFetch('/activity_log', {
      method: 'POST',
      body: JSON.stringify({
        post_id:    post_id    || null,
        actor:      actor_name || 'Unknown',
        action:     action     || '',
        created_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn('logActivity failed:', err);
  }
}
