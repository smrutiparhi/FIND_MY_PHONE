import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DemoState, RecoveryCaseId } from '@recoverai/shared';
import { DEMO_STAGE_COUNT, DEMO_STAGE_LABELS } from '@recoverai/shared';
import { ApiClientError, apiDelete, apiGet, apiPost } from '../../lib/apiClient';
import { Button } from '@recoverai/ui';
import { demoStageRoute } from '../../lib/demoStageRoutes';

/**
 * Persistent stepper shown on every page of a Demo Mode case (rendered by
 * AppLayout whenever the current route's :caseId resolves to one - see
 * AppLayout.tsx) - the loud, unmissable "you are looking at fictional data"
 * signal the master spec requires, and the actual "Next" mechanism that
 * drives the guided presentation flow through the real app pages.
 */
export function DemoModeBar({ caseId }: { caseId: RecoveryCaseId }): ReactElement | null {
  const navigate = useNavigate();
  const [state, setState] = useState<DemoState | null | 'not-demo'>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<DemoState>(`/api/demo/${caseId}`)
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState('not-demo');
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (state === null || state === 'not-demo') return null;

  async function goToStage(stage: number): Promise<void> {
    setBusy(true);
    try {
      const updated = await apiPost<DemoState>(`/api/demo/${caseId}/advance`, { stage });
      setState(updated);
      navigate(demoStageRoute(caseId, stage));
    } catch (err) {
      // Non-critical for a demo tool - the bar just stays put if a step fails to advance.
      console.error('Demo advance failed', err instanceof ApiClientError ? err.message : err);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestart(): Promise<void> {
    setBusy(true);
    try {
      await apiDelete(`/api/demo/${caseId}`);
      navigate('/demo');
    } finally {
      setBusy(false);
    }
  }

  const { stage, stageLabel, isFinalStage } = state;

  return (
    <div className="glass-panel-critical fade-in sticky top-16 z-30 mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-lg">
          🎬
        </span>
        <div>
          <p className="text-[11px] font-bold tracking-wide text-fuchsia-200 uppercase">Demo Mode - fictional case, not a real incident</p>
          <p className="text-sm font-semibold text-white">
            Stage {stage} of {DEMO_STAGE_COUNT}: {stageLabel}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" disabled={busy || stage <= 1} onClick={() => void goToStage(stage - 1)}>
          &larr; Back
        </Button>
        {!isFinalStage ? (
          <Button variant="primary" size="sm" disabled={busy} onClick={() => void goToStage(stage + 1)}>
            {busy ? 'Advancing...' : `Next: ${DEMO_STAGE_LABELS[stage] ?? 'Continue'} →`}
          </Button>
        ) : (
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            Walkthrough complete
          </span>
        )}
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void handleRestart()}>
          Restart demo
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => navigate('/dashboard')}>
          Exit
        </Button>
      </div>
    </div>
  );
}
