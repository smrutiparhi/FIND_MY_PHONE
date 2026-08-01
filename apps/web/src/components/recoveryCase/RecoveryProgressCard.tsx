import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { RecoveryCaseId, RecoveryPlan } from '@recoverai/shared';
import { RiskBadge } from '../dashboard/RiskBadge';
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
 * actions, not arbitrary percentages" (master spec) - a literal checklist
 * (checkmark or "pending"), not a computed percentage, matching the spec's
 * own worked example almost verbatim. "The largest CTA should always be the
 * Recovery Decision Engine's current recommended action" - the block below
 * the checklist, sized and colored to be the obvious next click on the page.
 */
export function RecoveryProgressCard({ caseId, plan, submitting, onMarkActionDone }: RecoveryProgressCardProps): ReactElement {
  const checklist = plan.orderedActions.filter((a) => !PROGRESS_EXCLUDED_ACTION_TYPES.includes(a.type));
  const next = plan.currentRecommendedAction;
  const section = next ? DASHBOARD_SECTIONS.find((s) => s.actionType === next.type) : undefined;
  const nextRoute = section?.route ? section.route(caseId) : null;
  const nextExternalUrl = next?.officialExternalAction?.url ?? null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-300">Recovery progress</h2>
        <RiskBadge riskLevel={plan.riskLevel} />
      </div>

      <ul className="mt-4 space-y-1.5">
        {checklist.map((action) => {
          const done = DONE_STATUSES.has(action.status);
          return (
            <li key={action.id} className="flex items-center gap-2 text-sm">
              <span className={done ? 'text-emerald-400' : 'text-slate-600'} aria-hidden="true">
                {done ? '✓' : '○'}
              </span>
              <span className={done ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-200'}>{action.title}</span>
              {!done && action.status === 'BLOCKED' ? <span className="text-xs text-slate-600">(blocked)</span> : null}
            </li>
          );
        })}
      </ul>

      {next ? (
        <div className="mt-5 rounded-md border border-sky-800 bg-sky-950/50 p-4">
          <p className="text-xs font-semibold tracking-wide text-sky-400 uppercase">Next action</p>
          <p className="mt-1 text-base font-semibold text-white">{next.title}</p>
          <p className="mt-1 text-xs text-sky-200/80">{next.reason}</p>
          <div className="mt-3">
            {nextRoute ? (
              <Link
                to={nextRoute}
                className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
              >
                Continue
              </Link>
            ) : nextExternalUrl ? (
              <a
                href={nextExternalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
              >
                {next.officialExternalAction?.label ?? 'Continue'}
              </a>
            ) : next.type === 'MONITOR' ? (
              <Link
                to={`/recovery-cases/${caseId}/timeline`}
                className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
              >
                Open timeline
              </Link>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onMarkActionDone(next.id)}
                className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark as done
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-400">No further action is currently recommended.</p>
      )}
    </div>
  );
}
