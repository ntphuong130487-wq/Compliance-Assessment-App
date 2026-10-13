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

