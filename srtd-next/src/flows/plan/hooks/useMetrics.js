// Look up metrics row for a given post by post.id (uuid).

import { usePlanStore } from '../store/planStore.js';

export function useMetrics() {
  return usePlanStore((s) => s.metrics);
}

export function useMetricsFor(post) {
  const metrics = usePlanStore((s) => s.metrics);
  if (!post || !post.id) return null;
  return metrics[post.id] || null;
}
