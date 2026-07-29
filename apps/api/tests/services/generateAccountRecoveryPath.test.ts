import { describe, expect, it } from 'vitest';
import type { AccountAccessSignal } from '@recoverai/shared';
import { generateAccountRecoveryPath } from '../../src/services/accountRecovery/generateAccountRecoveryPath';

describe('generateAccountRecoveryPath', () => {
  it('OTHER platform gets a single generic, external-dependent step with no fabricated link', () => {
    const steps = generateAccountRecoveryPath('OTHER', []);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.key).toBe('other_platform');
    expect(steps[0]?.officialExternalAction).toBeNull();
    expect(steps[0]?.dependsOnExternalProvider).toBe(true);
  });

  it('PASSWORD takes precedence over every other signal on iPhone', () => {
    const steps = generateAccountRecoveryPath('IPHONE', ['PASSWORD', 'TRUSTED_DEVICE', 'RECOVERY_EMAIL']);
    expect(steps[0]?.key).toBe('sign_in_with_password');
    expect(steps[0]?.speed).toBe('FAST');
    expect(steps[0]?.dependsOnExternalProvider).toBe(false);
    expect(steps[0]?.officialExternalAction?.url).toBe('https://iforgot.apple.com');
  });

  it('TRUSTED_DEVICE without a password still resolves fast, on Apple', () => {
    const steps = generateAccountRecoveryPath('IPHONE', ['TRUSTED_DEVICE']);
    expect(steps[0]?.key).toBe('reset_via_trusted_device');
    expect(steps[0]?.speed).toBe('FAST');
  });

  it('distinguishes trusted phone number from backup codes in the step title, same key', () => {
    const viaPhone = generateAccountRecoveryPath('ANDROID', ['TRUSTED_PHONE_NUMBER']);
    const viaBackup = generateAccountRecoveryPath('ANDROID', ['BACKUP_AUTH_METHOD']);
    expect(viaPhone[0]?.key).toBe('reset_via_phone_or_backup_codes');
    expect(viaBackup[0]?.key).toBe('reset_via_phone_or_backup_codes');
    expect(viaPhone[0]?.title).toContain('phone number');
    expect(viaBackup[0]?.title).toContain('backup code');
  });

  it('RECOVERY_EMAIL alone resolves to a VARIES-speed step', () => {
    const steps = generateAccountRecoveryPath('ANDROID', ['RECOVERY_EMAIL']);
    expect(steps[0]?.key).toBe('reset_via_recovery_email');
    expect(steps[0]?.speed).toBe('VARIES');
  });

  it('no signals at all falls back to the slow, external-dependent formal recovery process', () => {
    const steps = generateAccountRecoveryPath('ANDROID', []);
    expect(steps[0]?.key).toBe('formal_account_recovery');
    expect(steps[0]?.speed).toBe('SLOW');
    expect(steps[0]?.dependsOnExternalProvider).toBe(true);
    expect(steps[0]?.officialExternalAction?.url).toBe('https://accounts.google.com/signin/recovery');
  });

  it('appends a SIM-helps-OTP step only when SIM is one of the signals', () => {
    const withSim = generateAccountRecoveryPath('IPHONE', ['PASSWORD', 'SIM']);
    const withoutSim = generateAccountRecoveryPath('IPHONE', ['PASSWORD']);
    expect(withSim.some((s) => s.key === 'sim_helps_otp')).toBe(true);
    expect(withoutSim.some((s) => s.key === 'sim_helps_otp')).toBe(false);
    expect(withSim.find((s) => s.key === 'sim_helps_otp')?.officialExternalAction).toBeNull();
  });

  it('never returns a step whose description could be mistaken for a request for a secret', () => {
    const allSignalCombos: AccountAccessSignal[][] = [
      [],
      ['PASSWORD'],
      ['TRUSTED_DEVICE'],
      ['TRUSTED_PHONE_NUMBER'],
      ['RECOVERY_EMAIL'],
      ['BACKUP_AUTH_METHOD'],
      ['SIM'],
    ];
    for (const combo of allSignalCombos) {
      for (const platform of ['ANDROID', 'IPHONE', 'OTHER'] as const) {
        const steps = generateAccountRecoveryPath(platform, combo);
        for (const step of steps) {
          expect(step.description.toLowerCase()).not.toMatch(/enter your password|send us your|share your password|reply with/);
        }
      }
    }
  });
});
