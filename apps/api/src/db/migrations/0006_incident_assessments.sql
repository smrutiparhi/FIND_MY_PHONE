-- Append-only history: the Recovery Decision Engine (Part 6) recalculates
-- "whenever a recovery action changes state," so a case can have many
-- assessments over its lifetime. recovery_cases.risk_level is a denormalized
-- cache of the latest row here, kept in sync by the service layer, so the
-- dashboard (Part 4/17) can read risk without joining assessment history.
CREATE TABLE incident_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  screen_lock_enabled tri_state_answer,
  sensitive_apps sensitive_app_type[] NOT NULL DEFAULT '{}',
  device_finding_available tri_state_answer,
  risk_level risk_level NOT NULL,
  risk_reasons TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_assessments_case_id ON incident_assessments(case_id, created_at DESC);
