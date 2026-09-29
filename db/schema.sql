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
