-- AgriS Compliance Assessment App
-- Logical/physical schema candidate v1.0-rc1
-- PostgreSQL / Neon compatible

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_schema_version (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_schema_version(version) VALUES ('1.0-rc1') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  unit_type text NOT NULL,
  parent_id uuid REFERENCES org_units(id),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL CHECK (actor_type IN ('person','team','org_unit','service_account')),
  name text NOT NULL,
  org_unit_id uuid REFERENCES org_units(id),
  auth_subject text,
  email text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS actors_auth_subject_uq ON actors(auth_subject) WHERE auth_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS compliance_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  version text,
  effective_from date,
  effective_to date,
  owner_actor_id uuid REFERENCES actors(id),
  owner_text text,
  status text NOT NULL DEFAULT 'draft',
  supersedes_id uuid REFERENCES compliance_sources(id),
  source_uri text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code, version)
);

CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  owner_actor_id uuid REFERENCES actors(id),
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code, version)
);

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  source_id uuid REFERENCES compliance_sources(id),
  source_clause text,
  parent_id uuid REFERENCES compliance_requirements(id),
  assessable boolean NOT NULL DEFAULT true,
  mandatory_level text NOT NULL DEFAULT 'mandatory',
  test_procedure text,
  expected_evidence text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS framework_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id),
  sort_order integer,
  applicability_rule jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(framework_id, requirement_id)
);

CREATE TABLE IF NOT EXISTS control_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  control_type text,
  frequency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requirement_control_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  control_reference_id uuid NOT NULL REFERENCES control_references(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'expected',
  UNIQUE(requirement_id, control_reference_id)
);

CREATE TABLE IF NOT EXISTS existing_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_reference_id uuid REFERENCES control_references(id),
  org_unit_id uuid REFERENCES org_units(id),
  name text NOT NULL,
  owner_actor_id uuid REFERENCES actors(id),
  status text NOT NULL DEFAULT 'active',
  frequency text,
  design_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  period text,
  objective text,
  owner_actor_id uuid REFERENCES actors(id),
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES assessment_programs(id),
  framework_id uuid NOT NULL REFERENCES compliance_frameworks(id),
  name text NOT NULL,
  objective text,
  period_from date,
  period_to date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved_plan','fieldwork','unit_response','review','signed_off','closed','reopened')),
  result_summary text,
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  framework_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  org_unit_id uuid REFERENCES org_units(id),
  process_ref text,
  location_ref text,
  activity_ref text,
  scope_note text,
  include_all_requirements boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES actors(id),
  role text NOT NULL,
  assigned_from date,
  assigned_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assessment_id, actor_id, role)
);

CREATE TABLE IF NOT EXISTS requirement_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id),
  workflow_status text NOT NULL DEFAULT 'to_do' CHECK (workflow_status IN ('to_do','in_progress','in_review','done')),
  compliance_result text NOT NULL DEFAULT 'not_assessed' CHECK (compliance_result IN ('not_assessed','compliant','partially_compliant','non_compliant','not_applicable','insufficient_evidence')),
  finding_type text,
  observation text,
  assessed_by_actor_id uuid REFERENCES actors(id),
  assessed_at timestamptz,
  requirement_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assessment_id, requirement_id)
);

CREATE TABLE IF NOT EXISTS requirement_assessment_existing_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_assessment_id uuid NOT NULL REFERENCES requirement_assessments(id) ON DELETE CASCADE,
  existing_control_id uuid NOT NULL REFERENCES existing_controls(id),
  control_result text,
  UNIQUE(requirement_assessment_id, existing_control_id)
);

