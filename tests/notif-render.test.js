import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Source for static analysis
var uiSrc = readFileSync(resolve(__dirname, '..', '10-ui.js'), 'utf8');

// ---------------------------------------------------------------
// Extract helpers from 10-ui.js as executable JS
// ---------------------------------------------------------------
function extract(fnSig) {
  var re = new RegExp('function\\s+' + fnSig + '[\\s\\S]*?\\n\\}\\n');
  var m = uiSrc.match(re);
  if (!m) throw new Error('Could not find ' + fnSig);
  return m[0];
}

var sandbox = '';
sandbox += extract('_notifRelTime\\(iso\\)');
sandbox += extract('_notifIsOverdue\\(post\\)');
sandbox += extract('_notifTypeClass\\(n, post\\)');
sandbox += extract('_notifActorClass\\(actor\\)');
sandbox += extract('_notifChipMatch\\(filter, n, post\\)');
sandbox += '\nreturn { _notifRelTime:_notifRelTime, _notifIsOverdue:_notifIsOverdue, _notifTypeClass:_notifTypeClass, _notifActorClass:_notifActorClass, _notifChipMatch:_notifChipMatch };\n';
var helpers = (new Function(sandbox))();


// ---------------------------------------------------------------
// _notifRelTime
// ---------------------------------------------------------------
describe('_notifRelTime', function() {
  it('returns "just now" for under a minute', function() {
    var iso = new Date(Date.now() - 30*1000).toISOString();
    expect(helpers._notifRelTime(iso)).toBe('just now');
  });
  it('returns "X min ago" under an hour', function() {
    var iso = new Date(Date.now() - 15*60*1000).toISOString();
    expect(helpers._notifRelTime(iso)).toBe('15 min ago');
  });
  it('returns "X hr ago" under a day', function() {
    var iso = new Date(Date.now() - 3*60*60*1000).toISOString();
    expect(helpers._notifRelTime(iso)).toBe('3 hr ago');
  });
  it('returns Yesterday label for yesterday', function() {
    var d = new Date(); d.setDate(d.getDate()-1); d.setHours(10,0,0,0);
    var out = helpers._notifRelTime(d.toISOString());
    expect(out.indexOf('Yesterday')).toBe(0);
  });
  it('returns full date for older than yesterday', function() {
    var d = new Date(); d.setDate(d.getDate()-5); d.setHours(9,0,0,0);
    var out = helpers._notifRelTime(d.toISOString());
    expect(out).toMatch(/[A-Z][a-z]{2}/);
    expect(out.indexOf('Yesterday')).toBe(-1);
    expect(out.indexOf('just now')).toBe(-1);
  });
  it('returns empty string on bad input', function() {
    expect(helpers._notifRelTime('')).toBe('');
    expect(helpers._notifRelTime(null)).toBe('');
  });
});


// ---------------------------------------------------------------
// _notifIsOverdue
// ---------------------------------------------------------------
describe('_notifIsOverdue', function() {
  it('returns false for null post', function() {
    expect(helpers._notifIsOverdue(null)).toBe(false);
  });
  it('returns false for published posts', function() {
    var tenDaysAgo = new Date(Date.now() - 10*86400000).toISOString();
    expect(helpers._notifIsOverdue({ stage:'published', status_changed_at: tenDaysAgo })).toBe(false);
  });
  it('returns false for posts missing status_changed_at', function() {
    expect(helpers._notifIsOverdue({ stage:'in_production' })).toBe(false);
  });
  it('returns false for posts stuck < 2 days', function() {
    var oneDayAgo = new Date(Date.now() - 1*86400000).toISOString();
    expect(helpers._notifIsOverdue({ stage:'in_production', status_changed_at: oneDayAgo })).toBe(false);
  });
  it('returns true for posts stuck > 2 days and not published', function() {
    var threeDaysAgo = new Date(Date.now() - 3*86400000).toISOString();
    expect(helpers._notifIsOverdue({ stage:'in_production', status_changed_at: threeDaysAgo })).toBe(true);
  });
});


