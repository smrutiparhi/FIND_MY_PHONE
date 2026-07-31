import { describe, expect, it } from 'vitest';
import type { Device, DeviceId, Evidence, EvidenceId, PoliceReport, PoliceReportId, RecoveryCaseId, SimProtectionRecord, SimProtectionRecordId, UserId } from '@recoverai/shared';
import { buildCeirChecklistHints } from '../../src/services/ceir/buildCeirChecklistHints';

function baseDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-1' as DeviceId,
    userId: 'user-1' as UserId,
    nickname: 'My Phone',
    manufacturer: 'Samsung',
    model: 'Galaxy S23',
    platform: 'ANDROID',
    phoneNumberMasked: null,
    imei1Encrypted: null,
    imei2Encrypted: null,
    serialNumberEncrypted: null,
    simType: 'PHYSICAL',
    carrier: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function baseSimRecord(overrides: Partial<SimProtectionRecord> = {}): SimProtectionRecord {
  return {
    id: 'sim-1' as SimProtectionRecordId,
    caseId: 'case-1' as RecoveryCaseId,
    status: 'ACTIVE',
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function policeReport(overrides: Partial<PoliceReport> = {}): PoliceReport {
  return {
    id: 'report-1' as PoliceReportId,
    caseId: 'case-1' as RecoveryCaseId,
    createdByUserId: 'user-1' as UserId,
    status: 'DRAFT',
    ownerFullName: 'Test Owner',
    ownerContact: 'test@example.com',
    incidentDateTime: null,
    lastKnownPlace: null,
    incidentDescription: 'test',
    deviceDescriptionSnapshot: 'test',
    draftText: 'test',
    externalReferenceNumber: null,
    approvedAt: null,
    userMarkedSubmittedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'evidence-1' as EvidenceId,
    caseId: 'case-1' as RecoveryCaseId,
    uploadedByUserId: 'user-1' as UserId,
    category: 'OTHER',
    description: null,
    storageKey: 'internal:test',
    originalFileName: 'test.txt',
    mimeType: 'text/plain',
    fileSizeBytes: 10,
    checksumSha256: null,
    malwareScanStatus: 'SKIPPED',
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildCeirChecklistHints', () => {
  it('reports every hint unsatisfied for a bare device with nothing else on file', () => {
    const hints = buildCeirChecklistHints({
      device: baseDevice(),
      policeReports: [],
      simRecord: baseSimRecord(),
      evidence: [],
    });

    expect(hints.find((h) => h.item === 'IMEI_INFORMATION')?.satisfied).toBe(false);
    expect(hints.find((h) => h.item === 'MOBILE_NUMBER')?.satisfied).toBe(false);
    expect(hints.find((h) => h.item === 'DEVICE_DETAILS')?.satisfied).toBe(true);
    expect(hints.find((h) => h.item === 'POLICE_REPORT')?.satisfied).toBe(false);
    expect(hints.find((h) => h.item === 'IDENTITY_DOCUMENT')?.satisfied).toBe(false);
    expect(hints.find((h) => h.item === 'PURCHASE_INVOICE')?.satisfied).toBe(false);
    expect(hints.find((h) => h.item === 'REPLACEMENT_SIM_STATUS')?.satisfied).toBe(false);
    expect(hints.find((h) => h.item === 'OTHER')?.satisfied).toBe(false);
  });

  it('reflects real IMEI, phone number, filed police report, purchase invoice, and resolved SIM status', () => {
    const hints = buildCeirChecklistHints({
      device: baseDevice({ imei1Encrypted: 'ciphertext', phoneNumberMasked: '+91 98••••210' }),
      policeReports: [policeReport({ status: 'USER_MARKED_SUBMITTED' })],
      simRecord: baseSimRecord({ status: 'REPLACED' }),
      evidence: [evidence({ category: 'PURCHASE_INVOICE' })],
    });

    expect(hints.find((h) => h.item === 'IMEI_INFORMATION')?.satisfied).toBe(true);
    expect(hints.find((h) => h.item === 'MOBILE_NUMBER')?.satisfied).toBe(true);
    expect(hints.find((h) => h.item === 'POLICE_REPORT')?.satisfied).toBe(true);
    expect(hints.find((h) => h.item === 'PURCHASE_INVOICE')?.satisfied).toBe(true);
    expect(hints.find((h) => h.item === 'REPLACEMENT_SIM_STATUS')?.satisfied).toBe(true);
  });

  it('does not count a merely-drafted (not filed) police report as satisfying POLICE_REPORT', () => {
    const hints = buildCeirChecklistHints({
      device: baseDevice(),
      policeReports: [policeReport({ status: 'APPROVED' })],
      simRecord: baseSimRecord(),
      evidence: [],
    });

    expect(hints.find((h) => h.item === 'POLICE_REPORT')?.satisfied).toBe(false);
  });
});
