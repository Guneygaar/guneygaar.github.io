// React telemetry bridge. Pushes events into the shared
// window._clickBuffer array (set up in vanilla 10-ui.js:20-96),
// which flushes to /click_log every 30 s and on beforeunload. No
// separate network path — React and vanilla share the same sink.
//
// logError wraps the vanilla window.logError (00-appstate.js:73)
// which writes to the error_log table on Supabase. Safe no-op if
// the vanilla helper isn't available yet.

export function logClick(action, data = {}, success = true, opts = {}) {
  try {
    if (typeof window === 'undefined') return;
    if (!Array.isArray(window._clickBuffer)) window._clickBuffer = [];
    window._clickBuffer.push({
      action,
      data: data || null,
      post_id: opts.post_id || null,
      success: success !== false,
      error: opts.error || null,
      duration_ms: opts.duration_ms || null,
      created_at: new Date().toISOString()
    });
  } catch (e) { /* never block UI */ }
}

export function logError(err, context = {}) {
  try {
    if (typeof window === 'undefined') return;
    const message = (err && err.message) || String(err || 'unknown');
    const stack = (err && err.stack) || '';
    const action = context.action || 'react-unknown';
    if (typeof window.logError === 'function') {
      window.logError(message, stack, action);
    }
  } catch (e) { /* never block UI */ }
}
