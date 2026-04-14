// ═══════════════════════════════════════════════════════════════
// srtd-ai Worker
//
// Single entry point for every AI feature in Sorted. Fronts the
// Anthropic API, loads brand context from R2 + Supabase, gates on
// workspace_settings.ai_* flags, and logs every call to ai_usage.
//
// Routes:
//   OPTIONS *          → CORS preflight (204)
//   POST    /ai/complete → main AI completion endpoint
//   POST    /ai/log      → lightweight standalone usage logger
//   *                  → 404
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://vxokfscjzytpgdrmertk.supabase.co';
// Service-role key — required for workspace_settings reads + ai_usage
// writes with the current (loose) table permissions. Consistent with
// the hardcoded-Supabase-creds pattern used by sorted-preview-worker.
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4b2tmc2Nqenl0cGdkcm1lcnRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzA2NjkxNCwiZXhwIjoyMDU4NjQyOTE0fQ.mhMGDExFm3pVFmB24gzBGwIuXHHBB2B88FVqnmM5JQkw';

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_MAX_TOKENS = 1500;

// Sonnet 4 pricing (per 1M tokens): input $3, output $15.
const PRICE_INPUT_PER_MTOK = 3;
const PRICE_OUTPUT_PER_MTOK = 15;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-AI-Secret'
};

const FEATURE_FLAGS = {
  writer:      'ai_writer',
  qc:          'ai_qc',
  chat:        'ai_chat',
  email_brief: 'ai_email_briefs'
};

// ─── helpers ─────────────────────────────────────────────────

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

function errorResponse(message, status) {
  return jsonResponse({ success: false, error: message }, status || 500);
}

async function supabaseGet(path) {
  const res = await fetch(SUPABASE_URL + '/rest/v1' + path, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error('supabase GET ' + res.status + ' ' + path);
  }
  return res.json();
}

async function supabasePost(path, body) {
  return fetch(SUPABASE_URL + '/rest/v1' + path, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  });
}

function calcCostUsd(inputTokens, outputTokens) {
  const n = (Number(inputTokens) || 0) * PRICE_INPUT_PER_MTOK
          + (Number(outputTokens) || 0) * PRICE_OUTPUT_PER_MTOK;
  return n / 1000000;
}

// ─── workspace-settings gate ─────────────────────────────────

async function checkWorkspaceEnabled(workspaceId, feature) {
  const rows = await supabaseGet(
    '/workspace_settings?workspace_id=eq.' + encodeURIComponent(workspaceId)
    + '&select=ai_enabled,ai_writer,ai_qc,ai_chat,ai_email_briefs&limit=1'
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, reason: 'AI not enabled for this workspace' };
  }
  const row = rows[0];
  if (row.ai_enabled !== true) {
    return { ok: false, reason: 'AI not enabled for this workspace' };
  }
  const flagKey = FEATURE_FLAGS[feature];
  if (!flagKey) {
    return { ok: false, reason: 'Unknown feature' };
  }
  if (row[flagKey] !== true) {
    return { ok: false, reason: 'Feature not enabled for this workspace' };
  }
  return { ok: true };
}

// ─── system-prompt builder ───────────────────────────────────

async function loadBrandGuide(env) {
  try {
    const obj = await env.AI_ASSETS.get('brand-guide.txt');
    if (!obj) return '';
    return await obj.text();
  } catch (e) {
    return '';
  }
}

async function loadApprovedContext() {
  try {
    const rows = await supabaseGet(
      '/posts?stage=eq.approved&select=title,caption,content_pillar,format'
      + '&order=updated_at.desc&limit=20'
    );
    if (!Array.isArray(rows) || rows.length === 0) return '';
    return rows.map(function(p) {
      return 'Title: ' + (p.title || '') + '\nCaption: ' + (p.caption || '');
    }).join('\n---\n');
  } catch (e) {
    return '';
  }
}

function buildSystemPrompt(feature, approvedContext, brandGuide) {
  const ctx = approvedContext || '';
  const bg  = brandGuide || '';
  if (feature === 'writer') {
    return 'You are a LinkedIn content writer for Godavari Biorefineries Limited (GBL), a sugarcane biorefinery. '
      + 'Write in their established voice. Here are 20 approved posts for reference:\n\n'
      + ctx
      + '\n\nBrand guide:\n'
      + bg
      + '\n\nReturn exactly 3 numbered copy options. Each option on its own. No preamble.';
  }
  if (feature === 'qc') {
    return 'You are a brand quality controller for GBL. Check the provided copy against the brand voice and approved posts. '
      + 'Here are 20 approved posts:\n\n'
      + ctx
      + '\n\nBrand guide:\n'
      + bg
      + '\n\nReturn a structured verdict: PASS or FLAG for each item checked. Be specific. Be brief.';
  }
  if (feature === 'chat') {
    return 'You are a copy editor helping refine LinkedIn content for GBL. Here are 20 approved posts for reference:\n\n'
      + ctx
      + '\n\nBrand guide:\n'
      + bg
      + '\n\nHelp the user improve the copy. Be direct and brief.';
  }
  if (feature === 'email_brief') {
    return 'You are a content strategist. Read the email below and identify every distinct post brief it contains. '
      + 'Return a JSON array only — no preamble, no markdown, no backticks. '
      + 'Each object must have: title (string), brief (string), content_pillar (string), '
      + 'format (string, one of: Photo/Carousel/Video/Creative), '
      + 'copy_options (array of exactly 3 strings), visual_direction (string). '
      + 'If brief count is unclear, return 1 object and set title to include [REVIEW: may contain multiple briefs].';
  }
  return '';
}

