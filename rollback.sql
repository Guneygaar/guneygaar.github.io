-- ROLLBACK: Role standardization (run if production breaks)
-- Reverts DB to person-name based owner values

-- Step 1: Drop new constraints
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_owner_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_roles;

-- Step 2: Revert posts.owner
UPDATE posts SET owner = 'Pranav' WHERE owner = 'Creative';
UPDATE posts SET owner = 'Chitra' WHERE owner = 'Servicing';

-- Step 3: Revert notifications.user_role
UPDATE notifications SET user_role = 'Pranav' WHERE user_role = 'Creative';
UPDATE notifications SET user_role = 'Chitra' WHERE user_role = 'Servicing';

-- Step 4: Restore old constraints
ALTER TABLE posts ADD CONSTRAINT owner_check
CHECK (owner = ANY (ARRAY['Pranav'::text, 'Chitra'::text, 'Client'::text]));
ALTER TABLE notifications ADD CONSTRAINT valid_roles
CHECK (user_role = ANY (ARRAY['Admin'::text, 'Pranav'::text, 'Chitra'::text, 'Servicing'::text, 'Client'::text]));

-- End rollback
