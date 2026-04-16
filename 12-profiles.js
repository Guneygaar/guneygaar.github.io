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
    // allowLogout:false — fetchProfiles runs in parallel with
    // loadPostsForClient and updateLastActive from activateRole(). A
    // transient 401 on any of them must NOT trigger _clearSessionAndLogin
    // and cascade-evict the other parallel chains. Only user-initiated
    // actions get the default allowLogout:true behaviour.
    var rows = await apiFetch('/profiles?select=email,display_name,username,title,avatar_url,status,scratchpad,notification_email,notification_digest,notification_client_comments,notification_whatsapp', {}, { allowLogout: false });
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
      var rolesRes = await apiFetch('/user_roles?select=email,role,name', {}, { allowLogout: false });
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
    _scratchLoad();
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
    return local.split(/[._-]/)
      .filter(Boolean)
      .map(function(p) {
        return p.charAt(0).toUpperCase() +
               p.slice(1).toLowerCase();
      }).join(' ');
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
  // allowLogout:false — updateLastActive runs in parallel with
  // loadPostsForClient and fetchProfiles from activateRole(). See the
  // long-form rationale above fetchProfiles().
  apiFetch('/profiles?email=eq.' + encodeURIComponent(email), {
    method: 'PATCH',
    body: JSON.stringify({ last_active_at: new Date().toISOString(), status: 'online' })
  }, { allowLogout: false }).catch(function(err) {
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
      '<img src="' + photoUrl.replace(/"/g, '&quot;') + '" loading="lazy" width="' + sz + '" height="' + sz + '" style="width:100%;height:100%;object-fit:cover;display:block;" alt="">' +
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
  var scratchpadVal = (profile && profile.scratchpad) || '';

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

  // Scratchpad section
  html += '<div class="prof-section-hdr">\uD83D\uDCDD SCRATCHPAD</div>';
  html += '<div class="prof-fields">';
  html += '<textarea class="prof-input prof-scratchpad" id="prof-scratchpad" placeholder="Quick notes, reminders, to-dos..." rows="5">' + esc(scratchpadVal) + '</textarea>';
  html += '<div class="prof-field-helper">AUTO-SAVES WHEN YOU TAP OUTSIDE</div>';
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

  // Wire photo upload — opens crop modal first, then handleAvatarUpload runs
  // on the cropped result. The original upload pipeline is unchanged; the
  // crop step just sits in front of it.
  var photoInput = document.getElementById('prof-photo-input');
  if (photoInput) {
    photoInput.onchange = function() {
      if (this.files && this.files[0]) {
        openAvatarCropModal(this.files[0]);
        this.value = '';
      }
    };
  }

  // Wire scratchpad auto-save on blur
  var scratchpad = document.getElementById('prof-scratchpad');
  if (scratchpad) {
    scratchpad._lastSaved = scratchpad.value;
    scratchpad.addEventListener('blur', function() {
      var val = this.value;
      if (val === this._lastSaved) return;
      this._lastSaved = val;
      var userEmail = (AppState.user.email || '');
      apiFetch('/profiles?email=eq.' + encodeURIComponent(userEmail), {
        method: 'PATCH',
        body: JSON.stringify({ scratchpad: val, updated_at: new Date().toISOString() })
      }).then(function() {
        var ck = userEmail.toLowerCase();
        if (window._profilesCache && window._profilesCache[ck]) {
          window._profilesCache[ck].scratchpad = val;
        }
        if (typeof showToast === 'function') showToast('Notes saved', 'success');
      }).catch(function(err) {
        console.error('[profiles] scratchpad save failed:', err);
        if (typeof window.logError === 'function') window.logError(err, 'scratchpad-save');
        if (typeof showToast === 'function') showToast('Failed to save notes', 'error');
      });
    });
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
  var scratchpadEl = document.getElementById('prof-scratchpad');
  var scratchpad = scratchpadEl ? scratchpadEl.value : undefined;

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
  if (scratchpad !== undefined) payload.scratchpad = scratchpad;

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

/* ===============================================
   Avatar Crop Modal — pinch/scroll-zoom + drag-pan
   over a circular crop overlay. Sits between file
   selection and handleAvatarUpload so the upload
   pipeline below is untouched.
=============================================== */

window._cropState = null;

function openAvatarCropModal(file) {
  // Validate type up-front (same allowlist as handleAvatarUpload)
  var validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!file || validTypes.indexOf(file.type) === -1) {
    if (typeof showToast === 'function') showToast('Only JPG, PNG, or WebP allowed', 'error');
    return;
  }
  // Cap raw input at 10MB; the cropped output is re-compressed downstream
  if (file.size > 10 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('Image must be under 10MB', 'error');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      _cropMountModal(img, file);
    };
    img.onerror = function() {
      if (typeof showToast === 'function') showToast('Could not read image', 'error');
    };
    img.src = e.target.result;
  };
  reader.onerror = function() {
    if (typeof showToast === 'function') showToast('Could not read file', 'error');
  };
  reader.readAsDataURL(file);
}

function _cropMountModal(img, originalFile) {
  var overlay = document.getElementById('prof-crop-overlay');
  if (!overlay) return;

  // Stage size: mobile-first, capped so it fits on small screens
  var vw = Math.min(window.innerWidth || 360, 480);
  var STAGE = Math.max(240, Math.min(vw - 48, 340));
  // Inset the circle 8px so the gold ring and rounding are visible
  var R = Math.floor(STAGE / 2) - 8;

  // Initial scale: image just fully covers the crop circle
  var minScale = Math.max((2 * R) / img.width, (2 * R) / img.height);
  var maxScale = minScale * 8;

  window._cropState = {
    img: img,
    originalFile: originalFile,
    stage: STAGE,
    radius: R,
    scale: minScale,
    minScale: minScale,
    maxScale: maxScale,
    tx: 0,
    ty: 0,
    // gesture scratch
    startTx: 0,
    startTy: 0,
    startScale: 0,
    startDist: 0,
    startMidX: 0,
    startMidY: 0,
    pinching: false
  };

  overlay.innerHTML = _cropModalHtml(STAGE, R);
  overlay.style.display = 'flex';
  // Profile panel already set body overflow + AppState.ui.modalOpen — leave both.

  _cropDraw();
  _cropWireGestures();

  document.getElementById('crop-cancel-btn').onclick = closeAvatarCropModal;
  document.getElementById('crop-save-btn').onclick = _cropConfirm;
  var slider = document.getElementById('crop-zoom-slider');
  if (slider) {
    slider.min = '0';
    slider.max = '1000';
    slider.value = '0';
    slider.oninput = function() {
      var s = window._cropState;
      if (!s) return;
      var t = parseFloat(this.value) / 1000;
      s.scale = s.minScale + (s.maxScale - s.minScale) * t;
      _cropConstrain();
      _cropDraw();
    };
  }
}

function _cropModalHtml(STAGE, R) {
  // SVG mask creates the circular cutout with a darkened backdrop.
  // pointer-events:none on the SVG so the canvas underneath captures
  // every touch and mouse event.
  var maskId = 'crop-mask-' + Date.now();
  return '<div style="display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:' + (STAGE + 24) + 'px;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:.12em;color:#BCBCD0;text-transform:uppercase;text-align:center;">Position your photo</div>' +
    '<div style="position:relative;width:' + STAGE + 'px;height:' + STAGE + 'px;background:#000;overflow:hidden;touch-action:none;">' +
      '<canvas id="crop-canvas" style="position:absolute;inset:0;display:block;width:' + STAGE + 'px;height:' + STAGE + 'px;touch-action:none;cursor:grab;"></canvas>' +
      '<svg width="' + STAGE + '" height="' + STAGE + '" viewBox="0 0 ' + STAGE + ' ' + STAGE + '" style="position:absolute;inset:0;pointer-events:none;">' +
        '<defs>' +
          '<mask id="' + maskId + '">' +
            '<rect width="' + STAGE + '" height="' + STAGE + '" fill="white"/>' +
            '<circle cx="' + (STAGE / 2) + '" cy="' + (STAGE / 2) + '" r="' + R + '" fill="black"/>' +
          '</mask>' +
        '</defs>' +
        '<rect width="' + STAGE + '" height="' + STAGE + '" fill="#000000B3" mask="url(#' + maskId + ')"/>' +
        '<circle cx="' + (STAGE / 2) + '" cy="' + (STAGE / 2) + '" r="' + R + '" fill="none" stroke="#C8A84B" stroke-width="2"/>' +
      '</svg>' +
    '</div>' +
    '<input type="range" id="crop-zoom-slider" min="0" max="1000" value="0" style="width:100%;max-width:' + STAGE + 'px;accent-color:#C8A84B;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#7a7a90;text-align:center;letter-spacing:.08em;text-transform:uppercase;">Drag to position \u00B7 Pinch or scroll to zoom</div>' +
    '<div style="display:flex;gap:10px;width:100%;max-width:' + STAGE + 'px;margin-top:6px;">' +
      '<button id="crop-cancel-btn" style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#BCBCD0;background:#1a1a26;border:1px solid #2a2a3a;padding:14px;cursor:pointer;">Cancel</button>' +
      '<button id="crop-save-btn" style="flex:1;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#000;background:#C8A84B;border:none;padding:14px;cursor:pointer;">Save</button>' +
    '</div>' +
  '</div>';
}

function _cropDraw() {
  var s = window._cropState;
  if (!s) return;
  var canvas = document.getElementById('crop-canvas');
  if (!canvas) return;
  var DPR = window.devicePixelRatio || 1;
  // Resize backing store on first draw (or DPR change)
  if (canvas.width !== s.stage * DPR) {
    canvas.width = s.stage * DPR;
    canvas.height = s.stage * DPR;
  }
  var ctx = canvas.getContext('2d');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, s.stage, s.stage);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, s.stage, s.stage);
  var iw = s.img.width * s.scale;
  var ih = s.img.height * s.scale;
  var dx = (s.stage - iw) / 2 + s.tx;
  var dy = (s.stage - ih) / 2 + s.ty;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s.img, dx, dy, iw, ih);
  // Sync slider position so the UI matches programmatic scale changes
  var slider = document.getElementById('crop-zoom-slider');
  if (slider && s.maxScale > s.minScale) {
    var t = (s.scale - s.minScale) / (s.maxScale - s.minScale);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    slider.value = String(Math.round(t * 1000));
  }
}

