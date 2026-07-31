import type { ReactElement } from 'react';
import type { PoliceReportStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<PoliceReportStatus, string> = {
  DRAFT: 'border-slate-700 bg-slate-800 text-slate-400',
  APPROVED: 'border-sky-900 bg-sky-950 text-sky-300',
  USER_MARKED_SUBMITTED: 'border-emerald-900 bg-emerald-950 text-emerald-300',
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
