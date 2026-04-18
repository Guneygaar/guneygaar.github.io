import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import * as core from './core/index.js';
import { createPostFlow } from './flows/create-post/index.js';

if (typeof window !== 'undefined') {
  console.log('[sorted-react] bundle loaded, v0.7.0');

  if (typeof window.SortedReact !== 'object' || window.SortedReact === null) {
    window.SortedReact = {};
  }
  window.SortedReact.version   = '0.7.0';
  window.SortedReact.tokens    = core.tokens;
  window.SortedReact.mappings  = core.mappings;
  window.SortedReact.stores    = core.stores;
  window.SortedReact.bridges   = core.bridges;
  window.SortedReact.api       = core.api;
  window.SortedReact.ui        = core.ui;
  window.SortedReact.utils     = core.utils;
  window.SortedReact.flows     = {
    createPost: createPostFlow
  };

  const mountEl = document.getElementById('react-root-new-post');
  if (mountEl) {
    // When a flow is active, ensure the host div is visible.
    // The flow components render position:fixed overlays so the
    // div itself just needs to exist and not be display:none.
    mountEl.style.display = 'block';

    try {
      const root = createRoot(mountEl);
      root.render(<App />);
      window.SortedReact.mounted = true;
      console.log('[sorted-react] mounted, core + flows ready on window.SortedReact');
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
