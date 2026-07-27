import { describe, expect, it } from 'vitest';
import { createUserWithCase, repos } from '../factories';
import { testPool } from '../setup';

describe('CeirRecordRepository', () => {
  it('getOrCreateForCase is idempotent - one record per case', async () => {
    const { recoveryCase } = await createUserWithCase();

    const first = await repos.ceirRecords.getOrCreateForCase(recoveryCase.id);
    const second = await repos.ceirRecords.getOrCreateForCase(recoveryCase.id);

    expect(second.id).toBe(first.id);
    expect(first.status).toBe('NOT_READY');
  });

  it('enforces one CEIR record per case at the database level', async () => {
    const { recoveryCase } = await createUserWithCase();

    await repos.ceirRecords.getOrCreateForCase(recoveryCase.id);
    await expect(
      testPool.query('INSERT INTO ceir_records (case_id) VALUES ($1)', [recoveryCase.id]),
    ).rejects.toThrow();
  });

  it('tracks the checklist and status as they progress', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const ceir = await repos.ceirRecords.getOrCreateForCase(recoveryCase.id);

    const updated = await repos.ceirRecords.update(ceir.id, user.id, {
      status: 'READY',
      checklistCompletedItems: [
        'IMEI_INFORMATION',
        'MOBILE_NUMBER',
        'DEVICE_DETAILS',
        'POLICE_REPORT',
      ],
    });

    expect(updated?.status).toBe('READY');
    expect(updated?.checklistCompletedItems).toEqual([
      'IMEI_INFORMATION',
      'MOBILE_NUMBER',
      'DEVICE_DETAILS',
      'POLICE_REPORT',
    ]);
  });

  it('never fabricates a CEIR request id - it stores exactly what the user entered', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const ceir = await repos.ceirRecords.getOrCreateForCase(recoveryCase.id);
    expect(ceir.ceirRequestId).toBeNull();

    const updated = await repos.ceirRecords.update(ceir.id, user.id, {
      status: 'SUBMITTED',
      ceirRequestId: 'CEIR-USER-ENTERED-000123',
    });
    expect(updated?.ceirRequestId).toBe('CEIR-USER-ENTERED-000123');
  });
});
