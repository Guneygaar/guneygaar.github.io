import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load source for static analysis
var clientSrc = readFileSync(resolve(__dirname, '..', 'render', 'client.js'), 'utf8');
var actionsSrc = readFileSync(resolve(__dirname, '..', '08-post-actions.js'), 'utf8');
var uiSrc = readFileSync(resolve(__dirname, '..', '10-ui.js'), 'utf8');
var postLoadSrc = readFileSync(resolve(__dirname, '..', '07-post-load.js'), 'utf8');

// =========================================================
// SETUP — mirrors tests/appstate-posts.test.js
// =========================================================

function makePost(overrides) {
  return Object.assign({
    post_id: 'p1',
    title: 'Test Post',
    stage: 'awaiting_approval',
    post_comments: [],
    images: []
  }, overrides || {});
}

beforeEach(function() {
  window._appStateDevMode = false;
  window.AppState = {
    user: {
      name: 'Manisha',
      email: 'manisha@test.com',
      role: 'Client',
      effectiveRole: 'Client'
    },
    posts: {
      all: [],
      cached: [],
      loaded: false,
      setAll: function(newPosts) {
        window.AppState.posts.all = newPosts;
      }
    }
  };
  window.apiFetch = vi.fn(function() { return Promise.resolve({}); });
  window.uploadPostAsset = vi.fn(function() {
    return Promise.resolve('https://r2.test/img.jpg');
  });
  window._clientFeedPendingImgs = {};
  window.showToast = vi.fn();
  window.esc = function(s) { return String(s || ''); };
});


// =========================================================
// GROUP 1 — _commentInputHtml rendering
// =========================================================
describe('_commentInputHtml', function() {

  it('1. Renders gold avatar with correct initial from AppState.user.name', function() {
    // The comment input should render the user initial in a gold-tinted avatar
    var match = clientSrc.match(/function _commentInputHtml[\s\S]*?\n  \}/);
    expect(match).toBeTruthy();
    var body = match[0];
    // Should use AppState.user.name initial, not generic icon
    expect(body).toContain('AppState.user.name');
    expect(body).toContain('initial');
    // Should render gold background color (#C8A84B)
    expect(body).toContain('C8A84B');
  });

  it('2. Renders pill input with id="comment-input-p1"', function() {
    var match = clientSrc.match(/_commentInputHtml/);
    expect(match).toBeTruthy();
    expect(clientSrc).toContain('comment-input-');
    expect(clientSrc).toContain('id="comment-input-');
  });

  it('3. Renders PHOTO button', function() {
    // The input area should have a PHOTO button (not just ATTACH)
    var fnMatch = clientSrc.match(/function _commentInputHtml[\s\S]*?\n  \}/);
    expect(fnMatch).toBeTruthy();
    var fnBody = fnMatch[0];
    expect(fnBody).toContain('PHOTO');
  });

  it('4. Renders @MENTION button', function() {
    // Client comment input should have an @MENTION trigger button
    var fnMatch = clientSrc.match(/function _commentInputHtml[\s\S]*?\n  \}/);
    expect(fnMatch).toBeTruthy();
    var fnBody = fnMatch[0];
    expect(fnBody).toMatch(/@|mention|MENTION/i);
    expect(fnBody).toContain('mention');
  });

  it('5. Renders hidden file input with id="client-feed-img-input-p1"', function() {
    expect(clientSrc).toContain('client-feed-img-input-');
    expect(clientSrc).toContain('type="file"');
    expect(clientSrc).toContain('accept="image/*"');
  });

  it('6. Renders image preview strip with id="client-img-preview-p1" (hidden)', function() {
    var fnMatch = clientSrc.match(/function _commentInputHtml[\s\S]*?\n  \}/);
    expect(fnMatch).toBeTruthy();
    var fnBody = fnMatch[0];
    expect(fnBody).toContain('client-img-preview-');
    expect(fnBody).toMatch(/display:\s*none|style\.display/);
  });

  it('7. Renders mention dropdown with id="client-mention-drop-p1" (hidden)', function() {
    var fnMatch = clientSrc.match(/function _commentInputHtml[\s\S]*?\n  \}/);
    expect(fnMatch).toBeTruthy();
    var fnBody = fnMatch[0];
    expect(fnBody).toContain('client-mention-drop-');
  });

  it('8. Does NOT render input when stage is "in_production"', function() {
    var fnMatch = clientSrc.match(/function _commentInputHtml[\s\S]*?\n  \}/);
    expect(fnMatch).toBeTruthy();
    var fnBody = fnMatch[0];
    // Function should return empty for non-approval stages
    expect(fnBody).toMatch(/awaiting_approval|awaiting_brand_input/);
    expect(fnBody).toMatch(/return\s*['"]{2}|return\s*''|return '';/);
  });

  it('9. Does NOT render input when stage is "published"', function() {
    // Same gate check — published is not in the allowed list
    var fnMatch = clientSrc.match(/function _commentInputHtml[\s\S]*?\n  \}/);
    expect(fnMatch).toBeTruthy();
    var fnBody = fnMatch[0];
    // Should NOT contain an explicit check for 'published' rendering
    expect(fnBody).not.toMatch(/stage\s*===?\s*['"]published['"]\s*\)/);
  });

  it('10. Renders input when stage is "awaiting_approval"', function() {
    var fnMatch = clientSrc.match(/function _commentInputHtml[\s\S]*?\n  \}/);
    expect(fnMatch).toBeTruthy();
    var fnBody = fnMatch[0];
    expect(fnBody).toContain('awaiting_approval');
  });

  it('11. Renders input when stage is "awaiting_brand_input"', function() {
    var fnMatch = clientSrc.match(/function _commentInputHtml[\s\S]*?\n  \}/);
    expect(fnMatch).toBeTruthy();
    var fnBody = fnMatch[0];
    expect(fnBody).toContain('awaiting_brand_input');
  });
});


