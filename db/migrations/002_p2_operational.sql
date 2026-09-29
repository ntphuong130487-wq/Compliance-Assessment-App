-- P2 operational quality / production-readiness migration
-- Safe to re-run.

ALTER TABLE compliance_sources
  ADD COLUMN IF NOT EXISTS issuer text,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS supersedes_ref text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE compliance_requirements
  ADD COLUMN IF NOT EXISTS applicability text,
  ADD COLUMN IF NOT EXISTS obligation_type text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE compliance_assessments
  ADD COLUMN IF NOT EXISTS lead_assessor text,
  ADD COLUMN IF NOT EXISTS reviewer text,
  ADD COLUMN IF NOT EXISTS unit_representative text;

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS disposition text,
  ADD COLUMN IF NOT EXISTS disposition_note text,
  ADD COLUMN IF NOT EXISTS finalized_by text,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

ALTER TABLE remediation_actions
  ADD COLUMN IF NOT EXISTS owner_identity_id text,
  ADD COLUMN IF NOT EXISTS closure_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  display_name text,
  role_code text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  identity_provider text NOT NULL DEFAULT 'entra',
  tenant_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_org_scopes (
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  org_unit_id uuid NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  scope_role text,
  PRIMARY KEY (user_id, org_unit_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  notification_type text NOT NULL,
  severity text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL,
  title text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS user_notification_reads (
  notification_id text NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_requirements_source_status ON compliance_requirements(source_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_object ON notifications(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_notifications_open ON notifications(resolved_at) WHERE resolved_at IS NULL;
