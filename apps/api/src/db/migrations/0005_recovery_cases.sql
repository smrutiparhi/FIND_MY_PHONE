-- Field list matches the master spec's RecoveryCase section verbatim.
-- current_recommended_action_id is added by 0007 (recovery_actions) via
-- ALTER TABLE, because the two tables reference each other: an action
-- belongs to a case, and a case points at its current recommended action.
-- device_id is ON DELETE RESTRICT - a device with recovery history can't be
-- silently deleted out from under that history.
CREATE TABLE recovery_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  incident_type incident_type NOT NULL,
  status case_status NOT NULL DEFAULT 'NEW',
  risk_level risk_level,
  occurred_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  last_seen_description TEXT,
  account_access_status tri_state_answer,
  sim_access_status sim_access_status,
  location_capability tri_state_answer,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_recovery_cases_user_id ON recovery_cases(user_id);
CREATE INDEX idx_recovery_cases_device_id ON recovery_cases(device_id);
CREATE INDEX idx_recovery_cases_user_status ON recovery_cases(user_id, status);

CREATE TRIGGER trg_recovery_cases_updated_at
  BEFORE UPDATE ON recovery_cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
