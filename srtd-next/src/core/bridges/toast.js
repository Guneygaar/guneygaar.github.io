// React-side toast entry point. Every srtd-next component calls
// toast(msg, type, opts?) from this bridge. Under the hood it
// drives useToastStore, which is rendered by <Toast/> mounted in
// App.jsx. Vanilla window.showToast is kept as a last-resort
// fallback for calls fired before the store has initialised.
//
// Shape: toast(msg, type, opts)
//   msg:  string
//   type: 'success' | 'error' | 'warning'  (default: 'success')
//   opts: {
//     cost?: number,                                 // success-variant session cost pill
//     action?: { label: string, onClick: () => void }, // UNDO / RETRY button
//     duration?: number                              // override auto-dismiss ms
//   }

import { useToastStore } from '../stores/toastStore.js';

export function toast(msg, type, opts) {
  try {
    useToastStore.getState().show(msg, type, opts);
  } catch (e) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(msg, type);
    }
  }
}
