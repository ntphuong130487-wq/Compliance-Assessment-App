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
