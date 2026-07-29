import type { ReactElement } from 'react';
import type { RecoveryPlanAction } from '@recoverai/shared';

/** Title only, on purpose - "do not display a huge checklist during emergency mode." */
export function NextActionPreview({ action }: { action: RecoveryPlanAction | null }): ReactElement {
  if (!action) {
    return <p className="text-sm text-slate-500">No further protections queued after this.</p>;
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 p-3">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Up next</p>
      <p className="mt-1 text-sm text-slate-300">{action.title}</p>
      {action.status === 'BLOCKED' ? <p className="mt-0.5 text-xs text-slate-600">Unlocks once the current step is done.</p> : null}
    </div>
  );
}
