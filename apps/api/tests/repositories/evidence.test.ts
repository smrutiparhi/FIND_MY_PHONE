import { describe, expect, it } from 'vitest';
import { createUserWithCase, repos } from '../factories';

describe('EvidenceRepository', () => {
  it('soft-deletes: excluded from the default list but recoverable with includeDeleted', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const evidence = await repos.evidence.create({
      caseId: recoveryCase.id,
      uploadedByUserId: user.id,
      category: 'PURCHASE_INVOICE',
      storageKey: 'evidence/invoice.pdf',
      originalFileName: 'invoice.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
    });

    await expect(repos.evidence.softDelete(evidence.id, user.id)).resolves.toBe(true);

    const activeList = await repos.evidence.listByCase(recoveryCase.id);
    expect(activeList).toEqual([]);

    const fullList = await repos.evidence.listByCase(recoveryCase.id, { includeDeleted: true });
    expect(fullList).toHaveLength(1);
    expect(fullList[0]?.deletedAt).not.toBeNull();

    // findByIdForUser only ever returns active evidence.
    await expect(repos.evidence.findByIdForUser(evidence.id, user.id)).resolves.toBeNull();
  });

  it('rejects a zero or negative file size', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    await expect(
      repos.evidence.create({
        caseId: recoveryCase.id,
        uploadedByUserId: user.id,
        category: 'DEVICE_PHOTO',
        storageKey: 'evidence/empty.jpg',
        originalFileName: 'empty.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 0,
      }),
    ).rejects.toThrow();
  });

  it('defaults malware scan status to PENDING and allows updating it', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const evidence = await repos.evidence.create({
      caseId: recoveryCase.id,
      uploadedByUserId: user.id,
      category: 'OTHER',
      storageKey: 'evidence/file.bin',
      originalFileName: 'file.bin',
      mimeType: 'application/octet-stream',
      fileSizeBytes: 512,
    });
    expect(evidence.malwareScanStatus).toBe('PENDING');

    await repos.evidence.updateMalwareScanStatus(evidence.id, 'CLEAN');
    const rescanned = await repos.evidence.findByIdForUser(evidence.id, user.id);
    expect(rescanned?.malwareScanStatus).toBe('CLEAN');
  });
});
