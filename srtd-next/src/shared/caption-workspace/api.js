// Caption Workspace API — wraps the srtd-ai Worker /ai/complete
// endpoint + Supabase ai_memory / ai_usage tables (via vanilla
// window.apiFetch). Keeps the Worker-facing payload identical to
// the vanilla _callSrtdAI pattern so the existing defensive filter
// + system-prompt builder handle our calls correctly.
//
// Features are mapped from Workspace action → Worker FEATURE_FLAGS:
//   angles   → 'writer'   (caption-voice context is useful)
//   write    → 'writer'
//   refine   → 'writer'
//   rewrite  → 'writer'
//   review   → 'qc'       (designed for QC passes)
//
// The Worker's GBL brand guide + approved-posts context get
// prepended to whatever user prompt we send, which is what we want
// for angles/write/refine/rewrite. For review, the QC-feature
// context is the right brand lens.

import { getAIConfig } from '../../core/bridges/config.js';

function _featureForAction(action) {
  if (action === 'review') return 'qc';
  if (action === 'angles') return 'angles';
  if (action === 'rewrite') return 'chat';
  return 'writer';
}

/**
 * Call /ai/complete with a single user message.
 * Returns the raw Worker JSON response { success, content,
 * input_tokens, output_tokens, error? }.
 */
export async function callSrtdAI(action, userPrompt, opts = {}) {
  const cfg = getAIConfig();
  if (!cfg.workerUrl || !cfg.secret) {
    return { success: false, error: 'AI not configured' };
  }

  const body = {
    feature: _featureForAction(action),
    messages: [{ role: 'user', content: String(userPrompt || '') }],
    post_id: opts.postId || null,
    workspace_id: opts.workspaceId || 'default',
    created_by: opts.createdBy || ''
  };
  if (opts.memoryContext) body.memory_context = opts.memoryContext;

  try {
    const res = await fetch(cfg.workerUrl + '/ai/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Secret': cfg.secret
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return data;
  } catch (err) {
    return { success: false, error: (err && err.message) || 'network error' };
  }
}

/**
 * Fetch today + month AI-usage totals for the signed-in user so the
 * header meter can show Session / Today / Month. Fire-and-forget —
 * swallow errors, return zeros on failure.
 *
 * Today still comes from ai_usage (per-user scope). Month is seeded
 * from ai_usage for instant render, then overridden by the real
 * org-wide Anthropic cost figure in store.open() once /ai/month-cost
 * returns.
 */
export async function fetchTodayMonthCosts(createdBy) {
  const out = { todayCostINR: 0, monthCostINR: 0 };
  if (typeof window === 'undefined' || typeof window.apiFetch !== 'function') return out;
  if (!createdBy) return out;

  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const createdByEnc = encodeURIComponent(createdBy);

  async function _sum(since) {
    try {
      const rows = await window.apiFetch(
        `/ai_usage?created_by=eq.${createdByEnc}&created_at=gte.${encodeURIComponent(since)}&select=cost_usd`,
        {},
        { allowLogout: false }
      );
      if (!Array.isArray(rows)) return 0;
      return rows.reduce((a, r) => a + (Number(r.cost_usd) || 0), 0);
    } catch (e) {
      return 0;
    }
  }

  const [todayUsd, monthUsd] = await Promise.all([_sum(midnight), _sum(monthStart)]);
  // Worker reports USD; convert × 83 to INR (matches calcCostINR).
  out.todayCostINR = todayUsd * 83;
  out.monthCostINR = monthUsd * 83;
  return out;
}

/**
 * Fetch the real month-to-date Anthropic spend (org-wide) via the
 * srtd-ai Worker's /ai/month-cost endpoint. Returns INR on success,
 * null on any failure so the caller can fall back to the ai_usage
 * estimate.
 */
export async function fetchAnthropicMonthCost() {
  const cfg = getAIConfig();
  if (!cfg.workerUrl || !cfg.secret) return null;
  try {
    const res = await fetch(cfg.workerUrl + '/ai/month-cost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Secret': cfg.secret
      },
      body: '{}'
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || data.success === false) return null;
    const inr = Number(data.month_cost_inr);
    return Number.isFinite(inr) ? inr : null;
  } catch (e) {
    return null;
  }
}

/**
 * Load ai_memory rows for workspace 'default' and build the
 * memory_context block exactly as vanilla _cwLoadMemory does. Returns
 * { memoryPrompt, correctionsPrompt }.
 */