function _cropConstrain() {
  var s = window._cropState;
  if (!s) return;
  if (s.scale < s.minScale) s.scale = s.minScale;
  if (s.scale > s.maxScale) s.scale = s.maxScale;
  // Keep the image always covering the crop circle
  var maxTx = (s.img.width * s.scale) / 2 - s.radius;
  var maxTy = (s.img.height * s.scale) / 2 - s.radius;
  if (maxTx < 0) maxTx = 0;
  if (maxTy < 0) maxTy = 0;
  if (s.tx > maxTx) s.tx = maxTx;
  if (s.tx < -maxTx) s.tx = -maxTx;
  if (s.ty > maxTy) s.ty = maxTy;
  if (s.ty < -maxTy) s.ty = -maxTy;
}

function _cropWireGestures() {
  var canvas = document.getElementById('crop-canvas');
  if (!canvas) return;
  // Touch (mobile + iPhone Safari)
  canvas.addEventListener('touchstart', _cropTouchStart, { passive: false });
  canvas.addEventListener('touchmove', _cropTouchMove, { passive: false });
  canvas.addEventListener('touchend', _cropTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', _cropTouchEnd, { passive: false });
  // Mouse + wheel (desktop)
  canvas.addEventListener('mousedown', _cropMouseDown);
  canvas.addEventListener('wheel', _cropWheel, { passive: false });
}

function _cropTouchStart(e) {
  e.preventDefault();
  var s = window._cropState;
  if (!s) return;
  if (e.touches.length === 1) {
    s.pinching = false;
    s.startTx = s.tx;
    s.startTy = s.ty;
    s.startMidX = e.touches[0].clientX;
    s.startMidY = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    s.pinching = true;
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    s.startDist = Math.sqrt(dx * dx + dy * dy) || 1;
    s.startScale = s.scale;
    s.startTx = s.tx;
    s.startTy = s.ty;
    s.startMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    s.startMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
}

function _cropTouchMove(e) {
  e.preventDefault();
  var s = window._cropState;
  if (!s) return;
  if (e.touches.length === 1 && !s.pinching) {
    s.tx = s.startTx + (e.touches[0].clientX - s.startMidX);
    s.ty = s.startTy + (e.touches[0].clientY - s.startMidY);
    _cropConstrain();
    _cropDraw();
  } else if (e.touches.length === 2) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    s.scale = s.startScale * (dist / s.startDist);
    var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    s.tx = s.startTx + (midX - s.startMidX);
    s.ty = s.startTy + (midY - s.startMidY);
    _cropConstrain();
    _cropDraw();
  }
}

function _cropTouchEnd(e) {
  // No preventDefault here — Safari needs the touchend to bubble for tap-to-button.
  var s = window._cropState;
  if (!s) return;
  if (e.touches.length === 0) {
    s.pinching = false;
  } else if (e.touches.length === 1) {
    s.pinching = false;
    s.startTx = s.tx;
    s.startTy = s.ty;
    s.startMidX = e.touches[0].clientX;
    s.startMidY = e.touches[0].clientY;
  }
}

function _cropMouseDown(e) {
  e.preventDefault();
  var s = window._cropState;
  if (!s) return;
  s.startTx = s.tx;
  s.startTy = s.ty;
  s.startMidX = e.clientX;
  s.startMidY = e.clientY;
  function move(ev) {
    s.tx = s.startTx + (ev.clientX - s.startMidX);
    s.ty = s.startTy + (ev.clientY - s.startMidY);
    _cropConstrain();
    _cropDraw();
  }
  function up() {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
  }
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function _cropWheel(e) {
  e.preventDefault();
  var s = window._cropState;
  if (!s) return;
  var factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
  s.scale = s.scale * factor;
  _cropConstrain();
  _cropDraw();
}

function closeAvatarCropModal() {
  var overlay = document.getElementById('prof-crop-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.innerHTML = '';
  }
  window._cropState = null;
  // Profile panel still owns body overflow + AppState.ui.modalOpen — don't touch.
}

function _cropConfirm() {
  var s = window._cropState;
  if (!s) return;

  var OUTPUT = 512;
  var W = s.stage;
  var R = s.radius;

  // Stage → image-space inverse mapping. The image is drawn at:
  //   dx = (W - iw)/2 + tx, dy = (W - ih)/2 + ty   where iw = img.width * scale
  // For a stage point (sx, sy):
  //   imgX = (sx - dx) / scale = (sx - W/2 - tx) / scale + img.width/2
  // The crop area is the square inscribing the gold circle:
  //   corner = (W/2 - R, W/2 - R), side = 2R
  var srcX = (W / 2 - R - W / 2 - s.tx) / s.scale + s.img.width / 2;
  var srcY = (W / 2 - R - W / 2 - s.ty) / s.scale + s.img.height / 2;
  var srcSize = (2 * R) / s.scale;
  var srcW = srcSize;
  var srcH = srcSize;

  // Defensive clamp — _cropConstrain already guarantees this, but a single
  // pixel of float drift would crash drawImage on Safari. Belt + braces.
  if (srcX < 0) { srcW += srcX; srcX = 0; }
  if (srcY < 0) { srcH += srcY; srcY = 0; }
  if (srcX + srcW > s.img.width)  srcW = s.img.width  - srcX;
  if (srcY + srcH > s.img.height) srcH = s.img.height - srcY;

  var out = document.createElement('canvas');
  out.width = OUTPUT;
  out.height = OUTPUT;
  var octx = out.getContext('2d');
  octx.fillStyle = '#000';
  octx.fillRect(0, 0, OUTPUT, OUTPUT);
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(s.img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT, OUTPUT);

  var saveBtn = document.getElementById('crop-save-btn');
  if (saveBtn) { saveBtn.textContent = 'PROCESSING...'; saveBtn.disabled = true; }

  var origName = (s.originalFile && s.originalFile.name) || 'avatar.jpg';
  out.toBlob(function(blob) {
    if (!blob) {
      if (typeof showToast === 'function') showToast('Crop failed', 'error');
      if (saveBtn) { saveBtn.textContent = 'SAVE'; saveBtn.disabled = false; }
      return;
    }
    var croppedFile = new File([blob], origName.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    closeAvatarCropModal();
    handleAvatarUpload(croppedFile);
  }, 'image/jpeg', 0.92);
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
  // Validate size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('Image must be under 5MB', 'error');
    return;
  }

  console.log('[avatar] Starting upload, file:', file.name, file.type, file.size);

  // Compress to max 400x400 JPEG q0.80
  try {
    file = await _compressAvatar(file);
  } catch (compErr) {
    console.warn('[avatar] Compression failed, using original:', compErr);
  }
  console.log('[avatar] Compressed, new size:', file.size);

  var email = (AppState.user.email || '');
  var sanitized = email.toLowerCase().replace(/@/g, '-at-').replace(/\./g, '-');
  var filename = 'profile-pictures/' + sanitized + '.jpeg';

  // Progress ring constants
  var ringSize = 88;
  var r = 40;
  var circumference = 2 * Math.PI * r;

  // Replace hero avatar with progress ring
  var heroEl = document.getElementById('prof-hero');
  var originalHeroHtml = heroEl ? heroEl.innerHTML : '';

  if (heroEl) {
    var progressHtml =
      '<div id="upload-ring-wrap">' +
      '<div style="position:relative;width:' + ringSize + 'px;height:' + ringSize + 'px;margin:0 auto 16px;">' +
        '<svg width="' + ringSize + '" height="' + ringSize + '" viewBox="0 0 ' + ringSize + ' ' + ringSize + '" style="transform:rotate(-90deg);position:absolute;top:0;left:0;">' +
          '<circle cx="' + (ringSize/2) + '" cy="' + (ringSize/2) + '" r="' + r + '" fill="none" stroke="#1c1c2a" stroke-width="4"/>' +
          '<circle id="upload-progress-ring" cx="' + (ringSize/2) + '" cy="' + (ringSize/2) + '" r="' + r + '" fill="none" stroke="#3ECF8E" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + circumference + '"/>' +
        '</svg>' +
        '<div style="position:absolute;top:4px;left:4px;width:' + (ringSize-8) + 'px;height:' + (ringSize-8) + 'px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#141420;">' +
          (AppState.user.avatarUrl
            ? '<img src="' + AppState.user.avatarUrl + '" style="width:100%;height:100%;object-fit:cover;opacity:0.4;">'
            : '<span style="font-family:IBM Plex Mono,monospace;font-size:24px;font-weight:700;color:#555;">' + (AppState.user.displayName || 'U').charAt(0) + '</span>') +
        '</div>' +
        '<div id="upload-pct" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:IBM Plex Mono,monospace;font-size:16px;font-weight:700;color:#3ECF8E;">0%</div>' +
      '</div>' +
      '</div>';

    var photoWrap = heroEl.querySelector('[style*="position:relative"]');
    if (photoWrap) {
      photoWrap.outerHTML = progressHtml;
    } else {
      heroEl.insertAdjacentHTML('afterbegin', progressHtml);
    }
  }

  try {
    var workerUrl = 'https://srtd-r2-upload.ksg-kumarshubhamgune.workers.dev/upload'
      + '?filename=' + encodeURIComponent(filename);
    console.log('[avatar] Uploading to:', workerUrl);

    // Use XHR for upload progress tracking
    var xhr = new XMLHttpRequest();
    xhr.open('POST', workerUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'image/jpeg');
    xhr.setRequestHeader('X-Upload-Secret', 'srtd2026xK9mN3pQ');

    xhr.upload.onprogress = function(e) {
      if (e.lengthComputable) {
        var pct = Math.round((e.loaded / e.total) * 100);
        var ring = document.getElementById('upload-progress-ring');
        var label = document.getElementById('upload-pct');
        if (ring) {
          var offset = circumference - (pct / 100) * circumference;
          ring.style.strokeDashoffset = offset;
        }
        if (label) label.textContent = pct + '%';
      }
    };

    var uploadPromise = new Promise(function(resolve, reject) {
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('Upload ' + xhr.status));
      };
      xhr.onerror = function() { reject(new Error('Upload network error')); };
    });

    xhr.send(file);
    await uploadPromise;
    console.log('[avatar] Upload complete');

    // Build cache-busted URL: store the ?t= timestamp in the DB so the URL
    // is unique per upload. Cloudflare's CDN treats it as a different cache
    // entry and the browser image cache picks up the new bytes immediately
    // — no stale-image-after-refresh bug. The R2 object itself is served
    // with `Cache-Control: immutable` (see r2-upload-worker.js) which is
    // safe because the URL changes every time.
    var cleanUrl = 'https://images.srtd.io/' + filename;
    var stamp = Date.now();
    var displayUrl = cleanUrl + '?t=' + stamp;

    // PATCH profile — persist the cache-busted URL so refreshes see it too.
    await apiFetch('/profiles?email=eq.' + encodeURIComponent(email), {
      method: 'PATCH',
      body: JSON.stringify({ avatar_url: displayUrl, updated_at: new Date().toISOString() })
    });

    // Update in-memory caches so the current session reflects the change
    // without waiting for the next fetchProfiles().
    var cacheKey = email.toLowerCase();
    if (window._profilesCache && window._profilesCache[cacheKey]) {
      window._profilesCache[cacheKey].avatar_url = displayUrl;
    }
    AppState.user.avatarUrl = displayUrl;

    // Wait 500ms for the ring animation to feel complete
    await new Promise(function(r) { setTimeout(r, 500); });

    // Re-render the ENTIRE profile hero (not just the ring)
    if (typeof _profileRenderHero === 'function') _profileRenderHero();

    // Re-render the topbar avatar trigger
    if (typeof _renderProfileTrigger === 'function') _renderProfileTrigger();

    if (typeof showToast === 'function') showToast('Photo updated', 'success');
  } catch (err) {
    console.error('[avatar] Upload failed:', err);
    if (typeof window.logError === 'function') window.logError(err, 'handleAvatarUpload');
    // Revert hero to original
    if (heroEl && originalHeroHtml) heroEl.innerHTML = originalHeroHtml;
    if (typeof showToast === 'function') showToast('Upload failed. Try again.', 'error');
  }
}

