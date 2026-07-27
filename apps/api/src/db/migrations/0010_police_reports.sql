-- Structured intake fields match the master spec's Part 13 list. Values here
-- are snapshotted at draft time rather than joined live from users/devices,
-- because a legal document's facts should stay frozen even if the user later
-- edits their profile or device nickname. created_by_user_id is ON DELETE
-- CASCADE, not RESTRICT, for the same reason as evidence.uploaded_by_user_id
-- above: this row is already removed via case_id's cascade when its case's
-- user is deleted, so RESTRICT would only block that account deletion.
CREATE TABLE police_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status police_report_status NOT NULL DEFAULT 'DRAFT',
  owner_full_name TEXT NOT NULL,
  owner_contact TEXT NOT NULL,
  incident_date_time TIMESTAMPTZ,
  last_known_place TEXT,
  incident_description TEXT NOT NULL,
  device_description_snapshot TEXT NOT NULL,
  draft_text TEXT NOT NULL,
  external_reference_number TEXT,
  approved_at TIMESTAMPTZ,
  user_marked_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_police_reports_case_id ON police_reports(case_id);

CREATE TRIGGER trg_police_reports_updated_at
  BEFORE UPDATE ON police_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- "Store complaint versions" (Part 13) as a proper history table rather than
-- an array column, so each draft revision keeps its own timestamp and id.
CREATE TABLE police_report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  police_report_id UUID NOT NULL REFERENCES police_reports(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  draft_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_police_report_versions_report_version UNIQUE (police_report_id, version_number)
);

CREATE INDEX idx_police_report_versions_report_id ON police_report_versions(police_report_id);
