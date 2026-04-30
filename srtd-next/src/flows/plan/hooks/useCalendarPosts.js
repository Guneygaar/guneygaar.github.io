import { useMemo } from 'react';
import { usePosts } from './usePosts.js';
import { usePlanStore } from '../store/planStore.js';

export function useCalendarPosts() {
  const posts = usePosts();
  const role = usePlanStore((s) => s.role);
  return useMemo(
    () => (role === 'client'
      ? posts.filter((p) => p.stage !== 'in_production')
      : posts),
    [posts, role]
  );
}
