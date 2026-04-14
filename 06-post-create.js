/* ===============================================
06-post-create.js - New Post modal & drafts
=============================================== */
console.log("LOADED:", "06-post-create.js");

function _generateWhatsAppPreview(postId, title, imageUrl) {
  fetch('https://srtd-og-inject.ksg-kumarshubhamgune.workers.dev/generate-preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Preview-Secret': 'srtd2026xK9mN3pQ'
    },
    body: JSON.stringify({
      post_id: postId,
      title: title,
      image_url: imageUrl || ''
    })
  }).catch(function() {});
}

const DRAFT_KEY = 'hinglish_new_post_draft';
let _draftTimer = null;
let _draftDebounce = null;

// PR 4 — Gmail import state. Mirrored onto window.* so handlers
// wired via inline onclick can read/write them.
var _npsSelectedOptIdx = 0;   // 1 | 2 | 3 — which AI caption option is picked
var _npsGmailImported  = false; // true once the form has been prefilled from Gmail
window._npsSelectedOptIdx = _npsSelectedOptIdx;
window._npsGmailImported  = _npsGmailImported;

function saveDraftDebounced() {
clearTimeout(_draftDebounce);
_draftDebounce = setTimeout(saveDraft, 800);
}

function saveDraft() {
const draft = {
title:    document.getElementById('new-post-title')?.value    || '',
pillar:   document.getElementById('new-post-pillar')?.value   || '',
location: document.getElementById('new-post-location')?.value || '',
owner:    document.getElementById('new-post-owner')?.value    || '',
stage:    document.getElementById('new-post-stage')?.value    || '',
date:     document.getElementById('new-post-date')?.value     || '',
postLink: document.getElementById('new-post-link')?.value     || '',
format:   document.getElementById('new-post-format')?.value   || '',
savedAt:  Date.now(),
};

if (draft.title) {
localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
showDraftStatus('Draft saved');
}
}

function loadDraft() {
try {
const raw = localStorage.getItem(DRAFT_KEY);
if (!raw) return false;

const d = JSON.parse(raw);

if (Date.now() - d.savedAt > 86400000) {
localStorage.removeItem(DRAFT_KEY);
return false;
}

if (!d.title) return false;

const _el = id => document.getElementById(id);
if (_el('new-post-title'))    _el('new-post-title').value    = d.title    || '';
if (_el('new-post-pillar'))   _el('new-post-pillar').value   = d.pillar   || '';
if (_el('new-post-location')) _el('new-post-location').value = d.location || '';
if (_el('new-post-owner'))    _el('new-post-owner').value    = d.owner    || '';
if (_el('new-post-stage'))    _el('new-post-stage').value    = d.stage    || 'in_production';
if (_el('new-post-date'))     _el('new-post-date').value     = d.date     || '';

if (_el('new-post-link'))     _el('new-post-link').value     = d.postLink || '';
if (_el('new-post-format'))   _el('new-post-format').value   = d.format   || '';

showDraftStatus('Draft restored');
_npsOwnerChange();
_npsCheckValid();
return true;

} catch (_) {
return false;
}
}

function clearDraft() {
localStorage.removeItem(DRAFT_KEY);
clearTimeout(_draftTimer);
showDraftStatus('');
}

function showDraftStatus(msg) {
const el = document.getElementById('npm-draft-status');
if (!el) return;

el.textContent = msg;
el.style.opacity = msg ? '1' : '0';
}

function startDraftAutosave() {
clearInterval(_draftTimer);
_draftTimer = setInterval(saveDraft, 20000);
}

function stopDraftAutosave() {
clearInterval(_draftTimer);
}

function _npsOwnerChange() {
var val = document.getElementById('new-post-owner').value;
var strip = document.getElementById('nps-color-strip');
if (!strip) return;
strip.className = 'nps-color-strip';
if (val === 'Creative') strip.classList.add('owner-pranav');
if (val === 'Servicing') strip.classList.add('owner-chitra');
if (val === 'Client') strip.classList.add('owner-client');
_npsCheckValid();
}

function _npsCheckValid() {
var t = (document.getElementById('new-post-title')
  .value || '').trim();
var o = document.getElementById('new-post-owner').value;
var btn = document.getElementById('nps-create-btn');
if (btn) btn.disabled = !(t && o);
}

