// Sugar hook for subscribing to the filtered post list. Applies
// currentFilter.stage in memory; returns the filtered array.
// Client role uses a stage DENYLIST so future stages default to visible
// unless explicitly listed as internal-only.

import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore.js';

const CLIENT_STAGE_DENYLIST = ['in_production', 'ready'];

export function usePosts() {
  const posts = usePlanStore((s) => s.posts);
  const filter = usePlanStore((s) => s.currentFilter);
  const role = usePlanStore((s) => s.role);
  return useMemo(() => {
    const isClient = role === 'client';
    const base = isClient
      ? posts.filter((p) => !CLIENT_STAGE_DENYLIST.includes(p.stage))
      : posts;
    if (!filter || !filter.stage || filter.stage === 'all') return base;
    return base.filter((p) => p.stage === filter.stage);
  }, [posts, filter, role]);
}

export function useAllPosts() {
  return usePlanStore((s) => s.posts);
}
