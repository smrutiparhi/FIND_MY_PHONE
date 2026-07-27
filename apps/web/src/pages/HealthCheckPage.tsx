import { useEffect, useState, type ReactElement } from 'react';
import type { HealthCheckResponse, ReadinessCheckResponse } from '@recoverai/shared';
import { ApiClientError, apiGet } from '../lib/apiClient';

type LoadState<T> =
  { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; message: string };

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

function StatusDot({ tone }: { tone: 'ok' | 'error' | 'pending' | 'warn' }): ReactElement {
  const color = {
    ok: 'bg-emerald-500',
    error: 'bg-red-500',
    warn: 'bg-amber-500',
    pending: 'bg-slate-400',
  }[tone];
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`}
      aria-hidden="true"
    />
  );
}

export function HealthCheckPage(): ReactElement {
  const [liveness, setLiveness] = useState<LoadState<HealthCheckResponse>>({ status: 'loading' });
  const [readiness, setReadiness] = useState<LoadState<ReadinessCheckResponse>>({
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;

    apiGet<HealthCheckResponse>('/api/health')
      .then((data) => {
        if (!cancelled) setLiveness({ status: 'success', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLiveness({ status: 'error', message: describeError(err) });
      });

    apiGet<ReadinessCheckResponse>('/api/health/ready')
      .then((data) => {
        if (!cancelled) setReadiness({ status: 'success', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setReadiness({ status: 'error', message: describeError(err) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-lg space-y-6">
        <header className="space-y-1">
          <p className="text-sm font-medium tracking-wide text-sky-400 uppercase">RecoverAI</p>
          <h1 className="text-2xl font-semibold text-white">System status</h1>
          <p className="text-sm text-slate-400">
            Part 1 architecture scaffold. This page confirms the frontend can reach the backend API
            - the real dashboard is built in Part 4.
          </p>
        </header>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">API liveness</h2>
          {liveness.status === 'loading' && (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <StatusDot tone="pending" /> Checking connection to the API...
            </p>
          )}
          {liveness.status === 'error' && (
            <p className="flex items-center gap-2 text-sm text-red-400">
              <StatusDot tone="error" /> Could not reach the API: {liveness.message}
            </p>
          )}
          {liveness.status === 'success' && (
            <div className="space-y-1 text-sm text-slate-300">
              <p className="flex items-center gap-2">
                <StatusDot tone="ok" /> API is reachable ({liveness.data.service})
              </p>
              <p className="text-slate-500">Uptime: {liveness.data.uptimeSeconds}s</p>
              <p className="text-slate-500">
                Checked at: {new Date(liveness.data.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Dependency readiness</h2>
          {readiness.status === 'loading' && (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <StatusDot tone="pending" /> Checking dependencies...
            </p>
          )}
          {readiness.status === 'error' && (
            <p className="flex items-center gap-2 text-sm text-red-400">
              <StatusDot tone="error" /> Could not reach the API: {readiness.message}
            </p>
          )}
          {readiness.status === 'success' && (
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <StatusDot
                  tone={readiness.data.dependencies.database === 'connected' ? 'ok' : 'warn'}
                />
                Database: {readiness.data.dependencies.database}
              </li>
              <li className="flex items-center gap-2">
                <StatusDot tone="ok" />
                AI provider: {readiness.data.dependencies.aiProvider.name}
              </li>
              <li className="flex items-center gap-2">
                <StatusDot
                  tone={
                    readiness.data.dependencies.mapProvider.status === 'connected' ? 'ok' : 'warn'
                  }
                />
                Map provider: {readiness.data.dependencies.mapProvider.name}
              </li>
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