function _npsWireEvents() {
var ownerEl = document.getElementById('new-post-owner');
if (ownerEl) ownerEl.onchange = function() { _npsOwnerChange(); saveDraftDebounced(); };

var titleEl = document.getElementById('new-post-title');
if (titleEl) titleEl.oninput = function() { _npsCheckValid(); saveDraftDebounced(); };

var cancelBtn = document.getElementById('nps-cancel-btn');
if (cancelBtn) cancelBtn.onclick = function() { closeNewPostModal(); };

var closeBtn = document.getElementById('nps-close-btn');
if (closeBtn) closeBtn.onclick = function() { closeNewPostModal(); };

var createBtn = document.getElementById('nps-create-btn');
if (createBtn) createBtn.onclick = function() { submitNewPost(); };

// PR 4 — Gmail import wiring. Safe to call on every re-open;
// re-assignment of .onclick replaces the previous handler.
var gmailBtnEl = document.getElementById('nps-gmail-btn');
if (gmailBtnEl) gmailBtnEl.onclick = window._npsShowEmailList;
var emailCancelEl = document.getElementById('nps-email-cancel');
if (emailCancelEl) emailCancelEl.onclick = window._npsHideEmailList;

// Wire saveDraftDebounced to remaining fields
['new-post-stage','new-post-pillar','new-post-format','new-post-location','new-post-date'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) el.onchange = saveDraftDebounced;
});
['new-post-link'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) el.oninput = saveDraftDebounced;
});
var captionWire = document.getElementById('new-post-caption');
if (captionWire) captionWire.oninput = function() {
  this.style.height = 'auto';
  this.style.height = this.scrollHeight + 'px';
  saveDraftDebounced();
};
}

// ═══════════════════════════════════════════════════════════════
// PR 4 — Gmail import handlers (Admin only)
//
// _npsShowEmailList   — POSTs to <worker>/gmail/list, renders up
//                       to 10 recent client briefs.
// _npsHideEmailList   — collapses the list back to the button.
// _npsSelectEmail     — POSTs to <worker>/gmail/brief, pre-fills
//                       the title, swaps the caption textarea for
//                       3 clickable caption options, pre-fills
//                       internal notes, and flips the button into
//                       "Brief imported" state.
// _npsPickOpt         — single-selection toggle across the 3
//                       option cards; stores the idx on
//                       window._npsSelectedOptIdx for submit.
// _npsRefine          — sends the current 3 options + the user's
//                       refine instruction to the writer feature
//                       and replaces all 3 option texts in place.
//
// Every handler returns early on missing window.AI_CONFIG so the
// form still works if ai-config.js fails to ship for any reason.
// ═══════════════════════════════════════════════════════════════

window._npsShowEmailList = async function() {
  var emailList = document.getElementById('nps-email-list');
  var items = document.getElementById('nps-email-items');
  if (!emailList || !items) return;

  items.innerHTML = '<div style="padding:12px 18px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:.07em;text-transform:uppercase;color:#555">Loading...</div>';
  emailList.style.display = 'block';

  try {
    var cfg = window.AI_CONFIG;
    if (!cfg || !cfg.workerUrl) throw new Error('AI not configured');

    var res = await fetch(cfg.workerUrl + '/gmail/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AI-Secret': cfg.secret },
      body: JSON.stringify({ workspace_id: 'default' })
    });
    var data = await res.json();

    if (!data.success || !data.emails || data.emails.length === 0) {
      items.innerHTML = '<div style="padding:12px 18px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:.07em;text-transform:uppercase;color:#555">No recent briefs found</div>';
      return;
    }

    items.innerHTML = '';
    data.emails.forEach(function(email) {
      var div = document.createElement('div');
      div.className = 'nps-email-item';
      var dateStr = '';
      try {
        if (email.date) {
          dateStr = new Date(email.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        }
      } catch (e) { dateStr = ''; }
      div.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">' +
          '<span class="nps-email-sender">' + ((email.sender || 'Client') + '').replace(/</g, '&lt;') + '</span>' +
          '<span class="nps-email-time">' + dateStr + '</span>' +
        '</div>' +
        '<div class="nps-email-subject">' + ((email.subject || '') + '').replace(/</g, '&lt;') + '</div>' +
        '<div class="nps-email-preview">' + ((email.snippet || '') + '').replace(/</g, '&lt;') + '</div>';
      div.onclick = function() { window._npsSelectEmail(email.id, email.subject); };
      items.appendChild(div);
    });
  } catch (e) {
    items.innerHTML = '<div style="padding:12px 18px;font-family:\'IBM Plex Mono\',monospace;font-size:9px;letter-spacing:.07em;text-transform:uppercase;color:#FF4B4B">Error loading emails</div>';
  }
};

