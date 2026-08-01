-- Part 18 - Device Recovered workflow. The master spec's own guided-review
-- list, verbatim, minus "Close case" (the terminal action itself, not a
-- checklist item the user reviews). Each item is a self-attestation
-- checkbox - some only apply conditionally ("if appropriate", "if
-- previously blocked", "when warranted"), so checking one just means "I
-- reviewed this," not that a specific real-world condition was true.
CREATE TYPE device_recovery_checklist_item AS ENUM (
  'CONFIRM_POSSESSION',
  'CHECK_UNEXPECTED_CHANGES',
  'RESTORE_SIM',
  'REVIEW_ACCOUNT_SECURITY',
  'REVIEW_EMAIL_SESSIONS',
  'REVIEW_FINANCIAL_APPS',
  'CHANGE_CREDENTIALS',
  'HANDLE_CEIR_UNBLOCKING',
  'RESTORE_DEVICE_SETTINGS',
  'PRESERVE_EVIDENCE'
);

-- One checklist per case (mirrors ceir_records - see 0011), lazily created
-- the first time a case's "I found my phone" flow is opened.
-- recovered_at is set the moment CONFIRM_POSSESSION first enters
-- completed_items (see services/deviceRecovery/deviceRecoveryService.ts) -
-- that is also the moment recovery_cases.status moves to RECOVERED and a
-- DEVICE_RECOVERED timeline event is logged. closed_at is set only once the
-- user explicitly closes the case; kept here as the two source-of-truth
-- timestamps the master spec's final case summary needs ("incident date,
-- recovery date"), independent of recovery_cases.closed_at - which only
-- ever records the *first* terminal-status transition, and would otherwise
-- conflate the two moments if a case goes RECOVERED then later CLOSED.
CREATE TABLE device_recovery_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  completed_items device_recovery_checklist_item[] NOT NULL DEFAULT '{}',
  notes TEXT,
  recovered_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_device_recovery_checklists_case_id UNIQUE (case_id)
);

CREATE TRIGGER trg_device_recovery_checklists_updated_at
  BEFORE UPDATE ON device_recovery_checklists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- See 0016_enable_row_level_security.sql for why every table gets this.
ALTER TABLE device_recovery_checklists ENABLE ROW LEVEL SECURITY;
