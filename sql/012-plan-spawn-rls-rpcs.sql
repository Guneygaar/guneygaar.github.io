-- Plan Spawn + Notification Suppression + Share Token + RLS — PR-3
-- Applied: 2026-04-26
-- Schema already applied to Supabase. Do NOT execute. Documentation + replay reference.

-- =========================================================================
-- [A] notify-stage suppression
-- The notify-stage edge function lives in Supabase (not this repo). To keep
-- the suppression contract durable and defendable from any caller, we layer
-- a DB-level guard: drop notifications inserted for plan-spawned posts in
-- the brief / in_production / awaiting_brand_input stages. Notifications
-- for awaiting_approval still reach the Client (per spec).
-- =========================================================================
CREATE OR REPLACE FUNCTION suppress_plan_spawned_stage_notifs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_cell_id uuid;
  v_stage text;
BEGIN
  -- Only inspect stage-change-shaped notifications.
  IF NEW.type IS DISTINCT FROM 'stage_change'
     AND NEW.type IS DISTINCT FROM 'stage_changed'
     AND NEW.type IS DISTINCT FROM 'brief'
     AND NEW.type IS DISTINCT FROM 'in_production'
     AND NEW.type IS DISTINCT FROM 'awaiting_brand_input' THEN
    RETURN NEW;
  END IF;

  IF NEW.post_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan_cell_id, stage INTO v_plan_cell_id, v_stage
  FROM posts WHERE post_id = NEW.post_id LIMIT 1;

  IF v_plan_cell_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_stage IN ('brief', 'in_production', 'awaiting_brand_input') THEN
    -- Plan owns these notifications; drop the per-post fan-out.
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS suppress_plan_spawned_stage_notifs_trg ON notifications;
CREATE TRIGGER suppress_plan_spawned_stage_notifs_trg
BEFORE INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION suppress_plan_spawned_stage_notifs();

