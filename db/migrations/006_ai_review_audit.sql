-- Human review audit trail for AI/rule-generated draft obligations
-- Safe to re-run.

ALTER TABLE decision_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_decision_draft_review
  ON decision_logs(object_type, object_id, decided_at DESC)
  WHERE object_type='DraftRequirement';
