-- Plan Feature Foundation — PR-1
-- Applied: 2026-04-26
-- Schema already applied to Supabase. This file is documentation + replay reference.

-- [2] plans
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL DEFAULT 'default',
  title text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  plan_status text NOT NULL DEFAULT 'draft'
    CHECK (plan_status IN ('draft','awaiting_alignment','aligned','changes_requested','archived')),
  share_token text UNIQUE,
  current_version int NOT NULL DEFAULT 1,
  aligned_version int,
  aligned_at timestamptz,
  aligned_by uuid REFERENCES profiles(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plans_workspace_idx ON plans(workspace_id);
CREATE INDEX IF NOT EXISTS plans_workspace_status_idx ON plans(workspace_id, plan_status);
CREATE INDEX IF NOT EXISTS plans_share_token_idx ON plans(share_token) WHERE share_token IS NOT NULL;

-- [3] plan_cells
CREATE TABLE IF NOT EXISTS plan_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  workspace_id text NOT NULL DEFAULT 'default',
  cell_date date NOT NULL,
  channel text NOT NULL CHECK (channel IN ('linkedin','instagram','twitter','tiktok','facebook','youtube')),
  concept text NOT NULL DEFAULT '',
  reference_image_url text,
  cell_status text NOT NULL DEFAULT 'draft'
    CHECK (cell_status IN ('draft','aligned','changes_requested','spawned','linked')),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, cell_date, channel, position)
);
CREATE INDEX IF NOT EXISTS plan_cells_plan_idx ON plan_cells(plan_id);
CREATE INDEX IF NOT EXISTS plan_cells_plan_date_idx ON plan_cells(plan_id, cell_date);

-- [4] plan_versions
CREATE TABLE IF NOT EXISTS plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  workspace_id text NOT NULL DEFAULT 'default',
  version_number int NOT NULL,
  snapshot_jsonb jsonb NOT NULL,
  trigger_event text NOT NULL CHECK (trigger_event IN ('sent_for_alignment','changes_requested','aligned','manual_snapshot')),
  triggered_by uuid REFERENCES profiles(id),
  triggered_by_name text,
  triggered_by_role text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version_number)
);
CREATE INDEX IF NOT EXISTS plan_versions_plan_idx ON plan_versions(plan_id, version_number DESC);

-- [5] plan_comments
CREATE TABLE IF NOT EXISTS plan_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  workspace_id text NOT NULL DEFAULT 'default',
  plan_cell_id uuid REFERENCES plan_cells(id) ON DELETE CASCADE,
  version_number int,
  author text NOT NULL,
  author_role text,
  author_email text,
  author_user_id uuid REFERENCES profiles(id),
  is_external bool NOT NULL DEFAULT false,
  message text NOT NULL,
  resolved bool NOT NULL DEFAULT false,
  resolved_by text,
  resolved_at timestamptz,
  reply_to uuid REFERENCES plan_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_comments_plan_idx ON plan_comments(plan_id);
CREATE INDEX IF NOT EXISTS plan_comments_cell_idx ON plan_comments(plan_cell_id) WHERE plan_cell_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS plan_comments_unresolved_idx ON plan_comments(plan_id) WHERE resolved = false;

-- [6] posts.plan_cell_id
ALTER TABLE posts ADD COLUMN IF NOT EXISTS plan_cell_id uuid REFERENCES plan_cells(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS posts_plan_cell_idx ON posts(plan_cell_id) WHERE plan_cell_id IS NOT NULL;
