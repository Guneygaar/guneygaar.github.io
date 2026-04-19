-- 006 — ai_usage.file_key
--
-- Adds a nullable text column to ai_usage so the srtd-ai Worker can
-- record which uploaded R2 asset (PDF or image) was attached to an
-- /ai/complete call. The column stores the R2 object key returned
-- by POST /ai/upload (shape: uploads/<workspace_id>/<post_id>/<ts>-<name>).
--
-- Nullable — every existing row and every future call without an
-- attachment keeps file_key NULL. Safe to re-run (IF NOT EXISTS).

ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS file_key text;
