import type { AccountAccessSignal, AccountRecoveryStep, PlatformType } from '@recoverai/shared';
import { accountRecoveryProvider } from '../recoveryEngine/officialProviderLinks';

const ACCOUNT_LABEL: Record<'ANDROID' | 'IPHONE', string> = { ANDROID: 'Google', IPHONE: 'Apple' };

function has(signals: AccountAccessSignal[], signal: AccountAccessSignal): boolean {
  return signals.includes(signal);
}

/**
 * Deterministic, not AI-generated - matches the master spec's insistence
 * elsewhere (Part 6) that recovery sequencing come from rules, not a prompt.
 * Every step here only ever points at Apple's/Google's own official
 * recovery entry point (accountRecoveryProvider) and only ever describes
 * *possession* checks (does the user have a trusted device, a recovery
 * email, ...) - never a field that could collect a password, OTP, or
 * recovery key, per "never ask the user to send RecoverAI their account
 * password, OTP, authentication code, recovery key or other secret."
 */
export function generateAccountRecoveryPath(platform: PlatformType, availableSignals: AccountAccessSignal[]): AccountRecoveryStep[] {
  const officialAction = accountRecoveryProvider(platform);

  if (platform === 'OTHER') {
    return [
      {
        key: 'other_platform',
        title: "Check this device's manufacturer account recovery",
        description:
          "RecoverAI's guided Apple/Google recovery paths don't apply to this device. Check the account provider's own support site for their official account-recovery process.",
        speed: 'VARIES',
        dependsOnExternalProvider: true,
        officialExternalAction: null,
      },
    ];
  }

  const accountLabel = ACCOUNT_LABEL[platform];
  const steps: AccountRecoveryStep[] = [];

  if (has(availableSignals, 'PASSWORD')) {
    steps.push({
      key: 'sign_in_with_password',
      title: 'Sign in directly',
      description: `You still know your password - sign in to your ${accountLabel} account normally. If prompted for a second verification step, a trusted device or trusted phone number (if you have one) will complete it instantly.`,
      speed: 'FAST',
      dependsOnExternalProvider: false,
      officialExternalAction: officialAction,
    });
  } else if (has(availableSignals, 'TRUSTED_DEVICE')) {
    steps.push({
      key: 'reset_via_trusted_device',
      title: 'Reset your password using a trusted device',
      description: `Start ${accountLabel}'s official password-reset flow and verify your identity using a device you're already signed in on. This is usually instant.`,
      speed: 'FAST',
      dependsOnExternalProvider: true,
      officialExternalAction: officialAction,
    });
  } else if (has(availableSignals, 'TRUSTED_PHONE_NUMBER') || has(availableSignals, 'BACKUP_AUTH_METHOD')) {
    steps.push({
      key: 'reset_via_phone_or_backup_codes',
      title: has(availableSignals, 'TRUSTED_PHONE_NUMBER') ? 'Reset your password using your trusted phone number' : 'Reset your password using a backup code',
      description: `Start ${accountLabel}'s official password-reset flow and verify your identity with ${
        has(availableSignals, 'TRUSTED_PHONE_NUMBER') ? 'an SMS or call to your trusted phone number' : 'one of your saved backup codes'
      }. Usually fast, though it can occasionally take a short wait for a code to arrive.`,
      speed: 'FAST',
      dependsOnExternalProvider: true,
      officialExternalAction: officialAction,
    });
  } else if (has(availableSignals, 'RECOVERY_EMAIL')) {
    steps.push({
      key: 'reset_via_recovery_email',
      title: 'Reset your password using your recovery email',
      description: `Start ${accountLabel}'s official password-reset flow and choose to verify via your recovery email address. Response time varies - check that inbox (and spam folder).`,
      speed: 'VARIES',
      dependsOnExternalProvider: true,
      officialExternalAction: officialAction,
    });
  } else {
    steps.push({
      key: 'formal_account_recovery',
      title: `Start ${accountLabel}'s formal Account Recovery process`,
      description: `Without a password, trusted device, trusted phone number, recovery email, or backup codes, ${accountLabel} has to verify your identity manually. This can take several days and RecoverAI cannot speed it up or check its status on your behalf - keep an eye on the email address you used to start the request.`,
      speed: 'SLOW',
      dependsOnExternalProvider: true,
      officialExternalAction: officialAction,
    });
  }

  if (has(availableSignals, 'SIM')) {
    steps.push({
      key: 'sim_helps_otp',
      title: 'Keep your SIM protected in the meantime',
      description: 'Having access to this phone number can help if any step above needs an SMS code - see the SIM/eSIM Protection Center if it might be at risk.',
      speed: 'FAST',
      dependsOnExternalProvider: false,
      officialExternalAction: null,
    });
  }

  return steps;
}
