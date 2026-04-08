import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

var uiSrc = readFileSync(resolve(__dirname, '..', '10-ui.js'), 'utf8');
var pcsSrc = readFileSync(resolve(__dirname, '..', 'actions', 'pcs.js'), 'utf8');
var postLoadSrc = readFileSync(resolve(__dirname, '..', '07-post-load.js'), 'utf8');
var briefSrc = readFileSync(resolve(__dirname, '..', 'render', 'brief.js'), 'utf8');

describe('FIX 1 — session token guards on apiFetch callers', function() {

  it('updateNotifBadge has session token guard', function() {
    var match = uiSrc.match(/function updateNotifBadge\(\)\s*\{[^}]{0,200}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("localStorage.getItem('sb_access_token')");
  });

  it('_flushClickBuffer has session token guard', function() {
    var match = uiSrc.match(/function _flushClickBuffer\(\)\s*\{[^}]{0,300}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("localStorage.getItem('sb_access_token')");
  });

  it('loadNotifications has session token guard', function() {
    var match = uiSrc.match(/async function loadNotifications\(\)\s*\{[^}]{0,200}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("localStorage.getItem('sb_access_token')");
  });

  it('startRealtime polling callback has session token guard', function() {
    var realtimeBlock = postLoadSrc.match(/realtimeTimer\s*=\s*setInterval[\s\S]{0,400}/);
    expect(realtimeBlock).toBeTruthy();
    expect(realtimeBlock[0]).toContain("localStorage.getItem('sb_access_token')");
  });
});

describe('FIX 2 — UUID validation before apiFetch', function() {

  it('_pcsDoDeleteComment validates commentId before guardAction', function() {
    var match = pcsSrc.match(/_pcsDoDeleteComment\s*=\s*async function\(commentId[\s\S]{0,400}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("!commentId");
    expect(match[0]).toContain("typeof commentId !== 'string'");
    expect(match[0]).toContain("commentId.trim()");
  });

  it('toggleTaskResolve validates commentId before apiFetch', function() {
    var match = pcsSrc.match(/toggleTaskResolve\s*=\s*function\(commentId[\s\S]{0,400}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("!commentId");
    expect(match[0]).toContain("typeof commentId !== 'string'");
  });

  it('_saveLiUrlInline validates _liPostId before apiFetch', function() {
    var match = pcsSrc.match(/_liPostId\s*=\s*_liPost[\s\S]{0,200}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("!_liPostId");
  });

  it('_closeBrief validates postId before apiFetch', function() {
    var match = briefSrc.match(/_closeBrief\s*=\s*function\(postId\)\s*\{[^}]{0,300}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("!postId");
  });

  it('_reopenBrief validates postId before apiFetch', function() {
    var match = briefSrc.match(/_reopenBrief\s*=\s*function\(postId\)\s*\{[^}]{0,300}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("!postId");
  });
});

describe('FIX 3 — _pcsDateChange guards re-render on closed PCS', function() {

  it('_pcsDateChange wraps updatePost+openPCS in pcs.open guard', function() {
    var match = pcsSrc.match(/_pcsDateChange\s*=\s*function[\s\S]{0,800}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain('AppState.pcs.open');
    // updatePost and openPCS must be INSIDE the guard, not before it
    var guardIdx = match[0].indexOf('AppState.pcs.open');
    var updateIdx = match[0].indexOf('updatePost(postId');
    var openIdx = match[0].indexOf('openPCS(postId');
    expect(updateIdx).toBeGreaterThan(guardIdx);
    expect(openIdx).toBeGreaterThan(guardIdx);
  });
});
