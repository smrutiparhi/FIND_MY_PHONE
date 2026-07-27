-- `action` is plain TEXT, not an enum, deliberately: every future part adds
-- new auditable actions (auth in Part 3, evidence access in Part 15, admin
-- actions in Part 20...), and a Postgres enum can only ever be extended, not
-- edited, without a new migration each time. The application layer (a
-- TypeScript union type) is the source of truth for valid values instead.
-- user_id is nullable for events that happen before identity is known (e.g.
-- a failed login attempt for a nonexistent account). metadata must never
-- contain the secrets the master spec forbids logging (tokens, passwords,
-- precise location, IMEI, OTPs, financial data) - enforced at the call site
-- in Part 20, not by this schema.
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_events_user_id ON audit_events(user_id, created_at DESC);
CREATE INDEX idx_audit_events_resource ON audit_events(resource_type, resource_id);
