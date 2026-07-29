import type { ReactElement } from 'react';
import type { RecoveryPlan, RecoveryPlanAction } from '@recoverai/shared';
import { RiskBadge } from '../dashboard/RiskBadge';
import { ActionStatusBadge } from './ActionStatusBadge';
import { VerificationTag } from './VerificationTag';

function ActionRow({ action, isCurrent }: { action: RecoveryPlanAction; isCurrent: boolean }): ReactElement {
  return (
    <li className={`rounded-md border p-3 ${isCurrent ? 'border-sky-800 bg-sky-950/40' : 'border-slate-800 bg-slate-900'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-white">{action.title}</p>
        <ActionStatusBadge status={action.status} />
      </div>
      <p className="mt-1 text-xs text-slate-400">{action.reason}</p>
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
              className="text-xs font-medium text-sky-400 hover:underline"
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

/** The live Recovery Decision Engine output (Part 6) for one case - riskReasons and orderedActions are explained, never recomputed, by the AI Recovery Agent next to it. */
export function RecoveryPlanPanel({ plan }: { plan: RecoveryPlan }): ReactElement {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-300">Recovery plan</h2>
        <div className="flex items-center gap-2">
          <VerificationTag kind="system" />
          <RiskBadge riskLevel={plan.riskLevel} />
        </div>
      </div>

      {plan.riskReasons.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-400">
          {plan.riskReasons.map((reason) => (
            <li key={reason}>- {reason}</li>
          ))}
        </ul>
      ) : null}

      {plan.warnings.length > 0 ? (
        <div className="mt-3 space-y-1 rounded-md border border-red-900 bg-red-950/60 p-3">
          {plan.warnings.map((warning) => (
            <p key={warning} className="text-xs text-red-300">
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {plan.orderedActions.map((action) => (
          <ActionRow key={action.id} action={action} isCurrent={plan.currentRecommendedAction?.id === action.id} />
        ))}
      </ul>
    </div>
  );
}
