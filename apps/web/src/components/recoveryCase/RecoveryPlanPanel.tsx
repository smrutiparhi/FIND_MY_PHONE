import type { ReactElement } from 'react';
import type { RecoveryPlan } from '@recoverai/shared';
import { RiskBadge, RecoveryActionCard, VerificationTag } from '@recoverai/ui';

/** The live Recovery Decision Engine output (Part 6) for one case - riskReasons and orderedActions are explained, never recomputed, by the AI Recovery Agent next to it. */
export function RecoveryPlanPanel({ plan }: { plan: RecoveryPlan }): ReactElement {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold text-slate-300">Recovery plan</h2>
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
        <div className="mt-3 space-y-1 glass-panel-danger p-3">
          {plan.warnings.map((warning) => (
            <p key={warning} className="text-xs text-rose-300">
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {plan.orderedActions.map((action) => (
          <RecoveryActionCard key={action.id} action={action} isCurrent={plan.currentRecommendedAction?.id === action.id} showInstructions />
        ))}
      </ul>
    </div>
  );
}
