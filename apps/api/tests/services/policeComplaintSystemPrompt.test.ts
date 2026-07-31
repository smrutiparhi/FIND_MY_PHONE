import { describe, expect, it } from 'vitest';
import type { PoliceComplaintFacts } from '../../src/services/policeReport/policeComplaintFacts';
import { buildPoliceComplaintFactsMessage } from '../../src/services/policeReport/policeComplaintSystemPrompt';

const facts: PoliceComplaintFacts = {
  ownerFullName: 'Aarav Mehta',
  ownerContact: 'aarav@example.com',
  incidentType: 'STOLEN',
  incidentDateTime: '2026-07-30T10:00:00.000Z',
  lastKnownPlace: null,
  incidentDescription: 'Someone grabbed the phone from my hand while I was on the bus.',
  deviceDescriptionSnapshot: 'Google Pixel 9 (ANDROID)\nIMEI 1: not provided',
  imei1: null,
  imei2: null,
  serialNumber: null,
  locationObservationSummary: null,
};

describe('buildPoliceComplaintFactsMessage', () => {
  it('includes every supplied fact verbatim', () => {
    const message = buildPoliceComplaintFactsMessage(facts);
    expect(message).toContain('Aarav Mehta');
    expect(message).toContain('aarav@example.com');
    expect(message).toContain('STOLEN');
    expect(message).toContain('Someone grabbed the phone from my hand while I was on the bus.');
    expect(message).toContain('Google Pixel 9 (ANDROID)');
  });

  it('marks every missing fact as "not provided" rather than omitting it silently', () => {
    const message = buildPoliceComplaintFactsMessage(facts);
    expect(message).toMatch(/Last known place: not provided/);
    expect(message).toMatch(/Last known location observation: not provided/);
  });
});
