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
sandbox += 'var _NOTIF_MOVES_TYPES = ["stage_change","ready","in_production","scheduled","brief","brief_done"];\n';
sandbox += 'var _NOTIF_STAGE_LABELS = { brief:"Brief", brief_done:"Brief Done", in_production:"In Production", awaiting_approval:"Awaiting Approval", awaiting_brand_input:"Needs Input", ready:"Ready", scheduled:"Scheduled", published:"Published" };\n';
sandbox += extract('_notifRelTime\\(iso\\)');
sandbox += extract('_notifActionText\\(n\\)');
sandbox += extract('_notifTypeClass\\(n, isMention\\)');
sandbox += extract('_notifActorClass\\(actor\\)');
sandbox += extract('_notifChipMatch\\(filter, n, mentionSet\\)');
sandbox += '\nreturn { _notifRelTime:_notifRelTime, _notifActionText:_notifActionText, _notifTypeClass:_notifTypeClass, _notifActorClass:_notifActorClass, _notifChipMatch:_notifChipMatch };\n';
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
// _notifActionText — strips actor prefix + applies stage labels
// ---------------------------------------------------------------
describe('_notifActionText', function() {
  it('strips leading actor name from message', function() {
    expect(helpers._notifActionText({ actor:'Manisha', message:'Manisha commented on brief' }))
      .toBe('commented on Brief');
  });
  it('leaves message intact when actor is absent', function() {
    expect(helpers._notifActionText({ actor:'', message:'moved to ready' }))
      .toBe('moved to Ready');
  });
  it('is case-insensitive when stripping actor', function() {
    expect(helpers._notifActionText({ actor:'CHITRA', message:'Chitra approved post' }))
      .toBe('approved post');
  });
  it('replaces raw stage keys with human labels', function() {
    var out = helpers._notifActionText({ actor:'Pranav', message:'Pranav moved to awaiting_brand_input' });
    expect(out).toBe('moved to Needs Input');
  });
  it('replaces all known stage keys (brief/published/scheduled/in_production)', function() {
    expect(helpers._notifActionText({ actor:'', message:'sent to awaiting_approval' }))
      .toBe('sent to Awaiting Approval');
    expect(helpers._notifActionText({ actor:'', message:'moved to scheduled' }))
      .toBe('moved to Scheduled');
    expect(helpers._notifActionText({ actor:'', message:'pushed to in_production' }))
      .toBe('pushed to In Production');
  });
});


// ---------------------------------------------------------------
// _notifTypeClass — new signature (n, isMention)
// ---------------------------------------------------------------
describe('_notifTypeClass', function() {
  it('returns ntype-mention when isMention is true', function() {
    expect(helpers._notifTypeClass({type:'comment'}, true)).toBe('ntype-mention');
  });
  it('returns ntype-comment for comment type without mention', function() {
    expect(helpers._notifTypeClass({type:'comment'}, false)).toBe('ntype-comment');
  });
  it('returns ntype-approval for awaiting_approval / awaiting_brand_input', function() {
    expect(helpers._notifTypeClass({type:'awaiting_approval'}, false)).toBe('ntype-approval');
    expect(helpers._notifTypeClass({type:'awaiting_brand_input'}, false)).toBe('ntype-approval');
  });
  it('returns ntype-live for published', function() {
    expect(helpers._notifTypeClass({type:'published'}, false)).toBe('ntype-live');
  });
  it('returns ntype-stage for stage_change/ready/in_production/scheduled/brief', function() {
    expect(helpers._notifTypeClass({type:'stage_change'}, false)).toBe('ntype-stage');
    expect(helpers._notifTypeClass({type:'ready'}, false)).toBe('ntype-stage');
    expect(helpers._notifTypeClass({type:'in_production'}, false)).toBe('ntype-stage');
    expect(helpers._notifTypeClass({type:'scheduled'}, false)).toBe('ntype-stage');
    expect(helpers._notifTypeClass({type:'brief'}, false)).toBe('ntype-stage');
  });
  it('mention flag overrides type', function() {
    expect(helpers._notifTypeClass({type:'stage_change'}, true)).toBe('ntype-mention');
  });
});


