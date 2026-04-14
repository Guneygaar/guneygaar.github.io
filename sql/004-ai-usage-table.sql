-- ═══════════════════════════════════════════════════════════════
-- PR 1 — Sorted AI Foundation
-- Migration 004: create ai_usage table
-- ═══════════════════════════════════════════════════════════════
--
-- PURPOSE:
--   Per-call telemetry sink for every Anthropic API invocation
--   made by the srtd-ai Worker. Fed fire-and-forget from the
--   Worker's POST /ai/complete path AND from the lightweight
--   POST /ai/log path (used when the client needs to log usage
--   without a completion).
--
--   Cost accounting uses Claude Sonnet 4 pricing:
--     input  $3  per 1M tokens
--     output $15 per 1M tokens
--   cost_usd = ((input * 3) + (output * 15)) / 1000000
--
-- SCHEMA NOTES:
--   - feature: 'writer' | 'qc' | 'chat' | 'email_brief'
--   - post_id: NO foreign key to posts.post_id on purpose —
--              email-brief flows create the post AFTER the AI
--              call, so post_id may be null at log time. A hard
--              FK would reject those rows.
--   - workspace_id: text (not uuid) to match the already-created
--                   workspace_settings.workspace_id column. The
--                   single-tenant install uses 'default'.
--
-- RUN ORDER:
--   Run AFTER sql/003-posts-ai-columns.sql.
--
-- RLS:
--   Not enabled. Consistent with error_log / notifications /
--   activity_log in the existing schema. The Worker uses the
--   service-role key to INSERT; the frontend never reads this
--   table directly.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE ai_usage (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  text DEFAULT 'default',
  post_id       text,
  feature       text,
  tokens_input  integer,
  tokens_output integer,
  cost_usd      numeric(10,6),
  created_by    text,
  created_at    timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- VERIFICATION (run after applying):
--
--   SELECT column_name, data_type
--   FROM   information_schema.columns
--   WHERE  table_name = 'ai_usage'
--   ORDER  BY ordinal_position;
--
--   -- Insert a probe row to confirm writes work:
--   INSERT INTO ai_usage (feature, tokens_input, tokens_output, cost_usd, created_by)
--   VALUES ('writer', 100, 200, 0.003300, 'test@example.com');
--
--   SELECT * FROM ai_usage ORDER BY created_at DESC LIMIT 1;
--   -- Clean up:
--   DELETE FROM ai_usage WHERE created_by = 'test@example.com';
-- ─────────────────────────────────────────────────────────────
