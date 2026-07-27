-- gen_random_uuid() is built into core Postgres since v13, but this keeps
-- migrations portable to older self-hosted Postgres instances too.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared trigger function: every table with an updated_at column attaches
-- this instead of relying on application code to remember to set it.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
