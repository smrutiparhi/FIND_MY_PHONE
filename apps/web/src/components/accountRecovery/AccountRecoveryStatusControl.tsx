import { useState, type ReactElement } from 'react';
import type { AccountRecoveryStatus, UserSettableAccountRecoveryStatus } from '@recoverai/shared';

interface AccountRecoveryStatusControlProps {
  status: AccountRecoveryStatus;
  submitting: boolean;
  onChangeStatus: (status: UserSettableAccountRecoveryStatus) => Promise<void>;
}

const BUTTON_CLASSES =
  'rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50';

/** RECOVERED requires an explicit confirmation, since it completes the case's account-recovery action and re-runs the Recovery Decision Engine. */
export function AccountRecoveryStatusControl({ status, submitting, onChangeStatus }: AccountRecoveryStatusControlProps): ReactElement | null {
  const [confirmingRecovered, setConfirmingRecovered] = useState(false);

  if (status === 'RECOVERED') return null;

  if (confirmingRecovered) {
    return (
      <div className="glass-panel-success p-3">
        <p className="text-xs text-emerald-200">
          This marks the account-recovery step complete and updates your risk level. Only confirm once you can
          actually sign in.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onChangeStatus('RECOVERED').then(() => setConfirmingRecovered(false))}
            className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Yes, I&apos;m back in
          </button>
          <button type="button" onClick={() => setConfirmingRecovered(false)} className={BUTTON_CLASSES}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'WAITING' ? (
        <button type="button" disabled={submitting} onClick={() => void onChangeStatus('WAITING')} className={BUTTON_CLASSES}>
          I&apos;m waiting to hear back
        </button>
      ) : null}
      <button type="button" disabled={submitting} onClick={() => setConfirmingRecovered(true)} className={BUTTON_CLASSES}>
        I&apos;ve regained access
      </button>
      {status !== 'FAILED' ? (
        <button type="button" disabled={submitting} onClick={() => void onChangeStatus('FAILED')} className={BUTTON_CLASSES}>
          This didn&apos;t work
        </button>
      ) : null}
    </div>
  );
}
