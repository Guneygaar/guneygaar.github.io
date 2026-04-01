import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Phase 3 — Error Handling', function() {

  var _apiFetchCalls = [];

  beforeEach(function() {
    vi.useFakeTimers();
    _apiFetchCalls = [];
    window.AppState = {
      user: { name: 'Test', email: 'test@test.com',
        role: 'Admin', effectiveRole: 'Admin', previewRole: null },
      posts: { all: [], cached: [], loaded: false,
        setAll: function(p) { window.AppState.posts.all = p; } },
      pcs: { open: false, postId: null, activeMenu: null },
      ui: { modalOpen: false, unreadCount: 0 },
      timers: {}
    };
    window.apiFetch = vi.fn(function(url, opts) {
      _apiFetchCalls.push({ url: url, opts: opts });
      return Promise.resolve({ ok: true });
    });
    // Clean up any toast from previous test
    var existing = document.getElementById('sorted-error-toast');
    if (existing) existing.parentNode.removeChild(existing);
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  // Load the actual source
  var appstateSrc = require('fs').readFileSync(
    require('path').join(__dirname, '..', '00-appstate.js'), 'utf8');
  eval(appstateSrc);

  var uiSrc = require('fs').readFileSync(
    require('path').join(__dirname, '..', '10-ui.js'), 'utf8');

  it('1. window.logError exists after 00-appstate.js loads', function() {
    expect(typeof window.logError).toBe('function');
  });

  it('2. window.logError calls apiFetch with URL containing error_log', function() {
    window.logError('test error', 'stack trace', 'test-action');
    vi.advanceTimersByTime(1);
    expect(window.apiFetch).toHaveBeenCalledTimes(1);
    var callArgs = window.apiFetch.mock.calls[0];
    expect(callArgs[0]).toContain('error_log');
  });

  it('3. payload includes user_email from AppState.user.email', function() {
    window.logError('test', '', 'test');
    vi.advanceTimersByTime(1);
    var body = JSON.parse(window.apiFetch.mock.calls[0][1].body);
    expect(body.user_email).toBe('test@test.com');
  });

  it('4. payload includes user_role from AppState.user.effectiveRole', function() {
    window.logError('test', '', 'test');
    vi.advanceTimersByTime(1);
    var body = JSON.parse(window.apiFetch.mock.calls[0][1].body);
    expect(body.user_role).toBe('Admin');
  });

  it('5. payload includes app_version string (not empty)', function() {
    window.logError('test', '', 'test');
    vi.advanceTimersByTime(1);
    var body = JSON.parse(window.apiFetch.mock.calls[0][1].body);
    expect(body.app_version).toBeTruthy();
    expect(typeof body.app_version).toBe('string');
  });

  it('6. payload includes page from window.location.pathname', function() {
    window.logError('test', '', 'test');
    vi.advanceTimersByTime(1);
    var body = JSON.parse(window.apiFetch.mock.calls[0][1].body);
    expect(body.page).toBe(window.location.pathname);
  });

  it('7. payload includes action parameter passed to logError', function() {
    window.logError('test', '', 'my-custom-action');
    vi.advanceTimersByTime(1);
    var body = JSON.parse(window.apiFetch.mock.calls[0][1].body);
    expect(body.action).toBe('my-custom-action');
  });

  it('8. apiFetch failure inside logError does not throw', function() {
    window.apiFetch = vi.fn(function() {
      return Promise.reject(new Error('network down'));
    });
    expect(function() {
      window.logError('test', '', 'test');
      vi.advanceTimersByTime(1);
    }).not.toThrow();
  });

  it('9. window._showErrorToast creates #sorted-error-toast in DOM', function() {
    // Eval the _showErrorToast function from 10-ui.js
    var match = uiSrc.match(/window\._showErrorToast\s*=\s*function[\s\S]*?;\s*\n\s*\};/);
    expect(match).not.toBeNull();
    eval(match[0]);
    window._showErrorToast();
    var toast = document.getElementById('sorted-error-toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Something went wrong');
  });

  it('10. calling _showErrorToast twice only creates one toast in DOM', function() {
    var match = uiSrc.match(/window\._showErrorToast\s*=\s*function[\s\S]*?;\s*\n\s*\};/);
    eval(match[0]);
    window._showErrorToast();
    window._showErrorToast();
    var toasts = document.querySelectorAll('#sorted-error-toast');
    expect(toasts.length).toBe(1);
  });

  // -- Pass 4: actions/pcs.js error handling --
  var pcsSrc = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'actions', 'pcs.js'), 'utf8');

  it('11. loadPcsComments() catch calls window.logError', function() {
    var match = pcsSrc.match(/catch\(e\)\s*\{\s*\n\s*console\.error\('loadPcsComments failed:'/);
    expect(match).toBeTruthy();
    var block = pcsSrc.slice(pcsSrc.indexOf(match[0]), pcsSrc.indexOf(match[0]) + 300);
    expect(block).toContain('logError');
  });

  it('12. submitPcsComment() catch calls window.logError', function() {
    var match = pcsSrc.match(/catch\(e\)\s*\{\s*\n\s*console\.error\('submitPcsComment failed:'/);
    expect(match).toBeTruthy();
    var block = pcsSrc.slice(pcsSrc.indexOf(match[0]), pcsSrc.indexOf(match[0]) + 300);
    expect(block).toContain('logError');
  });

  it('13. _doSubmitComment() catch calls window.logError', function() {
    var match = pcsSrc.match(/catch\(e\)\s*\{\s*\n\s*console\.error\('_doSubmitComment failed:'/);
    expect(match).toBeTruthy();
    var block = pcsSrc.slice(pcsSrc.indexOf(match[0]), pcsSrc.indexOf(match[0]) + 300);
    expect(block).toContain('logError');
  });

  it('14. _pcsDoDeleteComment() catch calls window.logError', function() {
    var match = pcsSrc.match(/window\._pcsDoDeleteComment\s*=\s*async\s*function[\s\S]*?\} catch/);
    expect(match).toBeTruthy();
    var catchBlock = pcsSrc.slice(pcsSrc.indexOf(match[0]) + match[0].length, pcsSrc.indexOf(match[0]) + match[0].length + 300);
    expect(catchBlock).toContain('logError');
  });

  it('15. pcsDoDelete() catch calls window.logError', function() {
    var match = pcsSrc.match(/window\.pcsDoDelete\s*=\s*async\s*function[\s\S]*?\} catch/);
    expect(match).toBeTruthy();
    var catchBlock = pcsSrc.slice(pcsSrc.indexOf(match[0]) + match[0].length, pcsSrc.indexOf(match[0]) + match[0].length + 300);
    expect(catchBlock).toContain('logError');
  });

  it('16. _pcsHandlePhotoInput() catch calls showToast not alert', function() {
    var match = pcsSrc.match(/window\._pcsHandlePhotoInput\s*=\s*async\s*function[\s\S]*?\n\}/);
    expect(match).toBeTruthy();
    var outerCatch = match[0].match(/\} catch\(e\) \{\s*\n\s*console\.error\('\[pcs\][\s\S]*?\n  \}/);
    expect(outerCatch).toBeTruthy();
    expect(outerCatch[0]).not.toContain('alert(');
    expect(outerCatch[0]).toContain('showToast');
    expect(outerCatch[0]).toContain('logError');
  });

  it('17. _pcsRemovePhoto() catch calls showToast not alert', function() {
    var match = pcsSrc.match(/window\._pcsRemovePhoto\s*=\s*async\s*function[\s\S]*?\n\}/);
    expect(match).toBeTruthy();
    var outerCatch = match[0].match(/\} catch\(e\) \{[\s\S]*?\n  \}/);
    expect(outerCatch).toBeTruthy();
    expect(outerCatch[0]).not.toContain('alert(');
    expect(outerCatch[0]).toContain('showToast');
    expect(outerCatch[0]).toContain('logError');
  });

  it('18. _saveCaptionEdit() catch calls showToast not alert', function() {
    var match = pcsSrc.match(/window\._saveCaptionEdit\s*=\s*async\s*function[\s\S]*?\n\}/);
    expect(match).toBeTruthy();
    var outerCatch = match[0].match(/\} catch \(err\) \{[\s\S]*?\n  \}/);
    expect(outerCatch).toBeTruthy();
    expect(outerCatch[0]).not.toContain('alert(');
    expect(outerCatch[0]).toContain('showToast');
    expect(outerCatch[0]).toContain('logError');
  });

});
