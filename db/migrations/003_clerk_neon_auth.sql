-- Clerk Free + Neon authentication migration
-- Safe to re-run.

ALTER TABLE app_users
  ALTER COLUMN identity_provider SET DEFAULT 'clerk';

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS public_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_app_users_email_status ON app_users(email, status);
CREATE INDEX IF NOT EXISTS idx_user_org_scopes_user ON user_org_scopes(user_id);
