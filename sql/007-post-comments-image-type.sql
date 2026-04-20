-- PR: fix-pcs-bugs (BUG 5 — comment image type mismatch)
-- Project: ozptjplxbyswclolbxyn
--
-- post_comments.attachments is jsonb that holds an array of blocks, e.g.
--   [{"type":"images","urls":["https://..."]}, {"type":"task", ...}]
--
-- The React PCS reader (srtd-next/src/flows/pcs/utils/attachments.js) was
-- standardised on {"type":"image"} (singular). This script rewrites every
-- existing block with type='images' to type='image' in place, preserving the
-- rest of the block's keys (urls, etc.).

UPDATE post_comments pc
SET attachments = sub.new_atts
FROM (
  SELECT
    pc2.id,
    (
      SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(elem) = 'object' AND elem->>'type' = 'images'
            THEN jsonb_set(elem, '{type}', to_jsonb('image'::text), true)
          ELSE elem
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(pc2.attachments) WITH ORDINALITY AS t(elem, ord)
    ) AS new_atts
  FROM post_comments pc2
  WHERE pc2.attachments IS NOT NULL
    AND jsonb_typeof(pc2.attachments) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(pc2.attachments) AS e
      WHERE jsonb_typeof(e) = 'object' AND e->>'type' = 'images'
    )
) AS sub
WHERE pc.id = sub.id
  AND sub.new_atts IS NOT NULL;

-- Same migration for internal_notes (same attachments shape).
UPDATE internal_notes n
SET attachments = sub.new_atts
FROM (
  SELECT
    n2.id,
    (
      SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(elem) = 'object' AND elem->>'type' = 'images'
            THEN jsonb_set(elem, '{type}', to_jsonb('image'::text), true)
          ELSE elem
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(n2.attachments) WITH ORDINALITY AS t(elem, ord)
    ) AS new_atts
  FROM internal_notes n2
  WHERE n2.attachments IS NOT NULL
    AND jsonb_typeof(n2.attachments) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(n2.attachments) AS e
      WHERE jsonb_typeof(e) = 'object' AND e->>'type' = 'images'
    )
) AS sub
WHERE n.id = sub.id
  AND sub.new_atts IS NOT NULL;
