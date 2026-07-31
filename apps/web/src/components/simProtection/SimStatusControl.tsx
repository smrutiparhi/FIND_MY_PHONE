import { useState, type ReactElement } from 'react';
import type { SimStatus, UserSettableSimStatus } from '@recoverai/shared';

interface SimStatusControlProps {
  status: SimStatus;
  submitting: boolean;
  onChangeStatus: (status: UserSettableSimStatus) => Promise<void>;
}

const BUTTON_CLASSES =
  'rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

/** BLOCKED and REPLACED both complete the case's SIM_PROTECTION action, so both go through an explicit confirm - "require confirmation before marking critical external actions completed" (master spec). */
export function SimStatusControl({ status, submitting, onChangeStatus }: SimStatusControlProps): ReactElement | null {
  const [confirmingTarget, setConfirmingTarget] = useState<'BLOCKED' | 'REPLACED' | null>(null);

  if (status === 'REPLACED') return null;

  if (confirmingTarget) {
    const label = confirmingTarget === 'BLOCKED' ? 'your carrier confirmed the SIM is blocked' : 'you have your replacement SIM in hand';
    return (
      <div className="rounded-md border border-emerald-900 bg-emerald-950/40 p-3">
        <p className="text-xs text-emerald-200">Only confirm once {label}.</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onChangeStatus(confirmingTarget).then(() => setConfirmingTarget(null))}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Yes, confirmed
          </button>
          <button type="button" onClick={() => setConfirmingTarget(null)} className={BUTTON_CLASSES}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'ACTIVE' || status === 'UNKNOWN' ? (
        <button type="button" disabled={submitting} onClick={() => void onChangeStatus('BLOCK_REQUESTED')} className={BUTTON_CLASSES}>
          I&apos;ve requested a block
        </button>
      ) : null}
      {status === 'BLOCK_REQUESTED' ? (
        <button type="button" disabled={submitting} onClick={() => setConfirmingTarget('BLOCKED')} className={BUTTON_CLASSES}>
          Carrier confirmed it&apos;s blocked
        </button>
      ) : null}
      {status === 'BLOCK_REQUESTED' || status === 'BLOCKED' ? (
        <button type="button" disabled={submitting} onClick={() => void onChangeStatus('REPLACEMENT_PENDING')} className={BUTTON_CLASSES}>
          I&apos;ve requested a replacement SIM
        </button>
      ) : null}
      {status === 'REPLACEMENT_PENDING' ? (
        <button type="button" disabled={submitting} onClick={() => setConfirmingTarget('REPLACED')} className={BUTTON_CLASSES}>
          I have my replacement SIM
        </button>
      ) : null}
    </div>
  );
}
