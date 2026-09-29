-- Compliance Assessment App – Production v1 foundation
-- Canonical normalized model. The MVP sync API temporarily persists the client state
-- as JSONB; these tables are the target source-of-truth for the next migration.

CREATE TABLE IF NOT EXISTS org_units (
  id uuid PRIMARY KEY, code text UNIQUE NOT NULL, name text NOT NULL,
  unit_type text NOT NULL, parent_id uuid REFERENCES org_units(id),
  status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_sources (
  id uuid PRIMARY KEY, source_type text NOT NULL, code text,
  title text NOT NULL, version text, effective_from date, effective_to date,
  owner text, supersedes_id uuid REFERENCES compliance_sources(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id uuid PRIMARY KEY, code text UNIQUE NOT NULL, name text NOT NULL,
  version text NOT NULL, status text NOT NULL DEFAULT 'draft',
  owner text, effective_from date, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id uuid PRIMARY KEY, code text NOT NULL, title text NOT NULL,
  description text, source_id uuid REFERENCES compliance_sources(id),
  source_clause text, parent_id uuid REFERENCES compliance_requirements(id),
  assessable boolean NOT NULL DEFAULT true, mandatory_level text,
  test_procedure text, expected_evidence text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS framework_requirements (
  framework_id uuid REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES compliance_requirements(id) ON DELETE RESTRICT,
  PRIMARY KEY (framework_id, requirement_id)
);

CREATE TABLE IF NOT EXISTS assessment_programs (
  id uuid PRIMARY KEY, code text UNIQUE, name text NOT NULL, period text,
  objective text, status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_assessments (
  id uuid PRIMARY KEY, program_id uuid REFERENCES assessment_programs(id),
  framework_id uuid NOT NULL REFERENCES compliance_frameworks(id),
  name text NOT NULL, objective text, period_from date, period_to date,
  status text NOT NULL DEFAULT 'draft', locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_scopes (
  id uuid PRIMARY KEY, assessment_id uuid NOT NULL REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  org_unit_id uuid REFERENCES org_units(id), process_ref text, location_ref text,
  activity_ref text, scope_note text, include_all_requirements boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS requirement_assessments (
  id uuid PRIMARY KEY, assessment_id uuid NOT NULL REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id),
  workflow_status text NOT NULL DEFAULT 'to_do',
  compliance_result text NOT NULL DEFAULT 'not_assessed',
  finding_type text, observation text, assessed_by text, assessed_at timestamptz,
  UNIQUE (assessment_id, requirement_id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY, name text NOT NULL, evidence_type text,
  source_system text, confidentiality text, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_revisions (
  id uuid PRIMARY KEY, evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,
  version integer NOT NULL, file_uri text, original_filename text,
  mime_type text, sha256 text, captured_at timestamptz, observation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evidence_id, version)
);

CREATE TABLE IF NOT EXISTS evidence_links (
  id uuid PRIMARY KEY, evidence_revision_id uuid NOT NULL REFERENCES evidence_revisions(id) ON DELETE RESTRICT,
  target_type text NOT NULL, target_id uuid NOT NULL, purpose text,
  linked_by text, linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS findings (
  id uuid PRIMARY KEY, requirement_assessment_id uuid NOT NULL REFERENCES requirement_assessments(id),
  title text NOT NULL, fact text NOT NULL, criteria text NOT NULL, gap text NOT NULL,
  root_cause text, risk_impact text, severity text, priority text,
  status text NOT NULL DEFAULT 'draft', confirmed_by text, confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS remediation_actions (
  id uuid PRIMARY KEY, finding_id uuid NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  action_type text, action_text text NOT NULL, owner text NOT NULL,
  due_date date, status text NOT NULL DEFAULT 'open', progress integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY, action_id uuid NOT NULL REFERENCES remediation_actions(id) ON DELETE CASCADE,
  verifier text, verification_date timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL, note text, next_review_date date
);

CREATE TABLE IF NOT EXISTS ai_analysis_proposals (
  id uuid PRIMARY KEY, evidence_revision_id uuid REFERENCES evidence_revisions(id),
  assessment_id uuid REFERENCES compliance_assessments(id),
  proposed_requirement_id uuid REFERENCES compliance_requirements(id),
  proposed_result text, proposed_finding jsonb, confidence numeric,
  rationale text, status text NOT NULL DEFAULT 'proposed',
  reviewed_by text, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decision_logs (
  id uuid PRIMARY KEY, object_type text NOT NULL, object_id uuid NOT NULL,
  decision_type text NOT NULL, from_state text, to_state text,
  reason text, decided_by text, decided_at timestamptz NOT NULL DEFAULT now(),
  approval_ref text
);

CREATE INDEX IF NOT EXISTS idx_ra_assessment ON requirement_assessments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS idx_actions_due_status ON remediation_actions(due_date, status);
CREATE INDEX IF NOT EXISTS idx_evidence_link_target ON evidence_links(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_decision_object ON decision_logs(object_type, object_id);


-- P2 operational quality / production-readiness
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



-- Clerk Free + Neon authentication migration
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

