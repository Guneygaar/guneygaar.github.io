-- Applied to live DB on 2026-04-26 via Supabase MCP. Frontend now writes briefs to internal_notes table as auto-pinned first row.

ALTER TABLE posts DROP COLUMN internal_notes;
NOTIFY pgrst, 'reload schema';
