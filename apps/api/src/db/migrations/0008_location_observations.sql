-- Field list matches the master spec's LocationObservation section verbatim.
-- This table is an append-only log of individual observations, never a
-- continuous track - the master spec explicitly warns against treating it as
-- live tracking; recorded_by_user_id is nullable only for the
-- AUTHORIZED_INTEGRATION source, where no human manually recorded it.
CREATE TABLE location_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  accuracy_meters NUMERIC(10, 2),
  observed_at TIMESTAMPTZ NOT NULL,
  source location_source NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'UNVERIFIED',
  notes TEXT,
  recorded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_location_observations_latitude CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_location_observations_longitude CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT chk_location_observations_accuracy CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0)
);

CREATE INDEX idx_location_observations_case_id ON location_observations(case_id, observed_at DESC);