window._npsHideEmailList = function() {
  var emailList = document.getElementById('nps-email-list');
  if (emailList) emailList.style.display = 'none';
};

window._npsSelectEmail = async function(messageId, subject) {
  var emailList = document.getElementById('nps-email-list');
  var proc      = document.getElementById('nps-gmail-processing');
  var procTxt   = document.getElementById('nps-proc-txt');
  if (emailList) emailList.style.display = 'none';
  if (proc)      proc.style.display = 'flex';
  if (procTxt)   procTxt.textContent = 'Claude is reading the brief...';

  try {
    var cfg = window.AI_CONFIG;
    if (!cfg || !cfg.workerUrl) throw new Error('AI not configured');

    var res = await fetch(cfg.workerUrl + '/gmail/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AI-Secret': cfg.secret },
      body: JSON.stringify({
        message_id:   messageId,
        workspace_id: 'default',
        created_by:   (window.AppState.user && window.AppState.user.email) || ''
      })
    });
    var data = await res.json();

    if (proc) proc.style.display = 'none';

    if (!data.success) {
      if (typeof showToast === 'function') showToast('Could not read brief - try again', 'error');
      return;
    }

    // Pre-fill title
    var titleEl = document.getElementById('new-post-title');
    if (titleEl) titleEl.value = data.title || subject || '';

    // Swap the textarea for the 3-option AI picker and seed each.
    var textarea = document.getElementById('new-post-caption');
    var optsWrap = document.getElementById('nps-caption-opts');
    if (textarea) textarea.style.display = 'none';
    if (optsWrap) {
      document.getElementById('nps-opt-txt-1').textContent = data.copy_option_1 || '';
      document.getElementById('nps-opt-txt-2').textContent = data.copy_option_2 || '';
      document.getElementById('nps-opt-txt-3').textContent = data.copy_option_3 || '';
      optsWrap.style.display = 'flex';
      // Default pick: option 1.
      window._npsPickOpt(document.getElementById('nps-cap-opt-1'));
    }

    // Pre-fill internal notes (Brief / Internal Notes field 08).
    var notesEl = document.getElementById('new-post-comments');
    if (notesEl) notesEl.value = data.internal_notes || '';

    // Flip the "Import" button into its "Brief imported" state.
    document.querySelectorAll('.nps-ai-tag').forEach(function(el) { el.style.display = 'inline-flex'; });
    var title = document.getElementById('nps-gmail-title');
    var sub   = document.getElementById('nps-gmail-sub');
    var arr   = document.getElementById('nps-gmail-arr');
    if (title) title.textContent = '\u2726 Brief imported \u2713';
    if (sub)   sub.textContent = ((data.title || subject || '') + '').substring(0, 40) + '... \u00b7 Tap to change';
    if (arr)   arr.style.display = 'none';

    window._npsGmailImported = true;

    // Re-wire the Import button to "reset + re-fetch list" so a
    // second tap lets the user pick a different email.
    var gmailBtnReimport = document.getElementById('nps-gmail-btn');
    if (gmailBtnReimport) {
      gmailBtnReimport.onclick = function() {
        window._npsGmailImported = false;
        window._npsSelectedOptIdx = 0;
        var textarea2 = document.getElementById('new-post-caption');
        var opts2     = document.getElementById('nps-caption-opts');
        if (textarea2) textarea2.style.display = '';
        if (opts2)     opts2.style.display = 'none';
        if (title) title.textContent = '\u2726 Import from Gmail';
        if (sub)   sub.textContent = 'Check for briefs from Manisha or Shivangini';
        if (arr)   arr.style.display = '';
        gmailBtnReimport.onclick = window._npsShowEmailList;
        document.querySelectorAll('.nps-ai-tag').forEach(function(el) { el.style.display = 'none'; });
        window._npsShowEmailList();
        _npsCheckValid();
      };
    }

    _npsCheckValid();
  } catch (e) {
    if (proc) proc.style.display = 'none';
    if (typeof showToast === 'function') showToast('Error reading brief', 'error');
  }
};

