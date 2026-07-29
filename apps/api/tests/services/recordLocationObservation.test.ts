import { describe, expect, it } from 'vitest';
import type { CreateRecoveryCaseWizardInput } from '@recoverai/shared';
import { createRecoveryCaseFromWizard } from '../../src/services/wizardAssessment/createRecoveryCaseFromWizard';
import { recordLocationObservation } from '../../src/services/location/recordLocationObservation';
import { gatherEngineInputForExistingCase } from '../../src/services/recoveryEngine/gatherEngineInputForExistingCase';
import { NotFoundError } from '../../src/lib/errors';
import { repos, createTestUser } from '../factories';
import { testPool } from '../setup';

const baseWizardInput: CreateRecoveryCaseWizardInput = {
  incidentType: 'STOLEN',
  device: { mode: 'new', nickname: 'My Phone', manufacturer: 'Apple', model: 'iPhone 16', platform: 'IPHONE' },
  lastSeenAt: null,
  lastSeenDescription: null,
  accountAccessStatus: 'YES',
  simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
  screenLockEnabled: 'YES',
  sensitiveApps: [],
  deviceFindingAvailable: 'YES',
};

async function setUpCase(overrides: Partial<CreateRecoveryCaseWizardInput> = {}) {
  const user = await createTestUser();
  const recoveryCase = await createRecoveryCaseFromWizard(testPool, user.id, { ...baseWizardInput, ...overrides });
  return { user, recoveryCase };
}

describe('recordLocationObservation', () => {
  it('persists the observation with a derived (never client-chosen) verificationStatus', async () => {
    const { user, recoveryCase } = await setUpCase();

    const result = await recordLocationObservation(testPool, user.id, recoveryCase.id, {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracyMeters: 25,
      observedAt: new Date().toISOString(),
      source: 'USER_CONFIRMED',
      notes: 'Seen in Find My just now',
    });

    expect(result.locationObservation.verificationStatus).toBe('EXTERNAL_VERIFIED');
    expect(result.locationObservation.latitude).toBeCloseTo(12.9716, 4);
    expect(result.locationObservation.longitude).toBeCloseTo(77.5946, 4);
    expect(result.locationObservation.recordedByUserId).toBe(user.id);
  });

  it('never labels a USER_ENTERED observation as anything but UNVERIFIED', async () => {
    const { user, recoveryCase } = await setUpCase();

    const result = await recordLocationObservation(testPool, user.id, recoveryCase.id, {
      latitude: 12.9716,
      longitude: 77.5946,
      observedAt: new Date().toISOString(),
      source: 'USER_ENTERED',
    });

    expect(result.locationObservation.verificationStatus).toBe('UNVERIFIED');
  });

  it('creates a LOCATION_OBSERVATION_RECORDED timeline event sourced from the user, linked to the observation', async () => {
    const { user, recoveryCase } = await setUpCase();

    const result = await recordLocationObservation(testPool, user.id, recoveryCase.id, {
      latitude: 12.9716,
      longitude: 77.5946,
      observedAt: new Date().toISOString(),
      source: 'USER_CONFIRMED',
    });

    const events = await repos.timelineEvents.listByCase(recoveryCase.id);
    const event = events.find((e) => e.type === 'LOCATION_OBSERVATION_RECORDED');
    expect(event).toBeDefined();
    expect(event?.source).toBe('USER');
    expect(event?.locationObservationId).toBe(result.locationObservation.id);
    expect(event?.verificationStatus).toBe('EXTERNAL_VERIFIED');
  });

  it('flips locationStatus from UNAVAILABLE to AVAILABLE for the next engine evaluation', async () => {
    const { user, recoveryCase } = await setUpCase();
    const device = await repos.devices.findById(recoveryCase.deviceId, user.id);
    if (!device) throw new Error('expected device');

    const before = await gatherEngineInputForExistingCase(repos, recoveryCase, device);
    expect(before.input.locationStatus).toBe('UNAVAILABLE');

    await recordLocationObservation(testPool, user.id, recoveryCase.id, {
      latitude: 12.9716,
      longitude: 77.5946,
      observedAt: new Date().toISOString(),
      source: 'USER_CONFIRMED',
    });

    const reloadedCase = await repos.recoveryCases.findById(recoveryCase.id, user.id);
    if (!reloadedCase) throw new Error('expected case');
    const after = await gatherEngineInputForExistingCase(repos, reloadedCase, device);
    expect(after.input.locationStatus).toBe('AVAILABLE');
  });

  it('keeps only the most recent observation as "latest" while preserving history, newest first', async () => {
    const { user, recoveryCase } = await setUpCase();

    await recordLocationObservation(testPool, user.id, recoveryCase.id, {
      latitude: 1,
      longitude: 1,
      observedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      source: 'USER_ENTERED',
    });
    await recordLocationObservation(testPool, user.id, recoveryCase.id, {
      latitude: 2,
      longitude: 2,
      observedAt: new Date().toISOString(),
      source: 'USER_CONFIRMED',
    });

    const history = await repos.locationObservations.listByCase(recoveryCase.id);
    expect(history).toHaveLength(2);
    expect(history[0]?.latitude).toBe(2);
    expect(history[1]?.latitude).toBe(1);

    const latest = await repos.locationObservations.findLatestByCase(recoveryCase.id);
    expect(latest?.latitude).toBe(2);
  });

  it('rejects a caseId belonging to another user', async () => {
    const { recoveryCase } = await setUpCase();
    const otherUser = await createTestUser();

    await expect(
      recordLocationObservation(testPool, otherUser.id, recoveryCase.id, {
        latitude: 1,
        longitude: 1,
        observedAt: new Date().toISOString(),
        source: 'USER_ENTERED',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const history = await repos.locationObservations.listByCase(recoveryCase.id);
    expect(history).toHaveLength(0);
  });
});
