import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import * as core from './core/index.js';

// Sorted React bundle entry (PR A6).
//
// - Exposes the full core runtime under window.SortedReact.*
// - Mounts an empty React tree into #react-root-new-post
// - Console confirms mount + core surface

if (typeof window !== 'undefined') {
  console.log('[sorted-react] bundle loaded, v0.3.0');

  // Expose core namespace BEFORE mount so other scripts that
  // run on DOMContentLoaded can find it.
  if (typeof window.SortedReact !== 'object' || window.SortedReact === null) {
    window.SortedReact = {};
  }
  window.SortedReact.version   = '0.3.0';
  window.SortedReact.tokens    = core.tokens;
  window.SortedReact.mappings  = core.mappings;
  window.SortedReact.stores    = core.stores;
  window.SortedReact.bridges   = core.bridges;
  window.SortedReact.api       = core.api;
  window.SortedReact.ui        = core.ui;

  const mountEl = document.getElementById('react-root-new-post');
  if (mountEl) {
    try {
      const root = createRoot(mountEl);
      root.render(<App />);
      window.SortedReact.mounted = true;
      console.log('[sorted-react] mounted, core surface ready on window.SortedReact');
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
