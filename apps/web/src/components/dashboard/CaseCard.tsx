import type { ReactElement } from 'react';
import type { DashboardCaseSummary, IncidentType, PlatformType } from '@recoverai/shared';
import { RiskBadge } from './RiskBadge';
import { CaseStatusBadge } from './CaseStatusBadge';
import { formatRelativeTime } from '../../lib/formatRelativeTime';

const INCIDENT_LABELS: Record<IncidentType, string> = {
  LOST: 'Lost',
  STOLEN: 'Stolen',
  UNSURE: 'Unsure',
};

const PLATFORM_LABELS: Record<PlatformType, string> = {
  ANDROID: 'Android',
  IPHONE: 'iPhone',
  OTHER: 'Other device',
};

/** Full detail card for an active case - the fields the master spec's Part 4 names explicitly. */
export function CaseCard({ summary }: { summary: DashboardCaseSummary }): ReactElement {
  const { device, location, securityProgress, currentRecommendedAction } = summary;

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {INCIDENT_LABELS[summary.incidentType]} &middot; {PLATFORM_LABELS[device.platform]}
          </p>
          <h3 className="text-lg font-semibold text-white">{device.nickname}</h3>
          <p className="text-sm text-slate-400">
            {device.manufacturer} {device.model}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <RiskBadge riskLevel={summary.riskLevel} />
          <CaseStatusBadge status={summary.status} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-800 pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Location</dt>
          <dd className="text-slate-200">
            {location.lastObservedAt ? `Last observed ${formatRelativeTime(location.lastObservedAt)}` : 'Not available yet'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Security progress</dt>
          <dd className="text-slate-200">
            {securityProgress.totalActions > 0
              ? `${securityProgress.completedActions} of ${securityProgress.totalActions} steps complete`
              : 'Not started yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-md border border-sky-900 bg-sky-950/50 p-3">
        <p className="text-xs font-medium tracking-wide text-sky-400 uppercase">Next action</p>
        <p className="mt-0.5 text-sm font-medium text-white">
          {currentRecommendedAction ? currentRecommendedAction.title : 'No action recommended right now'}
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-500">Last update: {formatRelativeTime(summary.updatedAt)}</p>
    </article>
  );
}
