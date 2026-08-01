import type { ReactElement } from 'react';
import type { FinancialProtectionStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<FinancialProtectionStatus, string> = {
  NOT_STARTED: 'border-white/15 bg-white/5 text-slate-400',
  IN_PROGRESS: 'border-amber-900 bg-amber-950 text-amber-300',
  CONFIRMED_BY_USER: 'glass-panel-success text-emerald-300',
  CONFIRMED_BY_INTEGRATION: 'glass-panel-success text-emerald-300',
};

const STATUS_LABELS: Record<FinancialProtectionStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  CONFIRMED_BY_USER: 'Confirmed by you',
  CONFIRMED_BY_INTEGRATION: 'Confirmed automatically',
};

export function FinancialItemStatusBadge({ status }: { status: FinancialProtectionStatus }): ReactElement {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
