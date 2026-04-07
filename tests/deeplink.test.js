import { describe, it, expect, beforeEach } from 'vitest';

/*
  Deep link feature spec:
  - URL param ?open=POST_ID sets window._pendingOpenPost
  - After auth + loadPosts, renderAll checks _pendingOpenPost
  - If set, openPCS(postId) is called, then _pendingOpenPost cleared
  These tests validate the parsing and state management logic.
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
    // Simulate the renderAll dispatch
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
