-- Part 13 - Police Complaint Generator. Extends the police_report_versions
-- table Part 2 already created (see 0007_recovery_actions.sql for the same
-- pattern of a later migration extending an earlier part's table via ALTER
-- TABLE). Tracks whether a given draft came from MockAiProvider (no real
-- AI_API_KEY configured) so the UI can keep showing an accurate "demo" badge
-- even after a page reload - master spec: never present simulated output as
-- a real integration, without clearly marking it as such.
ALTER TABLE police_report_versions ADD COLUMN is_simulated BOOLEAN NOT NULL DEFAULT false;
