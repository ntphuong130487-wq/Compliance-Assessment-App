-- Remediation action governance v1
-- Progress updates are audited; due-date changes require request + independent approval.
-- Safe to re-run.

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
