// Sugar hook for subscribing to the requests list. Buckets rows into
// `assigned` (status !== 'closed') and `closed` (status === 'closed').
// Vanilla pattern at 07-post-load.js fetches `/requests` unscoped and
// lets RLS handle tenant isolation; we mirror that here. Callers
// (BriefsSection) are responsible for gating on isClient.

import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore.js';

export function useRequests() {
  const requests = usePlanStore((s) => s.requests);
  const loading = usePlanStore((s) => s.requestsLoading);
  const error = usePlanStore((s) => s.requestsError);
  return useMemo(() => {
    const rows = Array.isArray(requests) ? requests : [];
    const assigned = [];
    const closed = [];
    for (const r of rows) {
      if (r && r.status === 'closed') closed.push(r);
      else assigned.push(r);
    }
    return { all: rows, assigned, closed, loading, error };
  }, [requests, loading, error]);
}
