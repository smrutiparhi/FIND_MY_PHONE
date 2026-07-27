import { describe, expect, it } from 'vitest';
import { createUserWithCase, repos } from '../factories';

describe('LocationObservationRepository', () => {
  it('never labels a USER_ENTERED coordinate as live GPS - source is stored and returned as given', async () => {
    const { recoveryCase } = await createUserWithCase();
    const observation = await repos.locationObservations.create({
      caseId: recoveryCase.id,
      latitude: 12.9716,
      longitude: 77.5946,
      observedAt: new Date().toISOString(),
      source: 'USER_ENTERED',
      notes: 'The owner remembered seeing it near this landmark.',
    });

    expect(observation.source).toBe('USER_ENTERED');
    expect(observation.verificationStatus).toBe('UNVERIFIED');
  });

  it('returns observations newest-first and identifies the latest one', async () => {
    const { recoveryCase } = await createUserWithCase();
    const older = await repos.locationObservations.create({
      caseId: recoveryCase.id,
      latitude: 12.9,
      longitude: 77.5,
      observedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      source: 'AUTHORIZED_INTEGRATION',
      verificationStatus: 'EXTERNAL_VERIFIED',
    });
    const newer = await repos.locationObservations.create({
      caseId: recoveryCase.id,
      latitude: 12.95,
      longitude: 77.55,
      observedAt: new Date().toISOString(),
      source: 'AUTHORIZED_INTEGRATION',
      verificationStatus: 'EXTERNAL_VERIFIED',
    });

    const list = await repos.locationObservations.listByCase(recoveryCase.id);
    expect(list.map((o) => o.id)).toEqual([newer.id, older.id]);

    const latest = await repos.locationObservations.findLatestByCase(recoveryCase.id);
    expect(latest?.id).toBe(newer.id);
  });

  it('rejects coordinates outside valid latitude/longitude ranges', async () => {
    const { recoveryCase } = await createUserWithCase();
    await expect(
      repos.locationObservations.create({
        caseId: recoveryCase.id,
        latitude: 200,
        longitude: 77.5946,
        observedAt: new Date().toISOString(),
        source: 'USER_CONFIRMED',
      }),
    ).rejects.toThrow();
  });

  it('reports no observations for a case that has none - "current location unavailable" state', async () => {
    const { recoveryCase } = await createUserWithCase();
    await expect(repos.locationObservations.listByCase(recoveryCase.id)).resolves.toEqual([]);
    await expect(repos.locationObservations.findLatestByCase(recoveryCase.id)).resolves.toBeNull();
  });
});
