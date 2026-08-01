import type { ReactElement } from 'react';
import type { RecoveryPlanAction } from '@recoverai/shared';
import { ActionStatusBadge } from './ActionStatusBadge';
import { VerificationTag } from './VerificationTag';

interface RecoveryActionCardProps {
  action: RecoveryPlanAction;
  isCurrent?: boolean;
  showInstructions?: boolean;
}

export function RecoveryActionCard({ action, isCurrent = false, showInstructions = false }: RecoveryActionCardProps): ReactElement {
  return (
    <li className={`glass-panel-hover rounded-2xl border p-3 transition ${isCurrent ? 'border-cyan-400/50 bg-cyan-400/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-white">{action.title}</p>
        <ActionStatusBadge status={action.status} />
      </div>
      <p className="mt-1 text-xs text-slate-400">{action.reason}</p>
      {showInstructions && action.instructions ? <p className="mt-1 text-xs text-slate-500">{action.instructions}</p> : null}
      {action.status === 'BLOCKED' && action.dependencies.length > 0 ? (
        <p className="mt-1 text-xs text-slate-500">Waiting on: {action.dependencies.join(', ')}</p>
      ) : null}
      {action.officialExternalAction ? (
        <div className="mt-2 flex items-center gap-2">
          <VerificationTag kind="external" />
          {action.officialExternalAction.url ? (
            <a
              href={action.officialExternalAction.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-cyan-300 hover:underline"
            >
              {action.officialExternalAction.label}
            </a>
          ) : (
            <span className="text-xs text-slate-400">{action.officialExternalAction.label}</span>
          )}
        </div>
      ) : null}
    </li>
  );
}
