-- Part 11 - SIM/eSIM Protection Center. Distinct from recovery_action_status
-- for the same reason account_recovery_status and ceir_status are their own
-- enums: the SIM_PROTECTION RecoveryAction's generic PENDING/IN_PROGRESS/
-- COMPLETED lifecycle can't express "carrier confirmed blocked" vs.
-- "replacement SIM requested but not yet in hand" - note BLOCKED here means
-- something entirely different from recovery_action_status's BLOCKED (a
-- carrier having blocked the SIM, vs. an action waiting on a dependency).
CREATE TYPE sim_status AS ENUM ('ACTIVE', 'BLOCK_REQUESTED', 'BLOCKED', 'REPLACEMENT_PENDING', 'REPLACED', 'UNKNOWN');

-- One record per case (mirrors ceir_records/account_recovery_attempts),
-- lazily created via getOrCreateForCase. No carrier/SIM-type columns here -
-- "store only necessary carrier/SIM metadata" (master spec): those already
-- live on devices.carrier/devices.sim_type from Part 2 and are read from
-- there, never duplicated.
CREATE TABLE sim_protection_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  status sim_status NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sim_protection_records_case_id UNIQUE (case_id)
);

CREATE TRIGGER trg_sim_protection_records_updated_at
  BEFORE UPDATE ON sim_protection_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- See 0016_enable_row_level_security.sql for why every table gets this.
ALTER TABLE sim_protection_records ENABLE ROW LEVEL SECURITY;
