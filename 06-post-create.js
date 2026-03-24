/* ===============================================
06-post-create.js - New Post modal & drafts
=============================================== */
console.log("LOADED:", "06-post-create.js");

const DRAFT_KEY = 'hinglish_new_post_draft';
let _draftTimer = null;
let _draftDebounce = null;

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
comments: document.getElementById('new-post-comments')?.value || '',
postLink: document.getElementById('new-post-link')?.value     || '',
format:   document.getElementById('new-post-format')?.value   || '',
savedAt:  Date.now(),
};

if (draft.title || draft.comments) {
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

if (!d.title && !d.comments) return false;

const _el = id => document.getElementById(id);
if (_el('new-post-title'))    _el('new-post-title').value    = d.title    || '';
if (_el('new-post-pillar'))   _el('new-post-pillar').value   = d.pillar   || '';
if (_el('new-post-location')) _el('new-post-location').value = d.location || '';
if (_el('new-post-owner'))    _el('new-post-owner').value    = d.owner    || '';
if (_el('new-post-stage'))    _el('new-post-stage').value    = d.stage    || 'in_production';
if (_el('new-post-date'))     _el('new-post-date').value     = d.date     || '';
if (_el('new-post-comments')) _el('new-post-comments').value = d.comments || '';
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
if (val === 'Pranav') strip.classList.add('owner-pranav');
if (val === 'Chitra') strip.classList.add('owner-chitra');
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

// Wire saveDraftDebounced to remaining fields
['new-post-stage','new-post-pillar','new-post-format','new-post-location','new-post-date'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) el.onchange = saveDraftDebounced;
});
['new-post-link','new-post-comments','new-post-caption'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) el.oninput = saveDraftDebounced;
});
}

function openNewPostModal() {

const hasDraft = loadDraft();

if (!hasDraft) {

['new-post-title','new-post-comments','new-post-link'].forEach(id => {
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
}

var strip = document.getElementById('nps-color-strip');
if (strip) strip.className = 'nps-color-strip';

var today = new Date().toISOString().split('T')[0];
var dateEl = document.getElementById('new-post-date');
if (dateEl && !dateEl.value) dateEl.value = today;

var createBtn = document.getElementById('nps-create-btn');
if (createBtn) createBtn.disabled = true;

window._modalOpen = true;
var _npoEl = document.getElementById('new-post-overlay');
if (_npoEl) _npoEl.style.display = 'flex';
document.body.style.overflow = 'hidden';

_npsWireEvents();
_npsCheckValid();
startDraftAutosave();
if (typeof _initPostAssetInput === 'function') _initPostAssetInput();

setTimeout(() => document.getElementById('new-post-title')?.focus(), 60);
}

function closeNewPostModal(e) {

if (e && e.target !== document.getElementById('new-post-overlay')) return;

saveDraft();
stopDraftAutosave();

var captionEl = document.getElementById('new-post-caption');
if (captionEl) captionEl.value = '';
if (typeof clearPostAsset === 'function') clearPostAsset();

var _npoClose = document.getElementById('new-post-overlay');
if (_npoClose) _npoClose.style.display = 'none';
document.body.style.overflow = '';
window._modalOpen = false;
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
const comments = (_s('new-post-comments')?.value || '').trim();
const postLink = (_s('new-post-link')?.value || '').trim();
var captionVal = (_s('new-post-caption')?.value || '').trim();

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

const payload = {
post_id: 'POST-' + Date.now(),
title,
owner,
content_pillar: sanitizePillar(pillar) || null,
location: location || null,
stage: toDbStage(stage || 'in_production'),
target_date: date || null,
comments: comments || null,
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
var assetFile = document.getElementById('new-post-asset') &&
                document.getElementById('new-post-asset').files[0];
if (assetFile && typeof uploadPostAsset === 'function') {
  try {
    var assetUrl = await uploadPostAsset(assetFile, payload.post_id);
    if (assetUrl) payload.image = assetUrl;
  } catch (uploadErr) {
    console.warn('[ASSET] Upload failed, continuing without image:', uploadErr);
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
clearDraft();
stopDraftAutosave();

var _npoClose2 = document.getElementById('new-post-overlay');
if (_npoClose2) _npoClose2.style.display = 'none';
document.body.style.overflow = '';
window._modalOpen = false;

await loadPosts();

showToast('Post created OK', 'success');

} catch (err) {

console.error('[submitNewPost] API FAILED:', err);

saveDraft();

showToast('Failed to create - draft saved', 'error');

if (createBtn) createBtn.disabled = false;
}
}

function _initPostAssetInput() {
  var input = document.getElementById('new-post-asset');
  if (!input || input._wired) return;
  input._wired = true;
  input.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var img      = document.getElementById('new-post-asset-img');
      var preview  = document.getElementById('new-post-asset-preview');
      var placeholder = document.getElementById('new-post-asset-placeholder');
      var filename = document.getElementById('new-post-asset-filename');
      if (img)         img.src = ev.target.result;
      if (filename)    filename.textContent = file.name;
      if (preview)     preview.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
}
window._initPostAssetInput = _initPostAssetInput;

function clearPostAsset() {
  var input       = document.getElementById('new-post-asset');
  var img         = document.getElementById('new-post-asset-img');
  var preview     = document.getElementById('new-post-asset-preview');
  var placeholder = document.getElementById('new-post-asset-placeholder');
  var filename    = document.getElementById('new-post-asset-filename');
  if (input)       input.value = '';
  if (img)         img.src = '';
  if (filename)    filename.textContent = '';
  if (preview)     preview.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';
}
window.clearPostAsset = clearPostAsset;
