import { describe, expect, it } from 'vitest';
import { createTestUser, createUserWithCase, repos } from '../factories';

/**
 * The master spec's central authorization requirement: "Ensure users can
 * never retrieve another user's device / case / location / IMEI / documents
 * / complaints / CEIR information." Every test here follows the same shape -
 * user A creates something, user B (a stranger) tries to read or mutate it
 * through the same ownership-scoped repository method a route handler would
 * use, and must be refused exactly as if the resource didn't exist.
 */
describe('ownership scoping (IDOR prevention)', () => {
  it("devices: a stranger cannot find, list, update, or delete another user's device", async () => {
    const { user: owner, device } = await createUserWithCase();
    const stranger = await createTestUser();

    await expect(repos.devices.findById(device.id, stranger.id)).resolves.toBeNull();
    await expect(repos.devices.listByUser(stranger.id)).resolves.toEqual([]);
    await expect(
      repos.devices.update(device.id, stranger.id, { nickname: 'Hijacked' }),
    ).resolves.toBeNull();
    await expect(repos.devices.delete(device.id, stranger.id)).resolves.toBe(false);

    // The owner can still see it untouched.
    const stillOwned = await repos.devices.findById(device.id, owner.id);
    expect(stillOwned?.nickname).toBe('Test Device');
  });

  it("devices: a stranger cannot decrypt another user's IMEI", async () => {
    const owner = await createTestUser();
    const device = await repos.devices.create({
      userId: owner.id,
      nickname: 'Owner Phone',
      manufacturer: 'TestCo',
      model: 'Model X',
      platform: 'ANDROID',
      imei1: '490154203237518',
    });
    const stranger = await createTestUser();

    await expect(repos.devices.getDecryptedImei1(device.id, stranger.id)).resolves.toBeNull();
    await expect(repos.devices.getDecryptedImei1(device.id, owner.id)).resolves.toBe(
      '490154203237518',
    );
  });

  it("recovery cases: a stranger cannot find, list, or update another user's case", async () => {
    const { user: owner, recoveryCase } = await createUserWithCase();
    const stranger = await createTestUser();

    await expect(repos.recoveryCases.findById(recoveryCase.id, stranger.id)).resolves.toBeNull();
    await expect(repos.recoveryCases.listByUser(stranger.id)).resolves.toEqual([]);
    await expect(
      repos.recoveryCases.update(recoveryCase.id, stranger.id, { status: 'CLOSED' }),
    ).resolves.toBeNull();

    const stillOpen = await repos.recoveryCases.findById(recoveryCase.id, owner.id);
    expect(stillOpen?.status).toBe('NEW');
  });

  it("recovery actions: a stranger cannot fetch or update another user's action", async () => {
    const { recoveryCase } = await createUserWithCase();
    const stranger = await createTestUser();
    const action = await repos.recoveryActions.create({
      caseId: recoveryCase.id,
      type: 'LOCATE_DEVICE',
      priority: 1,
      title: 'Locate the device',
      reason: 'Test',
      instructions: 'Test',
    });

    await expect(repos.recoveryActions.findByIdForUser(action.id, stranger.id)).resolves.toBeNull();
    await expect(
      repos.recoveryActions.updateStatus(action.id, stranger.id, 'COMPLETED'),
    ).resolves.toBeNull();

    const unchanged = await repos.recoveryActions.findById(action.id);
    expect(unchanged?.status).toBe('PENDING');
  });

  it("location observations: a stranger cannot fetch another user's location data", async () => {
    const { recoveryCase } = await createUserWithCase();
    const stranger = await createTestUser();
    const observation = await repos.locationObservations.create({
      caseId: recoveryCase.id,
      latitude: 12.9716,
      longitude: 77.5946,
      observedAt: new Date().toISOString(),
      source: 'USER_CONFIRMED',
    });

    await expect(
      repos.locationObservations.findByIdForUser(observation.id, stranger.id),
    ).resolves.toBeNull();
  });

  it("evidence: a stranger cannot fetch or delete another user's evidence", async () => {
    const { user: owner, recoveryCase } = await createUserWithCase();
    const stranger = await createTestUser();
    const evidence = await repos.evidence.create({
      caseId: recoveryCase.id,
      uploadedByUserId: owner.id,
      category: 'DEVICE_PHOTO',
      storageKey: 'evidence/test-key.jpg',
      originalFileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1024,
    });

    await expect(repos.evidence.findByIdForUser(evidence.id, stranger.id)).resolves.toBeNull();
    await expect(repos.evidence.softDelete(evidence.id, stranger.id)).resolves.toBe(false);

    const stillThere = await repos.evidence.findByIdForUser(evidence.id, owner.id);
    expect(stillThere).not.toBeNull();
  });

  it("timeline events: a stranger cannot read, edit, or delete another user's note", async () => {
    const { user: owner, recoveryCase } = await createUserWithCase();
    const stranger = await createTestUser();
    const note = await repos.timelineEvents.create({
      caseId: recoveryCase.id,
      type: 'USER_NOTE',
      title: 'Private note',
      source: 'USER',
      createdByUserId: owner.id,
    });

    await expect(repos.timelineEvents.findByIdForUser(note.id, stranger.id)).resolves.toBeNull();
    await expect(
      repos.timelineEvents.updateUserNote(note.id, stranger.id, { title: 'Hijacked' }),
    ).resolves.toBeNull();
    await expect(repos.timelineEvents.deleteUserNote(note.id, stranger.id)).resolves.toBe(false);
  });

  it("police reports: a stranger cannot read, approve, or mark another user's report submitted", async () => {
    const { user: owner, recoveryCase } = await createUserWithCase();
    const stranger = await createTestUser();
    const report = await repos.policeReports.create({
      caseId: recoveryCase.id,
      createdByUserId: owner.id,
      ownerFullName: 'Test Owner',
      ownerContact: 'owner@example.com',
      incidentDescription: 'Phone went missing.',
      deviceDescriptionSnapshot: 'TestCo Model X',
      draftText: 'Draft complaint text.',
    });

    await expect(repos.policeReports.findByIdForUser(report.id, stranger.id)).resolves.toBeNull();
    await expect(repos.policeReports.approve(report.id, stranger.id)).resolves.toBeNull();
    await expect(repos.policeReports.markUserSubmitted(report.id, stranger.id)).resolves.toBeNull();

    const stillDraft = await repos.policeReports.findByIdForUser(report.id, owner.id);
    expect(stillDraft?.status).toBe('DRAFT');
  });

  it("CEIR records: a stranger cannot read or update another user's record", async () => {
    const { recoveryCase } = await createUserWithCase();
    const stranger = await createTestUser();
    const ceir = await repos.ceirRecords.getOrCreateForCase(recoveryCase.id);

    await expect(repos.ceirRecords.findByIdForUser(ceir.id, stranger.id)).resolves.toBeNull();
    await expect(
      repos.ceirRecords.update(ceir.id, stranger.id, { status: 'READY' }),
    ).resolves.toBeNull();
  });

  it("notifications: a stranger cannot list or mark read another user's notifications", async () => {
    const { user: owner } = await createUserWithCase();
    const stranger = await createTestUser();
    const notification = await repos.notifications.create({
      userId: owner.id,
      type: 'CRITICAL_ACTION_PENDING',
      title: 'Protect your SIM',
      body: 'Test body',
    });

    await expect(repos.notifications.listByUser(stranger.id)).resolves.toEqual([]);
    await expect(repos.notifications.markRead(notification.id, stranger.id)).resolves.toBeNull();
  });
});