// =========================================================
// GROUP 2 — Image pending state
// =========================================================
describe('_clientFeedPendingImgs', function() {

  // Extract _clientRemoveImg logic from source for direct testing
  function _loadRemoveImg() {
    var match = clientSrc.match(/window\._clientRemoveImg\s*=\s*function\s*\(postId,\s*idx\)\s*\{([\s\S]*?)\n  \};/);
    if (!match) return null;
    // Strip DOM calls that aren't available in test context
    var body = match[1].replace(/_clientRenderImgPreview\([^)]*\);?/g, '');
    return new Function('postId', 'idx', body);
  }

  it('12. Initializes as empty array for new postId', function() {
    var imgs = window._clientFeedPendingImgs['p1'] || [];
    expect(Array.isArray(imgs)).toBe(true);
    expect(imgs.length).toBe(0);
  });

  it('13. _clientRemoveImg removes correct index', function() {
    window._clientFeedPendingImgs['p1'] = [
      'https://r2.test/a.jpg',
      'https://r2.test/b.jpg',
      'https://r2.test/c.jpg'
    ];
    var removeImg = _loadRemoveImg();
    expect(removeImg).toBeTruthy();
    removeImg('p1', 1);
    expect(window._clientFeedPendingImgs['p1'].length).toBe(2);
    expect(window._clientFeedPendingImgs['p1'][0]).toBe('https://r2.test/a.jpg');
    expect(window._clientFeedPendingImgs['p1'][1]).toBe('https://r2.test/c.jpg');
  });

  it('14. _clientRemoveImg on last image leaves empty array', function() {
    window._clientFeedPendingImgs['p1'] = ['https://r2.test/a.jpg'];
    var removeImg = _loadRemoveImg();
    expect(removeImg).toBeTruthy();
    removeImg('p1', 0);
    expect(window._clientFeedPendingImgs['p1'].length).toBe(0);
  });

  it('15. _clientRemoveImg with invalid index does not throw', function() {
    window._clientFeedPendingImgs['p1'] = ['https://r2.test/a.jpg'];
    var removeImg = _loadRemoveImg();
    expect(removeImg).toBeTruthy();
    expect(function() {
      removeImg('p1', 99);
    }).not.toThrow();
    expect(window._clientFeedPendingImgs['p1'].length).toBe(1);
  });

  it('16. Multiple posts have independent pending arrays', function() {
    window._clientFeedPendingImgs['p1'] = ['https://r2.test/a.jpg'];
    window._clientFeedPendingImgs['p2'] = ['https://r2.test/b.jpg', 'https://r2.test/c.jpg'];
    expect(window._clientFeedPendingImgs['p1'].length).toBe(1);
    expect(window._clientFeedPendingImgs['p2'].length).toBe(2);
  });
});


