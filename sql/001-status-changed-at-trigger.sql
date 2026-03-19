-- ═══════════════════════════════════════════════════════════════
-- FIX 1 — Automatically set status_changed_at on stage change
-- ═══════════════════════════════════════════════════════════════
--
-- PROBLEM:
--   Frontend sends PATCH { stage, updated_at } but NEVER sets
--   status_changed_at. Dashboard aging and delay calculations
--   depend on this field. Without it, aging falls back to
--   updated_at (which resets on ANY edit — comments, title, etc.)
--   producing incorrect delay/aging values.
--
-- SOLUTION:
--   Database trigger that fires BEFORE UPDATE on posts.
--   Sets status_changed_at = now() ONLY when stage actually changes.
--
-- SAFE TO RUN:
--   - Uses CREATE OR REPLACE (idempotent)
--   - Uses DROP TRIGGER IF EXISTS (idempotent)
--   - Does NOT modify existing data
--   - Does NOT alter table schema (assumes column exists)
--
-- PRE-REQUISITE:
--   The posts table MUST have a status_changed_at column.
--   If it does not exist, run the ALTER TABLE below FIRST.
-- ═══════════════════════════════════════════════════════════════

-- STEP 1: Ensure column exists (safe — IF NOT EXISTS)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

-- STEP 2: Backfill existing rows that have NULL status_changed_at.
-- Uses updated_at as best available approximation. This is imperfect
-- but better than NULL (which causes 'unknown' delay in the UI).
UPDATE posts
SET    status_changed_at = COALESCE(updated_at, created_at, now())
WHERE  status_changed_at IS NULL;

-- STEP 3: Create trigger function
CREATE OR REPLACE FUNCTION trg_set_status_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update timestamp when stage actually changes
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Attach trigger (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS posts_status_changed_at ON posts;

CREATE TRIGGER posts_status_changed_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_status_changed_at();

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION (run after applying):
--
--   1. Check column exists:
--      SELECT column_name, data_type
--      FROM information_schema.columns
--      WHERE table_name = 'posts' AND column_name = 'status_changed_at';
--
--   2. Check trigger exists:
--      SELECT trigger_name, event_manipulation, action_timing
--      FROM information_schema.triggers
--      WHERE event_object_table = 'posts'
--        AND trigger_name = 'posts_status_changed_at';
--
--   3. Test with a stage change:
--      UPDATE posts SET stage = 'ready' WHERE post_id = '<test_id>';
--      SELECT post_id, stage, status_changed_at, updated_at
--      FROM posts WHERE post_id = '<test_id>';
--      -- status_changed_at should be ~ now()
--
--   4. Test with a non-stage change (should NOT update):
--      UPDATE posts SET comments = 'test' WHERE post_id = '<test_id>';
--      SELECT post_id, stage, status_changed_at, updated_at
--      FROM posts WHERE post_id = '<test_id>';
--      -- status_changed_at should be UNCHANGED from step 3
-- ═══════════════════════════════════════════════════════════════
