// Reads window.AI_CONFIG (set by ai-config.js). Returns a safe
// snapshot so React code can't mutate the original object.

export function getAIConfig() {
  if (typeof window === 'undefined' || !window.AI_CONFIG) {
    return { workerUrl: null, secret: null, model: null };
  }
  return {
    workerUrl: window.AI_CONFIG.workerUrl || null,
    secret: window.AI_CONFIG.secret || null,
    model: window.AI_CONFIG.model || null
  };
}
