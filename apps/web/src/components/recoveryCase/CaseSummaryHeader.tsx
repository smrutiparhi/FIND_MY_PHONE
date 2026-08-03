import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { Device, LocationObservation, RecoveryCase } from '@recoverai/shared';
import { formatRelativeTime } from '@recoverai/shared';
import { RiskBadge, CaseStatusBadge, DemoDataBadge } from '@recoverai/ui';

const INCIDENT_LABELS: Record<RecoveryCase['incidentType'], string> = {
  LOST: 'Lost',
  STOLEN: 'Stolen',
  UNSURE: 'Unsure',
};

interface CaseSummaryHeaderProps {
  recoveryCase: RecoveryCase;
  device: Device;
  latestLocation: LocationObservation | null;
}

/** "The top should show: device, LOST/STOLEN status, risk level, case status, last location status, last update" (master spec, verbatim). */
export function CaseSummaryHeader({ recoveryCase, device, latestLocation }: CaseSummaryHeaderProps): ReactElement {
  return (
    <div>
      <Link to="/dashboard" className="text-xs text-slate-500 hover:text-slate-300">
        &larr; Back to dashboard
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{INCIDENT_LABELS[recoveryCase.incidentType]}</p>
            {recoveryCase.isDemo ? <DemoDataBadge /> : null}
          </div>
          <h1 className="text-2xl font-semibold text-white">{device.nickname}</h1>
          <p className="text-sm text-slate-400">
            {device.manufacturer} {device.model}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <RiskBadge riskLevel={recoveryCase.riskLevel} />
          <CaseStatusBadge status={recoveryCase.status} />
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
        <div>
          <dt className="inline text-slate-600">Last location: </dt>
          <dd className="inline">
            {latestLocation ? formatRelativeTime(latestLocation.observedAt) : 'No location on file'}
          </dd>
        </div>
        <div>
          <dt className="inline text-slate-600">Last update: </dt>
          <dd className="inline">{formatRelativeTime(recoveryCase.updatedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}