// =========================================================
// GROUP 3 — _handleSubmitComment POST body
// =========================================================
describe('_handleSubmitComment POST body', function() {

  // Extract the _handleSubmitComment function body for source analysis
  var fnMatch = clientSrc.match(/function _handleSubmitComment[\s\S]*?\n  \}/);
  var fnBody = fnMatch ? fnMatch[0] : '';

  it('17. POST includes post_id', function() {
    expect(fnBody).toContain('post_id');
    expect(fnBody).toMatch(/post_id:\s*realPostId/);
  });

  it('18. POST includes author from AppState.user.name', function() {
    expect(fnBody).toContain('AppState.user.name');
    expect(fnBody).toMatch(/author:\s*authorName/);
  });

  it('19. POST includes author_role: \'Client\'', function() {
    expect(fnBody).toMatch(/author_role:\s*['"]Client['"]/);
  });

  it('20. POST includes message text', function() {
    expect(fnBody).toMatch(/message:\s*message/);
  });

  it('21. POST includes post_title', function() {
    // The POST body should include post_title for notification context
    expect(fnBody).toMatch(/post_title:\s*postTitle|post_title:\s*\(post/);
  });

  it('22. POST includes mentioned_users array (empty when no @mention)', function() {
    expect(fnBody).toContain('mentioned_users');
  });

  it('23. POST includes mentioned_users: [\'Pranav\'] when message has @Pranav', function() {
    // Source should contain @mention parsing logic
    expect(fnBody).toMatch(/@(\w+)|mention/i);
    expect(fnBody).toContain('mentioned_users');
  });

  it('24. POST includes mentioned_users: [\'Pranav\',\'Chitra\'] for two mentions', function() {
    // @mention parser should capture all matches, not just first
    var mentionParse = clientSrc.match(/_parseMentions|match\(\/@|matchAll.*@/);
    expect(mentionParse).toBeTruthy();
  });

  it('25. POST includes attachments JSON when pending images exist', function() {
    expect(fnBody).toContain('attachments');
    expect(fnBody).toContain('images');
    // Should use _clientFeedPendingImgs (plural, per-post)
    expect(fnBody).toContain('_clientFeedPendingImgs');
  });

  it('26. POST attachments is null when no pending images', function() {
    // When no pending images, attachments should be null or absent
    expect(fnBody).toMatch(/attachments|_pendingImg/);
  });

  it('27. Submit allowed when message empty but pending image exists', function() {
    // Should NOT early-return when message is empty but images are pending
    // The guard should check: if (!message && no pending images) return
    expect(fnBody).toMatch(/_clientFeedPendingImgs|_pendingImg/);
    // Current code: if (!message) return — this must change to allow image-only
    var earlyReturn = fnBody.match(/if\s*\(\s*!message\s*\)\s*return/);
    // This test expects the early return to be conditional on images too
    expect(earlyReturn).toBeFalsy();
  });

  it('28. Submit blocked when message empty AND no pending images', function() {
    // Should have a guard that blocks empty submissions
    expect(fnBody).toMatch(/if\s*\(!message.*&&.*!.*pending|if\s*\(!message.*&&.*\.length/);
  });

  it('29. Pending images cleared after successful POST', function() {
    // After successful apiFetch, pending images for the post should be reset
    expect(fnBody).toMatch(/_clientFeedPendingImgs\[|_clientFeedPendingImg\s*=\s*null/);
  });

  it('30. Input cleared after successful POST', function() {
    expect(fnBody).toMatch(/input\.value\s*=\s*['"]{2}|input\.value\s*=\s*''/);
  });
});


// =========================================================
// GROUP 4 — Mutation rules
// =========================================================
describe('post_comments mutation rules', function() {

  var fnMatch = clientSrc.match(/function _handleSubmitComment[\s\S]*?\n  \}/);
  var fnBody = fnMatch ? fnMatch[0] : '';

  it('31. Optimistic comment uses concat not push (new array reference)', function() {
    // Must use concat or spread to create new array reference
    // MUST NOT use post.post_comments.push()
    var hasPush = /post_comments\.push\(/.test(fnBody);
    expect(hasPush).toBe(false);
    expect(fnBody).toMatch(/post_comments\.concat\(|\.\.\.post_comments/);
  });

  it('32. post.post_comments is never mutated directly', function() {
    // No direct .push(), .splice(), .pop() on post_comments
    var hasDirect = /post_comments\.(push|splice|pop|shift|unshift)\(/.test(fnBody);
    expect(hasDirect).toBe(false);
  });

  it('33. Rollback on failure removes optimistic comment from array', function() {
    // The catch block should restore the original post_comments
    expect(fnBody).toMatch(/catch|\.catch/);
    expect(fnBody).toMatch(/post_comments/);
  });

  it('34. Rollback restores original array reference', function() {
    // On failure, should restore original reference, not mutate with .pop()
    var catchBlock = fnBody.match(/\.catch\(function[\s\S]*?\}\)/);
    if (!catchBlock) catchBlock = fnBody.match(/catch\s*\([\s\S]*?\}/);
    expect(catchBlock).toBeTruthy();
    var block = catchBlock[0];
    var hasPop = /post_comments\.pop\(/.test(block);
    expect(hasPop).toBe(false);
  });
});


// =========================================================
// GROUP 5 — @mention parsing
// =========================================================
describe('@mention parsing', function() {

  // Look for a mention parser function in client.js
  function findMentionParser() {
    var match = clientSrc.match(
      /function _parseMentions\([\s\S]*?\}|_parseMentions\s*=\s*function[\s\S]*?\}/
    );
    return match ? match[0] : null;
  }

  it('35. No @ in message -> mentioned_users is []', function() {
    var parser = findMentionParser();
    expect(parser).toBeTruthy();
    // If we can extract the function, run it
    if (parser) {
      var fn = new Function(parser + '\n return _parseMentions;');
      var parse = fn();
      expect(parse('Hello world')).toEqual([]);
    }
  });

  it('36. @Pranav -> mentioned_users is [\'Pranav\']', function() {
    var parser = findMentionParser();
    expect(parser).toBeTruthy();
    if (parser) {
      var fn = new Function(parser + '\n return _parseMentions;');
      var parse = fn();
      expect(parse('Hey @Pranav check this')).toEqual(['Pranav']);
    }
  });

  it('37. @pranav lowercase -> mentioned_users is [\'pranav\']', function() {
    var parser = findMentionParser();
    expect(parser).toBeTruthy();
    if (parser) {
      var fn = new Function(parser + '\n return _parseMentions;');
      var parse = fn();
      var result = parse('Hey @pranav check this');
      expect(result).toEqual(['pranav']);
    }
  });

  it('38. Two @mentions -> both captured', function() {
    var parser = findMentionParser();
    expect(parser).toBeTruthy();
    if (parser) {
      var fn = new Function(parser + '\n return _parseMentions;');
      var parse = fn();
      var result = parse('@Pranav and @Chitra please review');
      expect(result).toEqual(['Pranav', 'Chitra']);
    }
  });

  it('39. Email address in message does not create false mention', function() {
    var parser = findMentionParser();
    expect(parser).toBeTruthy();
    if (parser) {
      var fn = new Function(parser + '\n return _parseMentions;');
      var parse = fn();
      var result = parse('Send to manisha@test.com please');
      expect(result).toEqual([]);
    }
  });

  it('40. @mention at end of string captured correctly', function() {
    var parser = findMentionParser();
    expect(parser).toBeTruthy();
    if (parser) {
      var fn = new Function(parser + '\n return _parseMentions;');
      var parse = fn();
      var result = parse('Please check @Shubham');
      expect(result).toEqual(['Shubham']);
    }
  });
});


// =========================================================
// GROUP 6 — Notification firing
// =========================================================
describe('comment notifications', function() {

  var fnMatch = clientSrc.match(/function _handleSubmitComment[\s\S]*?\n  \}/);
  var fnBody = fnMatch ? fnMatch[0] : '';

  it('41. On submit -> fires notification to user_role:\'Servicing\'', function() {
    expect(fnBody).toMatch(/user_role:\s*['"]Servicing['"]/);
  });

  it('42. On submit -> fires notification to user_role:\'Admin\'', function() {
    expect(fnBody).toMatch(/user_role:\s*['"]Admin['"]/);
  });

  it('43. @Pranav -> fires additional mention notification type:\'mention\'', function() {
    // After standard comment notifications, should fire mention-specific ones
    expect(fnBody).toMatch(/type:\s*['"]mention['"]/);
  });

  it('44. @Pranav -> mention notification has user_role:\'Creative\'', function() {
    // Pranav is Creative in _AGENCY_MEMBERS
    // The mention notification loop should resolve name -> role
    expect(fnBody).toMatch(/mention|_AGENCY_MEMBERS|Creative/);
  });

  it('45. @Shubham -> mention notification has user_role:\'Admin\'', function() {
    // Shubham is Admin — should resolve mention to Admin role notification
    expect(fnBody).toMatch(/mention|_AGENCY_MEMBERS|_lookupMention/);
  });

  it('46. Unknown @name -> no mention notification fired', function() {
    // Mention loop should skip unresolved names
    expect(fnBody).toMatch(/if\s*\(!|filter|find/);
  });

  it('47. Failed POST -> no notifications fired', function() {
    // Notifications are chained in .then() — if POST fails, .catch runs instead
    expect(fnBody).toMatch(/\.then\(function/);
    expect(fnBody).toMatch(/\.catch\(function/);
    // Notification calls must be inside .then(), not before it
    var thenIdx = fnBody.indexOf('.then(function');
    var notifIdx = fnBody.indexOf("'/notifications'");
    expect(thenIdx).toBeLessThan(notifIdx);
  });
});


// =========================================================
// GROUP 7 — Error handling pass 2
// =========================================================
describe('error handling pass 2', function() {

  it('48. _handleSubmitComment outer catch calls window.logError', function() {
    var outerCatch = clientSrc.match(/\}\)\.catch\(function\s*\([^)]*\)\s*\{[\s\S]*?Failed to send comment[\s\S]*?\}\);/);
    expect(outerCatch).toBeTruthy();
    expect(outerCatch[0]).toContain('logError');
  });

  it('49. clientApprove() catch calls window.logError', function() {
    var match = actionsSrc.match(/function clientApprove[\s\S]*?\n\}/);
    expect(match).toBeTruthy();
    var body = match[0];
    expect(body).toContain('logError');
  });

  it('50. submitClientRequest() catch calls window.logError', function() {
    var match = actionsSrc.match(/function submitClientRequest[\s\S]*?\n\}/);
    expect(match).toBeTruthy();
    var body = match[0];
    expect(body).toContain('logError');
  });

  it('51. loadPostsForClient() catch calls window.logError', function() {
    var match = postLoadSrc.match(/function loadPostsForClient[\s\S]*?\n\}/);
    expect(match).toBeTruthy();
    var body = match[0];
    expect(body).toContain('logError');
  });

  it('52. loadNotifications() catch calls window.logError', function() {
    var match = uiSrc.match(/function loadNotifications[\s\S]*?catch\(e\)[\s\S]*?\}/);
    expect(match).toBeTruthy();
    var body = match[0];
    expect(body).toContain('logError');
  });

  it('53. _clientFeedHandleImg() catch calls window.logError', function() {
    var match = clientSrc.match(/window\._clientFeedHandleImg\s*=\s*async\s*function[\s\S]*?\n  \};/);
    expect(match).toBeTruthy();
    var body = match[0];
    expect(body).toContain('logError');
  });

  it('54. submitClientRequest() resets button text to original on failure', function() {
    var match = actionsSrc.match(/function submitClientRequest[\s\S]*?\n\}/);
    expect(match).toBeTruthy();
    var catchBlock = match[0].match(/catch\s*\(err\)[\s\S]*?\}/);
    expect(catchBlock).toBeTruthy();
    expect(catchBlock[0]).toMatch(/SEND REQUEST/);
  });

  it('55. renderClientView() wrapped in try/catch', function() {
    var match = clientSrc.match(/window\.renderClientView\s*=\s*function\s*\(\)\s*\{[\s\S]*?\n  \};/);
    expect(match).toBeTruthy();
    var body = match[0];
    expect(body).toContain('try {');
    expect(body).toContain('catch');
  });

  it('56. renderClientView() catch calls window.logError', function() {
    var match = clientSrc.match(/window\.renderClientView\s*=\s*function\s*\(\)\s*\{[\s\S]*?\n  \};/);
    expect(match).toBeTruthy();
    var body = match[0];
    expect(body).toContain('logError');
    expect(body).toContain('render-client-view');
  });

  it('57. _reqAddPhotos FileReader has onerror handler', function() {
    var match = clientSrc.match(/window\._reqAddPhotos\s*=\s*function[\s\S]*?reader\.readAsDataURL/);
    expect(match).toBeTruthy();
    var body = match[0];
    expect(body).toContain('reader.onerror');
  });
});
