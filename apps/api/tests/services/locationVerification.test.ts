import { describe, expect, it } from 'vitest';
import { deriveLocationVerificationStatus } from '../../src/services/location/deriveLocationVerificationStatus';

describe('deriveLocationVerificationStatus', () => {
  it('maps AUTHORIZED_INTEGRATION to SYSTEM_VERIFIED', () => {
    expect(deriveLocationVerificationStatus('AUTHORIZED_INTEGRATION')).toBe('SYSTEM_VERIFIED');
  });

  it('maps USER_CONFIRMED to EXTERNAL_VERIFIED - Apple/Google verified it, the user is only relaying it', () => {
    expect(deriveLocationVerificationStatus('USER_CONFIRMED')).toBe('EXTERNAL_VERIFIED');
  });

  it('maps OTHER_VERIFIED_SOURCE to EXTERNAL_VERIFIED', () => {
    expect(deriveLocationVerificationStatus('OTHER_VERIFIED_SOURCE')).toBe('EXTERNAL_VERIFIED');
  });

  it('never labels USER_ENTERED as anything but UNVERIFIED - master spec: never label it live GPS', () => {
    expect(deriveLocationVerificationStatus('USER_ENTERED')).toBe('UNVERIFIED');
  });
});
