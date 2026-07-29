import type { ReactElement } from 'react';
import type { RecoveryActionStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<RecoveryActionStatus, string> = {
  PENDING: 'border-sky-900 bg-sky-950 text-sky-300',
  BLOCKED: 'border-slate-700 bg-slate-800 text-slate-400',
  IN_PROGRESS: 'border-amber-900 bg-amber-950 text-amber-300',
  COMPLETED: 'border-emerald-900 bg-emerald-950 text-emerald-300',
  SKIPPED: 'border-slate-700 bg-slate-800 text-slate-500',
};

const STATUS_LABELS: Record<RecoveryActionStatus, string> = {
  PENDING: 'Pending',
  BLOCKED: 'Blocked',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
};

export function ActionStatusBadge({ status }: { status: RecoveryActionStatus }): ReactElement {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
