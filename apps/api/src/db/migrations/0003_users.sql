-- No DEFAULT on id: it must equal the identity provider's user id (Supabase
-- Auth once Part 3 wires it up), passed in explicitly rather than generated
-- here. No FK to auth.users either - that schema only exists when Supabase
-- is the Postgres provider, and DATABASE_URL is deliberately portable to a
-- self-hosted Postgres instance too (see docs/ARCHITECTURE.md). Part 3 owns
-- the actual identity-sync mechanism.
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
