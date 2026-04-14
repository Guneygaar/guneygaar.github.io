/* ===============================================
   ai-config.js — single source of truth for the
   srtd-ai Worker URL + shared secret on the
   frontend. Every future AI feature reads from
   window.AI_CONFIG. Never hardcode the Worker
   URL anywhere else.
=============================================== */
console.log("LOADED:", "ai-config.js");

window.AI_CONFIG = {
  workerUrl: 'https://srtd-ai.ksg-kumarshubhamgune.workers.dev',
  secret:    'srtd-ai-2026xK9mN3pQ',
  model:     'claude-sonnet-4-20250514'
};
