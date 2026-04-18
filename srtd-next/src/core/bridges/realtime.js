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
  try {
    const ch = client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, (payload) => {
        try { onChange(payload); } catch (e) { console.error('[sorted-react/realtime] onChange threw', e); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_notes', filter: `post_id=eq.${postId}` }, (payload) => {
        try { onChange(payload); } catch (e) { console.error('[sorted-react/realtime] onChange threw', e); }
      })
      .subscribe();
    return () => {
      try { client.removeChannel(ch); } catch (e) { /* swallow */ }
    };
  } catch (err) {
    console.error('[sorted-react/realtime] subscribe failed', err);
    return () => {};
  }
}
