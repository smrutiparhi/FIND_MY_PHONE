-- One CEIR process per case, hence the unique constraint on case_id.
-- ceir_request_id is purely user-entered (the id issued by the real CEIR/
-- Sanchar Saathi portal) - never generated or fabricated by RecoverAI.
CREATE TABLE ceir_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  status ceir_status NOT NULL DEFAULT 'NOT_READY',
  ceir_request_id TEXT,
  submission_date DATE,
  notes TEXT,
  checklist_completed_items ceir_checklist_item[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ceir_records_case_id UNIQUE (case_id)
);

CREATE TRIGGER trg_ceir_records_updated_at
  BEFORE UPDATE ON ceir_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
