-- PR-3.14 pin-to-top for post_comments and internal_notes
-- Project: ozptjplxbyswclolbxyn
--
-- Adds pinned/pinned_at/pinned_by columns to both post_comments and
-- internal_notes. Pinned comments float to the top of the thread.
-- Agency-only (effectiveRole !== 'client'). Depth 0 only (no replies).
-- Max 3 pinned per post enforced by enforce_pin_limit BEFORE trigger.
-- Pin/unpin events written to audit_log via log_pin_event AFTER trigger.

ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pinned_by text NULL;

ALTER TABLE internal_notes
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pinned_by text NULL;

CREATE OR REPLACE FUNCTION enforce_pin_limit() RETURNS trigger AS $$
DECLARE v_count int;
BEGIN
  IF NEW.pinned IS TRUE AND (TG_OP = 'INSERT' OR OLD.pinned IS DISTINCT FROM TRUE) THEN
    IF NEW.reply_to IS NOT NULL THEN
      RAISE EXCEPTION 'Pin only top-level comments';
    END IF;
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE post_id = $1 AND pinned = true AND id <> $2', TG_TABLE_NAME)
      INTO v_count USING NEW.post_id, NEW.id;
    IF v_count >= 3 THEN
      RAISE EXCEPTION 'Max 3 pinned per post';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pin_limit_comments ON post_comments;
CREATE TRIGGER trg_pin_limit_comments
  BEFORE INSERT OR UPDATE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION enforce_pin_limit();

DROP TRIGGER IF EXISTS trg_pin_limit_notes ON internal_notes;
CREATE TRIGGER trg_pin_limit_notes
  BEFORE INSERT OR UPDATE ON internal_notes
  FOR EACH ROW EXECUTE FUNCTION enforce_pin_limit();

CREATE OR REPLACE FUNCTION log_pin_event() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.pinned IS DISTINCT FROM NEW.pinned THEN
    INSERT INTO audit_log (post_id, action, new_value, changed_by, changed_at)
    VALUES (
      NEW.post_id,
      CASE WHEN NEW.pinned THEN 'pinned' ELSE 'unpinned' END,
      jsonb_build_object(
        'comment_id', NEW.id,
        'source_table', TG_TABLE_NAME,
        'excerpt', LEFT(COALESCE(NEW.message, ''), 100)
      ),
      COALESCE(NEW.pinned_by, OLD.pinned_by, 'system'),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_pin_comments ON post_comments;
CREATE TRIGGER trg_log_pin_comments
  AFTER UPDATE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION log_pin_event();

DROP TRIGGER IF EXISTS trg_log_pin_notes ON internal_notes;
CREATE TRIGGER trg_log_pin_notes
  AFTER UPDATE ON internal_notes
  FOR EACH ROW EXECUTE FUNCTION log_pin_event();

NOTIFY pgrst, 'reload schema';
