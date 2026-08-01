import { EVIDENCE_ALLOWED_MIME_TYPES, EVIDENCE_MAX_FILE_SIZE_BYTES, type EvidenceAllowedMimeType } from '@recoverai/shared';
import { ValidationError } from '../../lib/errors';

function isAllowedMimeType(mimeType: string): mimeType is EvidenceAllowedMimeType {
  return (EVIDENCE_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * "File-type validation, size limits" (master spec) - a tight allow-list
 * checked server-side regardless of what the client's <input accept> already
 * filtered, since "uploaded files must be treated as untrusted content"
 * covers the request itself, not just the file's bytes.
 */
export function validateEvidenceFile(file: { mimeType: string; sizeBytes: number }): void {
  if (!isAllowedMimeType(file.mimeType)) {
    throw new ValidationError(
      `Unsupported file type "${file.mimeType}". Allowed types: ${EVIDENCE_ALLOWED_MIME_TYPES.join(', ')}.`,
    );
  }
  if (file.sizeBytes <= 0) {
    throw new ValidationError('Uploaded file is empty.');
  }
  if (file.sizeBytes > EVIDENCE_MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(`File is too large. Maximum size is ${Math.floor(EVIDENCE_MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`);
  }
}
