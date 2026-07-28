-- Enables RLS with zero policies on every table - a blanket default-deny.
--
-- Why this is needed now specifically: a Supabase-managed Postgres
-- auto-exposes every public-schema table over a REST API (PostgREST),
-- reachable with the project's `anon` key - which is not a secret, it ships
-- inside the frontend's JS bundle by design. Without RLS, anyone could pull
-- that key out of the bundle and query e.g. `/rest/v1/devices` directly,
-- reading every user's data and completely bypassing this app's Express
-- backend and its ownership-scoped repository methods.
--
-- This migration adds no policies at all, which makes every table
-- inaccessible via PostgREST to the `anon` and `authenticated` Postgres
-- roles (the ones that API uses) - a safe, correct default since nothing in
-- this app is ever meant to be queried that way. It doesn't affect this
-- app's own Postgres access at all: RLS only restricts roles other than a
-- table's owner (unless FORCE ROW LEVEL SECURITY is also set, which this
-- does not do), and the role in DATABASE_URL - the same role that ran these
-- migrations - owns every table here. It's also harmless on a self-hosted
-- Postgres with no PostgREST layer at all: there are no other roles for it
-- to restrict.
--
-- This does not replace the application-layer ownership scoping in every
-- repository method (see docs/DATABASE.md) - it closes a completely
-- different exposure path that only exists because of how Supabase serves
-- Postgres, not a substitute for it.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_action_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE police_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE police_report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceir_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
