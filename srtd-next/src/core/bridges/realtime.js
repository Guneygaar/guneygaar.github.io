// Reuses vanilla's shared window._supabaseClient. The Supabase SDK is
// loaded once by the vanilla shell via its CDN script tag and is never
// imported or instantiated inside the React bundle. Falls back to a
// no-op when the vanilla client is not yet hydrated.

export function subscribePostComments(postId, onChange) {
  if (!postId || typeof onChange !== 'function') return () => {};
  if (typeof window === 'undefined') return () => {};
  const client = window._supabaseClient;
  if (!client || typeof client.channel !== 'function') {
    console.warn('[sorted-react/realtime] _supabaseClient not available, realtime disabled');
    return () => {};
  }
  const channelName = `srtd-react-pcs-${postId}`;
  let ch = null;
  let recovering = false;
  try {
    ch = client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, (payload) => {
        try { onChange(payload); } catch (e) { console.error('[sorted-react/realtime] onChange threw', e); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_notes', filter: `post_id=eq.${postId}` }, (payload) => {
        try { onChange(payload); } catch (e) { console.error('[sorted-react/realtime] onChange threw', e); }
      })
      .subscribe(async (status, err) => {
        if (recovering) return;
        if (status === 'CHANNEL_ERROR' && err && /Token has expired|InvalidJWTToken/i.test((err && err.message) || '')) {
          recovering = true;
          try {
            if (typeof window.refreshSession === 'function') await window.refreshSession();
            const newToken = localStorage.getItem('sb_access_token');
            if (newToken && window._supabaseClient?.realtime?.setAuth) {
              window._supabaseClient.realtime.setAuth(newToken);
            }
            try { client.removeChannel(ch); } catch (e) { /* swallow */ }
            // Re-invoke this same starter; the new channel replaces the old.
            const restart = subscribePostComments(postId, onChange);
            // Swap the unsubscribe handle so the caller's cleanup hits the new channel.
            ch = { _restartUnsub: restart };
          } catch (e) {
            console.error('[sorted-react/realtime] recover failed', e);
            window.logError && window.logError('realtime-recover-pcs', e && e.stack, 'realtime-recover-pcs');
          }
        }
      });
    return () => {
      try {
        if (ch && ch._restartUnsub) { ch._restartUnsub(); }
        else { client.removeChannel(ch); }
      } catch (e) { /* swallow */ }
    };
  } catch (err) {
    console.error('[sorted-react/realtime] subscribe failed', err);
    return () => {};
  }
}
