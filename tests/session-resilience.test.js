import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

var authSrc = readFileSync(resolve(__dirname, '..', '03-auth.js'), 'utf8');
var apiSrc = readFileSync(resolve(__dirname, '..', '05-api.js'), 'utf8');
var routerSrc = readFileSync(resolve(__dirname, '..', '04-router.js'), 'utf8');
var postLoadSrc = readFileSync(resolve(__dirname, '..', '07-post-load.js'), 'utf8');
var postActionsSrc = readFileSync(resolve(__dirname, '..', '08-post-actions.js'), 'utf8');
var approvalSrc = readFileSync(resolve(__dirname, '..', '09-approval.js'), 'utf8');

// ── LAYER 1: refreshSession typed errors ────────────────────

describe('LAYER 1 — refreshSession typed error returns', function() {

  it('1. refreshSession returns { error: auth_expired } on 400/401/403', function() {
    var match = authSrc.match(/async function _doRefresh[\s\S]*?^}/m);
    expect(match).toBeTruthy();
    var body = match[0];
    expect(body).toContain("res.status === 400");
    expect(body).toContain("res.status === 401");
    expect(body).toContain("res.status === 403");
    expect(body).toContain("error: 'auth_expired'");
  });

  it('2. refreshSession returns { error: server } on non-ok non-auth response', function() {
    var match = authSrc.match(/async function _doRefresh[\s\S]*?^}/m);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("error: 'server'");
  });

  it('3. refreshSession returns { error: network } on TypeError', function() {
    var match = authSrc.match(/async function _doRefresh[\s\S]*?^}/m);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("err.name === 'TypeError'");
    expect(match[0]).toContain("error: 'network'");
  });

  it('4. refreshSession returns { token } on success', function() {
    var match = authSrc.match(/async function _doRefresh[\s\S]*?^}/m);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("token: data.access_token");
  });

  it('5. refreshSession returns { error: auth_expired } when no refresh token', function() {
    var match = authSrc.match(/async function refreshSession\(\)[\s\S]{0,300}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("{ error: 'auth_expired' }");
  });

  it('6. apiFetch handles result.token on 401', function() {
    expect(apiSrc).toContain('result.token');
  });

  it('7. apiFetch calls _clearSessionAndLogin on auth_expired', function() {
    expect(apiSrc).toContain("result.error === 'auth_expired'");
    expect(apiSrc).toContain('_clearSessionAndLogin');
  });

  it('8. apiFetch shows soft banner on network error, not session expired', function() {
    expect(apiSrc).toContain('Connection issue');
    expect(apiSrc).toContain("result.error");
  });

  it('9. _startRouter handles typed result from refreshSession', function() {
    expect(routerSrc).toContain('result.token');
    expect(routerSrc).toContain("result.error === 'auth_expired'");
  });

  it('10. client 50-min timer handles auth_expired', function() {
    var clientTimer = authSrc.match(/50 \* 60 \* 1000[\s\S]{0,50}/);
    expect(clientTimer).toBeTruthy();
    // Verify the 50-min timer block contains auth_expired handling
    var timerBlock = authSrc.match(/_clientTokenTimer = setInterval[\s\S]{0,600}/);
    expect(timerBlock).toBeTruthy();
    expect(timerBlock[0]).toContain("result.error === 'auth_expired'");
    expect(timerBlock[0]).toContain('_clearSessionAndLogin');
  });

  it('11. non-client 50-min timer handles auth_expired', function() {
    var timer = postLoadSrc.match(/tokenRefresh[\s\S]{0,800}50 \* 60/);
    expect(timer).toBeTruthy();
    expect(timer[0]).toContain("result.error === 'auth_expired'");
    expect(timer[0]).toContain('_clearSessionAndLogin');
  });
});

// ── LAYER 2: Cross-tab refresh lock ─────────────────────────

