// Wraps window.apiFetch from 05-api.js:20. Keeps the same
// signature and 401/refresh behavior. Throws on non-ok responses
// with a readable message.

export async function apiFetch(path, options = {}, meta) {
  if (typeof window === 'undefined' || typeof window.apiFetch !== 'function') {
    throw new Error('[sorted-react/api] window.apiFetch not available');
  }
  return window.apiFetch(path, options, meta);
}
