import type { ReactElement } from 'react';
import type { RecoveryActionStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<RecoveryActionStatus, string> = {
  PENDING: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
  BLOCKED: 'border-white/15 bg-white/5 text-slate-400',
  IN_PROGRESS: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  COMPLETED: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  SKIPPED: 'border-white/15 bg-white/5 text-slate-500',
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
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
