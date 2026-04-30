// Sugar hook for subscribing to the filtered post list. Applies
// currentFilter.stage in memory; returns the filtered array.
//
// Role scoping (PR-C1) mirrors vanilla render/pipeline.js role gates:
//
// - 'client': strict ALLOWLIST that mirrors the vanilla server-side
//   filter at 07-post-load.js:307-308. Any change to that vanilla list
//   must be mirrored here in lockstep — defense in depth because
//   vanilla's allowlist is the only thing keeping internal stages off
//   the client wire.
//
// - 'creative': mirrors pipeline.js:885-897. brief / ready are gated
//   to own-only (post.owner === 'Creative'); in_production +
//   awaiting_approval + awaiting_brand_input stay visible regardless
//   of owner. All other stages (scheduled, published, rejected,
//   parked) are hidden for the creative role.
//
// - 'servicing': mirrors pipeline.js:899-915. Allowed stages are
//   brief / awaiting_approval / awaiting_brand_input / in_production /
//   ready / scheduled. brief is gated to own-only
//   (post.owner === 'Servicing'); other allowed stages stay visible
//   regardless of owner.
//
// - 'admin' / 'agency': no filter beyond the active stage chip.

import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore.js';

const CLIENT_ALLOWED_STAGES = [
  'awaiting_approval',
  'awaiting_brand_input',
  'published',
  'brief',
  'scheduled'
];

const CREATIVE_OWN_STAGES = new Set(['brief', 'ready']);
const CREATIVE_ALL_STAGES = new Set(['awaiting_approval', 'awaiting_brand_input', 'in_production']);

const SERVICING_ALLOWED_STAGES = new Set([
  'brief',
  'awaiting_approval',
  'awaiting_brand_input',
  'in_production',
  'ready',
  'scheduled'
]);

function applyRoleScope(posts, role) {
  if (role === 'client') {
    return posts.filter((p) => CLIENT_ALLOWED_STAGES.includes(p.stage));
  }
  if (role === 'creative') {
    return posts.filter((p) => {
      const stage = p.stage || '';
      const ownerLc = (p.owner || '').toLowerCase();
      if (CREATIVE_OWN_STAGES.has(stage)) return ownerLc === 'creative';
      if (CREATIVE_ALL_STAGES.has(stage)) return true;
      return false;
    });
  }
  if (role === 'servicing') {
    return posts.filter((p) => {
      const stage = p.stage || '';
      if (!SERVICING_ALLOWED_STAGES.has(stage)) return false;
      if (stage === 'brief') return (p.owner || '').toLowerCase() === 'servicing';
      return true;
    });
  }
  return posts;
}

export function usePosts() {
  const posts = usePlanStore((s) => s.posts);
  const filter = usePlanStore((s) => s.currentFilter);
  const role = usePlanStore((s) => s.role);
  return useMemo(() => {
    const base = applyRoleScope(posts, role);
    if (!filter || !filter.stage || filter.stage === 'all') return base;
    return base.filter((p) => p.stage === filter.stage);
  }, [posts, filter, role]);
}

export function useAllPosts() {
  return usePlanStore((s) => s.posts);
}