// ---------------------------------------------------------------
// _notifTypeClass — left color bar assignment
// ---------------------------------------------------------------
describe('_notifTypeClass', function() {
  it('returns ntype-comment for comment type', function() {
    expect(helpers._notifTypeClass({type:'comment'}, null)).toBe('ntype-comment');
  });
  it('returns ntype-approval for awaiting_approval', function() {
    expect(helpers._notifTypeClass({type:'awaiting_approval'}, null)).toBe('ntype-approval');
  });
  it('returns ntype-approval for awaiting_brand_input', function() {
    expect(helpers._notifTypeClass({type:'awaiting_brand_input'}, null)).toBe('ntype-approval');
  });
  it('returns ntype-live for published', function() {
    expect(helpers._notifTypeClass({type:'published'}, null)).toBe('ntype-live');
  });
  it('returns ntype-stage for stage_change', function() {
    expect(helpers._notifTypeClass({type:'stage_change'}, null)).toBe('ntype-stage');
  });
  it('returns ntype-stage for ready/scheduled/in_production', function() {
    expect(helpers._notifTypeClass({type:'ready'}, null)).toBe('ntype-stage');
    expect(helpers._notifTypeClass({type:'scheduled'}, null)).toBe('ntype-stage');
    expect(helpers._notifTypeClass({type:'in_production'}, null)).toBe('ntype-stage');
  });
  it('returns ntype-overdue when post is overdue (>2d, not published)', function() {
    var threeDaysAgo = new Date(Date.now() - 3*86400000).toISOString();
    var post = { stage:'in_production', status_changed_at: threeDaysAgo };
    expect(helpers._notifTypeClass({type:'stage_change'}, post)).toBe('ntype-overdue');
  });
  it('never marks published posts as overdue', function() {
    var tenDaysAgo = new Date(Date.now() - 10*86400000).toISOString();
    var post = { stage:'published', status_changed_at: tenDaysAgo };
    expect(helpers._notifTypeClass({type:'published'}, post)).toBe('ntype-live');
  });
});


// ---------------------------------------------------------------
// _notifActorClass — avatar CSS mapping (new nav-* system)
// ---------------------------------------------------------------
describe('_notifActorClass', function() {
  it('maps names to correct CSS classes', function() {
    expect(helpers._notifActorClass('Manisha')).toBe('nav-client');
    expect(helpers._notifActorClass('Shivangini')).toBe('nav-client');
    expect(helpers._notifActorClass('Client')).toBe('nav-client');
    expect(helpers._notifActorClass('Chitra')).toBe('nav-chitra');
    expect(helpers._notifActorClass('Servicing')).toBe('nav-chitra');
    expect(helpers._notifActorClass('Pranav')).toBe('nav-pranav');
    expect(helpers._notifActorClass('Creative')).toBe('nav-pranav');
    expect(helpers._notifActorClass('Shubham')).toBe('nav-shubham');
    expect(helpers._notifActorClass('Admin')).toBe('nav-shubham');
  });
  it('returns nav-system for missing actor', function() {
    expect(helpers._notifActorClass('')).toBe('nav-system');
    expect(helpers._notifActorClass(null)).toBe('nav-system');
    expect(helpers._notifActorClass(undefined)).toBe('nav-system');
  });
  it('is case-insensitive', function() {
    expect(helpers._notifActorClass('CHITRA')).toBe('nav-chitra');
    expect(helpers._notifActorClass('chitra')).toBe('nav-chitra');
  });
});


