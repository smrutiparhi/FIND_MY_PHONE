import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DemoState } from '@recoverai/shared';
import { ApiClientError, apiPost } from '../lib/apiClient';
import { ErrorState } from '@recoverai/ui';
import { demoStageRoute } from '../lib/demoStageRoutes';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong starting the demo.';
}

/**
 * "Build a clearly labeled RecoverAI Demo Mode for portfolio demonstrations"
 * (master spec, Part 22). A pure entry point: starts (or resumes) the one
 * fictional "Android stolen at Hyderabad Metro" case this account is
 * allowed to have, then hands off to the real app pages - see
 * DemoModeBar.tsx for the guided stepper that drives the rest of the flow.
 */
export function DemoEntryPage(): ReactElement {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiPost<DemoState>('/api/demo/start', {})
      .then((state) => {
        if (cancelled) return;
        navigate(demoStageRoute(state.recoveryCase.id, state.stage), { replace: true });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg">
        <ErrorState title="Couldn't start Demo Mode" message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
      <span aria-hidden="true" className="text-3xl">
        🎬
      </span>
      <p className="font-display text-lg font-semibold text-white">Starting RecoverAI Demo Mode...</p>
      <p className="text-sm text-slate-400">
        Setting up a fictional "Android stolen at Hyderabad Metro" case to walk through the app - nothing here is real.
      </p>
    </div>
  );
}
