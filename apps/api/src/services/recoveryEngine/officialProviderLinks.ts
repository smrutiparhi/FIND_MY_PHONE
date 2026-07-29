import type { OfficialExternalAction, PlatformType } from '@recoverai/shared';

/**
 * The only two URLs this app ever hands the user for device-finding or
 * account-recovery - both official Apple/Google entry points, never
 * fabricated. Shared between the Recovery Decision Engine (Part 6, the
 * LOCATE_DEVICE/ACCOUNT_RECOVERY actions' officialExternalAction) and
 * Account Recovery Mode (Part 9) so there's exactly one place these can ever
 * drift from the real URLs.
 */
export function findingProvider(platform: PlatformType): OfficialExternalAction | null {
  if (platform === 'ANDROID') {
    return { provider: 'google', label: 'Open Google Find Hub', url: 'https://android.com/find' };
  }
  if (platform === 'IPHONE') {
    return { provider: 'apple', label: 'Open Find My', url: 'https://www.icloud.com/find' };
  }
  return null;
}

export function accountRecoveryProvider(platform: PlatformType): OfficialExternalAction | null {
  if (platform === 'ANDROID') {
    return {
      provider: 'google',
      label: 'Start Google Account Recovery',
      url: 'https://accounts.google.com/signin/recovery',
    };
  }
  if (platform === 'IPHONE') {
    return { provider: 'apple', label: 'Start Apple Account Recovery', url: 'https://iforgot.apple.com' };
  }
  return null;
}
