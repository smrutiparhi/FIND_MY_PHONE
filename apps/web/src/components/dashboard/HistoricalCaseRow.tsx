import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardCaseSummary } from '@recoverai/shared';
import { formatRelativeTime } from '@recoverai/shared';
import { CaseStatusBadge } from '@recoverai/ui';

/** Compact row for closed/recovered/erased cases - full CaseCard detail isn't needed once a case is finished. */
export function HistoricalCaseRow({ summary }: { summary: DashboardCaseSummary }): ReactElement {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-1 py-3 last:border-b-0">
      <Link to={`/recovery-cases/${summary.caseId}`} className="min-w-0 hover:underline">
        <p className="text-sm font-medium text-slate-200">{summary.device.nickname}</p>
        <p className="text-xs text-slate-500">
          {summary.device.manufacturer} {summary.device.model}
        </p>
      </Link>
      <div className="flex items-center gap-2">
        <CaseStatusBadge status={summary.status} />
        <span className="text-xs text-slate-500">{formatRelativeTime(summary.updatedAt)}</span>
      </div>
    </li>
  );
}
