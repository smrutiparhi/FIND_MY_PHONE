import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Device, EmergencyModeResult } from '@recoverai/shared';
import { ApiClientError, apiGet, apiPatch } from '../lib/apiClient';
import { RiskBadge } from '../components/dashboard/RiskBadge';
import { EmergencyActionCard } from '../components/emergencyMode/EmergencyActionCard';
import { NextActionPreview } from '../components/emergencyMode/NextActionPreview';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; result: EmergencyModeResult; device: Device };

export function EmergencyModePage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    apiGet<EmergencyModeResult>(`/api/recovery-cases/${caseId}/emergency`)
      .then((result) =>
        apiGet<Device[]>('/api/devices').then((devices) => {
          const device = devices.find((d) => d.id === result.recoveryCase.deviceId);
          if (!device) {
            setState({ status: 'error', message: "Could not load this case's device." });
            return;
          }
          setState({ status: 'success', result, device });
        }),
      )
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkDone(actionId: string): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPatch(`/api/recovery-cases/${caseId}/actions/${actionId}`, { status: 'COMPLETED' });
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
        <p className="font-medium">Couldn&apos;t load emergency mode.</p>
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

  const { result, device } = state;
  const { emergency, recoveryCase } = result;
  const { currentAction } = emergency;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link to={`/recovery-cases/${recoveryCase.id}`} className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Full recovery plan
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-white">{device.nickname}</h1>
          <RiskBadge riskLevel={emergency.riskLevel} />
        </div>
      </div>

      {!emergency.isEmergency ? (
        <div className="rounded-md border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          This case is no longer at critical or high risk - emergency mode isn&apos;t needed right now. See the full
          recovery plan for anything still open.
        </div>
      ) : (
        <>
          {emergency.riskReasons.length > 0 ? (
            <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Why risk is high</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {emergency.riskReasons.map((reason) => (
                  <li key={reason}>- {reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {emergency.warnings.length > 0 ? (
            <div className="space-y-1 rounded-md border border-red-900 bg-red-950/60 p-3">
              {emergency.warnings.map((warning) => (
                <p key={warning} className="text-xs text-red-300">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-slate-500">
            {emergency.completedCount} of {emergency.totalCount} protections completed
          </p>

          {actionError ? <p className="text-sm text-red-400">{actionError}</p> : null}

          {currentAction ? (
            <EmergencyActionCard action={currentAction} submitting={submitting} onMarkDone={() => handleMarkDone(currentAction.id)} />
          ) : (
            <div className="rounded-lg border border-emerald-900 bg-emerald-950/40 p-5 text-sm text-emerald-300">
              Every critical protection is complete. See the full recovery plan for what&apos;s left.
            </div>
          )}

          <NextActionPreview action={emergency.nextAction} />
        </>
      )}
    </div>
  );
}
