-- Field list matches the master spec's Device section verbatim.
-- imei1/imei2/serial_number are AES-256-GCM ciphertext (see lib/encryption.ts) -
-- reversible, because Part 13/14 must display the real value when drafting a
-- police complaint or CEIR submission. phone_number_masked is a different
-- strategy: only a display-safe masked string is ever persisted, the full
-- number is never written to the database at all.
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  platform platform_type NOT NULL,
  phone_number_masked TEXT,
  imei1_encrypted TEXT,
  imei2_encrypted TEXT,
  serial_number_encrypted TEXT,
  sim_type sim_type NOT NULL DEFAULT 'UNKNOWN',
  carrier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_user_id ON devices(user_id);

CREATE TRIGGER trg_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
