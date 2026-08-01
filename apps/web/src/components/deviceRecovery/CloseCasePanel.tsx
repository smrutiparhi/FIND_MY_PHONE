import { useState, type ReactElement } from 'react';
import type { RecoveryPlanAction } from '@recoverai/shared';
import { ActionStatusBadge } from '../recoveryCase/ActionStatusBadge';

interface CloseCasePanelProps {
  unresolvedActions: RecoveryPlanAction[];
  submitting: boolean;
  onClose: () => Promise<void>;
}

/** "Allow the user to close the case only after reviewing unresolved actions" (master spec) - the checkbox is the explicit confirmation the server requires. */
export function CloseCasePanel({ unresolvedActions, submitting, onClose }: CloseCasePanelProps): ReactElement {
  const [reviewed, setReviewed] = useState(false);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300">Close this case</h2>

      {unresolvedActions.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs text-slate-400">
            {unresolvedActions.length} action{unresolvedActions.length === 1 ? ' is' : 's are'} still unresolved:
          </p>
          <ul className="mt-2 space-y-1.5">
            {unresolvedActions.map((action) => (
              <li key={action.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-1.5">
                <span className="text-xs text-slate-300">{action.title}</span>
                <ActionStatusBadge status={action.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-xs text-emerald-400">No unresolved actions remain.</p>
      )}

      <label className="mt-4 flex items-start gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900"
        />
        <span>I&apos;ve reviewed the unresolved actions above and want to close this case anyway.</span>
      </label>

      <button
        type="button"
        disabled={!reviewed || submitting}
        onClick={() => void onClose()}
        className="mt-3 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Close case
      </button>
    </div>
  );
}