-- =========================================================================
-- [B] Share token RPC — single-shot generator. Returns existing token if
--     already set, otherwise generates 24-byte base64url and stores it.
-- =========================================================================
CREATE OR REPLACE FUNCTION generate_plan_share_token(p_plan_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing text;
  v_token text;
BEGIN
  SELECT share_token INTO v_existing FROM plans WHERE id = p_plan_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  UPDATE plans SET share_token = v_token, updated_at = now()
  WHERE id = p_plan_id AND share_token IS NULL;
  -- If a concurrent caller won the race, return the persisted token.
  SELECT share_token INTO v_existing FROM plans WHERE id = p_plan_id;
  RETURN v_existing;
END;
$$;

REVOKE ALL ON FUNCTION generate_plan_share_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_plan_share_token(uuid) TO authenticated;

-- =========================================================================
-- [C] send_plan_for_alignment_transaction — atomic snapshot + status flip
-- =========================================================================
CREATE OR REPLACE FUNCTION send_plan_for_alignment_transaction(
  p_plan_id uuid,
  p_user_id uuid,
  p_user_name text,
  p_user_role text,
  p_workspace_id text
) RETURNS TABLE (new_version int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next int;
  v_snapshot jsonb;
BEGIN
  SELECT COALESCE(current_version, 1) + 1 INTO v_next FROM plans WHERE id = p_plan_id;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'plan_not_found %', p_plan_id;
  END IF;

  SELECT jsonb_build_object('cells', COALESCE(jsonb_agg(c.*), '[]'::jsonb))
  INTO v_snapshot FROM plan_cells c WHERE c.plan_id = p_plan_id;

  INSERT INTO plan_versions (
    plan_id, workspace_id, version_number, snapshot_jsonb,
    trigger_event, triggered_by, triggered_by_name, triggered_by_role
  ) VALUES (
    p_plan_id, p_workspace_id, v_next, v_snapshot,
    'sent_for_alignment', p_user_id, p_user_name, p_user_role
  );

  UPDATE plans
  SET plan_status = 'awaiting_alignment',
      current_version = v_next,
      updated_at = now()
  WHERE id = p_plan_id;

  INSERT INTO notifications (user_role, post_id, type, message, actor)
  VALUES ('Client', NULL, 'plan_alignment',
          p_user_name || ' sent the plan for alignment',
          p_user_name);

  RETURN QUERY SELECT v_next;
END;
$$;

REVOKE ALL ON FUNCTION send_plan_for_alignment_transaction(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION send_plan_for_alignment_transaction(uuid, uuid, text, text, text) TO authenticated, service_role;

-- =========================================================================
-- [D] align_plan_transaction — snapshot + flip + spawn posts + notify
-- =========================================================================
CREATE OR REPLACE FUNCTION align_plan_transaction(
  p_plan_id uuid,
  p_client_user_id uuid,
  p_client_name text,
  p_workspace_id text
) RETURNS TABLE (new_version int, spawned_count int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next int;
  v_spawned int := 0;
  v_client_email text;
  v_snapshot jsonb;
BEGIN
  SELECT COALESCE(current_version, 1) + 1 INTO v_next FROM plans WHERE id = p_plan_id;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'plan_not_found %', p_plan_id;
  END IF;

  SELECT email INTO v_client_email FROM profiles WHERE id = p_client_user_id LIMIT 1;

  SELECT jsonb_build_object(
    'cells', COALESCE(jsonb_agg(c.*), '[]'::jsonb),
    'plan_status', 'aligned'
  ) INTO v_snapshot FROM plan_cells c WHERE c.plan_id = p_plan_id;

  INSERT INTO plan_versions (
    plan_id, workspace_id, version_number, snapshot_jsonb,
    trigger_event, triggered_by, triggered_by_name, triggered_by_role
  ) VALUES (
    p_plan_id, p_workspace_id, v_next, v_snapshot,
    'aligned', p_client_user_id, p_client_name, 'Client'
  );

  UPDATE plans
  SET plan_status = 'aligned',
      current_version = v_next,
      aligned_version = v_next,
      aligned_at = now(),
      aligned_by = p_client_user_id,
      updated_at = now()
  WHERE id = p_plan_id;

  WITH spawn AS (
    INSERT INTO posts (post_id, title, stage, owner, target_date, created_by, plan_cell_id)
    SELECT
      'post_' || substring(c.id::text, 1, 8),
      NULLIF(c.concept, ''),
      'brief',
      'Servicing',
      c.cell_date,
      v_client_email,
      c.id
    FROM plan_cells c
    WHERE c.plan_id = p_plan_id
      AND c.cell_status <> 'spawned'
      AND c.cell_status <> 'linked'
    ON CONFLICT DO NOTHING
    RETURNING plan_cell_id
  )
  UPDATE plan_cells
  SET cell_status = 'spawned', updated_at = now()
  WHERE id IN (SELECT plan_cell_id FROM spawn);
  GET DIAGNOSTICS v_spawned = ROW_COUNT;

  INSERT INTO notifications (user_role, post_id, type, message, actor)
  VALUES ('Servicing', NULL, 'plan_aligned',
          p_client_name || ' aligned the plan',
          p_client_name);

  RETURN QUERY SELECT v_next, v_spawned;
END;
$$;

REVOKE ALL ON FUNCTION align_plan_transaction(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION align_plan_transaction(uuid, uuid, text, text) TO authenticated, service_role;

-- =========================================================================
-- [E] RLS — workspace-scoped access for authenticated users; share_token
--     opens read-only access (+ external comment insert) to anon callers.
-- =========================================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members can access plans" ON plans;
CREATE POLICY "workspace members can access plans"
ON plans FOR ALL TO authenticated
USING (workspace_id = 'default')
WITH CHECK (workspace_id = 'default');

DROP POLICY IF EXISTS "workspace members can access plan_cells" ON plan_cells;
CREATE POLICY "workspace members can access plan_cells"
ON plan_cells FOR ALL TO authenticated
USING (workspace_id = 'default')
WITH CHECK (workspace_id = 'default');

DROP POLICY IF EXISTS "workspace members can access plan_versions" ON plan_versions;
CREATE POLICY "workspace members can access plan_versions"
ON plan_versions FOR ALL TO authenticated
USING (workspace_id = 'default')
WITH CHECK (workspace_id = 'default');

DROP POLICY IF EXISTS "workspace members can access plan_comments" ON plan_comments;
CREATE POLICY "workspace members can access plan_comments"
ON plan_comments FOR ALL TO authenticated
USING (workspace_id = 'default')
WITH CHECK (workspace_id = 'default');

DROP POLICY IF EXISTS "share token read access on plans" ON plans;
CREATE POLICY "share token read access on plans"
ON plans FOR SELECT TO anon
USING (share_token IS NOT NULL);

DROP POLICY IF EXISTS "share token read access on plan_cells" ON plan_cells;
CREATE POLICY "share token read access on plan_cells"
ON plan_cells FOR SELECT TO anon
USING (plan_id IN (SELECT id FROM plans WHERE share_token IS NOT NULL));

DROP POLICY IF EXISTS "share token read on plan_comments" ON plan_comments;
CREATE POLICY "share token read on plan_comments"
ON plan_comments FOR SELECT TO anon
USING (plan_id IN (SELECT id FROM plans WHERE share_token IS NOT NULL));

DROP POLICY IF EXISTS "share token insert plan_comments" ON plan_comments;
CREATE POLICY "share token insert plan_comments"
ON plan_comments FOR INSERT TO anon
WITH CHECK (
  is_external = true
  AND plan_id IN (SELECT id FROM plans WHERE share_token IS NOT NULL)
);