/* ===============================================
   Scratchpad — full-screen overlay opened from dropdown.
   Google-Docs-style debounced auto-save: 1.5s after the
   user stops typing, PATCH profiles.scratchpad. Subtle
   status indicator (Saving… / Saved / Save failed —
   retrying…). One retry after 3s on failure.
=============================================== */

window._scratchSaveTimer = null;
window._scratchRetryTimer = null;
window._scratchSavedHideTimer = null;
window._scratchLastSaved = '';
window._scratchInFlight = false;

function _scratchLoad() {
  // No DOM updates needed - panel reads from cache when opened
}

function openScratchpadPanel() {
  var panel = document.getElementById('scratchpad-panel');
  if (!panel) return;
  panel.style.display = 'flex';
  var profile = getProfileByEmail(AppState.user.email);
  var content = (profile && profile.scratchpad) || '';
  var input = document.getElementById('scratchpad-textarea');
  if (input) {
    input.value = content;
    window._scratchLastSaved = content;
    if (!input._autoSaveWired) {
      input.addEventListener('input', _scratchOnInput);
      input._autoSaveWired = true;
    }
    input.focus();
  }
  _scratchSetStatus('');
}

function closeScratchpadPanel() {
  // Flush any pending debounced save immediately so nothing is lost.
  if (window._scratchSaveTimer) {
    clearTimeout(window._scratchSaveTimer);
    window._scratchSaveTimer = null;
    _scratchPerformSave(false);
  }
  var panel = document.getElementById('scratchpad-panel');
  if (panel) panel.style.display = 'none';
}

