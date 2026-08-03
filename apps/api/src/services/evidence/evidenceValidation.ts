import { EVIDENCE_ALLOWED_MIME_TYPES, EVIDENCE_MAX_FILE_SIZE_BYTES, type EvidenceAllowedMimeType } from '@recoverai/shared';
import { ValidationError } from '../../lib/errors';

function isAllowedMimeType(mimeType: string): mimeType is EvidenceAllowedMimeType {
  return (EVIDENCE_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * "Uploaded files must be treated as untrusted content" (master spec) covers
 * the multipart request's own Content-Type header, not just the file's
 * bytes - a client fully controls what MIME type it declares, so checking
 * only that would let a renamed/relabeled executable through as long as the
 * attacker also lies about the type. Each allowed type's real magic-byte
 * signature is checked against the actual buffer instead.
 */
function matchesSignature(buffer: Buffer, mimeType: EvidenceAllowedMimeType): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    case 'application/pdf':
      return buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF';
  }
}

/**
 * "File-type validation, size limits" (master spec) - a tight allow-list
 * checked server-side regardless of what the client's <input accept> already
 * filtered, plus a magic-byte check so a mislabeled file (e.g. an
 * executable renamed to look like a JPEG) is rejected even if its declared
 * Content-Type is on the allow-list.
 */
export function validateEvidenceFile(file: { mimeType: string; sizeBytes: number; buffer: Buffer }): void {
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
  if (!matchesSignature(file.buffer, file.mimeType)) {
    throw new ValidationError(
      `The uploaded file's content does not match its declared type (${file.mimeType}). It may be mislabeled or corrupted.`,
    );
  }
}
