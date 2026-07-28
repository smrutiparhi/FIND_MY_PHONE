import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { HealthCheckResponse, ReadinessCheckResponse, User } from '@recoverai/shared';
import { ApiClientError, apiGet } from '../lib/apiClient';
import { useAuth } from '../hooks/useAuth';

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
  const { user, signOut } = useAuth();
  const [liveness, setLiveness] = useState<LoadState<HealthCheckResponse>>({ status: 'loading' });
  const [readiness, setReadiness] = useState<LoadState<ReadinessCheckResponse>>({
    status: 'loading',
  });
  const [profile, setProfile] = useState<LoadState<User>>({ status: 'loading' });

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

    apiGet<User>('/api/auth/me')
      .then((data) => {
        if (!cancelled) setProfile({ status: 'success', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setProfile({ status: 'error', message: describeError(err) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-lg space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium tracking-wide text-sky-400 uppercase">RecoverAI</p>
            <h1 className="text-2xl font-semibold text-white">System status</h1>
            <p className="text-sm text-slate-400">
              Signed in as {user?.email}. Diagnostics page confirming the API, database, and auth
              session all work end to end - not part of the main navigation.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link to="/" className="text-sm font-medium text-sky-400 hover:text-sky-300">
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Your account</h2>
          {profile.status === 'loading' && (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <StatusDot tone="pending" /> Loading profile...
            </p>
          )}
          {profile.status === 'error' && (
            <p className="flex items-center gap-2 text-sm text-red-400">
              <StatusDot tone="error" /> Could not load your profile: {profile.message}
            </p>
          )}
          {profile.status === 'success' && (
            <div className="space-y-1 text-sm text-slate-300">
              <p className="flex items-center gap-2">
                <StatusDot tone="ok" /> Backend recognizes this session (GET /api/auth/me)
              </p>
              <p className="text-slate-500">User id: {profile.data.id}</p>
              <p className="text-slate-500">Email: {profile.data.email}</p>
            </div>
          )}
        </section>

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