describe('LAYER 2 — Cross-tab refresh lock', function() {

  it('12. refreshSession checks _srtd_refresh_lock before refresh', function() {
    expect(authSrc).toContain('_srtd_refresh_lock');
    var match = authSrc.match(/async function refreshSession[\s\S]*?_refreshInProgress = _doRefresh/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("localStorage.getItem('_srtd_refresh_lock')");
  });

  it('13. _doRefresh sets lock before fetch and removes in finally', function() {
    var match = authSrc.match(/async function _doRefresh[\s\S]*?finally[\s\S]*?\}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("localStorage.setItem('_srtd_refresh_lock'");
    expect(match[0]).toContain("localStorage.removeItem('_srtd_refresh_lock')");
  });

  it('14. cross-tab lock polls for new token at 300ms intervals', function() {
    var match = authSrc.match(/Another tab is refreshing[\s\S]{0,500}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain('300');
    expect(match[0]).toContain('setInterval');
  });

  it('15. storage event listener handles token cleared by other tab', function() {
    expect(authSrc).toContain("addEventListener('storage'");
    expect(authSrc).toContain("e.key === 'sb_access_token'");
    expect(authSrc).toContain('!e.newValue');
    expect(authSrc).toContain('showLoginOverlay');
  });
});

// ── LAYER 3: visibilitychange + _authReady ──────────────────

describe('LAYER 3 — visibilitychange with _authReady guard', function() {

  it('16. visibilitychange listener is bound once', function() {
    expect(authSrc).toContain('_visibilityRefreshBound');
    expect(authSrc).toContain("addEventListener('visibilitychange'");
  });

  it('17. visibilitychange checks _authReady before refresh', function() {
    var match = authSrc.match(/visibilitychange[\s\S]{0,500}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain('_authReady');
  });

  it('18. visibilitychange only fires when document becomes visible', function() {
    var match = authSrc.match(/visibilitychange[\s\S]{0,300}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("visibilityState !== 'visible'");
  });

  it('19. visibilitychange skips if URL has access_token hash', function() {
    var match = authSrc.match(/visibilitychange[\s\S]{0,500}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain('access_token');
  });

  it('20. visibilitychange calls _clearSessionAndLogin on auth_expired', function() {
    var visBlock = authSrc.match(/visibilitychange[\s\S]{0,800}/);
    expect(visBlock).toBeTruthy();
    expect(visBlock[0]).toContain("result.error === 'auth_expired'");
    expect(visBlock[0]).toContain('_clearSessionAndLogin');
  });

  it('21. _startRouter sets _authReady = true on all exit paths', function() {
    var paths = routerSrc.match(/_authReady\s*=\s*true/g);
    // At least 4 exit paths: refresh success, auth_expired, network fallback,
    // savedToken fallback, showLoginOverlay
    expect(paths).toBeTruthy();
    expect(paths.length).toBeGreaterThanOrEqual(4);
  });
});

// ── BONUS: clientApprove guardAction + payload alignment ────

describe('BONUS — clientApprove guardAction + approval payload', function() {

  it('22. clientApprove is wrapped in guardAction', function() {
    var match = postActionsSrc.match(/function clientApprove[\s\S]{0,500}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("window.guardAction('client-approve-'");
  });

  it('23. submitApproval approved PATCH includes status_changed_at', function() {
    // Find the 'approved' branch PATCH body
    var approvedMatch = approvalSrc.match(/type === 'approved'[\s\S]{0,400}/);
    expect(approvedMatch).toBeTruthy();
    expect(approvedMatch[0]).toContain('status_changed_at');
  });

  it('24. submitApproval approved PATCH includes updated_by Client', function() {
    var approvedMatch = approvalSrc.match(/type === 'approved'[\s\S]{0,400}/);
    expect(approvedMatch).toBeTruthy();
    expect(approvedMatch[0]).toContain("updated_by: 'Client'");
  });

  it('25. _clearSessionAndLogin is exported to window', function() {
    expect(authSrc).toContain('window._clearSessionAndLogin = _clearSessionAndLogin');
  });
});