export async function loadMemory() {
  const empty = { memoryPrompt: '', correctionsPrompt: '' };
  if (typeof window === 'undefined' || typeof window.apiFetch !== 'function') return empty;
  try {
    const rows = await window.apiFetch(
      '/ai_memory?workspace_id=eq.default&order=created_at.desc&limit=50&select=type,content',
      {},
      { allowLogout: false }
    );
    if (!Array.isArray(rows) || rows.length === 0) return empty;

    const instructions = [];
    const zeroTolerance = [];
    const brandSummary = [];
    const clientPattern = [];
    const clientPatternAuto = [];
    const styleDna = [];
    const companyIdentity = [];
    const productKnowledge = [];
    const corrections = [];
    const _str = (c) => (typeof c === 'string' ? c : JSON.stringify(c));

    rows.forEach((r) => {
      try {
        const s = _str(r.content);
        if (r.type === 'user_instruction') instructions.push('- ' + s);
        else if (r.type === 'brand_guide_summary') {
          if (s.indexOf('ZERO TOLERANCE') !== -1) zeroTolerance.push(s);
          else brandSummary.push(s);
        } else if (r.type === 'client_pattern') clientPattern.push(s);
        else if (r.type === 'client_pattern_auto') clientPatternAuto.push(s);
        else if (r.type === 'style_dna') styleDna.push(s);
        else if (r.type === 'company_identity') companyIdentity.push(s);
        else if (r.type === 'product_knowledge') productKnowledge.push(s);
        else if (r.type === 'edit_correction') {
          const c = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
          if (c && c.original && c.edited) {
            const origP = c.original.length > 100 ? c.original.slice(0, 100) + '…' : c.original;
            const editP = c.edited.length > 100 ? c.edited.slice(0, 100) + '…' : c.edited;
            corrections.push(`- Changed: "${origP}" → "${editP}"`);
          }
        }
      } catch (_) {}
    });

    const blocks = [];
    if (instructions.length > 0)
      blocks.push(
        'USER INSTRUCTIONS — NEVER VIOLATE THESE. These are direct commands from the user.\n' +
        instructions.join('\n')
      );
    if (zeroTolerance.length > 0) blocks.push('ZERO TOLERANCE RULES:\n' + zeroTolerance.join('\n'));
    if (brandSummary.length > 0) blocks.push('BRAND GUIDE:\n' + brandSummary.join('\n'));
    if (clientPattern.length > 0)
      blocks.push('CLIENT FEEDBACK PATTERNS (never repeat these mistakes):\n' + clientPattern.join('\n'));
    if (clientPatternAuto.length > 0)
      blocks.push('CLIENT FEEDBACK PATTERNS (auto-detected):\n' + clientPatternAuto.join('\n'));
    if (styleDna.length > 0)
      blocks.push('WRITING STYLE FOR THIS BRAND:\n' + styleDna.join('\n'));
    if (companyIdentity.length > 0)
      blocks.push('COMPANY IDENTITY:\n' + companyIdentity.join('\n'));
    if (productKnowledge.length > 0)
      blocks.push('PRODUCT KNOWLEDGE:\n' + productKnowledge.join('\n'));
    if (corrections.length > 0)
      blocks.push(
        'STYLE PREFERENCES (learned from user edits):\n' + corrections.join('\n')
      );

    return {
      memoryPrompt: blocks.length > 0 ? blocks.join('\n\n') : '',
      correctionsPrompt: corrections.length > 0
        ? '\n\nSTYLE CORRECTIONS FROM THIS USER (apply to all future drafts):\n' +
          corrections.join('\n')
        : ''
    };
  } catch (e) {
    return empty;
  }
}

/** Fire-and-forget insert into ai_memory. */
export function saveUserInstruction(instruction, opts = {}) {
  if (typeof window === 'undefined' || typeof window.apiFetch !== 'function') return;
  window.apiFetch('/ai_memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      workspace_id: 'default',
      type: 'user_instruction',
      content: String(instruction || ''),
      post_id: opts.postId || null
    })
  }).catch(() => {});
}

/** Fire-and-forget edit_correction insert. */
export function saveCorrection(original, edited, opts = {}) {
  if (typeof window === 'undefined' || typeof window.apiFetch !== 'function') return;
  if (!original || !edited) return;
  // Only log meaningful diffs (≥5 character delta).
  if (Math.abs(original.length - edited.length) < 5 && original.trim() === edited.trim()) return;
  window.apiFetch('/ai_memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      workspace_id: 'default',
      type: 'edit_correction',
      content: { original, edited },
      post_id: opts.postId || null
    })
  }).catch(() => {});
}
