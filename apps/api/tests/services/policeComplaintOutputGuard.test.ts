import { describe, expect, it } from 'vitest';
import type { PoliceComplaintFacts } from '../../src/services/policeReport/policeComplaintFacts';
import { checkPoliceComplaintDraft } from '../../src/services/policeReport/policeComplaintOutputGuard';

function baseFacts(overrides: Partial<PoliceComplaintFacts> = {}): PoliceComplaintFacts {
  return {
    ownerFullName: 'Priya Iyer',
    ownerContact: 'priya@example.com',
    incidentType: 'LOST',
    incidentDateTime: null,
    lastKnownPlace: null,
    incidentDescription: 'I set my phone down on a cafe table and it was gone when I looked back.',
    deviceDescriptionSnapshot: 'Samsung Galaxy S23 (ANDROID)',
    imei1: null,
    imei2: null,
    serialNumber: null,
    locationObservationSummary: null,
    ...overrides,
  };
}

describe('checkPoliceComplaintDraft', () => {
  it('allows a clean, fact-grounded draft', () => {
    const result = checkPoliceComplaintDraft(
      'I, Priya Iyer, wish to report that my phone went missing. The last known location is unclear.',
      baseFacts(),
    );
    expect(result.safe).toBe(true);
  });

  it('flags a long digit sequence when no IMEI was supplied', () => {
    const result = checkPoliceComplaintDraft('The IMEI of the device is 359876543212345.', baseFacts({ imei1: null, imei2: null }));
    expect(result.safe).toBe(false);
    expect(result.reasons.some((r) => r.includes('IMEI'))).toBe(true);
  });

  it('allows a long digit sequence when an IMEI was actually supplied', () => {
    const result = checkPoliceComplaintDraft('The IMEI of the device is 359876543212345.', baseFacts({ imei1: '359876543212345' }));
    expect(result.safe).toBe(true);
  });

  it('flags theft/stolen language when the incident type is not STOLEN', () => {
    for (const incidentType of ['LOST', 'UNSURE'] as const) {
      const result = checkPoliceComplaintDraft('My phone was stolen from my bag.', baseFacts({ incidentType }));
      expect(result.safe).toBe(false);
      expect(result.reasons.some((r) => r.includes('theft'))).toBe(true);
    }
  });

  it('allows theft/stolen language when the incident type is STOLEN', () => {
    const result = checkPoliceComplaintDraft('My phone was stolen from my bag.', baseFacts({ incidentType: 'STOLEN' }));
    expect(result.safe).toBe(true);
  });

  it('flags what looks like a specific address when no last known place was supplied', () => {
    const result = checkPoliceComplaintDraft('The device was last seen near 42 Residency Road.', baseFacts({ lastKnownPlace: null }));
    expect(result.safe).toBe(false);
    expect(result.reasons.some((r) => r.includes('address'))).toBe(true);
  });

  it('allows an address-like mention when a last known place was actually supplied', () => {
    const result = checkPoliceComplaintDraft(
      'The device was last seen near 42 Residency Road, as reported by the owner.',
      baseFacts({ lastKnownPlace: '42 Residency Road' }),
    );
    expect(result.safe).toBe(true);
  });

  it('flags language that names or asserts a specific suspect', () => {
    const result = checkPoliceComplaintDraft('The suspect is a man in a red jacket seen nearby.', baseFacts());
    expect(result.safe).toBe(false);
    expect(result.reasons.some((r) => r.includes('suspect'))).toBe(true);
  });
});
