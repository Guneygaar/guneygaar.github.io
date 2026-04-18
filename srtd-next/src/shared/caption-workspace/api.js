// Thin wrapper around the srtd-ai Cloudflare Worker /ai/complete
// endpoint. Mirrors actions/pcs.js _callSrtdAI so the Worker API
// shape stays identical across vanilla + React callers.

import { getAIConfig } from '../../core/bridges/config.js';

export async function callSrtdAI(feature, messages, postId) {
  const cfg = getAIConfig();
  if (!cfg.workerUrl) {
    return { success: false, error: 'AI not configured' };
  }
  const userEmail = (typeof window !== 'undefined'
    && window.AppState && window.AppState.user && window.AppState.user.email) || '';
  const payload = {
    feature,
    messages,
    post_id: postId || null,
    workspace_id: 'default',
    created_by: userEmail
  };
  try {
    const res = await fetch(cfg.workerUrl + '/ai/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Secret': cfg.secret
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data;
  } catch (e) {
    return { success: false, error: e && e.message };
  }
}

const USD_TO_INR = 100;

export function calcCostINR(inputTokens, outputTokens) {
  const usd = (inputTokens * 3 / 1_000_000) + (outputTokens * 15 / 1_000_000);
  return usd * USD_TO_INR;
}

export function formatINR(v) {
  if (!v || v < 0) return '\u20B90';
  if (v < 1) return '\u20B9' + v.toFixed(2);
  if (v < 1000) return '\u20B9' + Math.round(v);
  return '\u20B9' + Math.round(v).toLocaleString('en-IN');
}
