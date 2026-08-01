import { describe, expect, it } from 'vitest';
import { EVIDENCE_MAX_FILE_SIZE_BYTES } from '@recoverai/shared';
import { validateEvidenceFile } from '../../src/services/evidence/evidenceValidation';
import { ValidationError } from '../../src/lib/errors';

describe('validateEvidenceFile', () => {
  it('allows an allowed type within the size limit', () => {
    expect(() => validateEvidenceFile({ mimeType: 'image/jpeg', sizeBytes: 1024 })).not.toThrow();
    expect(() => validateEvidenceFile({ mimeType: 'application/pdf', sizeBytes: 1024 })).not.toThrow();
  });

  it('rejects a disallowed mime type', () => {
    expect(() => validateEvidenceFile({ mimeType: 'application/x-msdownload', sizeBytes: 1024 })).toThrow(ValidationError);
    expect(() => validateEvidenceFile({ mimeType: 'text/html', sizeBytes: 1024 })).toThrow(ValidationError);
  });

  it('rejects an empty file', () => {
    expect(() => validateEvidenceFile({ mimeType: 'image/png', sizeBytes: 0 })).toThrow(ValidationError);
  });

  it('rejects a file over the size limit', () => {
    expect(() => validateEvidenceFile({ mimeType: 'image/png', sizeBytes: EVIDENCE_MAX_FILE_SIZE_BYTES + 1 })).toThrow(ValidationError);
  });

  it('allows a file exactly at the size limit', () => {
    expect(() => validateEvidenceFile({ mimeType: 'image/png', sizeBytes: EVIDENCE_MAX_FILE_SIZE_BYTES })).not.toThrow();
  });
});
