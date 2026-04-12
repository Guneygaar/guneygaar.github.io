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
    var rows = await apiFetch('/profiles?select=email,display_name,username,title,avatar_url,status,notification_email,notification_digest,notification_client_comments,notification_whatsapp');
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
        var nec = {};
        for (var k = 0; k < rolesRes.length; k++) {
          var ur = rolesRes[k];
          if (ur.name && ur.email) {
            nec[ur.name.toLowerCase()] = ur.email.toLowerCase();
          }
        }
        window._nameToEmailCache = nec;
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
  var key = String(emailOrName).toLowerCase().trim();
  if (!key) return 'Unknown';
  var cache = window._profilesCache;
  if (cache && cache[key] && cache[key].display_name) {
    return cache[key].display_name;
  }
  if (cache) {
    var keys = Object.keys(cache);
    for (var i = 0; i < keys.length; i++) {
      var p = cache[keys[i]];
      if (p.display_name && p.display_name.toLowerCase() === key) {
        return p.display_name;
      }
    }
  }
  // Short name lookup via user_roles.name
  if (window._nameToEmailCache && window._nameToEmailCache[key]) {
    var resolvedEmail = window._nameToEmailCache[key];
    if (cache && cache[resolvedEmail] && cache[resolvedEmail].display_name) {
      return cache[resolvedEmail].display_name;
    }
  }
  if (key.indexOf('@') >= 0) {
    var local = key.split('@')[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return emailOrName;
}

function getAvatarUrl(nameOrEmail) {
  if (!nameOrEmail) return null;
  var key = String(nameOrEmail).toLowerCase().trim();
  if (!key) return null;
  var cache = window._profilesCache;
  if (cache && cache[key] && cache[key].avatar_url) {
    return cache[key].avatar_url;
  }
  if (cache) {
    var keys = Object.keys(cache);
    for (var i = 0; i < keys.length; i++) {
      var p = cache[keys[i]];
      if (p.display_name && p.display_name.toLowerCase() === key) {
        return p.avatar_url || null;
      }
    }
  }
  // Short name lookup via user_roles.name
  if (window._nameToEmailCache && window._nameToEmailCache[key]) {
    var resolvedEmail = window._nameToEmailCache[key];
    if (cache && cache[resolvedEmail]) {
      return cache[resolvedEmail].avatar_url || null;
    }
  }
  return null;
}

function getProfileByEmail(nameOrEmail) {
  if (!nameOrEmail) return null;
  var key = String(nameOrEmail).toLowerCase().trim();
  var cache = window._profilesCache;
  if (!cache) return null;
  if (cache[key]) return cache[key];
  var keys = Object.keys(cache);
  for (var i = 0; i < keys.length; i++) {
    var p = cache[keys[i]];
    if (p.display_name && p.display_name.toLowerCase() === key) {
      return p;
    }
  }
  // Short name lookup via user_roles.name
  if (window._nameToEmailCache && window._nameToEmailCache[key]) {
    var resolvedEmail = window._nameToEmailCache[key];
    if (cache[resolvedEmail]) return cache[resolvedEmail];
  }
  return null;
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
    _renderProfileTrigger();
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

function displayNameSafe(nameOrEmail) {
  if (!nameOrEmail) return 'Unknown';
  if (nameOrEmail.indexOf('@') >= 0) return getDisplayName(nameOrEmail);
  return nameOrEmail;
}

/* ===============================================
   Profile Panel — edit own profile
=============================================== */

function _profileRoleBadgeHtml(role) {
  var r = (role || '').toLowerCase();
  var colors = _avatarColors(r);
  var label = r.charAt(0).toUpperCase() + r.slice(1);
  return '<span style="display:inline-block;padding:3px 10px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:' + colors.bg + ';background:' + colors.bg + '1A;border:1px solid ' + colors.bg + '33;">' + label + '</span>';
}

function _profileToggleHtml(id, label, desc, checked) {
  return '<div class="prof-toggle-row">' +
    '<div class="prof-toggle-text">' +
      '<div class="prof-toggle-label">' + label + '</div>' +
      '<div class="prof-toggle-desc">' + desc + '</div>' +
    '</div>' +
    '<div class="prof-toggle" id="' + id + '" data-on="' + (checked ? 'true' : 'false') + '">' +
      '<div class="prof-toggle-knob"></div>' +
    '</div>' +
  '</div>';
}

function _profileRenderHero() {
  var hero = document.getElementById('prof-hero');
  if (!hero) return;
  var email = (AppState.user.email || '');
  var role = (AppState.user.effectiveRole || AppState.user.role || '').toLowerCase();
  var profile = getProfileByEmail(email);
  var displayName = (profile && profile.display_name) || AppState.user.displayName || AppState.user.name || 'Unknown';
  var username = (profile && profile.username) || AppState.user.username || '';
  var title = (profile && profile.title) || AppState.user.title || '';
  hero.innerHTML =
    '<div style="position:relative;display:inline-block;">' +
      renderAvatar(email, role, 80) +
      '<button class="prof-photo-edit" id="prof-photo-edit-btn" title="Change photo">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>' +
      '</button>' +
    '</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:20px;font-weight:700;color:#fff;margin-top:12px;">' + esc(displayName) + '</div>' +
    (username ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#BCBCD0;margin-top:2px;">@' + esc(username) + '</div>' : '') +
    (title ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#7a7a90;margin-top:4px;text-transform:uppercase;letter-spacing:.1em;">' + esc(title) + '</div>' : '') +
    '<div style="margin-top:10px;">' + _profileRoleBadgeHtml(role) + '</div>';
  // Wire photo edit button
  var editBtn = document.getElementById('prof-photo-edit-btn');
  if (editBtn) {
    editBtn.onclick = function() {
      var inp = document.getElementById('prof-photo-input');
      if (inp) inp.click();
    };
  }
}

function openProfilePanel() {
  var overlay = document.getElementById('prof-overlay');
  if (!overlay) return;
  var email = (AppState.user.email || '');
  var role = (AppState.user.effectiveRole || AppState.user.role || '').toLowerCase();
  var profile = getProfileByEmail(email);
  var displayName = (profile && profile.display_name) || AppState.user.displayName || AppState.user.name || '';
  var username = (profile && profile.username) || AppState.user.username || '';
  var titleVal = (profile && profile.title) || AppState.user.title || '';
  var notifEmail = profile ? (profile.notification_email !== false) : true;
  var notifDigest = profile ? (profile.notification_digest !== false) : true;
  var notifClient = profile ? (profile.notification_client_comments !== false) : true;
  var notifWA = profile ? (profile.notification_whatsapp === true) : false;

  // Build panel content
  var panel = document.getElementById('prof-panel');
  if (!panel) return;

  var html = '';

  // Topbar
  html += '<div class="prof-topbar">' +
    '<div>' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:17px;font-weight:700;color:#fff;">My Profile</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#BCBCD0;letter-spacing:.06em;margin-top:2px;">HOW YOU APPEAR ACROSS SORTED</div>' +
    '</div>' +
    '<button class="prof-close-btn" id="prof-close-btn">\u2715 CLOSE</button>' +
  '</div>';

  // Hero
  html += '<div class="prof-hero" id="prof-hero"></div>';

  // Hidden file input for avatar
  html += '<input type="file" id="prof-photo-input" accept="image/jpeg,image/png,image/webp" style="display:none">';

  // Identity section
  html += '<div class="prof-section-hdr">\uD83D\uDC64 IDENTITY</div>';
  html += '<div class="prof-fields">';

  // Field 01: Display Name
  html += '<div class="prof-field">' +
    '<div class="prof-field-num">01</div>' +
    '<div class="prof-field-label">Display Name</div>' +
    '<input type="text" class="prof-input" id="prof-display-name" value="' + esc(displayName) + '" placeholder="Your display name">' +
    '<div class="prof-field-helper" style="color:#3ECF8E;">THIS NAME APPEARS ON COMMENTS AND NOTIFICATIONS</div>' +
  '</div>';

  // Field 02: Username
  html += '<div class="prof-field">' +
    '<div class="prof-field-num">02</div>' +
    '<div class="prof-field-label">Username</div>' +
    '<input type="text" class="prof-input" id="prof-username" value="' + esc(username) + '" placeholder="your_username">' +
    '<div class="prof-field-helper">MUST BE UNIQUE \u00B7 LOWERCASE \u00B7 NO SPACES</div>' +
  '</div>';

  // Field 03: Title
  html += '<div class="prof-field">' +
    '<div class="prof-field-num">03</div>' +
    '<div class="prof-field-label">Title</div>' +
    '<input type="text" class="prof-input" id="prof-title" value="' + esc(titleVal) + '" placeholder="e.g. Creative Director">' +
    '<div class="prof-field-helper">VISIBLE ON YOUR PROFILE CARD AND TEAM PAGE</div>' +
  '</div>';

  html += '</div>'; // .prof-fields

  // Divider
  html += '<div class="prof-divider"></div>';

  // Notifications section
  html += '<div class="prof-section-hdr">\uD83D\uDD14 NOTIFICATIONS</div>';
  html += '<div class="prof-fields">';
  html += _profileToggleHtml('prof-notif-email', 'Email notifications', 'Stage changes, new comments, approvals', notifEmail);
  html += _profileToggleHtml('prof-notif-digest', 'Daily digest', 'Morning summary of what needs attention', notifDigest);
  html += _profileToggleHtml('prof-notif-client', 'Client comments', 'Instant alert when a client posts feedback', notifClient);
  html += _profileToggleHtml('prof-notif-wa', 'WhatsApp previews', 'Get notified on WhatsApp share events', notifWA);
  html += '</div>';

  // Divider
  html += '<div class="prof-divider"></div>';

  // Admin-controlled section
  html += '<div class="prof-section-hdr">\uD83D\uDD12 ADMIN-CONTROLLED</div>';
  html += '<div class="prof-fields">';

  // Field 04: Email (locked)
  html += '<div class="prof-field">' +
    '<div class="prof-field-num">04</div>' +
    '<div class="prof-field-label">Email <span class="prof-locked-badge">Locked</span></div>' +
    '<div class="prof-locked-val">' + esc(email) + '</div>' +
  '</div>';

  // Field 05: Role (locked)
  var roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  html += '<div class="prof-field">' +
    '<div class="prof-field-num">05</div>' +
    '<div class="prof-field-label">Role <span class="prof-locked-badge">Locked</span></div>' +
    '<div class="prof-locked-val">' + esc(roleLabel) + '</div>' +
  '</div>';

  html += '</div>'; // .prof-fields

  // Save button
  html += '<div style="padding:20px 20px 40px;">' +
    '<button class="prof-save-btn" id="prof-save-btn">SAVE CHANGES</button>' +
  '</div>';

  panel.innerHTML = html;

  // Render hero
  _profileRenderHero();

  // Show overlay
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  AppState.ui.modalOpen = true;

  // Wire events
  document.getElementById('prof-close-btn').onclick = closeProfilePanel;
  document.getElementById('prof-save-btn').onclick = saveProfile;

  // Wire toggles
  var toggles = panel.querySelectorAll('.prof-toggle');
  for (var i = 0; i < toggles.length; i++) {
    toggles[i].onclick = function() {
      var on = this.getAttribute('data-on') === 'true';
      this.setAttribute('data-on', on ? 'false' : 'true');
    };
  }

  // Wire photo upload
  var photoInput = document.getElementById('prof-photo-input');
  if (photoInput) {
    photoInput.onchange = function() {
      if (this.files && this.files[0]) {
        handleAvatarUpload(this.files[0]);
        this.value = '';
      }
    };
  }
}

function closeProfilePanel() {
  var overlay = document.getElementById('prof-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  AppState.ui.modalOpen = false;
  _drainDeferredRender();
}

async function saveProfile() {
  var btn = document.getElementById('prof-save-btn');
  if (btn) { btn.textContent = 'SAVING...'; btn.disabled = true; }

  var displayName = (document.getElementById('prof-display-name').value || '').trim();
  var username = (document.getElementById('prof-username').value || '').toLowerCase().trim().replace(/\s+/g, '');
  var title = (document.getElementById('prof-title').value || '').trim();

  var notifEmail = document.getElementById('prof-notif-email').getAttribute('data-on') === 'true';
  var notifDigest = document.getElementById('prof-notif-digest').getAttribute('data-on') === 'true';
  var notifClient = document.getElementById('prof-notif-client').getAttribute('data-on') === 'true';
  var notifWA = document.getElementById('prof-notif-wa').getAttribute('data-on') === 'true';

  var email = (AppState.user.email || '');
  var payload = {
    display_name: displayName,
    username: username,
    title: title,
    notification_email: notifEmail,
    notification_digest: notifDigest,
    notification_client_comments: notifClient,
    notification_whatsapp: notifWA,
    updated_at: new Date().toISOString()
  };

  try {
    await apiFetch('/profiles?email=eq.' + encodeURIComponent(email), {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    // Update local caches
    var cacheKey = email.toLowerCase();
    if (window._profilesCache && window._profilesCache[cacheKey]) {
      Object.assign(window._profilesCache[cacheKey], payload);
    }
    AppState.user.displayName = displayName || AppState.user.name || null;
    AppState.user.title = title || null;
    AppState.user.username = username || null;

    // Update hero
    _profileRenderHero();

    // Update topbar avatar
    _renderProfileTrigger();

    if (typeof showToast === 'function') showToast('Profile saved', 'success');
  } catch (err) {
    console.error('[profiles] saveProfile failed:', err);
    if (typeof window.logError === 'function') window.logError(err, 'saveProfile');
    if (typeof showToast === 'function') showToast('Failed to save. Try again.', 'error');
  }

  if (btn) { btn.textContent = 'SAVE CHANGES'; btn.disabled = false; }
}

async function _compressAvatar(file) {
  return new Promise(function(resolve) {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var MAX = 400;
        var w = img.width;
        var h = img.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) {
          var compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
          resolve(compressed);
        }, 'image/jpeg', 0.80);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleAvatarUpload(file) {
  // Validate type
  var validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (validTypes.indexOf(file.type) === -1) {
    if (typeof showToast === 'function') showToast('Only JPG, PNG, or WebP allowed', 'error');
    return;
  }
  // Validate size (2MB)
  if (file.size > 2 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('Image must be under 2MB', 'error');
    return;
  }

  var email = (AppState.user.email || '');
  var username = AppState.user.username || email.split('@')[0];

  try {
    // Compress
    var compressed = await _compressAvatar(file);
    var ext = compressed.name.split('.').pop();
    var filename = 'profile-pictures/' + username + '.' + ext;
    var workerUrl = 'https://srtd-r2-upload.ksg-kumarshubhamgune.workers.dev/upload'
      + '?filename=' + encodeURIComponent(filename);

    var res = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': compressed.type,
        'X-Upload-Secret': 'srtd2026xK9mN3pQ',
      },
      body: compressed,
    });
    if (!res.ok) throw new Error('Upload ' + res.status);
    var data = await res.json();
    var r2Url = data.url;

    // PATCH profile
    await apiFetch('/profiles?email=eq.' + encodeURIComponent(email), {
      method: 'PATCH',
      body: JSON.stringify({ avatar_url: r2Url, updated_at: new Date().toISOString() })
    });

    // Update caches
    var cacheKey = email.toLowerCase();
    if (window._profilesCache && window._profilesCache[cacheKey]) {
      window._profilesCache[cacheKey].avatar_url = r2Url;
    }
    AppState.user.avatarUrl = r2Url;

    // Re-render hero + topbar trigger
    _profileRenderHero();
    _renderProfileTrigger();

    if (typeof showToast === 'function') showToast('Photo updated', 'success');
  } catch (err) {
    console.error('[profiles] handleAvatarUpload failed:', err);
    if (typeof window.logError === 'function') window.logError(err, 'handleAvatarUpload');
    if (typeof showToast === 'function') showToast('Photo upload failed. Try again.', 'error');
  }
}

function _renderProfileTrigger() {
  var wrap = document.getElementById('prof-trigger');
  if (!wrap) return;
  var email = (window.AppState && window.AppState.user && window.AppState.user.email) || '';
  var role = (window.AppState && window.AppState.user && (window.AppState.user.effectiveRole || window.AppState.user.role)) || '';
  wrap.innerHTML = renderAvatar(email, role, 28);
}