function _scratchOnInput() {
  // New keystroke — cancel any queued save or retry.
  if (window._scratchSaveTimer) { clearTimeout(window._scratchSaveTimer); window._scratchSaveTimer = null; }
  if (window._scratchRetryTimer) { clearTimeout(window._scratchRetryTimer); window._scratchRetryTimer = null; }
  _scratchSetStatus('');
  window._scratchSaveTimer = setTimeout(function() {
    window._scratchSaveTimer = null;
    _scratchPerformSave(false);
  }, 1500);
}

function _scratchPerformSave(isRetry) {
  var input = document.getElementById('scratchpad-textarea');
  if (!input) return;
  var val = input.value;
  if (val === window._scratchLastSaved) { _scratchSetStatus(''); return; }
  var email = AppState.user.email;
  if (!email) return;
  window._scratchInFlight = true;
  _scratchSetStatus('saving');
  apiFetch('/profiles?email=eq.' + encodeURIComponent(email), {
    method: 'PATCH',
    body: JSON.stringify({ scratchpad: val, updated_at: new Date().toISOString() })
  }).then(function() {
    window._scratchInFlight = false;
    window._scratchLastSaved = val;
    var cacheKey = email.toLowerCase();
    if (window._profilesCache && window._profilesCache[cacheKey]) {
      window._profilesCache[cacheKey].scratchpad = val;
    }
    _scratchSetStatus('saved');
  }).catch(function(err) {
    window._scratchInFlight = false;
    console.warn('[scratch] Save failed:', err);
    if (typeof window.logError === 'function') window.logError(err, 'scratchpad-autosave');
    if (isRetry) {
      _scratchSetStatus('failed');
    } else {
      _scratchSetStatus('retrying');
      window._scratchRetryTimer = setTimeout(function() {
        window._scratchRetryTimer = null;
        _scratchPerformSave(true);
      }, 3000);
    }
  });
}

