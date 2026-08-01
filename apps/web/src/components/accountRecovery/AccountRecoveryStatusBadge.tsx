import type { ReactElement } from 'react';
import type { AccountRecoveryStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<AccountRecoveryStatus, string> = {
  NOT_STARTED: 'border-white/15 bg-white/5 text-slate-400',
  IN_PROGRESS: 'border-amber-900 bg-amber-950 text-amber-300',
  WAITING: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  RECOVERED: 'glass-panel-success text-emerald-300',
  FAILED: 'glass-panel-danger text-rose-300',
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
