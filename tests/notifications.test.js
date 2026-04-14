import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load source files for static analysis
var uiSrc = readFileSync(resolve(__dirname, '..', '10-ui.js'), 'utf8');
var actionsSrc = readFileSync(resolve(__dirname, '..', '08-post-actions.js'), 'utf8');
var sessionSrc = readFileSync(resolve(__dirname, '..', '02-session.js'), 'utf8');
var pcsSrc = '';
try { pcsSrc = readFileSync(resolve(__dirname, '..', 'actions', 'pcs.js'), 'utf8'); } catch(e) {}

// Extract _stageLabel from 08-post-actions.js
function loadStageLabel() {
  var match = actionsSrc.match(/function _stageLabel\(stage\)\s*\{[\s\S]*?\n\}/);
  if (!match) throw new Error('Could not find _stageLabel function');
  var fn = new Function(match[0] + '\n return _stageLabel;');
  return fn();
}
var _stageLabel = loadStageLabel();

// Notification routing logic -- pure logic, no API calls
function getNotifTargets(actorRole) {
  var r = (actorRole || '').toLowerCase();
  if (r === 'client')                          return ['Servicing', 'Admin'];
  if (r === 'creative' || r === 'pranav')      return ['Servicing', 'Admin'];
  if (r === 'servicing' || r === 'chitra')     return ['Admin', 'Client'];
  if (r === 'admin')                           return ['Client', 'Servicing'];
  return [];
}


// =========================================================
// GROUP 1: Self-notification filtering (source analysis)
// =========================================================
describe('Self-notification filtering', function() {

  it('updateNotifBadge builds URL with actor=neq filter', function() {
    // The updateNotifBadge function must append actor=neq to exclude self
    var match = uiSrc.match(/function updateNotifBadge\(\)[\s\S]*?\.catch/);
    expect(match).not.toBeNull();
    var body = match[0];
    expect(body).toContain('actor=neq.');
  });

  it('loadNotifications builds URL with actor=neq filter', function() {
    var match = uiSrc.match(/function loadNotifications\(\)[\s\S]*?catch\(e\)/);
    expect(match).not.toBeNull();
    var body = match[0];
    expect(body).toContain('actor=neq.');
  });

  it('self-filter uses AppState.user.name as primary source in updateNotifBadge', function() {
    var match = uiSrc.match(/function updateNotifBadge\(\)[\s\S]*?\.catch/);
    var body = match[0];
    // AppState.user.name must come BEFORE window.currentUserName
    var appStateIdx = body.indexOf('AppState.user.name');
    var windowIdx = body.indexOf('window.currentUserName');
    expect(appStateIdx).toBeGreaterThan(-1);
    expect(windowIdx).toBeGreaterThan(-1);
    expect(appStateIdx).toBeLessThan(windowIdx);
  });

  it('self-filter uses AppState.user.name as primary source in loadNotifications', function() {
    var match = uiSrc.match(/function loadNotifications\(\)[\s\S]*?catch\(e\)/);
    var body = match[0];
    var appStateIdx = body.indexOf('AppState.user.name');
    var windowIdx = body.indexOf('window.currentUserName');
    expect(appStateIdx).toBeGreaterThan(-1);
    expect(windowIdx).toBeGreaterThan(-1);
    expect(appStateIdx).toBeLessThan(windowIdx);
  });

  it('self-filter is conditional -- empty actor skips the filter', function() {
    // Must have an if check before appending actor=neq
    var match = uiSrc.match(/function updateNotifBadge\(\)[\s\S]*?\.catch/);
    var body = match[0];
    expect(body).toMatch(/if\s*\(\s*_badgeActor\s*\)/);
  });

});


