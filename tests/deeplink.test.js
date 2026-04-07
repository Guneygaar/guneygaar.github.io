import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

var routerSrc = readFileSync(resolve(__dirname, '..', '04-router.js'), 'utf8');
var postLoadSrc = readFileSync(resolve(__dirname, '..', '07-post-load.js'), 'utf8');

describe('Deep-link ?open=POST_ID', function() {

  it('1. router reads open param from URLSearchParams', function() {
    expect(routerSrc).toContain("params.get('open')");
  });

  it('2. router sets window._pendingOpenPost when open param present', function() {
    expect(routerSrc).toContain('window._pendingOpenPost = openPost');
  });

  it('3. open param check occurs after approval checks but before hash check', function() {
    var approveIdx = routerSrc.indexOf("params.get('approve')");
    var openIdx = routerSrc.indexOf("params.get('open')");
    var hashIdx = routerSrc.indexOf('window.location.hash');
    expect(approveIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeGreaterThan(approveIdx);
    expect(hashIdx).toBeGreaterThan(openIdx);
  });

  it('4. open param does NOT return early — auth flow continues', function() {
    // The open block should set the flag but not return
    var openLine = routerSrc.indexOf("window._pendingOpenPost = openPost");
    expect(openLine).toBeGreaterThan(-1);
    // Get the next 60 chars after the assignment — should not contain 'return'
    var after = routerSrc.substring(openLine, openLine + 80);
    // The line ends with semicolon, next meaningful code should be hash check
    expect(after).not.toMatch(/return\s*;/);
  });

  it('5. renderAll checks _pendingOpenPost after posts loaded', function() {
    expect(postLoadSrc).toContain('window._pendingOpenPost');
    expect(postLoadSrc).toContain('window.AppState.posts.loaded');
  });

  it('6. renderAll clears _pendingOpenPost before calling openPCS', function() {
    var clearIdx = postLoadSrc.indexOf('window._pendingOpenPost = null');
    var openIdx = postLoadSrc.indexOf("openPCS(_pid)");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeGreaterThan(clearIdx);
  });

  it('7. renderAll calls openPCS with the stored post ID', function() {
    // The pattern: save _pid, clear flag, call openPCS(_pid)
    var match = postLoadSrc.match(/var _pid = window\._pendingOpenPost;\s*window\._pendingOpenPost = null;\s*if \(typeof openPCS === 'function'\) openPCS\(_pid\)/);
    expect(match).toBeTruthy();
  });

  it('8. deep-link block is inside renderAll function', function() {
    var renderAllStart = postLoadSrc.indexOf('function renderAll()');
    var pendingCheck = postLoadSrc.indexOf('window._pendingOpenPost && window.AppState.posts.loaded');
    var nextFnStart = postLoadSrc.indexOf('function updateStats()');
    expect(renderAllStart).toBeGreaterThan(-1);
    expect(pendingCheck).toBeGreaterThan(renderAllStart);
    expect(pendingCheck).toBeLessThan(nextFnStart);
  });
});
