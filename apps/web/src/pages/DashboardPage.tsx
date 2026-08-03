import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardCaseSummary } from '@recoverai/shared';
import { ApiClientError, apiGet } from '../lib/apiClient';
import { useIsOnline } from '../hooks/useIsOnline';
import { EmptyState, ErrorState, SkeletonCard } from '@recoverai/ui';
import { OfflineBanner } from '../components/dashboard/OfflineBanner';
import { CaseCard } from '../components/dashboard/CaseCard';
import { HistoricalCaseRow } from '../components/dashboard/HistoricalCaseRow';

const TERMINAL_STATUSES = new Set(['RECOVERED', 'ERASED', 'CLOSED']);

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; cases: DashboardCaseSummary[] };

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

const REPORT_CTA_CLASSES =
  'inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_-4px_rgba(244,63,94,0.6)] transition hover:brightness-110';

export function DashboardPage(): ReactElement {
  const isOnline = useIsOnline();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    apiGet<DashboardCaseSummary[]>('/api/recovery-cases')
      .then((cases) => setState({ status: 'success', cases }))
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCases = state.status === 'success' ? state.cases.filter((c) => !TERMINAL_STATUSES.has(c.status)) : [];
  const historicalCases = state.status === 'success' ? state.cases.filter((c) => TERMINAL_STATUSES.has(c.status)) : [];
  const hasNoCases = state.status === 'success' && activeCases.length === 0 && historicalCases.length === 0;

  return (
    <div className="space-y-6">
      {!isOnline ? <OfflineBanner /> : null}

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">Your active and past device recovery cases.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link to="/demo" className="text-sm font-medium text-fuchsia-300 hover:text-fuchsia-200">
            🎬 View demo
          </Link>
          <Link to="/recovery/new" className={REPORT_CTA_CLASSES}>
            Report Lost or Stolen Phone
          </Link>
        </div>
      </div>

      {state.status === 'loading' ? (
        <div role="status" aria-label="Loading your cases" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {state.status === 'error' ? <ErrorState message={state.message} onRetry={load} title="Couldn't load your cases." /> : null}

      {hasNoCases ? (
        <EmptyState
          title="No recovery cases yet"
          description="If you've lost a phone or had one stolen, start a case and we'll walk you through what to do first."
          action={
            <Link to="/recovery/new" className={REPORT_CTA_CLASSES}>
              Report Lost or Stolen Phone
            </Link>
          }
        />
      ) : null}

      {state.status === 'success' && activeCases.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Active cases</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeCases.map((summary) => (
              <CaseCard key={summary.caseId} summary={summary} />
            ))}
          </div>
        </section>
      ) : null}

      {state.status === 'success' && historicalCases.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Past cases</h2>
          <ul className="glass-panel px-4">
            {historicalCases.map((summary) => (
              <HistoricalCaseRow key={summary.caseId} summary={summary} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
