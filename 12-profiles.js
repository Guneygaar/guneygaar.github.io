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
