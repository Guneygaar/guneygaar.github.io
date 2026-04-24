import { useMemo } from 'react';
import { usePosts } from './usePosts.js';

export function useCalendarPosts() {
  const posts = usePosts();
  return useMemo(() => posts.filter((p) => p.stage !== 'in_production'), [posts]);
}
