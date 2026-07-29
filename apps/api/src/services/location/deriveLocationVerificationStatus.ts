import type { LocationSource, VerificationStatus } from '@recoverai/shared';

/**
 * verificationStatus is always derived from source server-side, never
 * accepted as separate client input - otherwise a client could claim a
 * hand-typed coordinate is SYSTEM_VERIFIED. Master spec: "Never label
 * USER_ENTERED coordinates as live GPS."
 */
export function deriveLocationVerificationStatus(source: LocationSource): VerificationStatus {
  switch (source) {
    case 'AUTHORIZED_INTEGRATION':
      return 'SYSTEM_VERIFIED';
    case 'USER_CONFIRMED':
    case 'OTHER_VERIFIED_SOURCE':
      // Verified by Apple/Google/a carrier's own display - the user is only ever relaying it.
      return 'EXTERNAL_VERIFIED';
    case 'USER_ENTERED':
      return 'UNVERIFIED';
  }
}
