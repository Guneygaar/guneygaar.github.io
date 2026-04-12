/* ===============================================
   12-profiles.js - Profile data loader & helpers
   Fetches profiles table on login, caches results.
   All helpers are safe to call before cache loads
   (they return graceful fallbacks).
=============================================== */
console.log("LOADED:", "12-profiles.js");

window._profilesCache = null;

async function fetchProfiles() {
  try {
    var rows = await apiFetch('/profiles?select=email,display_name,username,title,avatar_url,status');
    var cache = {};
    if (Array.isArray(rows)) {
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r && r.email) {
          cache[r.email.toLowerCase()] = r;
        }
      }
    }
    window._profilesCache = cache;
    try {
      var rolesRes = await apiFetch('/user_roles?select=email,role,name');
      if (Array.isArray(rolesRes)) {
        var nrc = {};
        for (var j = 0; j < rolesRes.length; j++) {
          var u = rolesRes[j];
          var uRole = (u.role || '').toLowerCase();
          if (u.name) nrc[u.name.toLowerCase()] = uRole;
          if (u.email) nrc[u.email.toLowerCase()] = uRole;
        }
        window._nameToRoleCache = nrc;
      }
    } catch (roleErr) {
      console.warn('[profiles] user_roles fetch failed:', roleErr);
    }
    enrichAppStateUser();
  } catch (err) {
    console.error('[profiles] fetchProfiles failed:', err);
    window._profilesCache = {};
  }
}

function getDisplayName(emailOrName) {
  if (!emailOrName) return 'Unknown';
  var input = String(emailOrName).toLowerCase();
  if (!input) return 'Unknown';
  var cache = window._profilesCache;
  if (cache && cache[input] && cache[input].display_name) {
    return cache[input].display_name;
  }
  if (input.indexOf('@') > -1) {
    var local = input.split('@')[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return emailOrName;
}

function getAvatarUrl(emailOrName) {
  if (!emailOrName) return null;
  var input = String(emailOrName).toLowerCase();
  if (!input) return null;
  var cache = window._profilesCache;
  if (cache && cache[input] && cache[input].avatar_url) {
    return cache[input].avatar_url;
  }
  return null;
}

function getProfileByEmail(email) {
  if (!email) return null;
  var cache = window._profilesCache;
  if (!cache) return null;
  return cache[String(email).toLowerCase()] || null;
}

function updateLastActive() {
  var email = window.AppState && window.AppState.user && window.AppState.user.email;
  if (!email) return;
  apiFetch('/profiles?email=eq.' + encodeURIComponent(email), {
    method: 'PATCH',
    body: JSON.stringify({ last_active_at: new Date().toISOString(), status: 'online' })
  }).catch(function(err) {
    console.error('[profiles] updateLastActive failed:', err);
  });
}

window._nameToRoleCache = {};

function getRoleFor(nameOrEmail) {
  if (!nameOrEmail) return '';
  var key = String(nameOrEmail).toLowerCase();
  if (key === 'admin' || key === 'servicing' || key === 'creative' || key === 'client') return key;
  return (window._nameToRoleCache && window._nameToRoleCache[key]) || '';
}

function enrichAppStateUser() {
  try {
    var email = (window.AppState.user.email || '').toLowerCase();
    if (!email || !window._profilesCache) return;
    var profile = window._profilesCache[email];
    if (!profile) return;
    window.AppState.user.displayName = profile.display_name || window.AppState.user.name || null;
    window.AppState.user.avatarUrl = profile.avatar_url || null;
    window.AppState.user.title = profile.title || null;
    window.AppState.user.username = profile.username || null;
  } catch (err) {
    console.warn('[profiles] enrichAppStateUser failed:', err);
  }
}

function _avatarColors(role) {
  var r = (role || '').toLowerCase();
  if (r === 'client')    return { bg: '#FF4B4B', fg: '#ffffff' };
  if (r === 'servicing') return { bg: '#22D3EE', fg: '#000000' };
  if (r === 'creative')  return { bg: '#9b87f5', fg: '#ffffff' };
  if (r === 'admin')     return { bg: '#C8A84B', fg: '#000000' };
  return { bg: '#555566', fg: '#ffffff' };
}

function renderAvatar(emailOrName, role, size, opts) {
  opts = opts || {};
  var sz = size || 32;
  var fs = opts.fontSize || Math.round(sz * 0.38) + 'px';
  var ff = opts.fontFamily || "'DM Sans', sans-serif";
  var classes = opts.classes || '';
  var photoUrl = getAvatarUrl(emailOrName);
  if (photoUrl) {
    return '<div class="' + classes + '" style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;overflow:hidden;flex-shrink:0;' + (opts.border || '') + '">' +
      '<img src="' + photoUrl.replace(/"/g, '&quot;') + '" width="' + sz + '" height="' + sz + '" style="width:100%;height:100%;object-fit:cover;display:block;" alt="">' +
      '</div>';
  }
  var displayName = getDisplayName(emailOrName);
  var initial = displayName.charAt(0).toUpperCase();
  if (sz >= 26 && displayName.indexOf(' ') > 0) {
    var parts = displayName.split(' ');
    initial = (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  } else if (sz >= 26 && displayName.length >= 2 && displayName.indexOf(' ') === -1) {
    initial = displayName.slice(0, 2).toUpperCase();
  }
  var colors = _avatarColors(role);
  return '<div class="' + classes + '" style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + colors.bg + ';color:' + colors.fg + ';font-family:' + ff + ';font-size:' + fs + ';font-weight:700;' + (opts.border || '') + '">' +
    initial +
    '</div>';
}
