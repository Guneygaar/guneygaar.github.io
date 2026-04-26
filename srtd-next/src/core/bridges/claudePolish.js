// Mirrors /10-ui.js:226-286 _claudePolish exactly.
// Feature: 'chat'. Prompt prepended to user content for Anthropic 400 compat.

import { getAIConfig } from './config.js';

const POLISH_PROMPT = "You are polishing a short comment that one colleague is writing to another in an agency/client collaboration tool. Make it clearer, warmer, and more professional while preserving the user's meaning and tone. Keep it concise - typically no longer than the original. No greetings unless the user wrote one. No sign-offs. Return ONLY the polished text, no preamble, no commentary, no quotes around it.";

export async function polishText(text, postId) {
  if (!text || !text.trim()) throw new Error('polishText: text required');
  const cfg = getAIConfig();
  if (!cfg || !cfg.workerUrl || !cfg.secret) throw new Error('polishText: AI config missing');

  const userContent = POLISH_PROMPT + '\n\n---\n\nText to polish:\n' + text;
  const email = (typeof window !== 'undefined' && window.AppState?.user?.email) || '';

  const res = await fetch(cfg.workerUrl.replace(/\/$/, '') + '/ai/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-AI-Secret': cfg.secret },
    body: JSON.stringify({
      feature: 'chat',
      messages: [{ role: 'user', content: userContent }],
      post_id: postId || null,
      workspace_id: (typeof window !== 'undefined' && window.AppState?.workspace?.id) || null,
      created_by: email
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) throw new Error(data?.error || `polishText: ${res.status}`);
  return { content: String(data.content || '').trim(), inputTokens: data.input_tokens || 0, outputTokens: data.output_tokens || 0 };
}
