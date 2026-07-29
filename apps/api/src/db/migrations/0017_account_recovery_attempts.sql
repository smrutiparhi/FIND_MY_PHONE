-- Part 9 - Account Recovery Mode. Distinct from recovery_action_status (the
-- generic PENDING/IN_PROGRESS/COMPLETED the ACCOUNT_RECOVERY RecoveryAction
-- already has) for the same reason police_report_status and ceir_status are
-- their own enums rather than overloading recovery_action_status: this
-- tracks the specific Apple/Google account-recovery process, which has
-- states (WAITING on an external provider, FAILED and retryable) that don't
-- fit the generic action lifecycle Part 6's engine already governs.
CREATE TYPE account_recovery_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'RECOVERED', 'FAILED');

-- Verbatim checklist from the master spec's Part 9 ("Ask what the user still
-- has access to"). "none/unsure" is an empty array, not its own value.
CREATE TYPE account_access_signal AS ENUM (
  'PASSWORD',
  'TRUSTED_DEVICE',
  'TRUSTED_PHONE_NUMBER',
  'RECOVERY_EMAIL',
  'SIM',
  'BACKUP_AUTH_METHOD'
);

-- One attempt per case (mirrors ceir_records - see 0011), lazily created the
-- first time a case's Account Recovery Mode screen is opened via
-- getOrCreateForCase. The generated recovery path itself is never stored
-- here - it's a pure function of platform + available_signals
-- (generateAccountRecoveryPath.ts), recomputed fresh on every read so a
-- later refinement to that logic never leaves stale step text behind.
CREATE TABLE account_recovery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  status account_recovery_status NOT NULL DEFAULT 'NOT_STARTED',
  available_signals account_access_signal[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_account_recovery_attempts_case_id UNIQUE (case_id)
);

CREATE TRIGGER trg_account_recovery_attempts_updated_at
  BEFORE UPDATE ON account_recovery_attempts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- See 0016_enable_row_level_security.sql for why every table gets this.
ALTER TABLE account_recovery_attempts ENABLE ROW LEVEL SECURITY;
