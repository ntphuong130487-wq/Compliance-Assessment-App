-- Requirement-level assessor assignment v1
-- Supports one primary assessor per Requirement Assessment plus optional secondary assignments.
-- Safe to re-run.

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