// ---------------------------------------------------------------
// _notifActorClass — avatar CSS mapping (nav-* palette)
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
  it('"mentions" matches only comment notifications with mention', function() {
    var s = new Set(['post-a']);
    expect(helpers._notifChipMatch('mentions', {type:'comment', post_id:'post-a'}, s)).toBe(true);
    expect(helpers._notifChipMatch('mentions', {type:'comment', post_id:'post-b'}, s)).toBe(false);
    expect(helpers._notifChipMatch('mentions', {type:'stage_change', post_id:'post-a'}, s)).toBe(false);
  });
  it('"comments" matches only type:comment', function() {
    expect(helpers._notifChipMatch('comments', {type:'comment'}, null)).toBe(true);
    expect(helpers._notifChipMatch('comments', {type:'stage_change'}, null)).toBe(false);
    expect(helpers._notifChipMatch('comments', {type:'published'}, null)).toBe(false);
  });
  it('"live" matches only type:published', function() {
    expect(helpers._notifChipMatch('live', {type:'published'}, null)).toBe(true);
    expect(helpers._notifChipMatch('live', {type:'scheduled'}, null)).toBe(false);
    expect(helpers._notifChipMatch('live', {type:'comment'}, null)).toBe(false);
  });
  it('"moves" matches stage_change/ready/in_production/scheduled/brief/brief_done', function() {
    expect(helpers._notifChipMatch('moves', {type:'stage_change'}, null)).toBe(true);
    expect(helpers._notifChipMatch('moves', {type:'ready'}, null)).toBe(true);
    expect(helpers._notifChipMatch('moves', {type:'in_production'}, null)).toBe(true);
    expect(helpers._notifChipMatch('moves', {type:'scheduled'}, null)).toBe(true);
    expect(helpers._notifChipMatch('moves', {type:'brief'}, null)).toBe(true);
    expect(helpers._notifChipMatch('moves', {type:'brief_done'}, null)).toBe(true);
    expect(helpers._notifChipMatch('moves', {type:'comment'}, null)).toBe(false);
    expect(helpers._notifChipMatch('moves', {type:'published'}, null)).toBe(false);
  });
  it('mentions chip returns falsy with no mention set', function() {
    expect(helpers._notifChipMatch('mentions', {type:'comment', post_id:'p1'}, null)).toBeFalsy();
  });
  it('unknown filter defaults to permissive (true)', function() {
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
  it('batch-fetches post_comments for mention + preview data', function() {
    expect(uiSrc).toContain('/post_comments?post_id=in.');
    expect(uiSrc).toContain('mentioned_users');
  });
  it('initial chip filter defaults to "all"', function() {
    expect(uiSrc).toMatch(/var\s+_notifChipFilter\s*=\s*['"]all['"]/);
  });
  it('renderNotifications writes to all 4 chip-count ids', function() {
    var start = uiSrc.indexOf('function renderNotifications');
    var end = uiSrc.indexOf('\nasync function markNotifRead', start);
    var body = uiSrc.slice(start, end);
    expect(body).toContain('nchip-count-all');
    expect(body).toContain('nchip-count-mentions');
    expect(body).toContain('nchip-count-comments');
    expect(body).toContain('nchip-count-moves');
  });
  it('item markup emits data-post-id + data-notif-id on .notif-item wrapper', function() {
    var start = uiSrc.indexOf('function renderNotifications');
    var end = uiSrc.indexOf('\nasync function markNotifRead', start);
    var body = uiSrc.slice(start, end);
    expect(body).toMatch(/class="notif-item[\s\S]*?data-notif-id/);
    expect(body).toContain("data-post-id");
  });
  it('published notifications render as .notif-live-card (not .notif-item)', function() {
    var start = uiSrc.indexOf('function renderNotifications');
    var end = uiSrc.indexOf('\nasync function markNotifRead', start);
    var body = uiSrc.slice(start, end);
    expect(body).toContain('notif-live-card');
    expect(body).toContain("n.type === 'published'");
  });
  it('grouped comment copy uses "left N comments" template', function() {
    var start = uiSrc.indexOf('function renderNotifications');
    var end = uiSrc.indexOf('\nasync function markNotifRead', start);
    var body = uiSrc.slice(start, end);
    expect(body).toContain('left ');
    expect(body).toContain(' comments on ');
  });
  it('day groups are today/yesterday/earlier (Today/Yesterday/Earlier labels)', function() {
    var start = uiSrc.indexOf('function renderNotifications');
    var end = uiSrc.indexOf('\nasync function markNotifRead', start);
    var body = uiSrc.slice(start, end);
    expect(body).toContain('Today');
    expect(body).toContain('Yesterday');
    expect(body).toContain('Earlier');
    expect(body).toContain('notif-day-label');
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
  it('clears all four chip count spans', function() {
    expect(body).toContain('nchip-count-all');
    expect(body).toContain('nchip-count-mentions');
    expect(body).toContain('nchip-count-comments');
    expect(body).toContain('nchip-count-moves');
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
  it('overlay aligns items stretch + panel is flex column 100%', function() {
    expect(body).toContain('align-items:stretch');
    expect(body).toContain('height:100%');
    expect(body).toContain('flex-direction:column');
  });
  it('tap handler targets .notif-item and .notif-live-card', function() {
    expect(body).toContain("closest('.notif-item, .notif-live-card')");
  });
  it('tap handler reads data-post-id and data-notif-id', function() {
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
// Source analysis: dead code removed (PR 1 + 2 + 3)
// ---------------------------------------------------------------
describe('dead code removed', function() {
  it('PR 1 dead helpers are gone', function() {
    expect(uiSrc).not.toMatch(/function\s+loadNotifBadge/);
    expect(uiSrc).not.toContain('window.loadNotifBadge');
    expect(uiSrc).not.toContain('getActions');
    expect(uiSrc).not.toContain('parseActor');
    expect(uiSrc).not.toContain('notif-client-badge');
  });
  it('PR 2 dead APIs are gone (setNotifFilter/nftab/ntab-*-count/needs-updates/stagePill/notif-summary/chip-urgent)', function() {
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
  it('PR 3 overdue detection is entirely removed', function() {
    expect(uiSrc).not.toContain('isOverdue');
    expect(uiSrc).not.toContain('_notifIsOverdue');
    expect(uiSrc).not.toContain('ntype-overdue');
    expect(uiSrc).not.toContain('OVERDUE');
  });
  it('PR 3 old chip ids gone (nchip-all-count etc.)', function() {
    expect(uiSrc).not.toContain('nchip-all-count');
    expect(uiSrc).not.toContain('nchip-approval-count');
    expect(uiSrc).not.toContain('nchip-comment-count');
    expect(uiSrc).not.toContain('nchip-overdue-count');
  });
  it('PR 3 old chip palette gone (nchip-red/cyan/amber/green)', function() {
    expect(uiSrc).not.toContain('nchip-red');
    expect(uiSrc).not.toContain('nchip-amber');
  });
});
