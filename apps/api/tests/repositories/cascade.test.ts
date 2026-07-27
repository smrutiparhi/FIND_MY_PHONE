import { describe, expect, it } from 'vitest';
import { createUserWithCase, repos } from '../factories';
import { testPool } from '../setup';

describe('cascade delete integrity', () => {
  it('deleting a user cascades through devices, cases, and every case-scoped table', async () => {
    const { user, device, recoveryCase } = await createUserWithCase();

    await repos.incidentAssessments.create({
      caseId: recoveryCase.id,
      riskLevel: 'HIGH',
      riskReasons: ['test'],
    });
    const action = await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'LOCATE_DEVICE',
      priority: 1,
      title: 'Locate',
      reason: 'Test',
      instructions: 'Test',
    });
    await repos.locationObservations.create({
      caseId: recoveryCase.id,
      latitude: 1,
      longitude: 1,
      observedAt: new Date().toISOString(),
      source: 'USER_ENTERED',
    });
    const evidence = await repos.evidence.create({
      caseId: recoveryCase.id,
      uploadedByUserId: user.id,
      category: 'OTHER',
      storageKey: 'k',
      originalFileName: 'f',
      mimeType: 'text/plain',
      fileSizeBytes: 1,
    });
    await repos.timelineEvents.create({
      caseId: recoveryCase.id,
      type: 'CASE_CREATED',
      title: 'Created',
      source: 'SYSTEM',
    });
    const report = await repos.policeReports.create({
      caseId: recoveryCase.id,
      createdByUserId: user.id,
      ownerFullName: 'Test',
      ownerContact: 'test@example.com',
      incidentDescription: 'Test',
      deviceDescriptionSnapshot: 'Test',
      draftText: 'Test',
    });
    const ceir = await repos.ceirRecords.getOrCreateForCase(recoveryCase.id);
    await repos.notifications.create({
      userId: user.id,
      type: 'CASE_INACTIVITY',
      title: 'T',
      body: 'T',
    });

    await repos.users.delete(user.id);

    const tables = [
      ['devices', device.id],
      ['recovery_cases', recoveryCase.id],
      ['recovery_actions', action.id],
      ['evidence', evidence.id],
      ['police_reports', report.id],
      ['ceir_records', ceir.id],
    ] as const;

    for (const [table, id] of tables) {
      const result = await testPool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
      expect(
        result.rows,
        `expected ${table} row to be gone after cascading user delete`,
      ).toHaveLength(0);
    }

    const notificationCount = await testPool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1',
      [user.id],
    );
    expect(notificationCount.rows[0]?.count).toBe(0);
  });
});
