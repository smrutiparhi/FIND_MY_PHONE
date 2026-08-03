-- Part 22 (Demo Mode). A single flag on the one table every other case-scoped
-- table already keys off of - "isolated demo data" (master spec) doesn't
-- need its own column on all 20 tables when every one of them already joins
-- back to recovery_cases. Defaults false so nothing about any existing or
-- future real case changes; every demo-specific endpoint requires this to
-- be true before it will touch a case at all (see services/demo/), which is
-- what actually enforces "Demo Mode must never be confused with real
-- recovery operations" - the column alone is just data, not the guard.
ALTER TABLE recovery_cases ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_recovery_cases_is_demo ON recovery_cases(user_id, is_demo);
