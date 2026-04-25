-- PR-3.13 anchor system (caption pin-to-span + photo pin-to-spot)
-- Project: ozptjplxbyswclolbxyn
--
-- Adds anchor metadata to post_comments and internal_notes so a comment
-- can be pinned to a substring of post.caption ("caption" anchor) or to
-- an absolute pixel-percent point on a specific carousel image
-- ("photo" anchor). Anchor presence/absence is computed client-side at
-- render time (caption: substring check vs current post.caption; photo:
-- image_index match vs current scroll/lightbox index). No anchor_status
-- column. No recompute trigger. Pinned-to-top (max 3 per post) is PR-3.14.
--
-- anchor_payload shape:
--   caption: { type:'caption', text:string, char_start:int, char_end:int }
--   photo:   { type:'photo',   image_index:int, x_pct:number, y_pct:number }

ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS anchor_type text NULL,
  ADD COLUMN IF NOT EXISTS anchor_payload jsonb NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_anchor_type_check'
  ) THEN
    ALTER TABLE post_comments
      ADD CONSTRAINT post_comments_anchor_type_check
      CHECK (anchor_type IN ('caption','photo') OR anchor_type IS NULL);
  END IF;
END $$;

ALTER TABLE internal_notes
  ADD COLUMN IF NOT EXISTS anchor_type text NULL,
  ADD COLUMN IF NOT EXISTS anchor_payload jsonb NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'internal_notes_anchor_type_check'
  ) THEN
    ALTER TABLE internal_notes
      ADD CONSTRAINT internal_notes_anchor_type_check
      CHECK (anchor_type IN ('caption','photo') OR anchor_type IS NULL);
  END IF;
END $$;
