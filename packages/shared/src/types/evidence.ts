import type { EvidenceCategory } from './domain';

/** 15 MB - generous enough for a phone photo or scanned document, small enough that abuse is cheap to rate-limit. */
export const EVIDENCE_MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

/**
 * A tight allow-list, not a deny-list - "uploaded files must be treated as
 * untrusted content" (master spec). Covers every evidence category the
 * checklist actually needs (photos, scanned/exported documents) with nothing
 * executable ever accepted.
 */
export const EVIDENCE_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type EvidenceAllowedMimeType = (typeof EVIDENCE_ALLOWED_MIME_TYPES)[number];

export interface UploadEvidenceMetadata {
  category: EvidenceCategory;
  description?: string | null;
}

/**
 * "Do not expose evidence through public URLs" (master spec) - the only two
 * shapes an access response can take. `signed_url` is a short-lived private
 * object-storage URL for a real uploaded file. `inline_text` is used for the
 * handful of Evidence rows Parts 13/14 create that were never actual file
 * uploads (an approved police complaint draft, a CEIR submission record) -
 * their `storageKey` is an internal marker, not a real storage object, so
 * the content is served back out directly instead of pointing at object
 * storage that was never written.
 */
export type EvidenceAccessResult =
  | { kind: 'signed_url'; url: string; expiresAt: string }
  | { kind: 'inline_text'; text: string };
