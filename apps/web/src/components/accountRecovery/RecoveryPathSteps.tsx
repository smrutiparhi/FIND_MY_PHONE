import type { ReactElement } from 'react';
import type { AccountRecoveryStep } from '@recoverai/shared';

const SPEED_STYLES: Record<AccountRecoveryStep['speed'], string> = {
  FAST: 'glass-panel-success text-emerald-300',
  VARIES: 'border-amber-900 bg-amber-950 text-amber-300',
  SLOW: 'glass-panel-danger text-rose-300',
};

const SPEED_LABELS: Record<AccountRecoveryStep['speed'], string> = {
  FAST: 'Usually fast',
  VARIES: 'Time varies',
  SLOW: 'Can take days',
};

/** Every step here came from generateAccountRecoveryPath.ts (deterministic, not AI-generated) - see docs/ACCOUNT_RECOVERY.md. */
export function RecoveryPathSteps({ steps }: { steps: AccountRecoveryStep[] }): ReactElement {
  return (
    <div className="glass-panel p-5">
      <h2 className="text-sm font-semibold text-slate-300">Your recovery path</h2>
      <p className="mt-1 text-xs text-slate-500">
        This happens entirely through Apple/Google&apos;s own systems - RecoverAI cannot speed it up or check its
        status for you.
      </p>

      <ol className="mt-3 space-y-3">
        {steps.map((step, index) => (
          <li key={step.key} className="rounded-md border border-white/10 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-medium text-white">
                {index + 1}. {step.title}
              </p>
              <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SPEED_STYLES[step.speed]}`}>
                {SPEED_LABELS[step.speed]}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{step.description}</p>
            {step.officialExternalAction?.url ? (
              <a
                href={step.officialExternalAction.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center text-xs font-medium text-cyan-300 hover:underline"
              >
                {step.officialExternalAction.label}
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
