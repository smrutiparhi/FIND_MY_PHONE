import { useState, type ReactElement } from 'react';
import type { PoliceReportStatus } from '@recoverai/shared';

const BUTTON_CLASSES =
  'rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50';

interface PoliceReportApprovalActionsProps {
  status: PoliceReportStatus;
  submitting: boolean;
  onRegenerate: () => void;
  onApprove: () => Promise<void>;
  onMarkSubmitted: (externalReferenceNumber: string | null) => Promise<void>;
}

/** "The user must approve the final text" and "do not claim the complaint has been submitted unless an official integration confirms submission" (master spec) - both approve and mark-submitted are explicit, confirmed user actions, never automatic. */
export function PoliceReportApprovalActions({
  status,
  submitting,
  onRegenerate,
  onApprove,
  onMarkSubmitted,
}: PoliceReportApprovalActionsProps): ReactElement {
  const [confirmingApprove, setConfirmingApprove] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');

  if (confirmingApprove) {
    return (
      <div className="rounded-md border border-cyan-400/30 bg-cyan-400/10 p-3">
        <p className="text-xs text-sky-200">
          Approving confirms this text is accurate and ready to file. You can still edit it afterward - editing
          reopens it as a draft.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onApprove().then(() => setConfirmingApprove(false))}
            className="rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Yes, approve
          </button>
          <button type="button" onClick={() => setConfirmingApprove(false)} className={BUTTON_CLASSES}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (confirmingSubmit) {
    return (
      <div className="glass-panel-success p-3">
        <p className="text-xs text-emerald-200">
          Only confirm once you&apos;ve actually filed this yourself (in person or via an official portal).
          RecoverAI never files it for you.
        </p>
        <input
          type="text"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="FIR / reference number (optional)"
          maxLength={100}
          className="mt-2 w-full rounded-md input-field px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onMarkSubmitted(referenceNumber.trim() === '' ? null : referenceNumber.trim()).then(() => setConfirmingSubmit(false))}
            className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Yes, I&apos;ve filed it
          </button>
          <button type="button" onClick={() => setConfirmingSubmit(false)} className={BUTTON_CLASSES}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={submitting} onClick={onRegenerate} className={BUTTON_CLASSES}>
        Regenerate with updated facts
      </button>
      {status === 'DRAFT' ? (
        <button type="button" disabled={submitting} onClick={() => setConfirmingApprove(true)} className={BUTTON_CLASSES}>
          Approve
        </button>
      ) : null}
      {status !== 'USER_MARKED_SUBMITTED' ? (
        <button type="button" disabled={submitting} onClick={() => setConfirmingSubmit(true)} className={BUTTON_CLASSES}>
          Mark as filed
        </button>
      ) : null}
    </div>
  );
}
