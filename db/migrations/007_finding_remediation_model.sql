-- Finding remediation model v1
-- Separates advisory recommendation from mandatory remediation requirement.
-- Safe to re-run.

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
