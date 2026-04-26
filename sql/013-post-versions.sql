-- Applied to live DB on 2026-04-26 via Supabase MCP. Do NOT execute.
-- Captures caption edits for History tab; stage moves remain in activity_log.
-- Note: task spec requested sql/011 but that slot was taken by 011-plan-foundation.sql
-- and 012-plan-spawn-rls-rpcs.sql; PR-3.17 lands at the next free slot 013.

CREATE TABLE IF NOT EXISTS public.post_versions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         uuid        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  caption         text,
  edited_by       text,
  edited_by_role  text,
  edited_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_versions_post_id_edited_at_idx
  ON public.post_versions (post_id, edited_at DESC);

CREATE OR REPLACE FUNCTION public.capture_post_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
  v_role  text;
BEGIN
  v_email := COALESCE(
    NEW.updated_by,
    OLD.updated_by,
    NULLIF(current_setting('request.jwt.claims', true)::json ->> 'email', ''),
    'system'
  );

  SELECT role INTO v_role
  FROM public.user_roles
  WHERE email = v_email
  LIMIT 1;

  INSERT INTO public.post_versions (post_id, caption, edited_by, edited_by_role, edited_at)
  VALUES (OLD.id, OLD.caption, v_email, COALESCE(v_role, 'unknown'), now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_capture_caption_version ON public.posts;
CREATE TRIGGER posts_capture_caption_version
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  WHEN (OLD.caption IS DISTINCT FROM NEW.caption)
  EXECUTE FUNCTION public.capture_post_version();

ALTER TABLE public.post_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_versions read for authenticated" ON public.post_versions;
CREATE POLICY "post_versions read for authenticated"
  ON public.post_versions
  FOR SELECT
  TO authenticated
  USING (true);
