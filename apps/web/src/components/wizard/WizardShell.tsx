import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@recoverai/ui';

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
    <main className="flex min-h-screen flex-col px-4 py-6 text-slate-100">
      <div className="fade-in mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/dashboard" className="text-sm font-medium text-slate-400 hover:text-slate-200">
            Cancel
          </Link>
          <p className="font-mono-data text-xs font-medium text-slate-500">
            Step {stepNumber} of {totalSteps}
          </p>
        </div>

        <div
          className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-white/5"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 shadow-[0_0_10px_rgba(34,211,238,0.6)] transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex-1">
          <h1 className="font-display text-xl font-semibold text-white">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>

        <div className="mt-8 flex gap-3">
          {onBack ? (
            <Button variant="secondary" size="md" onClick={onBack}>
              Back
            </Button>
          ) : null}
          <Button variant="primary" size="md" className="flex-1" onClick={onNext} disabled={nextDisabled}>
            {nextLabel ?? 'Continue'}
          </Button>
        </div>
      </div>
    </main>
  );
}