window._npsPickOpt = function(el) {
  if (!el) return;
  document.querySelectorAll('.nps-cap-opt').forEach(function(o) {
    o.classList.remove('nps-cap-opt--sel');
    var tag = o.querySelector('.nps-cap-opt-tag');
    if (tag) tag.textContent = 'Tap to select';
  });
  el.classList.add('nps-cap-opt--sel');
  var selTag = el.querySelector('.nps-cap-opt-tag');
  if (selTag) selTag.textContent = 'Selected';
  window._npsSelectedOptIdx = parseInt(el.dataset.idx || '1', 10);
};

window._npsRefine = async function() {
  var input   = document.getElementById('nps-refine-input');
  var sendBtn = document.getElementById('nps-refine-send');
  var instruction = input ? (input.value || '').trim() : '';
  if (!instruction) return;

  if (sendBtn) { sendBtn.textContent = '...'; sendBtn.disabled = true; }

  var currentOpts = [
    document.getElementById('nps-opt-txt-1') ? (document.getElementById('nps-opt-txt-1').textContent || '') : '',
    document.getElementById('nps-opt-txt-2') ? (document.getElementById('nps-opt-txt-2').textContent || '') : '',
    document.getElementById('nps-opt-txt-3') ? (document.getElementById('nps-opt-txt-3').textContent || '') : ''
  ];

  try {
    var cfg = window.AI_CONFIG;
    if (!cfg || !cfg.workerUrl) throw new Error('AI not configured');

    var messages = [{
      role: 'user',
      content: 'Here are 3 LinkedIn caption options:\n\n' +
        'Option 1:\n' + currentOpts[0] +
        '\n\nOption 2:\n' + currentOpts[1] +
        '\n\nOption 3:\n' + currentOpts[2] +
        '\n\nInstruction: ' + instruction +
        '\n\nRewrite all 3 options following this instruction. ' +
        'Return JSON only with keys: copy_option_1, copy_option_2, copy_option_3.'
    }];

    var res = await fetch(cfg.workerUrl + '/ai/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AI-Secret': cfg.secret },
      body: JSON.stringify({
        feature:      'writer',
        messages:     messages,
        workspace_id: 'default',
        created_by:   (window.AppState.user && window.AppState.user.email) || ''
      })
    });
    var data = await res.json();

    if (data.success && data.content) {
      try {
        var clean = data.content.replace(/```json|```/g, '').trim();
        var parsed = JSON.parse(clean);
        if (parsed.copy_option_1) document.getElementById('nps-opt-txt-1').textContent = parsed.copy_option_1;
        if (parsed.copy_option_2) document.getElementById('nps-opt-txt-2').textContent = parsed.copy_option_2;
        if (parsed.copy_option_3) document.getElementById('nps-opt-txt-3').textContent = parsed.copy_option_3;
        // Re-select option 1 after replacement so the submit path
        // always points at a fresh option.
        window._npsPickOpt(document.getElementById('nps-cap-opt-1'));
        if (input) input.value = '';
      } catch (e) {
        // JSON parse failed — keep the existing options visible.
      }
    }
  } catch (e) {
    // Network / config failure — keep existing options, swallow.
  }

  if (sendBtn) { sendBtn.textContent = 'Refine'; sendBtn.disabled = false; }
};

