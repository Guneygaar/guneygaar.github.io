import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Extract only the router block from 10-ui.js so we don't have to
// evaluate the whole file (it pulls in many globals we don't want
// to stub). The router is wrapped in `if (!window._routerBound)`.
var uiSrc = fs.readFileSync(
  path.join(__dirname, '..', '10-ui.js'), 'utf8');
var routerMatch = uiSrc.match(
  /if \(!window\._routerBound\) \{[\s\S]*?document\.addEventListener[\s\S]*?\n\s*\}\);\n\}/);
if (!routerMatch) throw new Error('Could not extract router block from 10-ui.js');
var routerSrc = routerMatch[0];

// Load guardAction from 00-appstate.js (whole file is safe — it only
// defines globals and sets window.onerror/onunhandledrejection).
var appstateSrc = fs.readFileSync(
  path.join(__dirname, '..', '00-appstate.js'), 'utf8');

// Microtask drain helper — guardAction's .finally() fires on the
// next microtask, so awaits flush between assertions.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function dispatchClickOn(el) {
  var evt = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  el.dispatchEvent(evt);
}

describe('Phase 4/5 — Action Router & guardAction', function() {

  beforeAll(function() {
    window.AppState = {
      user: { name:'Test', email:'t@t.com',
        role:'Admin', effectiveRole:'Admin', previewRole:null },
      posts: { all:[], cached:[], loaded:false,
        setAll:function(p){ window.AppState.posts.all = p; } },
      pcs: { open:false, postId:null, activeMenu:null },
      ui: { modalOpen:false, unreadCount:0 },
      timers: {}
    };
    // Prevent logError's fetch from touching the network.
    window.fetch = vi.fn(function() { return Promise.resolve({ ok:true }); });
    // 10-ui.js owns window._clickBuffer in production; the router
    // pushes to it on every dispatch. We're not evaluating 10-ui.js
    // here (only the router block), so stub the buffer array.
    window._clickBuffer = [];
    // Evaluate guardAction and the router ONCE.
    // Re-evaluating would either double-bind the listener or re-declare _inFlight,
    // so keep state stable across the suite and clear _inFlight via the
    // unique-key discipline in each test.
    eval(appstateSrc);
    eval(routerSrc);
  });

  beforeEach(function() {
    // Fresh mocks on every test.
    window.switchTab         = vi.fn();
    window.showLibrary       = vi.fn();
    window.showInsights      = vi.fn();
    window._pcsTabSwitch     = vi.fn();
    window.setPcsVisibility  = vi.fn();
    window.setNotifFilter    = vi.fn();
    window.insSetMetric      = vi.fn();
    window.insSetRange       = vi.fn();
    window.insSetPostsPeriod = vi.fn();
    window.insSetLens        = vi.fn();
    window.libSetView        = vi.fn();
    window.nrsSetUrg         = vi.fn();
    window.insSetMainTab     = vi.fn();
    window.showToast         = vi.fn();
    window.logError          = vi.fn();
    document.body.innerHTML = '';
  });

  afterEach(function() {
    document.body.innerHTML = '';
  });

  // ===========================================================
  // 1. guardAction utility
  // ===========================================================
  describe('guardAction utility', function() {

    it('1. calls fn when key is not in-flight', async function() {
      var spy = vi.fn();
      window.guardAction('ga-key-1', spy);
      expect(spy).toHaveBeenCalledTimes(1);
      await flush();
    });

    it('2. does NOT call fn a second time while key is in-flight', async function() {
      var resolveInner;
      var pending = new Promise(function(r){ resolveInner = r; });
      var spy = vi.fn(function() { return pending; });
      window.guardAction('ga-key-2', spy);
      window.guardAction('ga-key-2', spy);
      window.guardAction('ga-key-2', spy);
      expect(spy).toHaveBeenCalledTimes(1);
      resolveInner();
      await flush();
    });

    it('3. releases key after fn resolves — next call goes through', async function() {
      var spy = vi.fn();
      window.guardAction('ga-key-3', spy);
      await flush();
      window.guardAction('ga-key-3', spy);
      await flush();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('4. catches thrown errors, calls logError, calls showToast', async function() {
      window.guardAction('ga-key-4', async function() {
        throw new Error('boom');
      });
      await flush();
      expect(window.logError).toHaveBeenCalled();
      expect(window.showToast).toHaveBeenCalledWith('Something went wrong', 'error');
    });

    it('5. does not re-throw on error', async function() {
      var threw = false;
      try {
        window.guardAction('ga-key-5', async function() {
          throw new Error('boom');
        });
      } catch (e) { threw = true; }
      expect(threw).toBe(false);
      await flush();
    });

    it('6. releases key even when fn throws', async function() {
      window.guardAction('ga-key-6', async function() { throw new Error('boom'); });
      await flush();
      var spy = vi.fn();
      window.guardAction('ga-key-6', spy);
      expect(spy).toHaveBeenCalledTimes(1);
      await flush();
    });

    it('7. works with sync functions', async function() {
      var spy = vi.fn(function() { return 'sync-result'; });
      window.guardAction('ga-key-7', spy);
      expect(spy).toHaveBeenCalledTimes(1);
      await flush();
    });

    it('8. works with async functions', async function() {
      var spy = vi.fn(async function() { return 'async-result'; });
      window.guardAction('ga-key-8', spy);
      expect(spy).toHaveBeenCalledTimes(1);
      await flush();
    });

    it('9. different keys do not block each other', async function() {
      var resolveA, resolveB;
      var pA = new Promise(function(r){ resolveA = r; });
      var pB = new Promise(function(r){ resolveB = r; });
      var spyA = vi.fn(function(){ return pA; });
      var spyB = vi.fn(function(){ return pB; });
      window.guardAction('ga-key-9a', spyA);
      window.guardAction('ga-key-9b', spyB);
      expect(spyA).toHaveBeenCalledTimes(1);
      expect(spyB).toHaveBeenCalledTimes(1);
      resolveA(); resolveB();
      await flush();
    });
  });

  // ===========================================================
  // 2. Duplicate listener guard
  // ===========================================================
  describe('_routerBound duplicate listener guard', function() {
    it('10. window._routerBound is true after router init', function() {
      expect(window._routerBound).toBe(true);
    });

    it('11. re-eval of router block does not add a second listener', async function() {
      // If we re-eval and it double-binds, a single click would fire the
      // handler twice, calling switchTab twice for one click.
      eval(routerSrc);
      var el = document.createElement('div');
      el.setAttribute('data-action', 'nav-tab');
      el.setAttribute('data-tab', 'tasks');
      document.body.appendChild(el);
      dispatchClickOn(el);
      await flush();
      expect(window.switchTab).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================
  // 3. Every Action Router case — click → handler called correctly
  // ===========================================================
  describe('Action Router switch cases', function() {

    function makeEl(attrs, parent) {
      var el = document.createElement('button');
      Object.keys(attrs).forEach(function(k) { el.setAttribute(k, attrs[k]); });
      (parent || document.body).appendChild(el);
      return el;
    }

    it('12. nav-tab → switchTab(actionEl)', async function() {
      var el = makeEl({ 'data-action':'nav-tab', 'data-tab':'r12-tasks' });
      dispatchClickOn(el);
      await flush();
      expect(window.switchTab).toHaveBeenCalledTimes(1);
      expect(window.switchTab).toHaveBeenCalledWith(el);
    });

    it('13. nav-library → showLibrary()', async function() {
      var el = makeEl({ 'data-action':'nav-library' });
      // Use unique key per test by clearing previous in-flight cycle
      // via flush() before assertion.
      dispatchClickOn(el);
      await flush();
      expect(window.showLibrary).toHaveBeenCalledTimes(1);
    });

    it('14. nav-insights → showInsights()', async function() {
      // nav-insights uses fixed key 'nav-insights' — flush to release
      // from any prior test scoping. beforeEach re-mocks; the key state
      // is orthogonal to mock fn identity so we need to ensure the guard
      // is released. Since each test awaits flush() at the end, the key
      // is cleared. No extra work needed here.
      var el = makeEl({ 'data-action':'nav-insights' });
      dispatchClickOn(el);
      await flush();
      expect(window.showInsights).toHaveBeenCalledTimes(1);
    });

    it('15. pcs-tab → _pcsTabSwitch(tabValue)', async function() {
      var el = makeEl({ 'data-action':'pcs-tab', 'data-tab':'r15-caption' });
      dispatchClickOn(el);
      await flush();
      expect(window._pcsTabSwitch).toHaveBeenCalledTimes(1);
      expect(window._pcsTabSwitch).toHaveBeenCalledWith('r15-caption');
    });

    it('16. pcs-vis → setPcsVisibility(actionEl, visValue)', async function() {
      var el = makeEl({ 'data-action':'pcs-vis', 'data-vis':'r16-admin' });
      dispatchClickOn(el);
      await flush();
      expect(window.setPcsVisibility).toHaveBeenCalledTimes(1);
      expect(window.setPcsVisibility).toHaveBeenCalledWith(el, 'r16-admin');
    });


    it('18. ins-metric → insSetMetric(metricValue, actionEl)', async function() {
      var el = makeEl({ 'data-action':'ins-metric', 'data-metric':'r18-imp' });
      dispatchClickOn(el);
      await flush();
      expect(window.insSetMetric).toHaveBeenCalledTimes(1);
      expect(window.insSetMetric).toHaveBeenCalledWith('r18-imp', el);
    });

    it('19. ins-range → insSetRange(rangeValue, actionEl)', async function() {
      var el = makeEl({ 'data-action':'ins-range', 'data-range':'r19-7d' });
      dispatchClickOn(el);
      await flush();
      expect(window.insSetRange).toHaveBeenCalledTimes(1);
      expect(window.insSetRange).toHaveBeenCalledWith('r19-7d', el);
    });

    it('20. ins-period → insSetPostsPeriod(periodValue, actionEl)', async function() {
      var el = makeEl({ 'data-action':'ins-period', 'data-period':'r20-mar' });
      dispatchClickOn(el);
      await flush();
      expect(window.insSetPostsPeriod).toHaveBeenCalledTimes(1);
      expect(window.insSetPostsPeriod).toHaveBeenCalledWith('r20-mar', el);
    });

    it('21. ins-lens → insSetLens(lensValue, actionEl)', async function() {
      var el = makeEl({ 'data-action':'ins-lens', 'data-lens':'r21-reach' });
      dispatchClickOn(el);
      await flush();
      expect(window.insSetLens).toHaveBeenCalledTimes(1);
      expect(window.insSetLens).toHaveBeenCalledWith('r21-reach', el);
    });

    it('22. lib-view → libSetView(viewValue, actionEl)', async function() {
      var el = makeEl({ 'data-action':'lib-view', 'data-view':'r22-list' });
      dispatchClickOn(el);
      await flush();
      expect(window.libSetView).toHaveBeenCalledTimes(1);
      expect(window.libSetView).toHaveBeenCalledWith('r22-list', el);
    });

    it('23. nrs-urg → nrsSetUrg(actionEl, urgencyValue)', async function() {
      var el = makeEl({ 'data-action':'nrs-urg', 'data-urgency':'r23-low' });
      dispatchClickOn(el);
      await flush();
      expect(window.nrsSetUrg).toHaveBeenCalledTimes(1);
      expect(window.nrsSetUrg).toHaveBeenCalledWith(el, 'r23-low');
    });

    it('24. ins-main-tab → insSetMainTab(tabValue, actionEl)', async function() {
      var el = makeEl({ 'data-action':'ins-main-tab', 'data-tab':'r24-overview' });
      dispatchClickOn(el);
      await flush();
      expect(window.insSetMainTab).toHaveBeenCalledTimes(1);
      expect(window.insSetMainTab).toHaveBeenCalledWith('r24-overview', el);
    });

    it('25. overlay-close → close fn called when e.target === actionEl', async function() {
      window.closeR25 = vi.fn();
      var el = document.createElement('div');
      el.setAttribute('data-action', 'overlay-close');
      el.setAttribute('data-close', 'closeR25');
      document.body.appendChild(el);
      dispatchClickOn(el);
      await flush();
      expect(window.closeR25).toHaveBeenCalledTimes(1);
      delete window.closeR25;
    });

    it('26. overlay-close → close fn NOT called when child clicked', async function() {
      window.closeR26 = vi.fn();
      var el = document.createElement('div');
      el.setAttribute('data-action', 'overlay-close');
      el.setAttribute('data-close', 'closeR26');
      var child = document.createElement('div');
      el.appendChild(child);
      document.body.appendChild(el);
      dispatchClickOn(child);
      await flush();
      expect(window.closeR26).not.toHaveBeenCalled();
      delete window.closeR26;
    });
  });

  // ===========================================================
  // 4. Interactive-descendant guard
  // ===========================================================
  describe('interactive descendant guard', function() {

    it('27. click on <input> inside [data-action] → no handler called', async function() {
      var el = document.createElement('div');
      el.setAttribute('data-action', 'nav-library');
      var input = document.createElement('input');
      el.appendChild(input);
      document.body.appendChild(el);
      dispatchClickOn(input);
      await flush();
      expect(window.showLibrary).not.toHaveBeenCalled();
    });

    it('28. click on <textarea> inside [data-action] → no handler called', async function() {
      var el = document.createElement('div');
      el.setAttribute('data-action', 'nav-library');
      var ta = document.createElement('textarea');
      el.appendChild(ta);
      document.body.appendChild(el);
      dispatchClickOn(ta);
      await flush();
      expect(window.showLibrary).not.toHaveBeenCalled();
    });

    it('29. click on <a> inside [data-action] → no handler called', async function() {
      var el = document.createElement('div');
      el.setAttribute('data-action', 'nav-library');
      var a = document.createElement('a');
      a.setAttribute('href', '#');
      el.appendChild(a);
      document.body.appendChild(el);
      dispatchClickOn(a);
      await flush();
      expect(window.showLibrary).not.toHaveBeenCalled();
    });

    it('30. click on contenteditable inside [data-action] → no handler called', async function() {
      var el = document.createElement('div');
      el.setAttribute('data-action', 'nav-library');
      var ce = document.createElement('div');
      ce.setAttribute('contenteditable', 'true');
      el.appendChild(ce);
      document.body.appendChild(el);
      dispatchClickOn(ce);
      await flush();
      expect(window.showLibrary).not.toHaveBeenCalled();
    });

    it('31. <button> WITH data-action IS allowed (action el IS the button)', async function() {
      var btn = document.createElement('button');
      btn.setAttribute('data-action', 'pcs-tab');
      btn.setAttribute('data-tab', 'r31-caption');
      document.body.appendChild(btn);
      dispatchClickOn(btn);
      await flush();
      expect(window._pcsTabSwitch).toHaveBeenCalledTimes(1);
      expect(window._pcsTabSwitch).toHaveBeenCalledWith('r31-caption');
    });
  });

  // ===========================================================
  // 5. PCS overlay routing
  // ===========================================================
  describe('PCS overlay routing', function() {
    it('32. pcs-tab inside #pcs-overlay still routes', async function() {
      var overlay = document.createElement('div');
      overlay.id = 'pcs-overlay';
      var btn = document.createElement('button');
      btn.setAttribute('data-action', 'pcs-tab');
      btn.setAttribute('data-tab', 'r32-client');
      overlay.appendChild(btn);
      document.body.appendChild(overlay);
      dispatchClickOn(btn);
      await flush();
      expect(window._pcsTabSwitch).toHaveBeenCalledTimes(1);
      expect(window._pcsTabSwitch).toHaveBeenCalledWith('r32-client');
    });

    it('33. pcs-vis inside #pcs-overlay still routes', async function() {
      var overlay = document.createElement('div');
      overlay.id = 'pcs-overlay';
      var btn = document.createElement('button');
      btn.setAttribute('data-action', 'pcs-vis');
      btn.setAttribute('data-vis', 'r33-admin');
      overlay.appendChild(btn);
      document.body.appendChild(overlay);
      dispatchClickOn(btn);
      await flush();
      expect(window.setPcsVisibility).toHaveBeenCalledTimes(1);
      expect(window.setPcsVisibility).toHaveBeenCalledWith(btn, 'r33-admin');
    });
  });

  // ===========================================================
  // 6. Error boundary — a handler that throws synchronously
  // ===========================================================
  describe('error boundary', function() {
    it('34. throwing handler → showToast + logError called, listener survives', async function() {
      window.switchTab = vi.fn(function() { throw new Error('handler-boom'); });
      var el = document.createElement('div');
      el.setAttribute('data-action', 'nav-tab');
      el.setAttribute('data-tab', 'r34-unique');
      document.body.appendChild(el);
      dispatchClickOn(el);
      await flush();
      // guardAction catches the throw → logError + showToast('Something went wrong', 'error')
      expect(window.logError).toHaveBeenCalled();
      expect(window.showToast).toHaveBeenCalled();

      // Second click with a fresh (non-throwing) handler still dispatches.
      window.nrsSetUrg = vi.fn();
      var el2 = document.createElement('div');
      el2.setAttribute('data-action', 'nrs-urg');
      el2.setAttribute('data-urgency', 'r34-after');
      document.body.appendChild(el2);
      dispatchClickOn(el2);
      await flush();
      expect(window.nrsSetUrg).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================
  // 7. Unknown action
  // ===========================================================
  describe('unknown action', function() {
    it('35. unknown data-action → no crash, no handler called', async function() {
      var el = document.createElement('div');
      el.setAttribute('data-action', 'totally-unknown-r35');
      document.body.appendChild(el);
      expect(function() { dispatchClickOn(el); }).not.toThrow();
      await flush();
      expect(window.switchTab).not.toHaveBeenCalled();
      expect(window.showLibrary).not.toHaveBeenCalled();
    });

    it('36. unknown action with _appStateDevMode=true → console.warn fired', async function() {
      var warnSpy = vi.spyOn(console, 'warn').mockImplementation(function(){});
      window._appStateDevMode = true;
      var el = document.createElement('div');
      el.setAttribute('data-action', 'also-unknown-r36');
      document.body.appendChild(el);
      dispatchClickOn(el);
      await flush();
      expect(warnSpy).toHaveBeenCalled();
      var calls = warnSpy.mock.calls;
      var seen = calls.some(function(args){
        return args.some(function(a){
          return typeof a === 'string' && a.indexOf('also-unknown-r36') !== -1;
        });
      });
      expect(seen).toBe(true);
      window._appStateDevMode = false;
      warnSpy.mockRestore();
    });
  });
});
