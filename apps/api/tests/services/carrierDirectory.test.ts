import { describe, expect, it } from 'vitest';
import { findCarrierGuide } from '../../src/services/simProtection/carrierDirectory';

describe('findCarrierGuide', () => {
  it.each(['Jio', 'jio', 'Reliance Jio', 'RELIANCE JIO'])('matches "%s" to Jio', (carrier) => {
    expect(findCarrierGuide(carrier).carrierKey).toBe('JIO');
  });

  it.each(['Airtel', 'Bharti Airtel', 'airtel'])('matches "%s" to Airtel', (carrier) => {
    expect(findCarrierGuide(carrier).carrierKey).toBe('AIRTEL');
  });

  it.each(['Vi', 'vi', 'Vodafone Idea', 'Vodafone', 'Idea'])('matches "%s" to Vi', (carrier) => {
    expect(findCarrierGuide(carrier).carrierKey).toBe('VI');
  });

  it.each(['BSNL', 'bsnl'])('matches "%s" to BSNL', (carrier) => {
    expect(findCarrierGuide(carrier).carrierKey).toBe('BSNL');
  });

  it('does not false-positive match "Vi" as a substring inside an unrelated carrier name', () => {
    expect(findCarrierGuide('Virgin Mobile').carrierKey).toBe('OTHER');
  });

  it('falls back to a generic guide for an unrecognized carrier, keeping the original name', () => {
    const guide = findCarrierGuide('Some Regional Telecom');
    expect(guide.carrierKey).toBe('OTHER');
    expect(guide.displayName).toBe('Some Regional Telecom');
    expect(guide.websiteUrl).toBeNull();
  });

  it('falls back to a generic guide for null or empty carrier', () => {
    expect(findCarrierGuide(null).carrierKey).toBe('OTHER');
    expect(findCarrierGuide('').carrierKey).toBe('OTHER');
    expect(findCarrierGuide('   ').carrierKey).toBe('OTHER');
  });

  it('every real carrier entry has a genuine https website and no fabricated phone number for BSNL', () => {
    for (const carrier of ['Jio', 'Airtel', 'Vi', 'BSNL']) {
      const guide = findCarrierGuide(carrier);
      expect(guide.websiteUrl).toMatch(/^https:\/\//);
    }
    expect(findCarrierGuide('BSNL').phone).toBeNull();
  });
});