function openNewPostModal() {

const hasDraft = loadDraft();

if (!hasDraft) {

['new-post-title','new-post-link','new-post-drive-link'].forEach(id => {
const el = document.getElementById(id);
if (el) el.value = '';
});

const _np = id => document.getElementById(id);
if (_np('new-post-pillar'))   _np('new-post-pillar').value   = '';
if (_np('new-post-location')) _np('new-post-location').value = '';
if (_np('new-post-owner'))    _np('new-post-owner').value    = '';
if (_np('new-post-stage'))    _np('new-post-stage').value    = 'in_production';
if (_np('new-post-date'))     _np('new-post-date').value     = '';
if (_np('new-post-format'))   _np('new-post-format').value   = '';

var captionEl = document.getElementById('new-post-caption');
if (captionEl) captionEl.value = '';
_newPostAssetFiles = [];
if (typeof clearPostAsset === 'function') clearPostAsset();
}

var strip = document.getElementById('nps-color-strip');
if (strip) strip.className = 'nps-color-strip';

var today = new Date().toISOString().split('T')[0];
var dateEl = document.getElementById('new-post-date');
if (dateEl && !dateEl.value) dateEl.value = today;

var createBtn = document.getElementById('nps-create-btn');
if (createBtn) createBtn.disabled = true;

window.AppState.ui.modalOpen = true;
var _npoEl = document.getElementById('new-post-overlay');
if (_npoEl) _npoEl.style.display = 'flex';
var nav = document.getElementById('bottom-nav');
if (nav) nav.style.display = 'none';
document.body.style.overflow = 'hidden';

// PR 4 — Gmail import: show only for Admin when ai_email_briefs
// is enabled in workspace_settings. Initial state on every open
// is "button visible, list/processing hidden, no option picked".
var gmailWrap = document.getElementById('nps-gmail-wrap');
var orDivider = document.getElementById('nps-or-divider');
var _npsRole = ((window.AppState && window.AppState.user && window.AppState.user.effectiveRole) || '').toLowerCase();
var _npsIsAdmin = _npsRole === 'admin';
var _npsAiEnabled = !!(window.AppState && window.AppState.workspace && window.AppState.workspace.ai_email_briefs);
if (gmailWrap) gmailWrap.style.display = (_npsIsAdmin && _npsAiEnabled) ? 'block' : 'none';
if (orDivider) orDivider.style.display = (_npsIsAdmin && _npsAiEnabled) ? 'flex' : 'none';
window._npsGmailImported  = false;
window._npsSelectedOptIdx = 0;

_npsWireEvents();
_npsCheckValid();
startDraftAutosave();
if (typeof _initPostAssetInput === 'function') _initPostAssetInput();

var captionEl = document.getElementById('new-post-caption');
if (captionEl) {
  captionEl.style.height = 'auto';
  captionEl.style.height = captionEl.scrollHeight + 'px';
}

setTimeout(() => document.getElementById('new-post-title')?.focus(), 60);
}

function closeNewPostModal(e) {

clearDraft();
localStorage.removeItem('hinglish_new_post_draft');
stopDraftAutosave();

var captionEl = document.getElementById('new-post-caption');
if (captionEl) captionEl.value = '';
_newPostAssetFiles = [];
if (typeof clearPostAsset === 'function') clearPostAsset();

document.getElementById('new-post-overlay').style.display = 'none';
var nav = document.getElementById('bottom-nav');
if (nav) nav.style.display = '';
document.body.style.overflow = '';
window.AppState.ui.modalOpen = false;

// PR 4 — Gmail import: tear down every per-open UI shim so the
// next open starts clean (button label, option wrap, processing
// row, email list, AI tags).
window._npsGmailImported  = false;
window._npsSelectedOptIdx = 0;
var captionOpts = document.getElementById('nps-caption-opts');
if (captionOpts) captionOpts.style.display = 'none';
var captionTextarea = document.getElementById('new-post-caption');
if (captionTextarea) captionTextarea.style.display = '';
var gmailBtn = document.getElementById('nps-gmail-btn');
if (gmailBtn) {
  var t = document.getElementById('nps-gmail-title');
  var s = document.getElementById('nps-gmail-sub');
  var a = document.getElementById('nps-gmail-arr');
  if (t) t.textContent = '\u2726 Import from Gmail';
  if (s) s.textContent = 'Check for briefs from Manisha or Shivangini';
  if (a) a.style.display = '';
}
var emailList = document.getElementById('nps-email-list');
if (emailList) emailList.style.display = 'none';
var proc = document.getElementById('nps-gmail-processing');
if (proc) proc.style.display = 'none';
document.querySelectorAll('.nps-ai-tag').forEach(function(el) { el.style.display = 'none'; });

_drainDeferredRender();
}