CREATE TABLE IF NOT EXISTS findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_assessment_id uuid NOT NULL REFERENCES requirement_assessments(id),
  title text NOT NULL,
  fact text NOT NULL,
  criteria text NOT NULL,
  gap text NOT NULL,
  root_cause text,
  risk_impact text,
  recommendation text,
  severity text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','assigned','in_progress','pending_verification','closed','dismissed','reopened')),
  confirmed_by_actor_id uuid REFERENCES actors(id),
  confirmed_by_text text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS remediation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_text text NOT NULL,
  owner_actor_id uuid REFERENCES actors(id),
  owner_text text,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','pending_verification','closed','rejected','reopened')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  escalation_level integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES remediation_actions(id) ON DELETE CASCADE,
  verifier_actor_id uuid REFERENCES actors(id),
  verifier_text text,
  verification_date date NOT NULL,
  result text NOT NULL CHECK (result IN ('effective','ineffective')),
  note text NOT NULL,
  next_review_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id),
  assessment_id uuid REFERENCES compliance_assessments(id),
  org_unit_id uuid REFERENCES org_units(id),
  justification text NOT NULL,
  compensating_control text NOT NULL,
  approver_actor_id uuid REFERENCES actors(id),
  approver_text text,
  approved_at timestamptz,
  expiry_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','expired','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unit_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES actors(id),
  response_type text NOT NULL,
  response_text text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  assessor_disposition text,
  disposition_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  evidence_type text NOT NULL,
  owner_actor_id uuid REFERENCES actors(id),
  source_system text,
  confidentiality text NOT NULL DEFAULT 'internal',
  valid_from date,
  valid_to date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  version integer NOT NULL,
  file_uri text,
  original_filename text,
  mime_type text,
  file_size bigint,
  sha256 char(64) NOT NULL,
  captured_at timestamptz,
  uploaded_by_actor_id uuid REFERENCES actors(id),
  uploaded_by_text text,
  observation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evidence_id, version),
  UNIQUE(sha256, evidence_id)
);

CREATE TABLE IF NOT EXISTS evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_revision_id uuid NOT NULL REFERENCES evidence_revisions(id),
  target_type text NOT NULL CHECK (target_type IN ('RequirementAssessment','Finding','RemediationAction','Verification','ComplianceException','ExistingControl')),
  target_id uuid NOT NULL,
  purpose text NOT NULL,
  linked_by_actor_id uuid REFERENCES actors(id),
  linked_by_text text,
  linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_links_target_idx ON evidence_links(target_type,target_id);

CREATE TABLE IF NOT EXISTS ai_analysis_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_revision_id uuid REFERENCES evidence_revisions(id),
  assessment_id uuid NOT NULL REFERENCES compliance_assessments(id),
  requirement_assessment_id uuid REFERENCES requirement_assessments(id),
  proposed_requirement_id uuid REFERENCES compliance_requirements(id),
  proposed_result text,
  proposed_finding text,
  confidence numeric(5,4),
  rationale text NOT NULL,
  model_provider text,
  model_name text,
  prompt_version text,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','rejected','superseded')),
  reviewed_by_actor_id uuid REFERENCES actors(id),
  reviewed_by_text text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type text NOT NULL,
  object_id text NOT NULL,
  decision_type text NOT NULL,
  from_state text,
  to_state text,
  reason text,
  decided_by_actor_id uuid REFERENCES actors(id),
  decided_by_text text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  approval_ref text,
  metadata jsonb
);
CREATE INDEX IF NOT EXISTS decision_logs_object_idx ON decision_logs(object_type,object_id,decided_at DESC);

-- Updated-at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_units','actors','compliance_sources','compliance_frameworks','compliance_requirements','control_references','existing_controls','assessment_programs','compliance_assessments','requirement_assessments','findings','remediation_actions','compliance_exceptions','evidence']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON %I',t,t);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',t,t);
  END LOOP;
END $$;

-- Seed only structural org units. No compliance facts or findings are generated.
INSERT INTO org_units(code,name,unit_type) VALUES ('HO','HO','HO') ON CONFLICT(code) DO NOTHING;
INSERT INTO org_units(code,name,unit_type,parent_id)
SELECT 'AgriC','AgriC','Center',id FROM org_units WHERE code='HO' ON CONFLICT(code) DO NOTHING;
INSERT INTO org_units(code,name,unit_type,parent_id)
SELECT 'ProC','ProC','Center',id FROM org_units WHERE code='HO' ON CONFLICT(code) DO NOTHING;
INSERT INTO org_units(code,name,unit_type,parent_id)
SELECT 'ComC','ComC','Center',id FROM org_units WHERE code='HO' ON CONFLICT(code) DO NOTHING;
