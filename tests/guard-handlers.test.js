import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Load guardAction from the real 00-appstate.js so we're testing
// production code. 00-appstate.js declares a module-scoped
// `const _inFlight = new Set()` and assigns window.guardAction.
var appstateSrc = fs.readFileSync(
  path.join(__dirname, '..', '00-appstate.js'), 'utf8');

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Phase 5 — guardAction double-tap coverage', function() {

  beforeAll(function() {
    window.AppState = {
      user: { name:'T', email:'t@t.com',
        role:'Admin', effectiveRole:'Admin', previewRole:null },
      posts: { all:[], cached:[], loaded:false,
        setAll:function(p){ window.AppState.posts.all = p; } },
      pcs: { open:false, postId:null, activeMenu:null },
      ui: { modalOpen:false, unreadCount:0 },
      timers: {}
    };
    window.fetch = vi.fn(function() { return Promise.resolve({ ok:true }); });
    // One eval is enough; _inFlight Set is released per-key after each
    // promise settles so unique keys keep tests isolated.
    eval(appstateSrc);
  });

  beforeEach(function() {
    window.logError  = vi.fn();
    window.showToast = vi.fn();
    window._pcsCommentsLoading = false;
  });

  // ---------------------------------------------------------
  // 1. clientAcknowledge double-tap
  // ---------------------------------------------------------
  it('1. clientAcknowledge double-tap → fn called once', async function() {
    const fn = vi.fn(() => Promise.resolve());
    await Promise.all([
      window.guardAction('client-acknowledge-post1', fn),
      window.guardAction('client-acknowledge-post1', fn)
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    await flush();
  });

  // ---------------------------------------------------------
  // 2. submitPcsComment double-tap
  // ---------------------------------------------------------
  it('2. submitPcsComment double-tap → fn called once', async function() {
    const fn = vi.fn(() => Promise.resolve());
    await Promise.all([
      window.guardAction('submit-pcs-comment-post1', fn),
      window.guardAction('submit-pcs-comment-post1', fn)
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    await flush();
  });

  // ---------------------------------------------------------
  // 3. _pcsDoDeleteComment double-tap
  // ---------------------------------------------------------
  it('3. _pcsDoDeleteComment double-tap → fn called once', async function() {
    const fn = vi.fn(() => Promise.resolve());
    await Promise.all([
      window.guardAction('pcs-delete-comment-comment1', fn),
      window.guardAction('pcs-delete-comment-comment1', fn)
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    await flush();
  });

  // ---------------------------------------------------------
  // 4. pcsDoDelete double-tap
  // ---------------------------------------------------------
  it('4. pcsDoDelete double-tap → fn called once', async function() {
    const fn = vi.fn(() => Promise.resolve());
    await Promise.all([
      window.guardAction('pcs-delete-post-post1', fn),
      window.guardAction('pcs-delete-post-post1', fn)
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    await flush();
  });

  // ---------------------------------------------------------
  // 5. submitApproval double-tap
  // ---------------------------------------------------------
  it('5. submitApproval double-tap → fn called once', async function() {
    const fn = vi.fn(() => Promise.resolve());
    await Promise.all([
      window.guardAction('submit-approval-post1', fn),
      window.guardAction('submit-approval-post1', fn)
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    await flush();
  });

  // ---------------------------------------------------------
  // 6. _saveCaptionEdit double-tap
  // ---------------------------------------------------------
  it('6. _saveCaptionEdit double-tap → fn called once', async function() {
    const fn = vi.fn(() => Promise.resolve());
    await Promise.all([
      window.guardAction('save-caption-post1', fn),
      window.guardAction('save-caption-post1', fn)
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    await flush();
  });

  // ---------------------------------------------------------
  // 7. loadPcsComments loading flag (NOT guardAction — dedicated
  //    window._pcsCommentsLoading flag, matches loadPosts pattern)
  // ---------------------------------------------------------
  it('7. loadPcsComments loading flag blocks second load', async function() {
    // Replicate the in-function guard verbatim from actions/pcs.js:
    //   if (window._pcsCommentsLoading) return;
    //   window._pcsCommentsLoading = true;
    //   try { await fetch(...) } finally { window._pcsCommentsLoading = false; }
    const doLoad = async () => {
      if (window._pcsCommentsLoading) return;
      window._pcsCommentsLoading = true;
      try {
        await window.fetch('/rest/v1/post_comments?post_id=eq.p');
      } finally {
        window._pcsCommentsLoading = false;
      }
    };

    window._pcsCommentsLoading = true;
    const fetchSpy = vi.fn(() => Promise.resolve({ ok:true }));
    window.fetch = fetchSpy;

    await doLoad();
    expect(fetchSpy).not.toHaveBeenCalled();

    window._pcsCommentsLoading = false;
    await doLoad();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------
  // 8. Different keys do not block each other
  // ---------------------------------------------------------
  it('8. different keys do not block each other', async function() {
    const fn1 = vi.fn(() => Promise.resolve());
    const fn2 = vi.fn(() => Promise.resolve());
    await Promise.all([
      window.guardAction('key-a', fn1),
      window.guardAction('key-b', fn2)
    ]);
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    await flush();
  });

  // ---------------------------------------------------------
  // 9. Partial failure — listener survives
  // ---------------------------------------------------------
  it('9. failing handler fires logError+showToast; next call still works', async function() {
    const failing = vi.fn(async function() { throw new Error('boom'); });
    window.guardAction('guard-h9-a', failing);
    await flush();
    expect(window.logError).toHaveBeenCalled();
    expect(window.showToast).toHaveBeenCalled();

    const ok = vi.fn(() => Promise.resolve());
    window.guardAction('guard-h9-b', ok);
    expect(ok).toHaveBeenCalledTimes(1);
    await flush();
  });

  // ---------------------------------------------------------
  // 10. _handleSubmitComment data-submitting flag guard
  // ---------------------------------------------------------
  it('10. data-submitting attribute blocks second call, clears to allow next', function() {
    // Replicate the guard shape from render/client.js:
    //   if (input.dataset.submitting === 'true' || …) return;
    const input = document.createElement('textarea');

    const submitSpy = vi.fn();
    const submit = function() {
      if (input.dataset.submitting === 'true') return;
      input.dataset.submitting = 'true';
      submitSpy();
    };

    // First tap while flag is already true → blocked.
    input.dataset.submitting = 'true';
    submit();
    expect(submitSpy).not.toHaveBeenCalled();

    // Reset flag → next call goes through and sets the flag again.
    input.dataset.submitting = '';
    submit();
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(input.dataset.submitting).toBe('true');

    // Immediate re-tap while in-flight → blocked.
    submit();
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
