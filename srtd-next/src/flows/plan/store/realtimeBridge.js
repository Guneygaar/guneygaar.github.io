// Plan React realtime spine (PR-A).
//
// Vanilla owns the Supabase channels (07-post-load.js startAgencyRealtime /
// startClientRealtime). React subscribes to two window events that vanilla
// dispatches after every mergePosts and every _recomputeBadgeLocal pass:
//
//   sorted:posts-updated         -> { posts, requests }
//   sorted:notifications-updated -> { notifications, unreadCount }
//
// This bridge is the only React consumer of those events. It pushes the
// snapshots into planStore. While a sheet or React PCS overlay is open
// the bridge pauses applying snapshots — the latest snapshot is kept in
// a pending slot (overwrite, never queue) and applied on resume.
//
// Strangler-fig invariants:
//   - Never imports @supabase/supabase-js or window.apiFetch.
//   - Never opens a channel; it only listens to window events.
//   - Idempotent: starting twice returns the same stopFn.

let _started = false;
let _stopFn = null;
let _store = null;

let _pauseCount = 0;
let _pendingPosts = null;
let _pendingNotifications = null;

function _applyPostsSnapshot(detail) {
  if (!_store || !detail) return;
  const apply = _store.getState().applyPostsSnapshot;
  if (typeof apply === 'function') {
    apply(detail);
  }
}

function _applyNotificationsSnapshot(detail) {
  if (!_store || !detail) return;
  const apply = _store.getState().applyNotificationsSnapshot;
  if (typeof apply === 'function') {
    apply(detail);
  }
}

function _onPosts(ev) {
  const detail = ev && ev.detail ? ev.detail : null;
  if (!detail) return;
  if (_pauseCount > 0) {
    _pendingPosts = detail;
    return;
  }
  _applyPostsSnapshot(detail);
}

function _onNotifications(ev) {
  const detail = ev && ev.detail ? ev.detail : null;
  if (!detail) return;
  if (_pauseCount > 0) {
    _pendingNotifications = detail;
    return;
  }
  _applyNotificationsSnapshot(detail);
}

// Vanilla brief sheet (render/brief.js) is opened from Plan React via
// BriefsSection.jsx and the deep-link drain in srtd-next/src/index.jsx.
// While the brief sheet is on screen we pause snapshot application so a
// realtime echo can't blow away the brief overlay's local state. Vanilla
// dispatches sorted:brief-sheet-opened on _openBriefSheet's appendChild
// and sorted:brief-sheet-closed when the overlay is removed (any path,
// observed via MutationObserver in render/brief.js).
function _onBriefOpen() { pauseRealtime(); }
function _onBriefClose() { resumeRealtime(); }

export function startRealtimeBridge(store) {
  if (_started) return _stopFn;
  if (!store || typeof store.getState !== 'function') {
    console.warn('[realtimeBridge] store missing getState — not starting');
    return () => {};
  }
  if (typeof window === 'undefined') return () => {};

  _store = store;
  window.addEventListener('sorted:posts-updated', _onPosts);
  window.addEventListener('sorted:notifications-updated', _onNotifications);
  window.addEventListener('sorted:brief-sheet-opened', _onBriefOpen);
  window.addEventListener('sorted:brief-sheet-closed', _onBriefClose);
  _started = true;

  _stopFn = function stopRealtimeBridge() {
    if (!_started) return;
    window.removeEventListener('sorted:posts-updated', _onPosts);
    window.removeEventListener('sorted:notifications-updated', _onNotifications);
    window.removeEventListener('sorted:brief-sheet-opened', _onBriefOpen);
    window.removeEventListener('sorted:brief-sheet-closed', _onBriefClose);
    _started = false;
    _store = null;
    _pauseCount = 0;
    _pendingPosts = null;
    _pendingNotifications = null;
    _stopFn = null;
  };
  return _stopFn;
}

export function pauseRealtime() {
  _pauseCount += 1;
}

export function resumeRealtime() {
  if (_pauseCount <= 0) {
    _pauseCount = 0;
    return;
  }
  _pauseCount -= 1;
  if (_pauseCount > 0) return;
  if (_pendingPosts) {
    const snap = _pendingPosts;
    _pendingPosts = null;
    _applyPostsSnapshot(snap);
  }
  if (_pendingNotifications) {
    const snap = _pendingNotifications;
    _pendingNotifications = null;
    _applyNotificationsSnapshot(snap);
  }
}

export function isPaused() {
  return _pauseCount > 0;
}
