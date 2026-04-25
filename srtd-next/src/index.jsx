import './styles/tailwind.css';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import * as core from './core/index.js';
import { createPostFlow } from './flows/create-post/index.js';
import { pcsFlow } from './flows/pcs/index.js';

if (typeof window !== 'undefined') {
  console.log('[sorted-react] bundle loaded, v0.9.25');

  if (typeof window.SortedReact !== 'object' || window.SortedReact === null) {
    window.SortedReact = {};
  }
  window.SortedReact.version   = '0.9.26';
  window.SortedReact.tokens    = core.tokens;
  window.SortedReact.mappings  = core.mappings;
  window.SortedReact.stores    = core.stores;
  window.SortedReact.bridges   = core.bridges;
  window.SortedReact.api       = core.api;
  window.SortedReact.ui        = core.ui;
  window.SortedReact.utils     = core.utils;
  window.SortedReact.theme     = core.theme;
  window.SortedReact.flows     = {
    createPost: createPostFlow,
    pcs: pcsFlow
  };

  const mountEl = document.getElementById('react-root-new-post');
  if (mountEl) {
    mountEl.style.display = 'block';

    try {
      const root = createRoot(mountEl);
      root.render(<App />);
      window.SortedReact.mounted = true;
      console.log('[sorted-react] mounted, core + flows ready on window.SortedReact');

      if (window.__pcsAutoOpenPostId) {
        setTimeout(() => {
          try { pcsFlow.open(window.__pcsAutoOpenPostId); }
          catch (e) { console.error('[sorted-react/pcs] auto-open failed', e); }
        }, 200);
      }

      // Plan React deep-link drain. Set by 04-router.js when ?plan_react=1
      // is on with ?open=POST_ID. Brief IDs (REQ-*) route to vanilla
      // _openBriefSheet (z-index 9500, above Plan's 1400). Regular post
      // IDs route to pcsFlow.open. setTimeout matches the __pcsAutoOpenPostId
      // delay so activateRole + React mount have settled.
      if (window._planReactPendingOpen) {
        const pendingId = window._planReactPendingOpen;
        window._planReactPendingOpen = null;
        setTimeout(() => {
          try {
            const isBrief = String(pendingId).indexOf('REQ-') === 0;
            if (isBrief && typeof window._openBriefSheet === 'function') {
              window._openBriefSheet(pendingId);
            } else {
              pcsFlow.open(pendingId);
            }
          } catch (e) {
            console.error('[sorted-react/plan] deep-link open failed', e);
          }
        }, 200);
      }
    } catch (err) {
      console.error('[sorted-react] mount failed:', err);
      window.SortedReact.mounted = false;
      window.SortedReact.mountError = err && err.message;
    }
  } else {
    console.warn('[sorted-react] mount point #react-root-new-post not found');
    window.SortedReact.mounted = false;
  }
}
