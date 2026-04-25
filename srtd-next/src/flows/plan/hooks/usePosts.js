// Sugar hook for subscribing to the filtered post list. Applies
// currentFilter.stage in memory; returns the filtered array.
// Client role uses a strict ALLOWLIST that mirrors the vanilla
// server-side filter at 07-post-load.js:307-308. Any change to that
// vanilla list must be mirrored here in lockstep — defense in depth
// because vanilla's allowlist is the only thing keeping internal
// stages off the client wire.

import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore.js';

const CLIENT_ALLOWED_STAGES = [
  'awaiting_approval',
  'awaiting_brand_input',
  'published',
  'brief',
  'scheduled',
  'in_production'
];

export function usePosts() {
  const posts = usePlanStore((s) => s.posts);
  const filter = usePlanStore((s) => s.currentFilter);
  const role = usePlanStore((s) => s.role);
  return useMemo(() => {
    const isClient = role === 'client';
    const base = isClient
      ? posts.filter((p) => CLIENT_ALLOWED_STAGES.includes(p.stage))
      : posts;
    if (!filter || !filter.stage || filter.stage === 'all') return base;
    return base.filter((p) => p.stage === filter.stage);
  }, [posts, filter, role]);
}

export function useAllPosts() {
  return usePlanStore((s) => s.posts);
}
