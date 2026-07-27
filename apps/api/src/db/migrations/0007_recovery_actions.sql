-- The generic unit the Recovery Decision Engine (Part 6) sequences: LOCATE,
-- SIM_PROTECTION, POLICE_REPORT, CEIR_SUBMISSION, etc. are all rows here
-- distinguished by `type`, rather than separate tables per action kind.
-- PoliceReport and CeirRecord still get their own dedicated tables (below)
-- because they hold substantial structured content (drafted text, versions,
-- request ids) that doesn't fit a generic action row; `metadata` carries any
-- lighter, type-specific structured data a later part needs without forcing
-- a schema change now.
CREATE TABLE recovery_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  type recovery_action_type NOT NULL,
  priority INTEGER NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  instructions TEXT NOT NULL,
  status recovery_action_status NOT NULL DEFAULT 'PENDING',
  official_external_action JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_recovery_actions_case_id ON recovery_actions(case_id);
CREATE INDEX idx_recovery_actions_case_status ON recovery_actions(case_id, status);

CREATE TRIGGER trg_recovery_actions_updated_at
  BEFORE UPDATE ON recovery_actions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Self-referential dependency graph ("this action can't start until that one
-- completes"), as a proper join table rather than a JSON array of ids, so
-- referential integrity is enforced by the database.
CREATE TABLE recovery_action_dependencies (
  action_id UUID NOT NULL REFERENCES recovery_actions(id) ON DELETE CASCADE,
  depends_on_action_id UUID NOT NULL REFERENCES recovery_actions(id) ON DELETE CASCADE,
  PRIMARY KEY (action_id, depends_on_action_id),
  CONSTRAINT chk_recovery_action_dependencies_not_self CHECK (action_id <> depends_on_action_id)
);

CREATE INDEX idx_recovery_action_dependencies_depends_on ON recovery_action_dependencies(depends_on_action_id);

-- Deferred from 0005: recovery_cases and recovery_actions reference each
-- other, so this FK can only be added once recovery_actions exists.
ALTER TABLE recovery_cases
  ADD COLUMN current_recommended_action_id UUID REFERENCES recovery_actions(id) ON DELETE SET NULL;

CREATE INDEX idx_recovery_cases_current_recommended_action
  ON recovery_cases(current_recommended_action_id);
