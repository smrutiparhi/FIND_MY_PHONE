import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { RecoveryPlanAction } from '@recoverai/shared';
import { ActionStatusBadge } from './ActionStatusBadge';

interface DashboardSectionCardProps {
  label: string;
  action: RecoveryPlanAction | undefined;
  route: string | null;
  isCurrent: boolean;
}

/** One of Part 17's main sections (LOCATION/SECURITY/SIM/...) - a compact status card, not the full detail RecoveryPlanPanel already shows below. */
export function DashboardSectionCard({ label, action, route, isCurrent }: DashboardSectionCardProps): ReactElement {
  return (
    <div className={`rounded-lg border p-4 ${isCurrent ? 'border-sky-800 bg-sky-950/30' : 'border-slate-800 bg-slate-900'}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">{label}</h3>
        {action ? <ActionStatusBadge status={action.status} /> : null}
      </div>

      {action ? (
        <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">{action.reason}</p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500">Not currently applicable to this case.</p>
      )}

      <div className="mt-3">
        {route ? (
          <Link to={route} className="text-xs font-medium text-sky-400 hover:underline">
            View &rarr;
          </Link>
        ) : action?.officialExternalAction?.url ? (
          <a
            href={action.officialExternalAction.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-sky-400 hover:underline"
          >
            {action.officialExternalAction.label} &rarr;
          </a>
        ) : (
          <span className="text-xs text-slate-600">No dedicated page yet</span>
        )}
      </div>
    </div>
  );
}
