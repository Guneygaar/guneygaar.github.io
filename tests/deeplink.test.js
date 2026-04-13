import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

var routerSrc = readFileSync(resolve(__dirname, '..', '04-router.js'), 'utf8');
var postLoadSrc = readFileSync(resolve(__dirname, '..', '07-post-load.js'), 'utf8');

/*
  Deep link feature spec:
  - URL param ?open=POST_ID sets window._pendingOpenPost
  - After auth + loadPosts, renderAll checks _pendingOpenPost
  - If set, openPCS(postId) is called, then _pendingOpenPost cleared
*/

describe('Deep link — URL param parsing', function() {

  beforeEach(function() {
    window._pendingOpenPost = undefined;
  });

  it('1. ?open=POST-123 sets _pendingOpenPost to POST-123', function() {
    var params = new URLSearchParams('?open=POST-123');
    var openParam = params.get('open');
    if (openParam) window._pendingOpenPost = openParam;
    expect(window._pendingOpenPost).toBe('POST-123');
  });

  it('2. ?open= with empty value does not set _pendingOpenPost', function() {
    var params = new URLSearchParams('?open=');
    var openParam = params.get('open');
    if (openParam) window._pendingOpenPost = openParam;
    expect(window._pendingOpenPost).toBeUndefined();
  });

  it('3. URL with no ?open param leaves _pendingOpenPost undefined', function() {
    var params = new URLSearchParams('?tab=pipeline');
    var openParam = params.get('open');
    if (openParam) window._pendingOpenPost = openParam;
    expect(window._pendingOpenPost).toBeUndefined();
  });

  it('4. _pendingOpenPost is cleared after openPCS is called', function() {
    window._pendingOpenPost = 'POST-456';
    var postId = window._pendingOpenPost;
    window._pendingOpenPost = null;
    expect(postId).toBe('POST-456');
    expect(window._pendingOpenPost).toBeNull();
  });

  it('5. openPCS receives correct postId from _pendingOpenPost', function() {
    window._pendingOpenPost = 'POST-789';
    var calledWith = null;
    var mockOpenPCS = function(pid) { calledWith = pid; };
    if (window._pendingOpenPost) {
      mockOpenPCS(window._pendingOpenPost);
      window._pendingOpenPost = null;
    }
    expect(calledWith).toBe('POST-789');
  });

  it('6. ?approve= param does not set _pendingOpenPost', function() {
    var params = new URLSearchParams('?approve=ABCD');
    var openParam = params.get('open');
    if (openParam) window._pendingOpenPost = openParam;
    expect(window._pendingOpenPost).toBeUndefined();
    expect(params.get('approve')).toBe('ABCD');
  });

  it('7. ?open=POST-123&other=val correctly extracts just the post id', function() {
    var params = new URLSearchParams('?open=POST-123&other=val');
    var openParam = params.get('open');
    if (openParam) window._pendingOpenPost = openParam;
    expect(window._pendingOpenPost).toBe('POST-123');
    expect(params.get('other')).toBe('val');
  });

  it('8. _pendingOpenPost with empty string does not trigger openPCS', function() {
    window._pendingOpenPost = '';
    var called = false;
    var mockOpenPCS = function() { called = true; };
    if (window._pendingOpenPost) {
      mockOpenPCS(window._pendingOpenPost);
    }
    expect(called).toBe(false);
  });
});

describe('Deep-link ?open=POST_ID — source analysis', function() {

  it('9. router reads open param from URLSearchParams', function() {
    expect(routerSrc).toContain("params.get('open')");
  });

  it('10. router sets window._pendingOpenPost when open param present', function() {
    expect(routerSrc).toContain('window._pendingOpenPost = openPost');
  });

  it('11. open param check occurs after approval checks but before hash check', function() {
    var approveIdx = routerSrc.indexOf("params.get('approve')");
    var openIdx = routerSrc.indexOf("params.get('open')");
    var hashIdx = routerSrc.indexOf('window.location.hash');
    expect(approveIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeGreaterThan(approveIdx);
    expect(hashIdx).toBeGreaterThan(openIdx);
  });

  it('12. open param does NOT return early — auth flow continues', function() {
    var openLine = routerSrc.indexOf("window._pendingOpenPost = openPost");
    expect(openLine).toBeGreaterThan(-1);
    var after = routerSrc.substring(openLine, openLine + 80);
    expect(after).not.toMatch(/return\s*;/);
  });

  it('13. renderAll checks _pendingOpenPost after posts loaded', function() {
    expect(postLoadSrc).toContain('window._pendingOpenPost');
    expect(postLoadSrc).toContain('window.AppState.posts.loaded');
  });

  it('14. renderAll clears _pendingOpenPost before calling openPCS', function() {
    var clearIdx = postLoadSrc.indexOf('window._pendingOpenPost = null');
    var openIdx = postLoadSrc.indexOf("openPCS(_pid)");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeGreaterThan(clearIdx);
  });

  it('15. renderAll routes deep-link by stage: brief sheet, client overlay, or PCS', function() {
    // The deep-link drain reads _pendingOpenPost into _pid, clears it, then
    // routes by stage: brief / brief_done / _isRequest -> _openBriefSheet,
    // client effectiveRole -> _openClientPostOverlay, otherwise -> openPCS.
    var clearMatch = postLoadSrc.match(/var _pid = window\._pendingOpenPost;\s*window\._pendingOpenPost = null;/);
    expect(clearMatch).toBeTruthy();
    expect(postLoadSrc).toContain("window._openBriefSheet(_pid)");
    expect(postLoadSrc).toContain("window._openClientPostOverlay(_pid)");
    expect(postLoadSrc).toContain("openPCS(_pid)");
    // The brief-routing branch must trigger on stage === 'brief' OR
    // stage === 'brief_done' OR _isRequest.
    expect(postLoadSrc).toMatch(/_dlStage === 'brief'/);
    expect(postLoadSrc).toMatch(/_dlStage === 'brief_done'/);
    expect(postLoadSrc).toMatch(/_isRequest/);
  });

  it('16. deep-link block is inside renderAll function', function() {
    var renderAllStart = postLoadSrc.indexOf('function renderAll()');
    var pendingCheck = postLoadSrc.indexOf('window._pendingOpenPost && window.AppState.posts.loaded');
    var nextFnStart = postLoadSrc.indexOf('function updateStats()');
    expect(renderAllStart).toBeGreaterThan(-1);
    expect(pendingCheck).toBeGreaterThan(renderAllStart);
    expect(pendingCheck).toBeLessThan(nextFnStart);
  });
});
