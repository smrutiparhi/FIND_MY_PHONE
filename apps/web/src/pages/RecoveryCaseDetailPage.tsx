import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Device, RecoveryCase, RecoveryCaseId, RecoveryPlan } from '@recoverai/shared';
import { ApiClientError, apiGet } from '../lib/apiClient';
import { RiskBadge } from '../components/dashboard/RiskBadge';
import { CaseStatusBadge } from '../components/dashboard/CaseStatusBadge';
import { RecoveryPlanPanel } from '../components/recoveryCase/RecoveryPlanPanel';
import { AgentChatPanel } from '../components/recoveryAgent/AgentChatPanel';

const INCIDENT_LABELS: Record<RecoveryCase['incidentType'], string> = {
  LOST: 'Lost',
  STOLEN: 'Stolen',
  UNSURE: 'Unsure',
};

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; recoveryCase: RecoveryCase; device: Device; recoveryPlan: RecoveryPlan };

export function RecoveryCaseDetailPage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    Promise.all([
      apiGet<RecoveryCase>(`/api/recovery-cases/${caseId}`),
      apiGet<Device[]>('/api/devices'),
      apiGet<RecoveryPlan>(`/api/recovery-cases/${caseId}/recovery-plan`),
    ])
      .then(([recoveryCase, devices, recoveryPlan]) => {
        const device = devices.find((d) => d.id === recoveryCase.deviceId);
        if (!device) {
          setState({ status: 'error', message: 'Could not load this case\'s device.' });
          return;
        }
        setState({ status: 'success', recoveryCase, device, recoveryPlan });
      })
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCaseUpdated = (recoveryCase: RecoveryCase, recoveryPlan: RecoveryPlan): void => {
    setState((prev) => (prev.status === 'success' ? { ...prev, recoveryCase, recoveryPlan } : prev));
  };

  if (state.status === 'loading') {
    return <div className="text-sm text-slate-400">Loading case...</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950 p-5 text-sm text-red-300">
        <p className="font-medium">Couldn&apos;t load this case.</p>
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

  const { recoveryCase, device, recoveryPlan } = state;
  const caseIdTyped = recoveryCase.id as RecoveryCaseId;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              {INCIDENT_LABELS[recoveryCase.incidentType]}
            </p>
            <h1 className="text-2xl font-semibold text-white">{device.nickname}</h1>
            <p className="text-sm text-slate-400">
              {device.manufacturer} {device.model}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <RiskBadge riskLevel={recoveryCase.riskLevel} />
            <CaseStatusBadge status={recoveryCase.status} />
          </div>
        </div>
        <Link
          to={`/recovery-cases/${recoveryCase.id}/location`}
          className="mt-3 inline-flex items-center rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          View device location
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecoveryPlanPanel plan={recoveryPlan} />
        <AgentChatPanel caseId={caseIdTyped} onCaseUpdated={handleCaseUpdated} />
      </div>
    </div>
  );
}
