import { describe, expect, it } from 'vitest';
import type { DeviceRecoveryChecklist, LocationObservation, PoliceReport, RecoveryCase, RecoveryPlan, TimelineEvent } from '@recoverai/shared';
import { buildFinalCaseSummary } from '../../src/services/deviceRecovery/buildFinalCaseSummary';

const recoveryCase = {
  id: 'case-1',
  occurredAt: '2026-07-01T10:00:00.000Z',
  lastSeenAt: '2026-07-01T09:00:00.000Z',
} as unknown as RecoveryCase;

const checklist = {
  recoveredAt: '2026-07-10T12:00:00.000Z',
} as unknown as DeviceRecoveryChecklist;

const recoveryPlan = {
  riskLevel: 'LOW',
  riskReasons: [],
  orderedActions: [
    { id: 'a1', type: 'LOCATE_DEVICE', title: 'Locate the device', status: 'COMPLETED' },
    { id: 'a2', type: 'SIM_PROTECTION', title: 'Block your SIM', status: 'PENDING' },
    { id: 'a3', type: 'MONITOR', title: 'Monitor the case', status: 'COMPLETED' },
  ],
  currentRecommendedAction: null,
  blockedActions: [],
  warnings: [],
} as unknown as RecoveryPlan;

function makeEvent(overrides: Record<string, unknown> = {}): TimelineEvent {
  return {
    id: 'e1',
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

function makeLocation(overrides: Partial<LocationObservation> = {}): LocationObservation {
  return {
    id: 'loc-1',
    caseId: 'case-1',
    latitude: 12.9716,
    longitude: 77.5946,
    accuracyMeters: null,
    observedAt: '2026-07-02T10:00:00.000Z',
    source: 'USER_CONFIRMED',
    verificationStatus: 'USER_REPORTED',
    notes: null,
    recordedByUserId: null,
    createdAt: '2026-07-02T10:00:00.000Z',
    ...overrides,
  } as LocationObservation;
}

describe('buildFinalCaseSummary', () => {
  it('reports incident date, recovery date, and only COMPLETED actions', () => {
    const summary = buildFinalCaseSummary({
      recoveryCase,
      checklist,
      recoveryPlan,
      timelineEvents: [],
      locationObservations: [],
      latestPoliceReport: null,
      ceirStatus: 'NOT_READY',
    });

    expect(summary.incidentDate).toBe('2026-07-01T10:00:00.000Z');
    expect(summary.recoveryDate).toBe('2026-07-10T12:00:00.000Z');
    expect(summary.actionsCompleted.map((a) => a.type)).toEqual(['LOCATE_DEVICE', 'MONITOR']);
    expect(summary.actionsCompleted.map((a) => a.type)).not.toContain('SIM_PROTECTION');
  });

  it('falls back to lastSeenAt when occurredAt is null', () => {
    const summary = buildFinalCaseSummary({
      recoveryCase: { ...recoveryCase, occurredAt: null } as RecoveryCase,
      checklist,
      recoveryPlan,
      timelineEvents: [],
      locationObservations: [],
      latestPoliceReport: null,
      ceirStatus: 'NOT_READY',
    });

    expect(summary.incidentDate).toBe('2026-07-01T09:00:00.000Z');
  });

  it('reports NOT_STARTED police status when no report exists, and the real status otherwise', () => {
    const withoutReport = buildFinalCaseSummary({
      recoveryCase,
      checklist,
      recoveryPlan,
      timelineEvents: [],
      locationObservations: [],
      latestPoliceReport: null,
      ceirStatus: 'NOT_READY',
    });
    expect(withoutReport.policeStatus).toBe('NOT_STARTED');

    const withReport = buildFinalCaseSummary({
      recoveryCase,
      checklist,
      recoveryPlan,
      timelineEvents: [],
      locationObservations: [],
      latestPoliceReport: { status: 'APPROVED' } as PoliceReport,
      ceirStatus: 'SUBMITTED',
    });
    expect(withReport.policeStatus).toBe('APPROVED');
    expect(withReport.ceirStatus).toBe('SUBMITTED');
  });

  it('includes real location observations (unlike the sanitized Timeline export)', () => {
    const summary = buildFinalCaseSummary({
      recoveryCase,
      checklist,
      recoveryPlan,
      timelineEvents: [],
      locationObservations: [makeLocation()],
      latestPoliceReport: null,
      ceirStatus: 'NOT_READY',
    });

    expect(summary.locationObservations).toHaveLength(1);
    expect(summary.locationObservations[0]?.latitude).toBe(12.9716);
  });

  it('sorts status changes chronologically regardless of input order', () => {
    const early = makeEvent({ id: 'e1', title: 'First', createdAt: '2026-07-01T09:00:00.000Z' });
    const late = makeEvent({ id: 'e2', title: 'Second', createdAt: '2026-07-05T09:00:00.000Z' });

    const summary = buildFinalCaseSummary({
      recoveryCase,
      checklist,
      recoveryPlan,
      timelineEvents: [late, early],
      locationObservations: [],
      latestPoliceReport: null,
      ceirStatus: 'NOT_READY',
    });

    expect(summary.statusChanges.map((e) => e.title)).toEqual(['First', 'Second']);
  });
});
