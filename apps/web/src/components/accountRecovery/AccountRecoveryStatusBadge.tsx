import type { ReactElement } from 'react';
import type { AccountRecoveryStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<AccountRecoveryStatus, string> = {
  NOT_STARTED: 'border-slate-700 bg-slate-800 text-slate-400',
  IN_PROGRESS: 'border-amber-900 bg-amber-950 text-amber-300',
  WAITING: 'border-sky-900 bg-sky-950 text-sky-300',
  RECOVERED: 'border-emerald-900 bg-emerald-950 text-emerald-300',
  FAILED: 'border-red-900 bg-red-950 text-red-300',
};

const STATUS_LABELS: Record<AccountRecoveryStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting on provider',
  RECOVERED: 'Access restored',
  FAILED: 'Not successful yet',
};

export function AccountRecoveryStatusBadge({ status }: { status: AccountRecoveryStatus }): ReactElement {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
