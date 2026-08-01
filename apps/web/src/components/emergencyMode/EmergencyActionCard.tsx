import { useState, type ReactElement } from 'react';
import type { RecoveryPlanAction } from '@recoverai/shared';

interface EmergencyActionCardProps {
  action: RecoveryPlanAction;
  submitting: boolean;
  onMarkDone: () => Promise<void>;
}

/** "Require confirmation before marking critical external actions completed" (master spec) - every action shown here is the one critical thing to do right now, so every completion goes through the same two-step confirm. */
export function EmergencyActionCard({ action, submitting, onMarkDone }: EmergencyActionCardProps): ReactElement {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="glass-panel-danger p-5">
      <p className="text-xs font-semibold tracking-wide text-rose-400 uppercase">Do this now</p>
      <h2 className="mt-1 text-xl font-semibold text-white">{action.title}</h2>
      <p className="mt-2 text-sm text-slate-300">{action.reason}</p>
      <p className="mt-2 text-sm text-slate-400">{action.instructions}</p>

      {action.officialExternalAction?.url ? (
        <a
          href={action.officialExternalAction.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          {action.officialExternalAction.label}
        </a>
      ) : null}

      <div className="mt-4">
        {confirming ? (
          <div className="glass-panel-success p-3">
            <p className="text-xs text-emerald-200">Only confirm once you&apos;ve actually finished this step.</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onMarkDone().then(() => setConfirming(false))}
                className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Yes, this is done
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() => setConfirming(true)}
            className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark as done
          </button>
        )}
      </div>
    </div>
  );
}
