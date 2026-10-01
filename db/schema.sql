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
  approval_ref text, metadata jsonb, source text
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



-- Production Core Phase 1A
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
  ai_generated boolean NOT NULL DEFAULT false,
  ai_confidence numeric(5,4),
  ai_engine text,
  ai_schema_version text,
  ai_field_confidence jsonb,
  ai_review_reasons jsonb,
  ai_uncertainties jsonb,
  ai_payload jsonb,
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



-- AI Obligation Intelligence v1
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='chk_draft_requirements_ai_confidence'
  ) THEN
    ALTER TABLE draft_requirements
      ADD CONSTRAINT chk_draft_requirements_ai_confidence
      CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_draft_requirements_ai_confidence
  ON draft_requirements(ai_confidence)
  WHERE ai_generated=true;
CREATE INDEX IF NOT EXISTS idx_draft_requirements_ai_review
  ON draft_requirements(review_status, ai_generated, ai_confidence);


-- Human review audit trail for draft obligations
ALTER TABLE decision_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS source text;
CREATE INDEX IF NOT EXISTS idx_decision_draft_review
  ON decision_logs(object_type, object_id, decided_at DESC)
  WHERE object_type='DraftRequirement';


-- Finding remediation model v1
ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS remediation_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remediation_requirement text;

ALTER TABLE remediation_actions
  ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT 'mandatory_remediation';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='chk_remediation_action_type'
  ) THEN
    ALTER TABLE remediation_actions
      ADD CONSTRAINT chk_remediation_action_type
      CHECK (action_type IN ('mandatory_remediation','improvement_action'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_findings_remediation_required
  ON findings(remediation_required,status)
  WHERE remediation_required=true;

CREATE INDEX IF NOT EXISTS idx_actions_type_status
  ON remediation_actions(action_type,status);


-- Remediation action governance v1
CREATE TABLE IF NOT EXISTS remediation_action_change_requests (
  id uuid PRIMARY KEY,
  action_id uuid NOT NULL REFERENCES remediation_actions(id) ON DELETE CASCADE,
  request_type text NOT NULL DEFAULT 'due_date_change',
  current_due_date date,
  requested_due_date date NOT NULL,
  reason text NOT NULL,
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  decided_by text,
  decided_at timestamptz,
  decision_note text
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='chk_action_change_request_type'
  ) THEN
    ALTER TABLE remediation_action_change_requests
      ADD CONSTRAINT chk_action_change_request_type
      CHECK (request_type IN ('due_date_change'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='chk_action_change_request_status'
  ) THEN
    ALTER TABLE remediation_action_change_requests
      ADD CONSTRAINT chk_action_change_request_status
      CHECK (status IN ('pending','approved','rejected','cancelled'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_action_pending_due_change
  ON remediation_action_change_requests(action_id)
  WHERE request_type='due_date_change' AND status='pending';

CREATE INDEX IF NOT EXISTS idx_action_change_requests_status
  ON remediation_action_change_requests(status,requested_at DESC);


-- Requirement-level assessor assignment v1
CREATE TABLE IF NOT EXISTS requirement_assessment_assignments (
  id uuid PRIMARY KEY,
  requirement_assessment_id uuid NOT NULL REFERENCES requirement_assessments(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  display_name text,
  assignment_role text NOT NULL DEFAULT 'primary_assessor',
  assigned_by text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='chk_ra_assignment_role'
  ) THEN
    ALTER TABLE requirement_assessment_assignments
      ADD CONSTRAINT chk_ra_assignment_role
      CHECK (assignment_role IN ('primary_assessor','support_assessor'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='chk_ra_assignment_status'
  ) THEN
    ALTER TABLE requirement_assessment_assignments
      ADD CONSTRAINT chk_ra_assignment_status
      CHECK (status IN ('active','inactive'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ra_primary_assessor
  ON requirement_assessment_assignments(requirement_assessment_id)
  WHERE assignment_role='primary_assessor' AND status='active';

CREATE UNIQUE INDEX IF NOT EXISTS ux_ra_user_active_assignment
  ON requirement_assessment_assignments(requirement_assessment_id,user_id,assignment_role)
  WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_ra_assignments_user
  ON requirement_assessment_assignments(user_id,status);

CREATE INDEX IF NOT EXISTS idx_ra_assignments_ra
  ON requirement_assessment_assignments(requirement_assessment_id,status);


-- Assessment-scoped source planning & obligation extraction v2
-- Safe to re-run.

ALTER TABLE compliance_assessments
  ALTER COLUMN framework_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS assessment_sources (
  id uuid PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES compliance_sources(id) ON DELETE CASCADE,
  source_role text NOT NULL,
  extraction_eligible boolean NOT NULL DEFAULT false,
  relevance_status text NOT NULL DEFAULT 'pending',
  effectiveness_status text NOT NULL DEFAULT 'pending',
  relevance_note text,
  linked_by text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  verified_by text,
  verified_at timestamptz,
  UNIQUE(assessment_id, source_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_assessment_source_role') THEN
    ALTER TABLE assessment_sources
      ADD CONSTRAINT chk_assessment_source_role
      CHECK (source_role IN ('basis_external','basis_internal','context','test_data','evidence'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_assessment_source_relevance') THEN
    ALTER TABLE assessment_sources
      ADD CONSTRAINT chk_assessment_source_relevance
      CHECK (relevance_status IN ('pending','verified','not_relevant'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_assessment_source_effectiveness') THEN
    ALTER TABLE assessment_sources
      ADD CONSTRAINT chk_assessment_source_effectiveness
      CHECK (effectiveness_status IN ('pending','verified','outdated','not_applicable'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_assessment_source_extraction_role') THEN
    ALTER TABLE assessment_sources
      ADD CONSTRAINT chk_assessment_source_extraction_role
      CHECK (
        (source_role IN ('basis_external','basis_internal') AND extraction_eligible IN (true,false))
        OR
        (source_role IN ('context','test_data','evidence') AND extraction_eligible=false)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assessment_sources_assessment
  ON assessment_sources(assessment_id, source_role, relevance_status, effectiveness_status);
CREATE INDEX IF NOT EXISTS idx_assessment_sources_source
  ON assessment_sources(source_id, assessment_id);

ALTER TABLE draft_requirements
  ADD COLUMN IF NOT EXISTS origin_assessment_id uuid REFERENCES compliance_assessments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_text text,
  ADD COLUMN IF NOT EXISTS action_text text,
  ADD COLUMN IF NOT EXISTS object_text text,
  ADD COLUMN IF NOT EXISTS condition_text text,
  ADD COLUMN IF NOT EXISTS exception_text text,
  ADD COLUMN IF NOT EXISTS timing_text text,
  ADD COLUMN IF NOT EXISTS frequency_text text,
  ADD COLUMN IF NOT EXISTS control_point text,
  ADD COLUMN IF NOT EXISTS control_objective text,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS applicable_org_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable_process_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable_activity_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable_role_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS obligation_key text,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES draft_requirements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_draft_requirements_origin_assessment
  ON draft_requirements(origin_assessment_id, review_status);
CREATE INDEX IF NOT EXISTS idx_draft_requirements_obligation_key
  ON draft_requirements(obligation_key) WHERE obligation_key IS NOT NULL;

ALTER TABLE compliance_requirements
  ADD COLUMN IF NOT EXISTS origin_assessment_id uuid REFERENCES compliance_assessments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_text text,
  ADD COLUMN IF NOT EXISTS action_text text,
  ADD COLUMN IF NOT EXISTS object_text text,
  ADD COLUMN IF NOT EXISTS condition_text text,
  ADD COLUMN IF NOT EXISTS exception_text text,
  ADD COLUMN IF NOT EXISTS timing_text text,
  ADD COLUMN IF NOT EXISTS frequency_text text,
  ADD COLUMN IF NOT EXISTS control_point text,
  ADD COLUMN IF NOT EXISTS control_objective text,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS applicable_org_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable_process_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable_activity_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable_role_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS obligation_key text,
  ADD COLUMN IF NOT EXISTS requirement_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_requirement_id uuid REFERENCES compliance_requirements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_requirements_origin_assessment
  ON compliance_requirements(origin_assessment_id, status);
CREATE INDEX IF NOT EXISTS idx_requirements_obligation_key
  ON compliance_requirements(obligation_key) WHERE obligation_key IS NOT NULL;

ALTER TABLE requirement_assessments
  ADD COLUMN IF NOT EXISTS requirement_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS scope_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS eligibility_snapshot jsonb;

