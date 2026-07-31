-- Part 12 - Financial Security Center. Verbatim checklist from the master
-- spec's Part 12 ("Ask whether the lost device contains: UPI apps, banking
-- apps, digital wallets, saved cards, email used for banking, password
-- manager") - deliberately its own enum, not a reuse of sensitive_app_type
-- (Part 5's coarser wizard checklist), since digital wallets and saved
-- cards have no equivalent there and this table tracks per-item progress
-- the wizard's checklist never needed to.
CREATE TYPE financial_item_category AS ENUM ('UPI', 'BANKING_APP', 'DIGITAL_WALLET', 'SAVED_CARD', 'BANKING_EMAIL', 'PASSWORD_MANAGER');

-- Verbatim from the master spec's Part 12. CONFIRMED_BY_INTEGRATION is
-- reserved for a real banking/UPI integration that doesn't exist yet - no
-- code path sets it today, same as LocationSource.AUTHORIZED_INTEGRATION
-- before Part 8 had a real device-finding API to call.
CREATE TYPE financial_protection_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'CONFIRMED_BY_USER', 'CONFIRMED_BY_INTEGRATION');

-- Many rows per case (unlike account_recovery_attempts/sim_protection_records's
-- one-per-case) - "allow the user to record institutions/apps generically or
-- by name" means this is a user-built list, not a single status. label is
-- free text and optional (generic tracking is fine); never a column for the
-- secrets the master spec explicitly forbids collecting (UPI PIN, ATM PIN,
-- CVV, bank password, full card number, OTP).
CREATE TABLE financial_protection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  category financial_item_category NOT NULL,
  label TEXT,
  status financial_protection_status NOT NULL DEFAULT 'NOT_STARTED',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_protection_items_case_id ON financial_protection_items(case_id, created_at);

CREATE TRIGGER trg_financial_protection_items_updated_at
  BEFORE UPDATE ON financial_protection_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- See 0016_enable_row_level_security.sql for why every table gets this.
ALTER TABLE financial_protection_items ENABLE ROW LEVEL SECURITY;
