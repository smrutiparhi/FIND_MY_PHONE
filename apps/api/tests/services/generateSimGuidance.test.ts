import { describe, expect, it } from 'vitest';
import { generateSimGuidance } from '../../src/services/simProtection/generateSimGuidance';

const EXPECTED_KEYS = [
  'sim_blocking',
  'esim_considerations',
  'replacement_sim',
  'mobile_number_recovery',
  'otp_impact',
  'account_recovery_after_restoration',
];

describe('generateSimGuidance', () => {
  it('always returns exactly the master spec Part 11 checklist, in order', () => {
    const sections = generateSimGuidance({ simType: 'PHYSICAL', incidentType: 'LOST' });
    expect(sections.map((s) => s.key)).toEqual(EXPECTED_KEYS);
  });

  it('gives eSIM-specific guidance for ESIM and DUAL sim types', () => {
    for (const simType of ['ESIM', 'DUAL'] as const) {
      const section = generateSimGuidance({ simType, incidentType: 'LOST' }).find((s) => s.key === 'esim_considerations');
      expect(section?.body).toContain('eSIM profile');
    }
  });

  it('notes eSIM guidance does not apply for a physical or unknown SIM', () => {
    for (const simType of ['PHYSICAL', 'UNKNOWN'] as const) {
      const section = generateSimGuidance({ simType, incidentType: 'LOST' }).find((s) => s.key === 'esim_considerations');
      expect(section?.body).toContain('physical SIM');
    }
  });

  it('emphasizes urgency in the blocking section for STOLEN, softer framing for LOST', () => {
    const stolen = generateSimGuidance({ simType: 'PHYSICAL', incidentType: 'STOLEN' }).find((s) => s.key === 'sim_blocking');
    const lost = generateSimGuidance({ simType: 'PHYSICAL', incidentType: 'LOST' }).find((s) => s.key === 'sim_blocking');
    expect(stolen?.body).toContain('as soon as possible');
    expect(lost?.body).not.toBe(stolen?.body);
  });

  it('never asks the user to send an OTP or PIN to RecoverAI', () => {
    for (const simType of ['PHYSICAL', 'ESIM', 'DUAL', 'UNKNOWN'] as const) {
      for (const incidentType of ['LOST', 'STOLEN', 'UNSURE'] as const) {
        const sections = generateSimGuidance({ simType, incidentType });
        for (const section of sections) {
          expect(section.body.toLowerCase()).not.toMatch(/send us your|enter your pin|share your otp/);
        }
      }
    }
  });
});
