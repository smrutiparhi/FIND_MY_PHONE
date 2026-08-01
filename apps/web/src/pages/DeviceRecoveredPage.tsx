import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  DeviceRecoveryChecklistItem,
  DeviceRecoveryState,
  FinalCaseSummary,
} from '@recoverai/shared';
import { DEVICE_RECOVERY_CHECKLIST_ITEMS } from '@recoverai/shared';
import { ApiClientError, apiGet, apiPatch, apiPost } from '../lib/apiClient';
import { DeviceRecoveryChecklistRow } from '../components/deviceRecovery/DeviceRecoveryChecklistRow';
import { CloseCasePanel } from '../components/deviceRecovery/CloseCasePanel';
import { FinalCaseSummaryView } from '../components/deviceRecovery/FinalCaseSummaryView';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; state: DeviceRecoveryState; summary: FinalCaseSummary | null };

export function DeviceRecoveredPage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Fetches the checklist/case/plan only - deliberately skips the final
   * summary. The summary (incident date, actions completed, full timeline,
   * location observations, police/CEIR status) has nothing to do with which
   * checklist items are checked, but it's expensive to compute (a full
   * engine recalculation plus several more reads) - refetching it on every
   * single checkbox toggle was measured to add several seconds of visible
   * lag to something that should feel instant. Used for every checklist
   * mutation; `load()` below (which does fetch the summary) is reserved for
   * the transitions that can actually change it.
   */
  const loadChecklistOnly = useCallback(() => {
    if (!caseId) return;
    apiGet<DeviceRecoveryState>(`/api/recovery-cases/${caseId}/device-recovery`)
      .then((deviceRecoveryState) => {
        setState((prev) =>
          prev.status === 'success'
            ? { ...prev, state: deviceRecoveryState }
            : { status: 'success', state: deviceRecoveryState, summary: null },
        );
      })
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  const load = useCallback(() => {
    if (!caseId) return;
    // Only show the full loading state on the very first load - a background refresh after
    // confirming possession or closing the case must not unmount CloseCasePanel, or its local
    // "I've reviewed..." confirmation checkbox would silently reset.
    setState((prev) => (prev.status === 'success' ? prev : { status: 'loading' }));
    apiGet<DeviceRecoveryState>(`/api/recovery-cases/${caseId}/device-recovery`)
      .then((deviceRecoveryState) => {
        if (!deviceRecoveryState.checklist.recoveredAt) {
          setState({ status: 'success', state: deviceRecoveryState, summary: null });
          return;
        }
        apiGet<FinalCaseSummary>(`/api/recovery-cases/${caseId}/device-recovery/summary`)
          .then((summary) => setState({ status: 'success', state: deviceRecoveryState, summary }))
          .catch(() => setState({ status: 'success', state: deviceRecoveryState, summary: null }));
      })
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConfirmPossession(): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPatch(`/api/recovery-cases/${caseId}/device-recovery`, { completedItems: ['CONFIRM_POSSESSION'] });
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleItem(item: DeviceRecoveryChecklistItem, checked: boolean): Promise<void> {
    if (!caseId || state.status !== 'success') return;
    const current = state.state.checklist.completedItems;
    const next = checked ? Array.from(new Set([...current, item])) : current.filter((i) => i !== item);
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPatch(`/api/recovery-cases/${caseId}/device-recovery`, { completedItems: next });
      loadChecklistOnly();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseCase(): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPost(`/api/recovery-cases/${caseId}/device-recovery/close`, { confirmedUnresolvedActionsReviewed: true });
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return <div className="text-sm text-slate-400">Loading...</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950 p-5 text-sm text-red-300">
        <p className="font-medium">Couldn&apos;t load this page.</p>
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

  const { checklist, recoveryCase, unresolvedActions } = state.state;
  const caseIdTyped = recoveryCase.id;
  const isClosed = recoveryCase.status === 'CLOSED';

  if (!checklist.recoveredAt) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Link to={`/recovery-cases/${caseIdTyped}`} className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to case
        </Link>
        <div className="rounded-lg border border-emerald-900 bg-emerald-950/40 p-6 text-center">
          <h1 className="text-xl font-semibold text-white">I found my phone</h1>
          <p className="mt-2 text-sm text-slate-300">
            Before we do anything else - do you have physical possession of the device right now?
          </p>
          {actionError ? <p className="mt-2 text-sm text-red-400">{actionError}</p> : null}
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleConfirmPossession()}
            className="mt-4 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Yes, I have the device
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/recovery-cases/${caseIdTyped}`} className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to case
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {isClosed ? 'Case closed' : 'Welcome back - a few things to check'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {isClosed
            ? 'This case has been closed. Its history stays available below.'
            : "We won't close the case yet - work through this checklist first, then close it when you're ready."}
        </p>
      </div>

      {actionError ? <p className="text-sm text-red-400">{actionError}</p> : null}

      {!isClosed ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-300">Recovery checklist</h2>
          <ul className="mt-3 space-y-2">
            {DEVICE_RECOVERY_CHECKLIST_ITEMS.filter((i) => i !== 'CONFIRM_POSSESSION').map((item) => (
              <DeviceRecoveryChecklistRow
                key={item}
                item={item}
                caseId={caseIdTyped}
                checked={checklist.completedItems.includes(item)}
                disabled={submitting}
                onToggle={(i, checked) => void handleToggleItem(i, checked)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {state.summary ? <FinalCaseSummaryView summary={state.summary} /> : null}

      {!isClosed ? <CloseCasePanel unresolvedActions={unresolvedActions} submitting={submitting} onClose={handleCloseCase} /> : null}
    </div>
  );
}
