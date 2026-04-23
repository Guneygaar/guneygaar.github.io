// Look up latest comment (reason) for rejected / parked posts by
// post.post_id (text slug).

import { usePlanStore } from '../store/planStore.js';

export function useReasonFor(post) {
  const reasons = usePlanStore((s) => s.reasons);
  if (!post || !post.post_id) return null;
  return reasons[post.post_id] || null;
}
