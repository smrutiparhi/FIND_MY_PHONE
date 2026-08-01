import { randomUUID } from 'node:crypto';
import type { RecoveryCaseId } from '@recoverai/shared';
import { EVIDENCE_ALLOWED_MIME_TYPES, EVIDENCE_MAX_FILE_SIZE_BYTES } from '@recoverai/shared';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

const EVIDENCE_BUCKET = 'evidence';
let bucketEnsured = false;

/**
 * "Private object storage" (master spec) - created lazily and idempotently
 * on first use, the same "just works after migrations run" ethos as
 * migrate.ts, rather than requiring a manual Supabase dashboard step.
 * `public: false` is what actually enforces "do not expose evidence through
 * public URLs" at the storage layer itself; every read goes through
 * createEvidenceAccessUrl's short-lived signed URLs instead. The allow-list
 * and size limit are enforced again here (mirroring evidenceValidation.ts)
 * as defense in depth - a second layer that holds even if a future caller
 * bypasses the service-layer check.
 */
async function ensureEvidenceBucket(): Promise<void> {
  if (bucketEnsured) return;
  const { error } = await getSupabaseAdmin().storage.createBucket(EVIDENCE_BUCKET, {
    public: false,
    fileSizeLimit: EVIDENCE_MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: [...EVIDENCE_ALLOWED_MIME_TYPES],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Failed to ensure evidence storage bucket: ${error.message}`);
  }
  bucketEnsured = true;
}

/** caseId-prefixed so a case's objects are easy to reason about/audit together; the random suffix is what actually guarantees uniqueness. */
export function buildEvidenceObjectKey(caseId: RecoveryCaseId): string {
  return `${caseId}/${randomUUID()}`;
}

export async function uploadEvidenceObject(objectKey: string, buffer: Buffer, mimeType: string): Promise<void> {
  await ensureEvidenceBucket();
  const { error } = await getSupabaseAdmin()
    .storage.from(EVIDENCE_BUCKET)
    .upload(objectKey, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Evidence upload failed: ${error.message}`);
}

/** Signed, time-limited access only - never a permanent or public URL (master spec). */
export async function createEvidenceAccessUrl(
  objectKey: string,
  expiresInSeconds = 300,
): Promise<{ url: string; expiresAt: string }> {
  await ensureEvidenceBucket();
  const { data, error } = await getSupabaseAdmin().storage.from(EVIDENCE_BUCKET).createSignedUrl(objectKey, expiresInSeconds);
  if (error || !data) throw new Error(`Failed to create evidence access URL: ${error?.message ?? 'unknown error'}`);
  return { url: data.signedUrl, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
}