// ---------------------------------------------------------------
// _notifChipMatch — horizontal chip filter predicate
// ---------------------------------------------------------------
describe('_notifChipMatch', function() {
  it('"all" matches every notification', function() {
    expect(helpers._notifChipMatch('all', {type:'comment'}, null)).toBe(true);
    expect(helpers._notifChipMatch('all', {type:'published'}, null)).toBe(true);
    expect(helpers._notifChipMatch('all', {type:'stage_change'}, null)).toBe(true);
  });
  it('"approval" matches awaiting_approval + awaiting_brand_input', function() {
    expect(helpers._notifChipMatch('approval', {type:'awaiting_approval'}, null)).toBe(true);
    expect(helpers._notifChipMatch('approval', {type:'awaiting_brand_input'}, null)).toBe(true);
    expect(helpers._notifChipMatch('approval', {type:'comment'}, null)).toBe(false);
    expect(helpers._notifChipMatch('approval', {type:'published'}, null)).toBe(false);
  });
  it('"comment" matches only type:comment', function() {
    expect(helpers._notifChipMatch('comment', {type:'comment'}, null)).toBe(true);
    expect(helpers._notifChipMatch('comment', {type:'awaiting_approval'}, null)).toBe(false);
    expect(helpers._notifChipMatch('comment', {type:'stage_change'}, null)).toBe(false);
  });
  it('"live" matches only type:published', function() {
    expect(helpers._notifChipMatch('live', {type:'published'}, null)).toBe(true);
    expect(helpers._notifChipMatch('live', {type:'scheduled'}, null)).toBe(false);
    expect(helpers._notifChipMatch('live', {type:'comment'}, null)).toBe(false);
  });
  it('"stage" matches stage_change/ready/in_production/scheduled', function() {
    expect(helpers._notifChipMatch('stage', {type:'stage_change'}, null)).toBe(true);
    expect(helpers._notifChipMatch('stage', {type:'ready'}, null)).toBe(true);
    expect(helpers._notifChipMatch('stage', {type:'in_production'}, null)).toBe(true);
    expect(helpers._notifChipMatch('stage', {type:'scheduled'}, null)).toBe(true);
    expect(helpers._notifChipMatch('stage', {type:'published'}, null)).toBe(false);
    expect(helpers._notifChipMatch('stage', {type:'comment'}, null)).toBe(false);
  });
  it('"overdue" matches only when post is stuck > 2 days', function() {
    var threeDaysAgo = new Date(Date.now() - 3*86400000).toISOString();
    var fresh = new Date(Date.now() - 1*60*1000).toISOString();
    var overduePost = { stage:'in_production', status_changed_at: threeDaysAgo };
    var freshPost   = { stage:'in_production', status_changed_at: fresh };
    expect(helpers._notifChipMatch('overdue', {type:'stage_change'}, overduePost)).toBe(true);
    expect(helpers._notifChipMatch('overdue', {type:'stage_change'}, freshPost)).toBe(false);
    expect(helpers._notifChipMatch('overdue', {type:'stage_change'}, null)).toBe(false);
  });
  it('unknown filter defaults to "all" (permissive)', function() {
    expect(helpers._notifChipMatch('unknown', {type:'comment'}, null)).toBe(true);
  });
});


