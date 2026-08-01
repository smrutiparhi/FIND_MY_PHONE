import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import type { AccountAccessSignal } from '@recoverai/shared';

const SIGNAL_OPTIONS: { value: AccountAccessSignal; label: string }[] = [
  { value: 'PASSWORD', label: 'Your password' },
  { value: 'TRUSTED_DEVICE', label: 'A trusted, signed-in device' },
  { value: 'TRUSTED_PHONE_NUMBER', label: 'Your trusted phone number' },
  { value: 'RECOVERY_EMAIL', label: 'Your recovery email' },
  { value: 'SIM', label: 'This phone number / SIM' },
  { value: 'BACKUP_AUTH_METHOD', label: 'Backup codes or an authenticator app' },
];

interface AccessChecklistFormProps {
  initialSignals: AccountAccessSignal[];
  submitting: boolean;
  onSubmit: (signals: AccountAccessSignal[]) => Promise<void>;
}

/**
 * Every option here is a possession check ("do you still have this"), never
 * a field that could collect the thing itself - master spec: "Never ask the
 * user to send RecoverAI their account password, OTP, authentication code,
 * recovery key or other secret."
 */
export function AccessChecklistForm({ initialSignals, submitting, onSubmit }: AccessChecklistFormProps): ReactElement {
  const [signals, setSignals] = useState<Set<AccountAccessSignal>>(new Set(initialSignals));

  useEffect(() => {
    setSignals(new Set(initialSignals));
  }, [initialSignals]);

  function toggle(value: AccountAccessSignal): void {
    setSignals((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    await onSubmit(Array.from(signals));
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 glass-panel p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-300">What do you still have access to?</h2>
        <p className="mt-1 text-xs text-slate-500">
          Check anything that applies. We only need to know what you still have - never the password, code, or key
          itself.
        </p>
      </div>

      <div className="space-y-2">
        {SIGNAL_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 p-2.5 hover:bg-white/10">
            <input type="checkbox" checked={signals.has(opt.value)} onChange={() => toggle(opt.value)} />
            <span className="text-sm text-slate-200">{opt.label}</span>
          </label>
        ))}
      </div>

      {signals.size === 0 ? <p className="text-xs text-slate-500">Nothing checked means &quot;none of these / not sure&quot; - that&apos;s fine.</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Save and get my recovery path'}
      </button>
    </form>
  );
}
