-- created_at doubles as the "timestamp" field the master spec requires.
-- `source` (who/what wrote this row: SYSTEM/USER/AI_AGENT/EXTERNAL_INTEGRATION)
-- and `verification_status` (how trustworthy the underlying fact is) are
-- deliberately separate axes - e.g. the backend (source=SYSTEM) can write an
-- event describing a fact the user merely reported (verification_status=
-- USER_REPORTED). Only USER_NOTE-type rows are ever user-editable/deletable;
-- that's enforced in the repository layer, not a schema flag, to avoid two
-- sources of truth. The five nullable FKs below are a deliberate polymorphic
-- reference pattern - exactly one is populated depending on `type` - chosen
-- over a generic (entity_type, entity_id) pair so referential integrity is
-- still enforced by the database.
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  type timeline_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source timeline_event_source NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'SYSTEM_VERIFIED',
  recovery_action_id UUID REFERENCES recovery_actions(id) ON DELETE SET NULL,
  location_observation_id UUID REFERENCES location_observations(id) ON DELETE SET NULL,
  evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL,
  police_report_id UUID REFERENCES police_reports(id) ON DELETE SET NULL,
  ceir_record_id UUID REFERENCES ceir_records(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_timeline_events_case_id ON timeline_events(case_id, created_at DESC);
