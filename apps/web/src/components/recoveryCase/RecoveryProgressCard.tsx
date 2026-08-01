import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { RecoveryCaseId, RecoveryPlan } from '@recoverai/shared';
import { RiskBadge, ProgressIndicator, NextActionCard, buttonClasses } from '@recoverai/ui';
import { DASHBOARD_SECTIONS, PROGRESS_EXCLUDED_ACTION_TYPES } from './dashboardSections';

interface RecoveryProgressCardProps {
  caseId: RecoveryCaseId;
  plan: RecoveryPlan;
  submitting: boolean;
  onMarkActionDone: (actionId: string) => Promise<void>;
}

const DONE_STATUSES = new Set(['COMPLETED', 'SKIPPED']);

/**
 * "Display a Recovery Progress indicator based on meaningful required
 * actions, not arbitrary percentages" (master spec) - a literal checklist,
 * not a computed percentage, matching the spec's own worked example almost
 * verbatim. "The largest CTA should always be the Recovery Decision
 * Engine's current recommended action" - the block below the checklist,
 * sized and colored to be the obvious next click on the page.
 */
export function RecoveryProgressCard({ caseId, plan, submitting, onMarkActionDone }: RecoveryProgressCardProps): ReactElement {
  const checklist = plan.orderedActions.filter((a) => !PROGRESS_EXCLUDED_ACTION_TYPES.includes(a.type));
  const steps = checklist.map((action) => ({
    id: action.id,
    label: action.title,
    done: DONE_STATUSES.has(action.status),
    blocked: action.status === 'BLOCKED',
  }));

  const next = plan.currentRecommendedAction;
  const section = next ? DASHBOARD_SECTIONS.find((s) => s.actionType === next.type) : undefined;
  const nextRoute = section?.route ? section.route(caseId) : null;
  const nextExternalUrl = next?.officialExternalAction?.url ?? null;
  const ctaClasses = buttonClasses('primary', 'md');

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold text-slate-300">Recovery progress</h2>
        <RiskBadge riskLevel={plan.riskLevel} />
      </div>

      <div className="mt-4">
        <ProgressIndicator steps={steps} />
      </div>

      {next ? (
        <div className="mt-5">
          <NextActionCard
            title={next.title}
            reason={next.reason}
            cta={
              nextRoute ? (
                <Link to={nextRoute} className={ctaClasses}>
                  Continue
                </Link>
              ) : nextExternalUrl ? (
                <a href={nextExternalUrl} target="_blank" rel="noreferrer" className={ctaClasses}>
                  {next.officialExternalAction?.label ?? 'Continue'}
                </a>
              ) : next.type === 'MONITOR' ? (
                <Link to={`/recovery-cases/${caseId}/timeline`} className={ctaClasses}>
                  Open timeline
                </Link>
              ) : (
                <button type="button" disabled={submitting} onClick={() => void onMarkActionDone(next.id)} className={ctaClasses}>
                  Mark as done
                </button>
              )
            }
          />
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-400">No further action is currently recommended.</p>
      )}
    </div>
  );
}
