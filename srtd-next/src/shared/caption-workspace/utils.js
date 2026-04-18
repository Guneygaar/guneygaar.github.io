// Shared helpers for Caption Workspace — cost math, INR formatting,
// caption extraction, escape helper.

const PRICE_INPUT_PER_MTOK  = 3;
const PRICE_OUTPUT_PER_MTOK = 15;
const USD_TO_INR            = 83;

export function calcCostINR(inputTokens, outputTokens) {
  const usd = (Number(inputTokens)  || 0) * PRICE_INPUT_PER_MTOK  / 1e6
            + (Number(outputTokens) || 0) * PRICE_OUTPUT_PER_MTOK / 1e6;
  return usd * USD_TO_INR;
}

export function formatINR(v) {
  if (!v || v < 1) return '\u20B9' + (Number(v) || 0).toFixed(2);
  if (v < 1000)    return '\u20B9' + Math.round(v);
  return '\u20B9' + Math.round(v).toLocaleString('en-IN');
}

// Strip <caption>...</caption> wrapper (used by qc/review returns).
export function extractCaption(text) {
  if (!text || typeof text !== 'string') return '';
  const m = text.match(/<caption>([\s\S]*?)<\/caption>/);
  return m ? m[1].trim() : text.trim();
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

// memorize / remember / never-forget triggers — mirrors vanilla _CW_MEMORY_REGEX
export const MEMORY_REGEX =
  /^(memoris[ez]e|remember(?:\s+this)?|never\s+forget|always(?:\s+do)?|never(?:\s+do)?|from\s+now\s+on|henceforth|make\s+sure(?:\s+you)?|going\s+forward|(?:new\s+)?rule|note|important)\s*:\s*([\s\S]+)$/i;

// Parse Claude JSON responses that may have ```json fencing.
export function parseJsonLoose(raw) {
  if (!raw) return null;
  try {
    const clean = String(raw).replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    return null;
  }
}

// Split a 3-option write-mode response into individual captions.
// Expects "1. ...\n\n2. ...\n\n3. ..." format.
export function splitOptions(raw) {
  if (!raw) return [];
  const parts = String(raw).split(/\n\s*(?=[123]\.\s)/);
  return parts.map((p) => p.replace(/^\s*[123]\.\s*/, '').trim()).filter(Boolean);
}

// Strip markdown bold/italic/inline-code markers so assistant text
// renders cleanly in the thread. Does not touch newlines or headings.
export function stripMarkdown(s) {
  if (!s) return '';
  return String(s)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}
