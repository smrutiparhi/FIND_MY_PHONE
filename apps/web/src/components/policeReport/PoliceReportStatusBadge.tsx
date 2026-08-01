import type { ReactElement } from 'react';
import type { PoliceReportStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<PoliceReportStatus, string> = {
  DRAFT: 'border-white/15 bg-white/5 text-slate-400',
  APPROVED: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  USER_MARKED_SUBMITTED: 'glass-panel-success text-emerald-300',
};

const STATUS_LABELS: Record<PoliceReportStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  USER_MARKED_SUBMITTED: 'Filed (self-reported)',
};

export function PoliceReportStatusBadge({ status }: { status: PoliceReportStatus }): ReactElement {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
