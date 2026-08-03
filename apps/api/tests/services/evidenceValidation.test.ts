import { describe, expect, it } from 'vitest';
import { EVIDENCE_MAX_FILE_SIZE_BYTES } from '@recoverai/shared';
import { validateEvidenceFile } from '../../src/services/evidence/evidenceValidation';
import { ValidationError } from '../../src/lib/errors';

const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP_BUFFER = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
const PDF_BUFFER = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'binary');
const TEXT_BUFFER = Buffer.from('plain text, not any of the allowed formats');

describe('validateEvidenceFile', () => {
  it('allows an allowed type within the size limit whose bytes match its declared type', () => {
    expect(() => validateEvidenceFile({ mimeType: 'image/jpeg', sizeBytes: JPEG_BUFFER.length, buffer: JPEG_BUFFER })).not.toThrow();
    expect(() => validateEvidenceFile({ mimeType: 'image/png', sizeBytes: PNG_BUFFER.length, buffer: PNG_BUFFER })).not.toThrow();
    expect(() => validateEvidenceFile({ mimeType: 'image/webp', sizeBytes: WEBP_BUFFER.length, buffer: WEBP_BUFFER })).not.toThrow();
    expect(() => validateEvidenceFile({ mimeType: 'application/pdf', sizeBytes: PDF_BUFFER.length, buffer: PDF_BUFFER })).not.toThrow();
  });

  it('rejects a disallowed mime type', () => {
    expect(() =>
      validateEvidenceFile({ mimeType: 'application/x-msdownload', sizeBytes: TEXT_BUFFER.length, buffer: TEXT_BUFFER }),
    ).toThrow(ValidationError);
    expect(() => validateEvidenceFile({ mimeType: 'text/html', sizeBytes: TEXT_BUFFER.length, buffer: TEXT_BUFFER })).toThrow(
      ValidationError,
    );
  });

  it('rejects an empty file', () => {
    const empty = Buffer.alloc(0);
    expect(() => validateEvidenceFile({ mimeType: 'image/png', sizeBytes: 0, buffer: empty })).toThrow(ValidationError);
  });

  it('rejects a file over the size limit', () => {
    expect(() =>
      validateEvidenceFile({ mimeType: 'image/png', sizeBytes: EVIDENCE_MAX_FILE_SIZE_BYTES + 1, buffer: PNG_BUFFER }),
    ).toThrow(ValidationError);
  });

  it('allows a file exactly at the size limit', () => {
    expect(() =>
      validateEvidenceFile({ mimeType: 'image/png', sizeBytes: EVIDENCE_MAX_FILE_SIZE_BYTES, buffer: PNG_BUFFER }),
    ).not.toThrow();
  });

  it('rejects a file whose real content does not match its declared MIME type - the "renamed executable" attack', () => {
    // Plain text bytes declared as an image - the declared Content-Type alone would have
    // passed the old allow-list check.
    expect(() =>
      validateEvidenceFile({ mimeType: 'image/jpeg', sizeBytes: TEXT_BUFFER.length, buffer: TEXT_BUFFER }),
    ).toThrow(ValidationError);
    // A PDF's real bytes mislabeled as a PNG.
    expect(() =>
      validateEvidenceFile({ mimeType: 'image/png', sizeBytes: PDF_BUFFER.length, buffer: PDF_BUFFER }),
    ).toThrow(ValidationError);
  });
});
