-- ═══════════════════════════════════════════════════════════════
-- FIX — ai_learn_from_comment() must run SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════════
--
-- PROBLEM:
--   The trigger function ai_learn_from_comment() fires on
--   post_comments INSERT and writes auto-captured feedback
--   patterns into ai_memory. It was created with SECURITY
--   INVOKER (Postgres default), so the INSERT into ai_memory
--   runs under the caller's JWT. ai_memory has RLS enabled
--   with zero policies (the table is trigger-only by design).
--   Result: every comment INSERT by the Client role returns
--   403 "new row violates row-level security policy for table
--   'ai_memory'" and the comment INSERT rolls back.
--
-- SOLUTION:
--   ALTER the function to SECURITY DEFINER so it runs with
--   the function owner's privileges and bypasses RLS on
--   ai_memory. Pin search_path to a known-safe value
--   (public, pg_temp) — this is the standard security
--   hardening for SECURITY DEFINER functions so a malicious
--   caller cannot shadow built-in names with objects in their
--   own schema.
--
-- SAFETY:
--   - No schema change (no ALTER TABLE, no CREATE POLICY).
--   - Trigger body is unchanged.
--   - ALTER FUNCTION is atomic and idempotent when re-run.
--   - Does NOT touch on_comment_insert (notify-comment edge
--     function trigger) — that one uses the service-role key
--     via pg_net and is unaffected.
--   - Does NOT add or remove RLS policies on ai_memory —
--     ai_memory remains trigger-only by design.
--
-- PRE-REQUISITE:
--   The function public.ai_learn_from_comment() must already
--   exist (created by whoever wired the ai_memory learning
--   feature). This migration only flips the security mode.
-- ═══════════════════════════════════════════════════════════════

ALTER FUNCTION public.ai_learn_from_comment()
  SECURITY DEFINER
  SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.ai_learn_from_comment() IS
  'Trigger fn on post_comments INSERT. Writes to ai_memory with '
  'auto-captured client feedback patterns. Runs as SECURITY '
  'DEFINER because ai_memory has RLS enabled with no policies - '
  'this is intentional (only the trigger should write). DO NOT '
  'modify this function to accept dynamic SQL or untrusted '
  'table/column names - SECURITY DEFINER makes such changes a '
  'privilege escalation vulnerability.';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION (run after applying):
--
--   SELECT proname, prosecdef
--   FROM   pg_proc
--   WHERE  proname = 'ai_learn_from_comment';
--   -- Expected: prosecdef = true
--
--   -- Confirm search_path is pinned:
--   SELECT proname, proconfig
--   FROM   pg_proc
--   WHERE  proname = 'ai_learn_from_comment';
--   -- Expected: proconfig contains 'search_path=public, pg_temp'
--
--   -- Smoke test — submit a comment as the client user and
--   -- confirm the row lands in post_comments AND ai_memory
--   -- without a 403.
-- ═══════════════════════════════════════════════════════════════
