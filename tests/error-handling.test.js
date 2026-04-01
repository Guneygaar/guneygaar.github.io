import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Phase 3 — Error Handling', function() {

  beforeEach(function() {
    window.AppState = {
      user: { name: 'Test', email: 'test@test.com',
        role: 'Admin', effectiveRole: 'Admin', previewRole: null },
      posts: { all: [], cached: [], loaded: false,
        setAll: function(p) { window.AppState.posts.all = p; } },
      pcs: { open: false, postId: null, activeMenu: null },
      ui: { modalOpen: false, unreadCount: 0 },
      timers: {}
    };
    window.SUPABASE_URL = 'https://test.supabase.co';
    window.SUPABASE_KEY = 'test-key';
    window.fetch = vi.fn(function() {
      return Promise.resolve({ ok: true });
    });
    // Clean up any toast from previous test
    var existing = document.getElementById('sorted-error-toast');
    if (existing) existing.parentNode.removeChild(existing);
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

  it('2. window.logError calls fetch with URL containing error_log', function() {
    window.logError('test error', 'stack trace', 'test-action');
    expect(window.fetch).toHaveBeenCalledTimes(1);
    var callArgs = window.fetch.mock.calls[0];
    expect(callArgs[0]).toContain('error_log');
  });

  it('3. payload includes user_email from AppState.user.email', function() {
    window.logError('test', '', 'test');
    var body = JSON.parse(window.fetch.mock.calls[0][1].body);
    expect(body.user_email).toBe('test@test.com');
  });

  it('4. payload includes user_role from AppState.user.effectiveRole', function() {
    window.logError('test', '', 'test');
    var body = JSON.parse(window.fetch.mock.calls[0][1].body);
    expect(body.user_role).toBe('Admin');
  });

  it('5. payload includes app_version string (not empty)', function() {
    window.logError('test', '', 'test');
    var body = JSON.parse(window.fetch.mock.calls[0][1].body);
    expect(body.app_version).toBeTruthy();
    expect(typeof body.app_version).toBe('string');
  });

  it('6. payload includes page from window.location.pathname', function() {
    window.logError('test', '', 'test');
    var body = JSON.parse(window.fetch.mock.calls[0][1].body);
    expect(body.page).toBe(window.location.pathname);
  });

  it('7. payload includes action parameter passed to logError', function() {
    window.logError('test', '', 'my-custom-action');
    var body = JSON.parse(window.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('my-custom-action');
  });

  it('8. fetch failure inside logError does not throw', function() {
    window.fetch = vi.fn(function() {
      return Promise.reject(new Error('network down'));
    });
    expect(function() {
      window.logError('test', '', 'test');
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

});