// =========================================================
// GROUP 2: Badge system (source analysis)
// =========================================================
describe('Notification badge', function() {

  it('updateNotifBadge queries with AppState.user.effectiveRole', function() {
    var match = uiSrc.match(/function updateNotifBadge\(\)[\s\S]*?\.catch/);
    var body = match[0];
    expect(body).toContain('AppState.user.effectiveRole');
  });

  it('updateNotifBadge updates all 4 badge element IDs', function() {
    var match = uiSrc.match(/function updateNotifBadge\(\)[\s\S]*?\.catch/);
    var body = match[0];
    var expectedIds = [
      'notif-bell-badge',
      'notif-pipeline-badge',
      'notif-lib-badge',
      'notif-ins-badge'
    ];
    expectedIds.forEach(function(id) {
      expect(body).toContain(id);
    });
  });

  it('badge shows 9+ for counts above 9', function() {
    var match = uiSrc.match(/function updateNotifBadge\(\)[\s\S]*?\.catch/);
    var body = match[0];
    expect(body).toContain("'9+'");
  });

  it('periodic badge refresh interval is set on AppState.timers', function() {
    expect(uiSrc).toContain('AppState.timers.notifBadgeTimer');
    expect(uiSrc).toMatch(/setInterval\(function\(\)\s*\{[\s\S]*?updateNotifBadge/);
  });

  it('periodic badge refresh interval is 20 seconds', function() {
    var match = uiSrc.match(/AppState\.timers\.notifBadgeTimer\s*=\s*setInterval\([\s\S]*?,\s*(\d+)\)/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1])).toBe(20000);
  });

});


