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
  // IMPORTANT: never call logout() here  -  a single 401 can be a transient
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
      // Refresh worked but the endpoint still rejected  -  likely RLS, not auth.
      // Throw so the caller can handle it, but do NOT logout.
      const body = await retry.text().catch(() => '');
      throw new Error(`Supabase ${retry.status}: ${body}`);
    }
    // Refresh failed  -  token might be genuinely expired.
    // Show a soft session-expired notification without destroying tokens.
    // The user can manually log out or refresh the page.
    console.warn('apiFetch: 401 and refresh failed  -  session may have expired');
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
    ...r,
    title:         r.title          || '',
    stage:         (r.stage || '').toLowerCase().trim().replace(/\s+/g, '_'),
    owner:         r.owner          || '',
    contentPillar: (r.content_pillar || '').toLowerCase().trim(),
    location:      r.location       || '',
    targetDate:    r.target_date    || '',
    postLink:      r.canva_link     || '',
    linkedinUrl:   r.linkedin_link  || '',
    comments:      r.comments       || '',
    caption:       r.caption        || '',
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
  var publicUrl = `${SUPABASE_URL}/storage/v1/object/public/post-assets/${filename}`;
  try {
    fetch(publicUrl, { method: 'GET', mode: 'no-cors' });
  } catch (e) {}
  return publicUrl;
}

async function logActivity({ post_id, actor, actor_role, action }) {
  try {
    await apiFetch('/activity_log', {
      method: 'POST',
      body: JSON.stringify({
        post_id:    post_id || null,
        actor:      actor   || 'Unknown',
        action:     action  || '',
        created_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn('logActivity failed:', err);
  }
}
