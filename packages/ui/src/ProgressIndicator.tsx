import type { ReactElement } from 'react';

export interface ProgressStep {
  id: string;
  label: string;
  done: boolean;
  blocked?: boolean;
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  title?: string;
}

/**
 * "Display a Recovery Progress indicator based on meaningful required
 * actions, not arbitrary percentages" (master spec) - a literal checklist,
 * not a computed percentage bar, plus a slim glowing completion rail above
 * it for at-a-glance progress.
 */
export function ProgressIndicator({ steps, title }: ProgressIndicatorProps): ReactElement {
  const total = steps.length;
  const completed = steps.filter((s) => s.done).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      {title ? (
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-300">{title}</p>
          <p className="font-mono-data text-xs text-slate-500">
            {completed}/{total}
          </p>
        </div>
      ) : null}

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 shadow-[0_0_10px_rgba(34,211,238,0.6)] transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1.5">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <span
              className={
                step.done
                  ? 'flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-[10px] text-emerald-300'
                  : 'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px] text-transparent'
              }
              aria-hidden="true"
            >
              {step.done ? '✓' : '·'}
            </span>
            <span className={step.done ? 'text-slate-500 line-through decoration-slate-700' : 'text-slate-200'}>{step.label}</span>
            {!step.done && step.blocked ? <span className="text-xs text-slate-600">(blocked)</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
