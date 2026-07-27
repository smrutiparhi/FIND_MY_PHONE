-- storage_key is a private-object-storage path/key, never a public URL (Part
-- 15 requires signed/temporary access URLs to be generated on demand from
-- this key). Soft-deleted via deleted_at rather than a hard DELETE, since
-- evidence can carry legal/audit significance even after a user removes it
-- from their active view. uploaded_by_user_id is ON DELETE CASCADE, not
-- RESTRICT: this row is already guaranteed to be removed via case_id's
-- cascade the moment its owning case's user is deleted (Part 3 "account
-- deletion"), so RESTRICT here would only ever serve to block that deletion.
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category evidence_category NOT NULL,
  description TEXT,
  storage_key TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  checksum_sha256 TEXT,
  malware_scan_status malware_scan_status NOT NULL DEFAULT 'PENDING',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_evidence_file_size_positive CHECK (file_size_bytes > 0)
);

CREATE INDEX idx_evidence_case_id ON evidence(case_id);
CREATE INDEX idx_evidence_case_active ON evidence(case_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_evidence_updated_at
  BEFORE UPDATE ON evidence
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
