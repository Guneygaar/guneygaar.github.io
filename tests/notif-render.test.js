import { describe, it, expect, beforeEach } from 'vitest';
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

// Build a tiny sandbox with extracted pure helpers
var sandbox = '';
sandbox += 'var _NOTIF_NEEDS_TYPES = ["awaiting_approval","awaiting_brand_input","brief","comment"];\n';
sandbox += 'var _NOTIF_UPDATES_TYPES = ["published","scheduled","stage_change","in_production","ready"];\n';
sandbox += extract('_notifRelTime\\(iso\\)');
sandbox += extract('_notifIsOverdue\\(post\\)');
sandbox += extract('_notifTypeClass\\(n, post\\)');
sandbox += extract('_notifActorClass\\(actor\\)');
sandbox += extract('_notifStagePillClass\\(stage\\)');
sandbox += '\nreturn { _notifRelTime:_notifRelTime, _notifIsOverdue:_notifIsOverdue, _notifTypeClass:_notifTypeClass, _notifActorClass:_notifActorClass, _notifStagePillClass:_notifStagePillClass, _NOTIF_NEEDS_TYPES:_NOTIF_NEEDS_TYPES, _NOTIF_UPDATES_TYPES:_NOTIF_UPDATES_TYPES };\n';
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
    // Should contain a weekday abbreviation and month
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
// Needs / Updates filter buckets
// ---------------------------------------------------------------
describe('Notification tab buckets', function() {
  it('needs types cover awaiting_approval, awaiting_brand_input, brief, comment', function() {
    expect(helpers._NOTIF_NEEDS_TYPES).toEqual(
      ['awaiting_approval','awaiting_brand_input','brief','comment']
    );
  });
  it('updates types cover published, scheduled, stage_change, in_production, ready', function() {
    expect(helpers._NOTIF_UPDATES_TYPES).toEqual(
      ['published','scheduled','stage_change','in_production','ready']
    );
  });
  it('buckets are disjoint (no type overlap)', function() {
    helpers._NOTIF_NEEDS_TYPES.forEach(function(t) {
      expect(helpers._NOTIF_UPDATES_TYPES.indexOf(t)).toBe(-1);
    });
  });
});


// ---------------------------------------------------------------
// ntype class assignment
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
    var threeDaysAgo = new Date(Date.now() - 3*24*60*60*1000).toISOString();
    var post = { stage: 'in_production', status_changed_at: threeDaysAgo };
    expect(helpers._notifTypeClass({type:'stage_change'}, post)).toBe('ntype-overdue');
  });
  it('never marks published posts as overdue', function() {
    var tenDaysAgo = new Date(Date.now() - 10*24*60*60*1000).toISOString();
    var post = { stage: 'published', status_changed_at: tenDaysAgo };
    expect(helpers._notifTypeClass({type:'published'}, post)).toBe('ntype-live');
  });
});


// ---------------------------------------------------------------
// Avatar class mapping
// ---------------------------------------------------------------
describe('_notifActorClass', function() {
  it('maps names to correct CSS classes', function() {
    expect(helpers._notifActorClass('Manisha')).toBe('av-n-client');
    expect(helpers._notifActorClass('Shivangini')).toBe('av-n-client');
    expect(helpers._notifActorClass('Client')).toBe('av-n-client');
    expect(helpers._notifActorClass('Chitra')).toBe('av-n-chitra');
    expect(helpers._notifActorClass('Servicing')).toBe('av-n-chitra');
    expect(helpers._notifActorClass('Pranav')).toBe('av-n-pranav');
    expect(helpers._notifActorClass('Creative')).toBe('av-n-pranav');
    expect(helpers._notifActorClass('Shubham')).toBe('av-n-shubham');
    expect(helpers._notifActorClass('Admin')).toBe('av-n-shubham');
  });
  it('returns av-n-system for missing actor', function() {
    expect(helpers._notifActorClass('')).toBe('av-n-system');
    expect(helpers._notifActorClass(null)).toBe('av-n-system');
    expect(helpers._notifActorClass(undefined)).toBe('av-n-system');
  });
  it('is case-insensitive', function() {
    expect(helpers._notifActorClass('CHITRA')).toBe('av-n-chitra');
    expect(helpers._notifActorClass('chitra')).toBe('av-n-chitra');
  });
});


// ---------------------------------------------------------------
// Stage pill class mapping
// ---------------------------------------------------------------
describe('_notifStagePillClass', function() {
  it('maps all stages to nsp-* classes', function() {
    expect(helpers._notifStagePillClass('awaiting_approval')).toBe('nsp-approval');
    expect(helpers._notifStagePillClass('awaiting_brand_input')).toBe('nsp-input');
    expect(helpers._notifStagePillClass('ready')).toBe('nsp-ready');
    expect(helpers._notifStagePillClass('scheduled')).toBe('nsp-scheduled');
    expect(helpers._notifStagePillClass('published')).toBe('nsp-published');
    expect(helpers._notifStagePillClass('in_production')).toBe('nsp-production');
  });
});


