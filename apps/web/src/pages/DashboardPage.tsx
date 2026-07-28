import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardCaseSummary } from '@recoverai/shared';
import { ApiClientError, apiGet } from '../lib/apiClient';
import { useIsOnline } from '../hooks/useIsOnline';
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

function CardSkeleton(): ReactElement {
  return (
    <div className="animate-pulse rounded-lg border border-slate-800 bg-slate-900 p-5" aria-hidden="true">
      <div className="h-3 w-24 rounded bg-slate-800" />
      <div className="mt-2 h-5 w-40 rounded bg-slate-800" />
      <div className="mt-2 h-3 w-32 rounded bg-slate-800" />
      <div className="mt-6 h-16 rounded bg-slate-800" />
    </div>
  );
}

const REPORT_CTA_CLASSES =
  'inline-flex shrink-0 items-center justify-center rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500';

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
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">Your active and past device recovery cases.</p>
        </div>
        <Link to="/recovery/new" className={REPORT_CTA_CLASSES}>
          Report Lost or Stolen Phone
        </Link>
      </div>

      {state.status === 'loading' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="rounded-lg border border-red-900 bg-red-950 p-5 text-sm text-red-300">
          <p className="font-medium">Couldn&apos;t load your cases.</p>
          <p className="mt-1 text-red-400">{state.message}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-md border border-red-800 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-900"
          >
            Try again
          </button>
        </div>
      ) : null}

      {hasNoCases ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-base font-medium text-white">No recovery cases yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            If you&apos;ve lost a phone or had one stolen, start a case and we&apos;ll walk you through what to do
            first.
          </p>
          <Link to="/recovery/new" className={`${REPORT_CTA_CLASSES} mt-4`}>
            Report Lost or Stolen Phone
          </Link>
        </div>
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
          <ul className="rounded-lg border border-slate-800 bg-slate-900 px-4">
            {historicalCases.map((summary) => (
              <HistoricalCaseRow key={summary.caseId} summary={summary} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