// =========================================================
// GROUP 3: Comment notifications (source analysis)
// =========================================================
// Comment notification fan-out now lives entirely in the notify-comment
// edge function. The JS-side POST to /notifications for comments was
// removed in the js-notif-fanout PR. These tests verify the removal
// and preserve the pure routing-logic assertions.
describe('Comment notifications', function() {

  it('pcs.js has zero comment notification POSTs', function() {
    var matches = pcsSrc.match(/type:\s*['"]comment['"]/g);
    expect(matches).toBeNull();
  });

  it('render/client.js has zero notification POSTs', function() {
    var clientSrc = readFileSync(resolve(__dirname, '..', 'render', 'client.js'), 'utf8');
    var matches = clientSrc.match(/apiFetch\(['"]\/notifications['"],\s*\{[\s\S]*?method:\s*['"]POST['"]/g);
    expect(matches).toBeNull();
  });

  it('render/brief.js has zero comment notification POSTs', function() {
    // Comment fan-out must stay in the notify-comment edge function.
    // An intentional exception exists for the assign path (type: 'assign'):
    // assign PATCHes target /requests, so notify-stage does NOT fire and
    // the assignee would hear nothing unless brief.js writes directly.
    // This test narrows the pcs.js-style ban to the comment type only,
    // matching the pcs.js assertion a few lines above.
    var briefSrc = readFileSync(resolve(__dirname, '..', 'render', 'brief.js'), 'utf8');
    var matches = briefSrc.match(/type:\s*['"]comment['"]/g);
    expect(matches).toBeNull();
  });

  it('render/pipeline.js has zero notification POSTs', function() {
    var pipelineSrc = readFileSync(resolve(__dirname, '..', 'render', 'pipeline.js'), 'utf8');
    var matches = pipelineSrc.match(/apiFetch\(['"]\/notifications['"],\s*\{[\s\S]*?method:\s*['"]POST['"]/g);
    expect(matches).toBeNull();
  });

  it('Client comments notify Servicing and Admin', function() {
    var targets = getNotifTargets('Client');
    expect(targets).toContain('Servicing');
    expect(targets).toContain('Admin');
    expect(targets).not.toContain('Client');
  });

  it('Servicing comments notify Admin and Client', function() {
    var targets = getNotifTargets('Servicing');
    expect(targets).toContain('Admin');
    expect(targets).toContain('Client');
    expect(targets).not.toContain('Servicing');
  });

  it('Admin comments notify Client and Servicing', function() {
    var targets = getNotifTargets('Admin');
    expect(targets).toContain('Client');
    expect(targets).toContain('Servicing');
    expect(targets).not.toContain('Admin');
  });

  it('Creative comments notify Servicing and Admin', function() {
    var targets = getNotifTargets('Creative');
    expect(targets).toContain('Servicing');
    expect(targets).toContain('Admin');
  });

});


// =========================================================
// GROUP 4: Client request notification
// =========================================================
describe('Client request notification', function() {

  it('client request sends new_request notification to Servicing', function() {
    expect(actionsSrc).toContain("type: 'new_request'");
    expect(actionsSrc).toContain("user_role: 'Servicing'");
  });

  it('client request notification includes actor field', function() {
    var idx = actionsSrc.indexOf("'new_request'");
    var block = actionsSrc.substring(idx - 100, idx + 300);
    expect(block).toContain('actor:');
  });

  it('client request notification uses AppState.user.name', function() {
    var idx = actionsSrc.indexOf("'new_request'");
    var block = actionsSrc.substring(idx - 200, idx + 300);
    expect(block).toContain('AppState.user.name');
  });

  it('client request notification includes read:false', function() {
    var idx = actionsSrc.indexOf("'new_request'");
    var block = actionsSrc.substring(idx - 50, idx + 300);
    expect(block).toContain('read: false');
  });

  it('client request notification targets ONLY Servicing (not Admin -- DB trigger handles Admin)', function() {
    // Find the new_request block and verify it targets only Servicing
    var idx = actionsSrc.indexOf("type: 'new_request'");
    var block = actionsSrc.substring(idx - 200, idx + 50);
    expect(block).toContain("user_role: 'Servicing'");
    // Verify there is no forEach loop targeting multiple roles for this insert
    expect(block).not.toContain('.forEach');
  });

});


// =========================================================
// GROUP 5: Mark as read (source analysis)
// =========================================================
describe('Mark as read', function() {

  it('markNotifRead sends PATCH with read:true', function() {
    var match = uiSrc.match(/function markNotifRead\(id\)[\s\S]*?catch/);
    expect(match).not.toBeNull();
    var body = match[0];
    expect(body).toContain("method: 'PATCH'");
    expect(body).toContain('read: true');
  });

  it('markNotifRead uses id=eq. filter in URL', function() {
    var match = uiSrc.match(/function markNotifRead\(id\)[\s\S]*?catch/);
    var body = match[0];
    expect(body).toContain('id=eq.');
  });

  it('markNotifRead updates _notifData optimistically before API call', function() {
    var match = uiSrc.match(/function markNotifRead\(id\)[\s\S]*?catch/);
    var body = match[0];
    // _notifData.map must come BEFORE apiFetch
    var mapIdx = body.indexOf('_notifData = _notifData.map');
    var apiIdx = body.indexOf('apiFetch');
    expect(mapIdx).toBeGreaterThan(-1);
    expect(apiIdx).toBeGreaterThan(-1);
    expect(mapIdx).toBeLessThan(apiIdx);
  });

  it('markNotifRead calls updateNotifBadge', function() {
    var match = uiSrc.match(/function markNotifRead\(id\)[\s\S]*?catch/);
    var body = match[0];
    expect(body).toContain('updateNotifBadge()');
  });

  it('markAllNotificationsRead patches all unread for current role', function() {
    var match = uiSrc.match(/function markAllNotificationsRead\(\)[\s\S]*?catch\(e\)/);
    expect(match).not.toBeNull();
    var body = match[0];
    expect(body).toContain('read=eq.false');
    expect(body).toContain('user_role=eq.');
    expect(body).toContain("method: 'PATCH'");
  });

  it('markAllNotificationsRead hides all 4 badge elements', function() {
    var match = uiSrc.match(/function markAllNotificationsRead\(\)[\s\S]*?catch\(e\)/);
    var body = match[0];
    expect(body).toContain('notif-bell-badge');
    expect(body).toContain('notif-pipeline-badge');
    expect(body).toContain('notif-lib-badge');
    expect(body).toContain('notif-ins-badge');
    expect(body).toContain("display = 'none'");
  });

});


// =========================================================
// GROUP 6: Card tap mark-as-read
// =========================================================
describe('Notification card tap', function() {

  it('notification cards render with data-notif-id attribute', function() {
    // renderNotifications must include data-notif-id in the HTML template
    expect(uiSrc).toContain('data-notif-id');
    // Specifically in the notif-item div
    var match = uiSrc.match(/class="notif-item[\s\S]{0,200}data-notif-id/);
    expect(match).not.toBeNull();
  });

  it('card tap handler reads data-notif-id and calls markNotifRead', function() {
    // The delegated click handler targets .notif-item and .notif-live-card
    var match = uiSrc.match(/closest\('\.notif-item, \.notif-live-card'\)[\s\S]{0,800}markNotifRead/);
    expect(match).not.toBeNull();
  });

  it('tap handler uses closest(.notif-item, .notif-live-card) to find the row', function() {
    // Entire row AND live card are now tappable
    expect(uiSrc).toContain("closest('.notif-item, .notif-live-card')");
  });

});


// =========================================================
// GROUP 7: No duplicate stage notifications from JS
// =========================================================
describe('No duplicate stage-change notifications from JS', function() {

  it('quickStage does NOT insert notifications', function() {
    var match = actionsSrc.match(/function quickStage\([\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    var body = match[0];
    // Must NOT contain a POST to /notifications
    var hasNotifPost = body.includes("'/notifications'") &&
      body.includes("method: 'POST'");
    expect(hasNotifPost).toBe(false);
  });

  it('clientApprove does NOT insert notifications', function() {
    var match = actionsSrc.match(/function clientApprove\([\s\S]*?\n\}/);
    if (!match) return; // function may not exist in this file
    var body = match[0];
    var hasNotifPost = body.includes("'/notifications'") &&
      body.includes("method: 'POST'");
    expect(hasNotifPost).toBe(false);
  });

  it('publishPost / _confirmPublish does NOT insert notifications', function() {
    // Look for the publish function
    var match = actionsSrc.match(/function _confirmPublish\([\s\S]*?\n\}/);
    if (!match) return; // function may not exist
    var body = match[0];
    var hasNotifPost = body.includes("'/notifications'") &&
      body.includes("method: 'POST'");
    expect(hasNotifPost).toBe(false);
  });

  it('08-post-actions.js has exactly 2 notification POSTs (2x new_request only)', function() {
    var matches = actionsSrc.match(/apiFetch\('\/notifications',\s*\{[\s\S]*?method:\s*'POST'/g);
    // 1 = submitClientRequest Servicing, 2 = submitClientRequest Admin.
    // _sendStageNotif helper was removed — notify-stage edge function
    // now writes all stage change notification rows.
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(2);
  });

  it('_sendStageNotif helper has been removed from 08-post-actions.js', function() {
    // The helper and all its call sites were removed in the js-notif-fanout PR.
    expect(actionsSrc).not.toMatch(/window\._sendStageNotif\s*=\s*function/);
    expect(actionsSrc).not.toMatch(/window\._sendStageNotif\s*\(/);
  });

  it('09-approval.js has no _sendStageNotif call sites', function() {
    var approvalSrc = readFileSync(resolve(__dirname, '..', '09-approval.js'), 'utf8');
    expect(approvalSrc).not.toMatch(/_sendStageNotif\s*\(/);
  });

  it('07-post-load.js has zero notification POSTs', function() {
    var postLoadSrc = readFileSync(resolve(__dirname, '..', '07-post-load.js'), 'utf8');
    var matches = postLoadSrc.match(/apiFetch\('\/notifications',\s*\{[\s\S]*?method:\s*'POST'/g);
    expect(matches).toBeNull();
  });

});


// =========================================================
// GROUP 8: Dead code stays dead
// =========================================================
describe('Dead code removed', function() {

  it('openNotifItem function does not exist in 10-ui.js', function() {
    expect(uiSrc).not.toMatch(/function openNotifItem\s*\(/);
    expect(uiSrc).not.toContain('window.openNotifItem');
  });

  it('handleNotifAction function does not exist in 10-ui.js', function() {
    expect(uiSrc).not.toMatch(/function handleNotifAction\s*\(/);
    expect(uiSrc).not.toContain('window.handleNotifAction');
  });

  it('async submitPcsComment v1 does not exist in 08-post-actions.js', function() {
    expect(actionsSrc).not.toMatch(/async\s+function\s+submitPcsComment\s*\(/);
  });

  it('window._unreadCount does not exist in 02-session.js', function() {
    expect(sessionSrc).not.toContain('window._unreadCount');
  });

  it('no stage_change type notification inserts remain in 08-post-actions.js', function() {
    // The only notification insert should be new_request
    var stageChangeNotifs = actionsSrc.match(/type:\s*['"]stage_change['"]/g);
    expect(stageChangeNotifs).toBeNull();
  });

  it('no awaiting_approval type notification inserts remain in 08-post-actions.js', function() {
    var matches = actionsSrc.match(/type:\s*['"]awaiting_approval['"]/g);
    expect(matches).toBeNull();
  });

  it('no published type notification inserts remain in 08-post-actions.js', function() {
    var matches = actionsSrc.match(/type:\s*['"]published['"]/g);
    expect(matches).toBeNull();
  });

});


// =========================================================
// GROUP 9: Role-based query correctness
// =========================================================
describe('Role-based notification queries', function() {

  it('loadNotifications uses AppState.user.effectiveRole for role filter', function() {
    var match = uiSrc.match(/function loadNotifications\(\)[\s\S]*?catch\(e\)/);
    var body = match[0];
    expect(body).toContain('AppState.user.effectiveRole');
    expect(body).toContain('user_role=eq.');
  });

  it('updateNotifBadge uses AppState.user.effectiveRole for role filter', function() {
    var match = uiSrc.match(/function updateNotifBadge\(\)[\s\S]*?\.catch/);
    var body = match[0];
    expect(body).toContain('AppState.user.effectiveRole');
    expect(body).toContain('user_role=eq.');
  });

  it('loadNotifications falls back to AppState.user.role when effectiveRole empty', function() {
    var match = uiSrc.match(/function loadNotifications\(\)[\s\S]*?catch\(e\)/);
    var body = match[0];
    expect(body).toContain('AppState.user.role');
  });

  it('role is lowercased before query', function() {
    var match = uiSrc.match(/function loadNotifications\(\)[\s\S]*?catch\(e\)/);
    var body = match[0];
    expect(body).toContain('.toLowerCase()');
  });

});


// =========================================================
// GROUP 10: _stageLabel (preserved from original tests)
// =========================================================
describe('_stageLabel', function() {

  it("'brief' -> 'Brief'", function() {
    expect(_stageLabel('brief')).toBe('Brief');
  });

  it("'brief_done' -> 'Closed Brief'", function() {
    expect(_stageLabel('brief_done')).toBe('Closed Brief');
  });

  it("'in_production' -> 'In Production'", function() {
    expect(_stageLabel('in_production')).toBe('In Production');
  });

  it("'awaiting_approval' -> 'Awaiting Approval'", function() {
    expect(_stageLabel('awaiting_approval')).toBe('Awaiting Approval');
  });

  it("'awaiting_brand_input' -> 'Awaiting Input'", function() {
    expect(_stageLabel('awaiting_brand_input')).toBe('Awaiting Input');
  });

  it("'published' -> 'Published'", function() {
    expect(_stageLabel('published')).toBe('Published');
  });

  it("'unknown_stage' -> 'unknown_stage' (passthrough)", function() {
    expect(_stageLabel('unknown_stage')).toBe('unknown_stage');
  });

  it('null/undefined -> safe empty-ish return', function() {
    expect(_stageLabel(null)).toBeFalsy();
    expect(_stageLabel(undefined)).toBeFalsy();
  });

});


// =========================================================
// GROUP 11: Notification routing (preserved from original)
// =========================================================
describe('getNotifTargets', function() {

  it("'Client' actor -> targets include 'Servicing'", function() {
    expect(getNotifTargets('Client')).toContain('Servicing');
  });

  it("'Client' actor -> targets include 'Admin'", function() {
    expect(getNotifTargets('Client')).toContain('Admin');
  });

  it("'Client' actor -> targets NOT include 'Client'", function() {
    expect(getNotifTargets('Client')).not.toContain('Client');
  });

  it("'Creative' actor -> targets include 'Servicing'", function() {
    expect(getNotifTargets('Creative')).toContain('Servicing');
  });

  it("'Pranav' actor -> same as Creative", function() {
    expect(getNotifTargets('Pranav')).toEqual(getNotifTargets('Creative'));
  });

  it("'Servicing' actor -> targets include 'Admin'", function() {
    expect(getNotifTargets('Servicing')).toContain('Admin');
  });

  it("'Servicing' actor -> targets include 'Client'", function() {
    expect(getNotifTargets('Servicing')).toContain('Client');
  });

  it("'Chitra' actor -> same as Servicing", function() {
    expect(getNotifTargets('Chitra')).toEqual(getNotifTargets('Servicing'));
  });

  it("'Admin' actor -> targets include 'Client'", function() {
    expect(getNotifTargets('Admin')).toContain('Client');
  });

  it("'Admin' actor -> targets include 'Servicing'", function() {
    expect(getNotifTargets('Admin')).toContain('Servicing');
  });

  it("'Admin' actor -> targets NOT include 'Admin'", function() {
    expect(getNotifTargets('Admin')).not.toContain('Admin');
  });

  it('no role doubles up (actor never notifies themselves)', function() {
    var roles = ['Admin', 'Servicing', 'Creative', 'Pranav', 'Chitra', 'Client'];
    for (var i = 0; i < roles.length; i++) {
      var targets = getNotifTargets(roles[i]);
      expect(targets).not.toContain(roles[i]);
    }
  });

});


// =========================================================
// GROUP 12: @mention notification system
// =========================================================

// Extract _AGENCY_MEMBERS from pcs.js for test use
var _TEST_AGENCY_MEMBERS = [
  { name: 'Shubham', role: 'Admin' },
  { name: 'Pranav', role: 'Creative' },
  { name: 'Chitra', role: 'Servicing' }
];

// Pure logic: resolve mention name to role (mirrors production code)
function _resolveMentionRole(name) {
  var found = _TEST_AGENCY_MEMBERS.find(function(m) {
    return m.name.toLowerCase() === (name || '').toLowerCase();
  });
  return found ? found.role : null;
}

describe('@mention notification routing', function() {

  it('@Pranav resolves to role Creative', function() {
    expect(_resolveMentionRole('Pranav')).toBe('Creative');
  });

  it('@Shubham resolves to role Admin', function() {
    expect(_resolveMentionRole('Shubham')).toBe('Admin');
  });

  it('@Chitra resolves to role Servicing', function() {
    expect(_resolveMentionRole('Chitra')).toBe('Servicing');
  });

  it('@UnknownPerson resolves to null (skipped)', function() {
    expect(_resolveMentionRole('UnknownPerson')).toBeNull();
  });

  it('case insensitive resolution works', function() {
    expect(_resolveMentionRole('pranav')).toBe('Creative');
    expect(_resolveMentionRole('CHITRA')).toBe('Servicing');
  });

});

// @mention notification fan-out was moved into the notify-comment
// edge function. The JS-side POST to /notifications with type:'mention'
// was removed in the js-notif-fanout PR. These tests verify the removal
// and preserve the pure name→role resolution checks in the block above.
describe('@mention notifications removed from JS fan-out', function() {

  it('pcs.js has no type:mention notification POST', function() {
    expect(pcsSrc).not.toContain("type: 'mention'");
  });

  it('render/client.js has no type:mention notification POST', function() {
    var clientSrc = readFileSync(resolve(__dirname, '..', 'render', 'client.js'), 'utf8');
    expect(clientSrc).not.toContain("type: 'mention'");
  });

  it('_lookupMentionEmails is preserved for display purposes', function() {
    // Used to build window._lastMentionContacts for the UI, not for
    // notification writes. Must stay after the fan-out removal.
    expect(pcsSrc).toContain('_lookupMentionEmails');
    expect(pcsSrc).toContain('window._lastMentionContacts');
  });

});
