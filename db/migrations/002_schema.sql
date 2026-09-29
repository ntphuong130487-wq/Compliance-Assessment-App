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

