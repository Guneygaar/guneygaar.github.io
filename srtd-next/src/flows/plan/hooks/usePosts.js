// Sugar hook for subscribing to the filtered post list. Applies
// currentFilter.stage in memory; returns the filtered array.

import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore.js';

export function usePosts() {
  const posts = usePlanStore((s) => s.posts);
  const filter = usePlanStore((s) => s.currentFilter);
  return useMemo(() => {
    if (!filter || !filter.stage || filter.stage === 'all') return posts;
    return posts.filter((p) => p.stage === filter.stage);
  }, [posts, filter]);
}

export function useAllPosts() {
  return usePlanStore((s) => s.posts);
}
