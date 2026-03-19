/* ===============================================
06-post-create.js - New Post modal & drafts
=============================================== */
console.log("LOADED:", "06-post-create.js");

const DRAFT_KEY = 'gbl_new_post_draft';
let _draftTimer = null;
let _draftDebounce = null;

function saveDraftDebounced() {
clearTimeout(_draftDebounce);
_draftDebounce = setTimeout(saveDraft, 800);
}

function saveDraft() {
const draft = {
title:    document.getElementById('npm-title')?.value    || '',
pillar:   document.getElementById('npm-pillar')?.value   || '',
location: document.getElementById('npm-location')?.value || '',
owner:    document.getElementById('npm-owner')?.value    || '',
stage:    document.getElementById('npm-stage')?.value    || '',
date:     document.getElementById('npm-date')?.value     || '',
comments: document.getElementById('npm-comments')?.value || '',
postLink: document.getElementById('npm-postlink')?.value || '',
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

const _npm = id => document.getElementById(id);
if (_npm('npm-title'))    _npm('npm-title').value    = d.title    || '';
if (_npm('npm-pillar'))   _npm('npm-pillar').value   = d.pillar   || '';
if (_npm('npm-location')) _npm('npm-location').value = d.location || '';
if (_npm('npm-owner'))    _npm('npm-owner').value    = d.owner    || '';
if (_npm('npm-stage'))    _npm('npm-stage').value    = d.stage    || 'in production';
if (_npm('npm-date'))     _npm('npm-date').value     = d.date     || '';
if (_npm('npm-comments')) _npm('npm-comments').value = d.comments || '';
if (_npm('npm-postlink')) _npm('npm-postlink').value = d.postLink || '';

showDraftStatus('Draft restored');
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

function _populateNewPostDropdowns() {

const stageEl = document.getElementById('npm-stage');

if (stageEl && typeof STAGES_DB !== 'undefined') {
stageEl.innerHTML = STAGES_DB
.filter(s => s !== 'parked')
.map(s => `<option value="${s}">${STAGE_DISPLAY[s]}</option>`)
.join('');
}

const pillarEl = document.getElementById('npm-pillar');

if (pillarEl && typeof PILLARS_DB !== 'undefined') {
pillarEl.innerHTML =
'<option value="">Select pillar</option>' +
PILLARS_DB
.map(p => `<option value="${p}">${formatPillarDisplay(p)}</option>`)
.join('');
}
}

function openNewPostModal() {

_populateNewPostDropdowns();

const hasDraft = loadDraft();

if (!hasDraft) {

['npm-title','npm-comments','npm-postlink'].forEach(id => {
const el = document.getElementById(id);
if (el) el.value = '';
});

const _np = id => document.getElementById(id);
if (_np('npm-pillar'))   _np('npm-pillar').value   = '';
if (_np('npm-location')) _np('npm-location').value = '';
if (_np('npm-owner'))    _np('npm-owner').value    = '';
if (_np('npm-stage'))    _np('npm-stage').value    = 'in production';
if (_np('npm-date'))     _np('npm-date').value     = '';
}

const npmSubmit = document.getElementById('npm-submit-btn');
if (npmSubmit) npmSubmit.disabled = false;
document.getElementById('npm-saving')?.classList.remove('active');

window._modalOpen = true;
document.getElementById('new-post-overlay')?.classList.add('open');
document.body.style.overflow = 'hidden';

startDraftAutosave();

setTimeout(() => document.getElementById('npm-title')?.focus(), 60);
}

function closeNewPostModal(e) {

if (e && e.target !== document.getElementById('new-post-overlay')) return;

saveDraft();
stopDraftAutosave();

document.getElementById('new-post-overlay')?.classList.remove('open');
document.body.style.overflow = '';
window._modalOpen = false;
_drainDeferredRender();
}

async function submitNewPost() {
console.log('[submitNewPost] SAVE CLICKED');

const _s = id => document.getElementById(id);
const title    = (_s('npm-title')?.value || '').trim();
const owner    = _s('npm-owner')?.value || '';
const pillar   = _s('npm-pillar')?.value || '';
const location = _s('npm-location')?.value || '';
const stage    = _s('npm-stage')?.value || '';
const date     = _s('npm-date')?.value || '';
const comments = (_s('npm-comments')?.value || '').trim();
const postLink = (_s('npm-postlink')?.value || '').trim();

if (!title) {
console.warn('[submitNewPost] BLOCKED: title empty');
showToast('Post title is required', 'error');
_s('npm-title')?.focus();
return;
}

if (!owner) {
console.warn('[submitNewPost] BLOCKED: owner empty');
showToast('Owner is required', 'error');
_s('npm-owner')?.focus();
return;
}

const submitBtn = _s('npm-submit-btn');
const savingMsg = _s('npm-saving');

if (submitBtn) submitBtn.disabled = true;
if (savingMsg) savingMsg.classList.add('active');

const payload = {
post_id: 'POST-' + Date.now(),
title,
owner,
content_pillar: sanitizePillar(pillar) || null,
location: location || null,
stage: toDbStage(stage || 'in production'),
target_date: date || null,
comments: comments || null,
};
// Defensive: remove any invalid field names that must never reach DB
delete payload.post_link;
delete payload.linkedin_url;
delete payload.linkedinLink;
delete payload.postLink;
// Route link to correct DB column based on URL content
if (postLink) {
  if (postLink.includes('linkedin.com')) {
    payload.linkedin_link = postLink;
  } else if (postLink.includes('canva.com')) {
    payload.canva_link = postLink;
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

document.getElementById('new-post-overlay')?.classList.remove('open');
document.body.style.overflow = '';
window._modalOpen = false;

await loadPosts();

showToast('Post created OK', 'success');

} catch (err) {

console.error('[submitNewPost] API FAILED:', err);

saveDraft();

showToast('Failed to create - draft saved', 'error');

if (submitBtn) submitBtn.disabled = false;
if (savingMsg) savingMsg.classList.remove('active');
}
}