// ─── Anthropic call ──────────────────────────────────────────

async function callAnthropic(env, systemPrompt, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: systemPrompt,
      messages: messages
    })
  });
  if (!res.ok) {
    const txt = await res.text().catch(function() { return ''; });
    // Never echo the API key: only the status + sanitised body.
    throw new Error('anthropic ' + res.status + ': ' + txt.slice(0, 500));
  }
  return res.json();
}

// ─── fire-and-forget usage logger ────────────────────────────

function logUsage(payload) {
  supabasePost('/ai_usage', payload).catch(function(err) {
    console.error('[srtd-ai] ai_usage log failed:', err && err.message);
  });
}

// ─── route handlers ──────────────────────────────────────────

async function handleComplete(request, env) {
  try {
    if (request.headers.get('X-AI-Secret') !== env.AI_SECRET) {
      return errorResponse('Unauthorized', 401);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return errorResponse('Invalid JSON', 400);
    }

    const feature     = body && body.feature;
    const messages    = body && body.messages;
    const postId      = (body && body.post_id) || null;
    const workspaceId = (body && body.workspace_id) || 'default';
    const createdBy   = (body && body.created_by) || '';

    if (!feature || !FEATURE_FLAGS[feature]) {
      return errorResponse('Invalid or missing feature', 400);
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse('Invalid or missing messages', 400);
    }

    const gate = await checkWorkspaceEnabled(workspaceId, feature);
    if (!gate.ok) {
      return jsonResponse({ success: false, error: gate.reason }, 403);
    }

    const brandGuide      = await loadBrandGuide(env);
    const approvedContext = await loadApprovedContext();
    const systemPrompt    = buildSystemPrompt(feature, approvedContext, brandGuide);

    const anthropicRes = await callAnthropic(env, systemPrompt, messages);

    const contentBlocks = anthropicRes && anthropicRes.content;
    const responseText  = (Array.isArray(contentBlocks) && contentBlocks[0] && contentBlocks[0].text)
      ? contentBlocks[0].text
      : '';
    const usage         = (anthropicRes && anthropicRes.usage) || {};
    const inputTokens   = Number(usage.input_tokens)  || 0;
    const outputTokens  = Number(usage.output_tokens) || 0;

    // Fire-and-forget: never block the response on the log write.
    logUsage({
      workspace_id:  workspaceId,
      post_id:       postId,
      feature:       feature,
      tokens_input:  inputTokens,
      tokens_output: outputTokens,
      cost_usd:      calcCostUsd(inputTokens, outputTokens),
      created_by:    createdBy
    });

    return jsonResponse({
      success: true,
      content: responseText,
      usage: { input: inputTokens, output: outputTokens }
    });
  } catch (err) {
    const msg = (err && err.message) || 'unknown error';
    return errorResponse(msg, 500);
  }
}

async function handleLog(request, env) {
  try {
    if (request.headers.get('X-AI-Secret') !== env.AI_SECRET) {
      return errorResponse('Unauthorized', 401);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return errorResponse('Invalid JSON', 400);
    }

    const payload = {
      workspace_id:  (body && body.workspace_id) || 'default',
      post_id:       (body && body.post_id) || null,
      feature:       body && body.feature,
      tokens_input:  Number(body && body.tokens_input)  || 0,
      tokens_output: Number(body && body.tokens_output) || 0,
      cost_usd:      Number(body && body.cost_usd)      || 0,
      created_by:    (body && body.created_by) || ''
    };

    const res = await supabasePost('/ai_usage', payload);
    if (!res.ok) {
      const txt = await res.text().catch(function() { return ''; });
      return errorResponse('ai_usage insert ' + res.status + ': ' + txt.slice(0, 300), 500);
    }
    return jsonResponse({ success: true });
  } catch (err) {
    const msg = (err && err.message) || 'unknown error';
    return errorResponse(msg, 500);
  }
}

// ─── entry point ─────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'POST' && url.pathname === '/ai/complete') {
      return handleComplete(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/ai/log') {
      return handleLog(request, env);
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  }
};
