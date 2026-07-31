import { useState, type ReactElement } from 'react';
import type { CeirStatus, UserSettableCeirStatus } from '@recoverai/shared';

const BUTTON_CLASSES =
  'rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

const CRITICAL_LABELS: Record<'SUBMITTED' | 'BLOCKED' | 'UNBLOCKED', string> = {
  SUBMITTED: 'you have actually submitted the CEIR request and recorded its Request ID below',
  BLOCKED: 'the CEIR portal has confirmed your IMEI is blocked',
  UNBLOCKED: 'the CEIR portal has confirmed your IMEI is unblocked',
};

/**
 * SUBMITTED, BLOCKED, and UNBLOCKED each go through an explicit confirm -
 * "require confirmation before marking critical external actions completed"
 * (master spec), same discipline as Parts 9-12. Every transition is the
 * user reporting what the CEIR portal told them, never RecoverAI claiming
 * to have done it.
 */
export function CeirStatusControl({
  status,
  submitting,
  onChangeStatus,
}: {
  status: CeirStatus;
  submitting: boolean;
  onChangeStatus: (status: UserSettableCeirStatus) => Promise<void>;
}): ReactElement {
  const [confirmingTarget, setConfirmingTarget] = useState<'SUBMITTED' | 'BLOCKED' | 'UNBLOCKED' | null>(null);

  if (confirmingTarget) {
    return (
      <div className="rounded-md border border-emerald-900 bg-emerald-950/40 p-3">
        <p className="text-xs text-emerald-200">Only confirm once {CRITICAL_LABELS[confirmingTarget]}.</p>
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
      {status === 'NOT_READY' ? (
        <button type="button" disabled={submitting} onClick={() => void onChangeStatus('READY')} className={BUTTON_CLASSES}>
          I&apos;m ready to submit
        </button>
      ) : null}
      {status === 'NOT_READY' || status === 'READY' || status === 'UNKNOWN' ? (
        <button type="button" disabled={submitting} onClick={() => setConfirmingTarget('SUBMITTED')} className={BUTTON_CLASSES}>
          I&apos;ve submitted my CEIR request
        </button>
      ) : null}
      {status === 'SUBMITTED' ? (
        <button type="button" disabled={submitting} onClick={() => void onChangeStatus('PROCESSING')} className={BUTTON_CLASSES}>
          It&apos;s processing
        </button>
      ) : null}
      {status === 'SUBMITTED' || status === 'PROCESSING' ? (
        <button type="button" disabled={submitting} onClick={() => setConfirmingTarget('BLOCKED')} className={BUTTON_CLASSES}>
          My IMEI has been blocked
        </button>
      ) : null}
      {status === 'BLOCKED' ? (
        <button type="button" disabled={submitting} onClick={() => void onChangeStatus('UNBLOCK_REQUESTED')} className={BUTTON_CLASSES}>
          I&apos;ve got my device back - request unblock
        </button>
      ) : null}
      {status === 'BLOCKED' || status === 'UNBLOCK_REQUESTED' ? (
        <button type="button" disabled={submitting} onClick={() => setConfirmingTarget('UNBLOCKED')} className={BUTTON_CLASSES}>
          My IMEI has been unblocked
        </button>
      ) : null}
      {status !== 'UNKNOWN' && status !== 'UNBLOCKED' ? (
        <button type="button" disabled={submitting} onClick={() => void onChangeStatus('UNKNOWN')} className={BUTTON_CLASSES}>
          I&apos;m not sure of the status
        </button>
      ) : null}
    </div>
  );
}
