import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface WizardShellProps {
  title: string;
  subtitle?: string;
  stepNumber: number;
  totalSteps: number;
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  children: ReactNode;
}

/** Shared chrome for every wizard step: progress bar, Back/Continue, and a Cancel escape hatch. */
export function WizardShell({
  title,
  subtitle,
  stepNumber,
  totalSteps,
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
  children,
}: WizardShellProps): ReactElement {
  const progressPercent = Math.round((stepNumber / totalSteps) * 100);

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-sm font-medium text-slate-400 hover:text-slate-200">
            Cancel
          </Link>
          <p className="text-xs font-medium text-slate-500">
            Step {stepNumber} of {totalSteps}
          </p>
        </div>

        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-sky-500 transition-[width]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex-1">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>

        <div className="mt-8 flex gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="flex-1 rounded-md bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {nextLabel ?? 'Continue'}
          </button>
        </div>
      </div>
    </main>
  );
}