async function submitNewPost() {
console.log('[submitNewPost] SAVE CLICKED');

const _s = id => document.getElementById(id);
const title    = (_s('new-post-title')?.value || '').trim();
const owner    = _s('new-post-owner')?.value || '';
const pillar   = _s('new-post-pillar')?.value || '';
const location = _s('new-post-location')?.value || '';
const stage    = _s('new-post-stage')?.value || '';
const date     = _s('new-post-date')?.value || '';
const postLink = (_s('new-post-link')?.value || '').trim();
// PR 4 — Gmail import: when the form was pre-filled from Gmail
// and the user has (or defaulted to) one of the 3 AI caption
// options, ship THAT option as the caption. Fall back to the
// textarea value if nothing is selected OR the user swapped back
// to manual entry.
var captionVal = '';
if (window._npsGmailImported && window._npsSelectedOptIdx > 0) {
  var selectedOptEl = document.getElementById('nps-opt-txt-' + window._npsSelectedOptIdx);
  captionVal = selectedOptEl ? (selectedOptEl.textContent || '').trim() : '';
}
if (!captionVal) {
  captionVal = (_s('new-post-caption')?.value || '').trim();
}

if (!title) {
console.warn('[submitNewPost] BLOCKED: title empty');
showToast('Post title is required', 'error');
_s('new-post-title')?.focus();
return;
}

if (!owner) {
console.warn('[submitNewPost] BLOCKED: owner empty');
showToast('Owner is required', 'error');
_s('new-post-owner')?.focus();
return;
}

const createBtn = _s('nps-create-btn');

if (createBtn) createBtn.disabled = true;

var formatVal = (_s('new-post-format')?.value || '').trim() || null;
var driveLinkVal = (_s('new-post-drive-link')?.value || '').trim() || null;

const payload = {
post_id: 'POST-' + Date.now(),
title,
owner,
content_pillar: sanitizePillar(pillar) || null,
location: location || null,
stage: 'in_production',
target_date: date || null,
format: formatVal,
drive_link: driveLinkVal,
};
if (captionVal) payload.caption = captionVal;
// Defensive: remove any invalid field names that must never reach DB
delete payload.post_link;
delete payload.linkedin_url;
delete payload.linkedinLink;
delete payload.postLink;
// Route link to correct DB column based on URL content
if (postLink) {
  if (postLink.includes('linkedin.com')) {
    payload.linkedin_link = postLink;
  } else {
    payload.canva_link = postLink;
  }
}
if (_newPostAssetFiles.length && typeof uploadPostAsset === 'function') {
  var uploadedUrls = [];
  for (var fi = 0; fi < _newPostAssetFiles.length; fi++) {
    try {
      var url = await uploadPostAsset(_newPostAssetFiles[fi], payload.post_id);
      if (url) uploadedUrls.push(url);
    } catch (uploadErr) {
      console.warn('[ASSET] Upload failed for file', fi, uploadErr);
    }
  }
  if (uploadedUrls.length) {
    payload.images = uploadedUrls;
  }
}

console.log('[submitNewPost] VALIDATION PASSED');
console.log('FINAL PAYLOAD:', JSON.stringify(payload, null, 2));

try {

await apiFetch('/posts', {
method: 'POST',
body: JSON.stringify(payload)
});

console.log('[submitNewPost] API SUCCESS');

var _newPostTitle = payload.title || '';
var _newPostImage = (Array.isArray(payload.images) && payload.images.length) ? payload.images[0] : '';
_generateWhatsAppPreview(payload.post_id, _newPostTitle, _newPostImage);

clearDraft();
localStorage.removeItem('hinglish_new_post_draft');
stopDraftAutosave();

// Show success screen before closing
var npo = document.getElementById('new-post-overlay');
var _npoOriginalHTML = npo ? npo.innerHTML : '';
if (npo) {
  npo.innerHTML =
    '<div style="position:fixed;inset:0;z-index:2001;background:#0a0a0f;' +
    'display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;gap:14px;">' +
    '<div style="font-size:32px;color:#3ECF8E;line-height:1;">&#x2713;</div>' +
    '<div style="font-family:\'DM Sans\',sans-serif;font-size:22px;' +
    'font-weight:600;color:#e8e2d9;letter-spacing:-0.01em;">Post created.</div>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;' +
    'letter-spacing:0.18em;text-transform:uppercase;color:#555;">' +
    'It\'s now in production.</div>' +
    '</div>';
  npo.style.display = 'flex';
}

await loadPosts();

// Close the brief and link to new post
if (window._activeBriefPostId) {
  var _bid = window._activeBriefPostId;
  window._activeBriefPostId = null;

  var _newPostId = null;
  try {
    var _sorted = (window.AppState.posts.all || []).slice().sort(function(a, b) {
      return new Date((b.status_changed_at||b.updated_at||'')+'Z') -
             new Date((a.status_changed_at||a.updated_at||'')+'Z');
    });
    if (_sorted[0]) _newPostId = _sorted[0].post_id;
  } catch(e) {
    console.warn('[post-create] sort for linked post failed', e);
  }

  if (_bid && _bid.toString().indexOf('REQ-') === 0) {
    // This brief came from a request row, not a posts row. The old
    // /posts PATCH matched zero rows and left the request orphaned
    // at status='assigned' forever. Close the request instead.
    // NOTE: requests table has no updated_at or linked_post_id
    // columns — only `status` is safe to PATCH here.
    apiFetch('/requests?id=eq.' + encodeURIComponent(_bid), {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'closed'
      })
    }).catch(function(err) {
      console.warn('[post-create] close request failed', err);
      window.logError && window.logError(err && err.message, err && err.stack, 'close-request-on-convert');
    });
  } else {
    // Legacy flow: brief was a posts row. Original PATCH unchanged.
    apiFetch('/posts?post_id=eq.' + encodeURIComponent(_bid), {
      method: 'PATCH',
      body: JSON.stringify({
        stage: 'brief_done',
        linked_post_id: _newPostId || null,
        updated_at: new Date().toISOString(),
        updated_by: resolveActor()
      })
    }).catch(function(err) {
      console.warn('[post-create] brief close failed', err);
      window.logError && window.logError(err && err.message, err && err.stack, 'brief-close-post-create');
    });
  }
}

