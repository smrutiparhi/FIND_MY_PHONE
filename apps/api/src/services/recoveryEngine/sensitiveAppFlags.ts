import type { SensitiveAppType } from '@recoverai/shared';

export interface SensitiveAppFlags {
  financialAppsPresent: boolean;
  authenticatorPresent: boolean;
  passwordManagerPresent: boolean;
  workAccountPresent: boolean;
}

/** The one place a raw sensitive-app checklist becomes the engine's four boolean inputs - shared so a recalculation and a fresh case derive them identically. */
export function deriveSensitiveAppFlags(sensitiveApps: SensitiveAppType[]): SensitiveAppFlags {
  return {
    financialAppsPresent: sensitiveApps.includes('BANKING') || sensitiveApps.includes('UPI'),
    authenticatorPresent: sensitiveApps.includes('AUTHENTICATOR'),
    passwordManagerPresent: sensitiveApps.includes('PASSWORD_MANAGER'),
    workAccountPresent: sensitiveApps.includes('WORK_ACCOUNTS'),
  };
}
