import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AccountAccessSignal, AccountRecoveryState, UserSettableAccountRecoveryStatus } from '@recoverai/shared';
import { ApiClientError, apiGet, apiPatch } from '../lib/apiClient';
import { AccessChecklistForm } from '../components/accountRecovery/AccessChecklistForm';
import { RecoveryPathSteps } from '../components/accountRecovery/RecoveryPathSteps';
import { AccountRecoveryStatusBadge } from '../components/accountRecovery/AccountRecoveryStatusBadge';
import { AccountRecoveryStatusControl } from '../components/accountRecovery/AccountRecoveryStatusControl';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; state: AccountRecoveryState };

export function AccountRecoveryPage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    apiGet<AccountRecoveryState>(`/api/recovery-cases/${caseId}/account-recovery`)
      .then((data) => setState({ status: 'success', state: data }))
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveChecklist(signals: AccountAccessSignal[]): Promise<void> {
    if (!caseId || state.status !== 'success') return;
    setSubmitting(true);
    setActionError(null);
    try {
      const data = await apiPatch<AccountRecoveryState>(`/api/recovery-cases/${caseId}/account-recovery`, {
        availableSignals: signals,
        ...(state.state.attempt.status === 'NOT_STARTED' ? { status: 'IN_PROGRESS' as const } : {}),
      });
      setState({ status: 'success', state: data });
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeStatus(status: UserSettableAccountRecoveryStatus): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const data = await apiPatch<AccountRecoveryState>(`/api/recovery-cases/${caseId}/account-recovery`, { status });
      setState({ status: 'success', state: data });
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return <div className="text-sm text-slate-400">Loading account recovery...</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950 p-5 text-sm text-red-300">
        <p className="font-medium">Couldn&apos;t load account recovery.</p>
        <p className="mt-1 text-red-400">{state.message}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-md border border-red-800 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-900"
        >
          Try again
        </button>
      </div>
    );
  }

  const { attempt, steps, recoveryCase } = state.state;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/recovery-cases/${recoveryCase.id}`} className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to case
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-white">Account recovery</h1>
          <AccountRecoveryStatusBadge status={attempt.status} />
        </div>
        <p className="mt-1 text-sm text-slate-400">
          We&apos;ll never ask you to send your password, OTP, authentication code, or recovery key - only what you
          still have access to.
        </p>
      </div>

      {attempt.status === 'RECOVERED' ? (
        <div className="rounded-md border border-emerald-900 bg-emerald-950/60 p-4 text-sm text-emerald-300">
          Account access has been marked restored. The recovery plan has been updated.
        </div>
      ) : (
        <AccountRecoveryStatusControl status={attempt.status} submitting={submitting} onChangeStatus={handleChangeStatus} />
      )}

      {actionError ? <p className="text-sm text-red-400">{actionError}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AccessChecklistForm initialSignals={attempt.availableSignals} submitting={submitting} onSubmit={handleSaveChecklist} />
        <RecoveryPathSteps steps={steps} />
      </div>
    </div>
  );
}