setTimeout(function() {
  // Restore original form DOM before closing
  if (npo && _npoOriginalHTML) npo.innerHTML = _npoOriginalHTML;
  closeNewPostModal();
}, 2000);

} catch (err) {

console.error('[submitNewPost] API FAILED:', err);

saveDraft();

showToast('Failed to create - draft saved', 'error');

if (createBtn) createBtn.disabled = false;
}
}

var _newPostAssetFiles = [];

function _initPostAssetInput() {
  var input = document.getElementById('new-post-asset');
  if (!input || input._wired) return;
  input._wired = true;
  input.addEventListener('change', function(e) {
    var files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(function(file) {
      if (_newPostAssetFiles.length >= 20) return;
      _newPostAssetFiles.push(file);
    });
    _renderNewPostAssetGrid();
  });
}
window._initPostAssetInput = _initPostAssetInput;

function _renderNewPostAssetGrid() {
  var grid = document.getElementById('new-post-asset-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!_newPostAssetFiles.length) {
    grid.style.display = 'none';
    return;
  }
  grid.style.display = 'flex';
  _newPostAssetFiles.forEach(function(file, idx) {
    var url = URL.createObjectURL(file);
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:80px;height:80px;flex-shrink:0;';
    var img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'width:80px;height:80px;object-fit:cover;display:block;';
    var rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.textContent = 'x';
    rmBtn.style.cssText = 'position:absolute;top:2px;right:2px;' +
      'width:18px;height:18px;border-radius:50%;' +
      'background:#000000B3;border:none;color:#888;' +
      'font-size:10px;cursor:pointer;display:flex;' +
      'align-items:center;justify-content:center;line-height:1;';
    rmBtn.onclick = function() {
      _newPostAssetFiles.splice(idx, 1);
      _renderNewPostAssetGrid();
    };
    wrap.appendChild(img);
    wrap.appendChild(rmBtn);
    grid.appendChild(wrap);
  });
}
window._renderNewPostAssetGrid = _renderNewPostAssetGrid;

function clearPostAsset() {
  _newPostAssetFiles = [];
  var input = document.getElementById('new-post-asset');
  if (input) input.value = '';
  _renderNewPostAssetGrid();
}
window.clearPostAsset = clearPostAsset;
