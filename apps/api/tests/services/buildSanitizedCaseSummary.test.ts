import { describe, expect, it } from 'vitest';
import type { Device, RecoveryCase, TimelineEvent } from '@recoverai/shared';
import { buildSanitizedCaseSummary } from '../../src/services/timeline/buildSanitizedCaseSummary';

const recoveryCase = {
  id: 'case-1',
  userId: 'user-1',
  deviceId: 'device-1',
  incidentType: 'STOLEN',
  status: 'NEW',
  riskLevel: 'HIGH',
  occurredAt: null,
  lastSeenAt: null,
  lastSeenDescription: 'Left it on a cafe table near MG Road',
  accountAccessStatus: 'YES',
  simAccessStatus: 'LOST_WITH_PHONE',
  locationCapability: 'YES',
  currentRecommendedActionId: null,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
  closedAt: null,
} as unknown as RecoveryCase;

const device = {
  id: 'device-1',
  userId: 'user-1',
  nickname: "My Phone",
  manufacturer: 'Samsung',
  model: 'Galaxy S23',
  platform: 'ANDROID',
  phoneNumberMasked: '+91••••••3210',
  imei1Encrypted: 'THIS-IS-A-SECRET-ENCRYPTED-IMEI-BLOB',
  imei2Encrypted: null,
  serialNumberEncrypted: 'THIS-IS-A-SECRET-ENCRYPTED-SERIAL-BLOB',
  simType: 'PHYSICAL',
  carrier: 'Jio',
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-07-01T09:00:00.000Z',
} as unknown as Device;

function makeEvent(overrides: Record<string, unknown>): TimelineEvent {
  return {
    id: 'event-1',
    caseId: 'case-1',
    type: 'CASE_CREATED',
    title: 'Case created',
    description: null,
    source: 'SYSTEM',
    verificationStatus: 'SYSTEM_VERIFIED',
    recoveryActionId: null,
    locationObservationId: null,
    evidenceId: null,
    policeReportId: null,
    ceirRecordId: null,
    createdByUserId: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  } as TimelineEvent;
}

describe('buildSanitizedCaseSummary', () => {
  it('includes case, device, and event narrative content', () => {
    const summary = buildSanitizedCaseSummary({
      recoveryCase,
      device,
      events: [makeEvent({})],
    });

    expect(summary).toContain('STOLEN');
    expect(summary).toContain('HIGH');
    expect(summary).toContain('Samsung Galaxy S23');
    expect(summary).toContain('Jio');
    expect(summary).toContain('Case created');
    expect(summary).toContain('Left it on a cafe table near MG Road');
  });

  it('never includes the device encrypted IMEI/serial field values, even though they were provided', () => {
    // The summary's own header names IMEI/serial as *excluded* categories (disclosure, not leakage) -
    // what must never appear is the actual encrypted field content.
    const summary = buildSanitizedCaseSummary({ recoveryCase, device, events: [] });

    expect(summary).not.toContain('THIS-IS-A-SECRET-ENCRYPTED-IMEI-BLOB');
    expect(summary).not.toContain('THIS-IS-A-SECRET-ENCRYPTED-SERIAL-BLOB');
    expect(summary).not.toContain(device.imei1Encrypted);
    expect(summary).not.toContain(device.serialNumberEncrypted);
  });

  it('lists events in chronological order regardless of input order', () => {
    const early = makeEvent({ id: 'e1', title: 'First event', createdAt: '2026-07-01T09:00:00.000Z' });
    const late = makeEvent({ id: 'e2', title: 'Second event', createdAt: '2026-07-01T11:00:00.000Z' });

    const summary = buildSanitizedCaseSummary({ recoveryCase, device, events: [late, early] });

    expect(summary.indexOf('First event')).toBeLessThan(summary.indexOf('Second event'));
  });

  it('includes every event title and description in the output', () => {
    const events = [
      makeEvent({ id: 'e1', title: 'SIM protection started', description: null }),
      makeEvent({ id: 'e2', title: 'Note from user', description: 'Called the bank to flag the account', source: 'USER', verificationStatus: 'USER_REPORTED' }),
    ];
    const summary = buildSanitizedCaseSummary({ recoveryCase, device, events });

    expect(summary).toContain('SIM protection started');
    expect(summary).toContain('Note from user');
    expect(summary).toContain('Called the bank to flag the account');
  });
});
