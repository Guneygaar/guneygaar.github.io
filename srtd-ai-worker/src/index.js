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

// ─── Gmail import (PR 4) ─────────────────────────────────────
//
// Two routes that front the Gmail REST API on behalf of the
// srtd-ai worker. handleGmailList fetches recent messages from a
// fixed allowlist of client addresses. handleGmailBrief fetches a
// single message body, then asks Claude to extract a title + 3
// LinkedIn caption options + internal notes as strict JSON.
//
// Secrets provisioned separately via `wrangler secret put`:
//   GMAIL_CLIENT_ID
//   GMAIL_CLIENT_SECRET
//   GMAIL_REFRESH_TOKEN
// OAuth flow: refresh_token grant against oauth2.googleapis.com,
// then Bearer token against gmail.googleapis.com/gmail/v1.

async function getGmailAccessToken(env) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token || null;
}

async function handleGmailList(request, env) {
  try {
    if (request.headers.get('X-AI-Secret') !== env.AI_SECRET) {
      return errorResponse('Unauthorized', 401);
    }

    const accessToken = await getGmailAccessToken(env);
    if (!accessToken) {
      return errorResponse('Failed to get Gmail access token', 500);
    }

    // Allowlist: only pull from known client addresses. Hardcoded
    // so a compromised client cannot ask the worker to read arbitrary
    // senders. Window: last 7 days, cap 10 results.
    const query = 'from:thakur.manisha@somaiya.com OR from:shivangini.j@somaiya.com newer_than:7d';
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=' + encodeURIComponent(query),
      { headers: { 'Authorization': 'Bearer ' + accessToken } }
    );
    const listData = await listRes.json();
    const messages = listData.messages || [];

    if (messages.length === 0) {
      return jsonResponse({ success: true, emails: [] });
    }

    // Hydrate each message with subject + snippet + sender + date.
    const emails = await Promise.all(messages.map(async function(msg) {
      try {
        const msgRes = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msg.id +
            '?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date',
          { headers: { 'Authorization': 'Bearer ' + accessToken } }
        );
        const msgData = await msgRes.json();
        const headers = (msgData.payload && msgData.payload.headers) || [];
        const getHeader = function(name) {
          const h = headers.find(function(h) { return h.name === name; });
          return h ? h.value : '';
        };
        const fromRaw = getHeader('From');
        const senderName = fromRaw.indexOf('Manisha') !== -1 ? 'Manisha' :
                           fromRaw.indexOf('Shivangini') !== -1 ? 'Shivangini' :
                           (fromRaw.split('<')[0].trim() || fromRaw);
        return {
          id: msg.id,
          subject: getHeader('Subject') || '(no subject)',
          snippet: (msgData.snippet || '')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .slice(0, 120),
          sender: senderName,
          date: getHeader('Date')
        };
      } catch (e) {
        return null;
      }
    }));

    return jsonResponse({
      success: true,
      emails: emails.filter(Boolean)
    });
  } catch (err) {
    return errorResponse((err && err.message) || 'unknown error', 500);
  }
}

async function handleGmailBrief(request, env) {
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

    const messageId   = body && body.message_id;
    const workspaceId = (body && body.workspace_id) || 'default';
    const createdBy   = (body && body.created_by) || '';

    if (!messageId) return errorResponse('message_id required', 400);

    // Workspace-level feature gate. Uses the 'email_brief' key in
    // FEATURE_FLAGS → 'ai_email_briefs' in workspace_settings.
    const gate = await checkWorkspaceEnabled(workspaceId, 'email_brief');
    if (!gate.ok) return jsonResponse({ success: false, error: gate.reason }, 403);

    const accessToken = await getGmailAccessToken(env);
    if (!accessToken) return errorResponse('Failed to get Gmail access token', 500);

    // Pull the full message so we can walk the MIME tree and lift
    // out the text/plain part.
    const msgRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + messageId + '?format=full',
      { headers: { 'Authorization': 'Bearer ' + accessToken } }
    );
    const msgData = await msgRes.json();

    function extractBody(payload) {
      if (!payload) return '';
      if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
        try {
          return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } catch (e) {
          return '';
        }
      }
      if (payload.parts) {
        for (var i = 0; i < payload.parts.length; i++) {
          var result = extractBody(payload.parts[i]);
          if (result) return result;
        }
      }
      return '';
    }

    // 3000-char cap — keeps the prompt inside a sane token budget
    // even on a forwarded-thread-of-doom email.
    const emailBody = extractBody(msgData.payload).slice(0, 3000);
    const headers = (msgData.payload && msgData.payload.headers) || [];
    const subject = (headers.find(function(h) { return h.name === 'Subject'; }) || {}).value || '';

    // Load GBL brand context — shared with the writer / qc flows.
    const brandGuide      = await loadBrandGuide(env);
    const approvedContext = await loadApprovedContext();

    // System prompt pins Claude to a strict JSON schema so the
    // frontend can JSON.parse() the result without a regex dance.
    const systemPrompt =
      'You are a LinkedIn content writer for Godavari Biorefineries Limited (GBL). ' +
      'Read the email below and extract the content brief. ' +
      'Return a JSON object only — no preamble, no markdown, no backticks — with these exact keys: ' +
      'title (string, 5-8 words, the post title), ' +
      'copy_option_1 (string, full LinkedIn caption option 1), ' +
      'copy_option_2 (string, full LinkedIn caption option 2), ' +
      'copy_option_3 (string, full LinkedIn caption option 3), ' +
      'internal_notes (string, 1-2 lines: source of brief + key instructions from client). ' +
      'Write 3 distinct caption options in GBL voice. Each should be complete and post-ready. ' +
      'Here are approved posts for reference:\n\n' + approvedContext +
      '\n\nBrand guide:\n' + brandGuide;

    const messages = [{
      role: 'user',
      content: 'Email subject: ' + subject + '\n\nEmail body:\n' + emailBody
    }];

    const anthropicRes = await callAnthropic(env, systemPrompt, messages);
    const rawText = (anthropicRes.content && anthropicRes.content[0] && anthropicRes.content[0].text) || '';

    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      return errorResponse('Claude did not return valid JSON: ' + rawText.slice(0, 200), 500);
    }

    // Fire-and-forget usage telemetry — never blocks the response.
    const usage = anthropicRes.usage || {};
    const inputTokens  = Number(usage.input_tokens)  || 0;
    const outputTokens = Number(usage.output_tokens) || 0;
    logUsage({
      workspace_id:  workspaceId,
      post_id:       null,
      feature:       'email_brief',
      tokens_input:  inputTokens,
      tokens_output: outputTokens,
      cost_usd:      calcCostUsd(inputTokens, outputTokens),
      created_by:    createdBy
    });

    return jsonResponse({
      success:        true,
      title:          parsed.title          || subject,
      copy_option_1:  parsed.copy_option_1  || '',
      copy_option_2:  parsed.copy_option_2  || '',
      copy_option_3:  parsed.copy_option_3  || '',
      internal_notes: parsed.internal_notes || ''
    });
  } catch (err) {
    return errorResponse((err && err.message) || 'unknown error', 500);
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
    if (request.method === 'POST' && url.pathname === '/gmail/list') {
      return handleGmailList(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/gmail/brief') {
      return handleGmailBrief(request, env);
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  }
};
