// Bridge to window.showToast defined in 10-ui.js:167.
// Accepts the same two-arg signature: toast(msg, type?)
// where type is 'success' | 'error' | 'warning' | undefined.

export function toast(msg, type) {
  if (typeof window === 'undefined') return;
  if (typeof window.showToast === 'function') {
    window.showToast(msg, type);
  } else {
    console.warn('[sorted-react/toast] window.showToast not yet defined:', msg);
  }
}