// ---------------------------------------------------------------
// Source analysis: renderNotifications wiring
// ---------------------------------------------------------------
describe('renderNotifications wiring (source)', function() {
  it('fetches actor field from notifications SELECT', function() {
    expect(uiSrc).toContain('select=id,type,message,read,created_at,post_id,user_role,actor');
  });
  it('initial chip filter defaults to "all"', function() {
    expect(uiSrc).toMatch(/var\s+_notifChipFilter\s*=\s*['"]all['"]/);
  });
  it('renderNotifications writes to all 4 chip-count ids', function() {
    var start = uiSrc.indexOf('function renderNotifications');
    var end = uiSrc.indexOf('\nasync function markNotifRead', start);
    var body = uiSrc.slice(start, end);
    expect(body).toContain('nchip-all-count');
    expect(body).toContain('nchip-approval-count');
    expect(body).toContain('nchip-comment-count');
    expect(body).toContain('nchip-overdue-count');
  });
  it('item markup emits data-post-id + data-notif-id on .notif-item wrapper', function() {
    var start = uiSrc.indexOf('function renderNotifications');
    var end = uiSrc.indexOf('\nasync function markNotifRead', start);
    var body = uiSrc.slice(start, end);
    expect(body).toMatch(/class="notif-item[\s\S]*?data-notif-id/);
    expect(body).toContain("data-post-id");
  });
  it('live moment branch uses .notif-live-card for type:published', function() {
    var start = uiSrc.indexOf('function renderNotifications');
    var end = uiSrc.indexOf('\nasync function markNotifRead', start);
    var body = uiSrc.slice(start, end);
    expect(body).toContain('notif-live-card');
    expect(body).toContain("n.type === 'published'");
  });
  it('renderNotifications uses no style= attributes in item markup', function() {
    var start = uiSrc.indexOf('function renderNotifications');
    var end = uiSrc.indexOf('\nasync function markNotifRead', start);
    var body = uiSrc.slice(start, end);
    // Only live-card inner div uses style="flex:1..." which is allowed layout helper
    var hits = (body.match(/\bstyle="/g) || []);
    // At most 1 allowed (the live-card flex:1 wrapper)
    expect(hits.length).toBeLessThanOrEqual(1);
  });
  it('relative time is rendered inline via notif-time-inline span', function() {
    expect(uiSrc).toContain('notif-time-inline');
  });
  it('overdue inline badge uses .notif-overdue-inline', function() {
    expect(uiSrc).toContain('notif-overdue-inline');
  });
});


// ---------------------------------------------------------------
// Source analysis: markAllNotificationsRead
// ---------------------------------------------------------------
describe('markAllNotificationsRead (source)', function() {
  var body = uiSrc.match(/function markAllNotificationsRead\(\)[\s\S]*?catch\(e\)[\s\S]*?\n\s*\}/)[0];

  it('title-cases role for PATCH (same logic as loadNotifications)', function() {
    expect(body).toMatch(/charAt\(0\)\.toUpperCase\(\)\s*\+[\s\S]*slice\(1\)\.toLowerCase/);
  });
  it('uses Title-cased role variable in PATCH URL', function() {
    expect(body).toContain('user_role=eq.');
    expect(body).toContain('_notifRole');
  });
  it('clears unread-driven chip counts (approval/comment/overdue)', function() {
    expect(body).toContain('nchip-approval-count');
    expect(body).toContain('nchip-comment-count');
    expect(body).toContain('nchip-overdue-count');
  });
  it('calls logError on catch', function() {
    expect(body).toContain('logError');
    expect(body).toContain('mark-all-notifications-read');
  });
  it('shows success toast', function() {
    expect(body).toContain('showToast');
    expect(body).toContain("'success'");
  });
});


// ---------------------------------------------------------------
// Source analysis: full-page overlay + item/live-card tap + chips
// ---------------------------------------------------------------
describe('openNotifications overlay (source)', function() {
  var body = uiSrc.match(/function openNotifications\(\)[\s\S]*?\n\}/)[0];

  it('overlay uses solid background #0a0a0f (not rgba)', function() {
    expect(body).toContain('background:#0a0a0f');
    expect(body).not.toContain('rgba(0,0,0,0.75)');
  });
  it('overlay aligns items stretch (full page)', function() {
    expect(body).toContain('align-items:stretch');
    expect(body).not.toContain('align-items:flex-end');
  });
  it('panel is a flex column with height:100%', function() {
    expect(body).toContain('height:100%');
    expect(body).toContain('flex-direction:column');
  });
  it('tap handler targets .notif-item and .notif-live-card', function() {
    expect(body).toContain("closest('.notif-item, .notif-live-card')");
  });
  it('tap handler reads data-post-id and data-notif-id from item', function() {
    expect(body).toContain("getAttribute('data-post-id')");
    expect(body).toContain("getAttribute('data-notif-id')");
  });
  it('wires #notif-chips click delegation with _chipsWired guard', function() {
    expect(body).toContain('_chipsWired');
    expect(body).toContain("getElementById('notif-chips')");
    expect(body).toContain('_notifChipFilter');
  });
});


// ---------------------------------------------------------------
// Source analysis: dead code removed (PR 1 + PR 2)
// ---------------------------------------------------------------
describe('dead code removed', function() {
  it('PR 1 dead helpers are gone (loadNotifBadge/getActions/parseActor/formatTime/notif-client-badge)', function() {
    expect(uiSrc).not.toMatch(/function\s+loadNotifBadge/);
    expect(uiSrc).not.toContain('window.loadNotifBadge');
    expect(uiSrc).not.toContain('getActions');
    expect(uiSrc).not.toContain('parseActor');
    expect(uiSrc).not.toMatch(/function\s+formatTime\(created_at\)/);
    expect(uiSrc).not.toContain('notif-client-badge');
  });
  it('PR 2 dead APIs are gone (setNotifFilter/.nftab/.ntab-*-count/_NOTIF_NEEDS_TYPES/_NOTIF_UPDATES_TYPES/_notifStagePillClass/notif-summary/chip-urgent)', function() {
    expect(uiSrc).not.toContain('setNotifFilter');
    expect(uiSrc).not.toContain(".nftab");
    expect(uiSrc).not.toContain('ntab-needs-count');
    expect(uiSrc).not.toContain('ntab-updates-count');
    expect(uiSrc).not.toContain('_NOTIF_NEEDS_TYPES');
    expect(uiSrc).not.toContain('_NOTIF_UPDATES_TYPES');
    expect(uiSrc).not.toContain('_notifStagePillClass');
    expect(uiSrc).not.toContain('notif-summary');
    expect(uiSrc).not.toContain('chip-urgent');
  });
});