// ---------------------------------------------------------------
// Source analysis: renderNotifications wiring
// ---------------------------------------------------------------
describe('renderNotifications wiring (source)', function() {
  it('fetches actor field from notifications SELECT', function() {
    expect(uiSrc).toContain('select=id,type,message,read,created_at,post_id,user_role,actor');
  });
  it('uses n.actor directly for avatar (no parseActor)', function() {
    expect(uiSrc).not.toContain('parseActor');
  });
  it('initial filter defaults to "needs"', function() {
    expect(uiSrc).toMatch(/var\s+_notifFilter\s*=\s*['"]needs['"]/);
  });
  it('setNotifFilter only accepts needs or updates', function() {
    var match = uiSrc.match(/function setNotifFilter[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    expect(match[0]).toContain("'needs'");
    expect(match[0]).toContain("'updates'");
  });
  it('renderNotifications writes to notif-summary element', function() {
    expect(uiSrc).toContain("getElementById('notif-summary')");
  });
  it('renderNotifications reads approvals from AppState.posts.all', function() {
    var match = uiSrc.match(/function renderNotifications[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    expect(match[0]).toContain("AppState.posts.all");
    expect(match[0]).toContain("stage === 'awaiting_approval'");
  });
  it('renderNotifications reads _clientCommentAt for comment count', function() {
    var match = uiSrc.match(/function renderNotifications[\s\S]*?\n\}/);
    expect(match[0]).toContain("_clientCommentAt");
  });
  it('summary chip classes use chip-urgent, chip-reply, chip-live, chip-allclear', function() {
    var match = uiSrc.match(/function renderNotifications[\s\S]*?\n\}/);
    expect(match[0]).toContain('chip-urgent');
    expect(match[0]).toContain('chip-reply');
    expect(match[0]).toContain('chip-live');
    expect(match[0]).toContain('chip-allclear');
  });
  it('renderNotifications writes to ntab-needs-count and ntab-updates-count', function() {
    expect(uiSrc).toContain('ntab-needs-count');
    expect(uiSrc).toContain('ntab-updates-count');
  });
  it('renderNotifications uses no inline style= attributes', function() {
    var start = uiSrc.indexOf('function renderNotifications');
    expect(start).toBeGreaterThan(-1);
    // Find matching close brace by walking forward to next top-level fn
    var end = uiSrc.indexOf('\nfunction setNotifFilter', start);
    expect(end).toBeGreaterThan(start);
    var body = uiSrc.slice(start, end);
    var styleMatches = (body.match(/\bstyle=/g) || []);
    expect(styleMatches.length).toBe(0);
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
  it('clears ntab-needs-count and ntab-updates-count', function() {
    expect(body).toContain('ntab-needs-count');
    expect(body).toContain('ntab-updates-count');
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
// Source analysis: full-page overlay + item tap
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
  it('tap handler targets .notif-item (not .notif-post-card-tap)', function() {
    expect(body).toContain("closest('.notif-item')");
    expect(body).not.toContain('notif-post-card-tap');
  });
  it('tap handler reads data-post-id and data-notif-id from item', function() {
    expect(body).toContain("getAttribute('data-post-id')");
    expect(body).toContain("getAttribute('data-notif-id')");
  });
});


// ---------------------------------------------------------------
// Source analysis: dead code removal
// ---------------------------------------------------------------
describe('dead code removed', function() {
  it('loadNotifBadge function is gone', function() {
    expect(uiSrc).not.toMatch(/function\s+loadNotifBadge/);
    expect(uiSrc).not.toContain('window.loadNotifBadge');
  });
  it('getActions helper is gone', function() {
    expect(uiSrc).not.toContain('getActions');
  });
  it('typeClass map is gone', function() {
    expect(uiSrc).not.toMatch(/var\s+typeClass\s*=\s*\{/);
  });
  it('stagePills map is gone', function() {
    expect(uiSrc).not.toMatch(/var\s+stagePills\s*=\s*\{/);
  });
  it('parseActor regex helper is gone', function() {
    expect(uiSrc).not.toContain('parseActor');
  });
  it('formatTime helper is gone (replaced by _notifRelTime)', function() {
    expect(uiSrc).not.toMatch(/function\s+formatTime\(created_at\)/);
  });
  it('notif-client-badge reference is gone', function() {
    expect(uiSrc).not.toContain('notif-client-badge');
  });
  it('old .nftab selector is gone (replaced with .ntab)', function() {
    expect(uiSrc).not.toContain(".nftab");
  });
});
