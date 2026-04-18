// Sorted React bundle entry.
//
// PR A5: mounts an empty React tree into #react-root-new-post
// if that element exists in the DOM. Exposes
// window.SortedReact.mounted so the browser console can confirm.

import { createRoot } from 'react-dom/client';
import App from './App.jsx';

if (typeof window !== 'undefined') {
  console.log('[sorted-react] bundle loaded, v0.2.0');

  const mountEl = document.getElementById('react-root-new-post');
  if (mountEl) {
    try {
      const root = createRoot(mountEl);
      root.render(<App />);
      console.log('[sorted-react] mounted into #react-root-new-post');
      if (typeof window.SortedReact !== 'object' || window.SortedReact === null) {
        window.SortedReact = {};
      }
      window.SortedReact.mounted = true;
      window.SortedReact.version = '0.2.0';
    } catch (err) {
      console.error('[sorted-react] mount failed:', err);
      if (typeof window.SortedReact !== 'object' || window.SortedReact === null) {
        window.SortedReact = {};
      }
      window.SortedReact.mounted = false;
      window.SortedReact.mountError = err && err.message;
    }
  } else {
    console.warn('[sorted-react] mount point #react-root-new-post not found — bundle loaded but nothing mounted');
    if (typeof window.SortedReact !== 'object' || window.SortedReact === null) {
      window.SortedReact = {};
    }
    window.SortedReact.mounted = false;
  }
}