function _scratchSetStatus(state) {
  var el = document.getElementById('scratchpad-status');
  if (!el) return;
  if (window._scratchSavedHideTimer) {
    clearTimeout(window._scratchSavedHideTimer);
    window._scratchSavedHideTimer = null;
  }
  if (state === 'saving') {
    el.textContent = 'Saving\u2026';
    el.style.color = '#7a7a90';
    el.style.opacity = '1';
  } else if (state === 'saved') {
    el.textContent = 'Saved';
    el.style.color = '#7a7a90';
    el.style.opacity = '1';
    window._scratchSavedHideTimer = setTimeout(function() {
      el.style.opacity = '0';
      window._scratchSavedHideTimer = null;
    }, 2000);
  } else if (state === 'retrying') {
    el.textContent = 'Save failed \u2014 retrying\u2026';
    el.style.color = '#F6A623';
    el.style.opacity = '1';
  } else if (state === 'failed') {
    el.textContent = 'Save failed';
    el.style.color = '#FF4B4B';
    el.style.opacity = '1';
  } else {
    el.textContent = '';
    el.style.opacity = '0';
  }
}

function _renderProfileTrigger() {
  var wrap = document.getElementById('prof-trigger');
  if (!wrap) return;
  var email = (window.AppState && window.AppState.user && window.AppState.user.email) || '';
  var role = (window.AppState && window.AppState.user && (window.AppState.user.effectiveRole || window.AppState.user.role)) || '';
  var colors = _avatarColors(role);
  wrap.style.border = '2px solid ' + colors.bg;
  wrap.innerHTML = renderAvatar(email, role, 32);
}
