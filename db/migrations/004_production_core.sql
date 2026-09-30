-- Production Core Phase 1A: normalized operational gaps
-- Safe to re-run.

ALTER TABLE compliance_sources
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS file_uri text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz;

ALTER TABLE compliance_frameworks
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE compliance_assessments
  ADD COLUMN IF NOT EXISTS unit_representative text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS assessment_assignments (
  id uuid PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  user_id text,
  display_name text,
  assignment_role text NOT NULL,
  org_unit_id uuid REFERENCES org_units(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS draft_requirements (
  id uuid PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES compliance_sources(id) ON DELETE CASCADE,
  source_clause text,
  original_text text,
  obligation text NOT NULL,
  applicability text,
  obligation_type text,
  mandatory_level text,
  expected_evidence text,
  test_procedure text,
  review_status text NOT NULL DEFAULT 'draft',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unit_responses (
  id uuid PRIMARY KEY,
  finding_id uuid NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  response_type text NOT NULL,
  response_text text NOT NULL,
  responded_by text NOT NULL,
  responded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS owner_user_id text,
  ADD COLUMN IF NOT EXISTS org_unit_id uuid REFERENCES org_units(id);

ALTER TABLE evidence_revisions
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS storage_provider text;

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE remediation_actions
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS verification_status text;

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_assessment ON assessment_assignments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_user ON assessment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_draft_requirements_source_status ON draft_requirements(source_id, review_status);
CREATE INDEX IF NOT EXISTS idx_unit_responses_finding ON unit_responses(finding_id);
CREATE INDEX IF NOT EXISTS idx_evidence_org ON evidence(org_unit_id);
