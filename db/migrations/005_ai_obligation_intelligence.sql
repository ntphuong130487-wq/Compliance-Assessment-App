-- AI Obligation Intelligence v1
-- Safe to re-run.

ALTER TABLE draft_requirements
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS ai_engine text,
  ADD COLUMN IF NOT EXISTS ai_schema_version text,
  ADD COLUMN IF NOT EXISTS ai_field_confidence jsonb,
  ADD COLUMN IF NOT EXISTS ai_review_reasons jsonb,
  ADD COLUMN IF NOT EXISTS ai_uncertainties jsonb,
  ADD COLUMN IF NOT EXISTS ai_payload jsonb;

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
