/* ===============================================
06-post-create.js - New Post modal & drafts
=============================================== */

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

document.getElementById('npm-title').value    = d.title    || '';
document.getElementById('npm-pillar').value   = d.pillar   || '';
document.getElementById('npm-location').value = d.location || '';
document.getElementById('npm-owner').value    = d.owner    || '';
document.getElementById('npm-stage').value    = d.stage    || 'in production';
document.getElementById('npm-date').value     = d.date     || '';
document.getElementById('npm-comments').value = d.comments || '';
document.getElementById('npm-postlink').value = d.postLink || '';

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
.map(p => `<option value="${p}">${(PILLAR_DISPLAY && PILLAR_DISPLAY[p]) || p}</option>`)
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

document.getElementById('npm-pillar').value   = '';
document.getElementById('npm-location').value = '';
document.getElementById('npm-owner').value    = '';
document.getElementById('npm-stage').value    = 'in production';
document.getElementById('npm-date').value     = '';
}

document.getElementById('npm-submit-btn').disabled = false;
document.getElementById('npm-saving').classList.remove('active');

document.getElementById('new-post-overlay').classList.add('open');
document.body.style.overflow = 'hidden';

startDraftAutosave();

setTimeout(() => document.getElementById('npm-title')?.focus(), 60);
}

function closeNewPostModal(e) {

if (e && e.target !== document.getElementById('new-post-overlay')) return;

saveDraft();
stopDraftAutosave();

document.getElementById('new-post-overlay').classList.remove('open');
document.body.style.overflow = '';
}

async function submitNewPost() {

const title    = document.getElementById('npm-title').value.trim();
const owner    = document.getElementById('npm-owner').value;
const pillar   = document.getElementById('npm-pillar').value;
const location = document.getElementById('npm-location').value;
const stage    = document.getElementById('npm-stage').value;
const date     = document.getElementById('npm-date').value;
const comments = document.getElementById('npm-comments').value.trim();
const postLink = document.getElementById('npm-postlink').value.trim();

if (!title) {
showToast('Post title is required', 'error');
document.getElementById('npm-title').focus();
return;
}

if (!owner) {
showToast('Owner is required', 'error');
document.getElementById('npm-owner').focus();
return;
}

const submitBtn = document.getElementById('npm-submit-btn');
const savingMsg = document.getElementById('npm-saving');

submitBtn.disabled = true;
savingMsg.classList.add('active');

try {

await apiFetch('/posts', {
method: 'POST',
body: JSON.stringify({
post_id: 'POST-' + Date.now(),
title,
owner,
content_pillar: pillar || null,
location: location || null,
stage: stage || 'in production',
target_date: date || null,
comments: comments || null,
post_link: postLink || null
})
});

clearDraft();
stopDraftAutosave();

document.getElementById('new-post-overlay').classList.remove('open');
document.body.style.overflow = '';

await loadPosts();

showToast('Post created OK', 'success');

} catch (err) {

console.error('submitNewPost:', err);

saveDraft();

showToast('Failed to create - draft saved', 'error');

submitBtn.disabled = false;
savingMsg.classList.remove('active');
}
}
