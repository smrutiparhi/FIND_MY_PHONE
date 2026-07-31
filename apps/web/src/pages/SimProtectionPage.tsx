import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Device, SimProtectionState, UpdateDeviceSimInfoInput, UserSettableSimStatus } from '@recoverai/shared';
import { ApiClientError, apiGet, apiPatch } from '../lib/apiClient';
import { SimStatusBadge } from '../components/simProtection/SimStatusBadge';
import { SimStatusControl } from '../components/simProtection/SimStatusControl';
import { CarrierGuideCard } from '../components/simProtection/CarrierGuideCard';
import { CarrierSettingsForm } from '../components/simProtection/CarrierSettingsForm';
import { SimGuidanceSections } from '../components/simProtection/SimGuidanceSections';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; state: SimProtectionState; device: Device };

export function SimProtectionPage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    apiGet<SimProtectionState>(`/api/recovery-cases/${caseId}/sim-protection`)
      .then((data) =>
        apiGet<Device[]>('/api/devices').then((devices) => {
          const device = devices.find((d) => d.id === data.recoveryCase.deviceId);
          if (!device) {
            setState({ status: 'error', message: "Could not load this case's device." });
            return;
          }
          setState({ status: 'success', state: data, device });
        }),
      )
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleChangeStatus(status: UserSettableSimStatus): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const data = await apiPatch<SimProtectionState>(`/api/recovery-cases/${caseId}/sim-protection`, { status });
      setState((prev) => (prev.status === 'success' ? { ...prev, state: data } : prev));
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveCarrier(input: UpdateDeviceSimInfoInput): Promise<void> {
    if (state.status !== 'success') return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPatch<Device>(`/api/devices/${state.device.id}`, input);
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return <div className="text-sm text-slate-400">Loading SIM protection...</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950 p-5 text-sm text-red-300">
        <p className="font-medium">Couldn&apos;t load the SIM/eSIM Protection Center.</p>
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

  const { record, carrierGuide, guidanceSections, recoveryCase } = state.state;
  const { device } = state;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/recovery-cases/${recoveryCase.id}`} className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to case
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-white">SIM / eSIM protection</h1>
          <SimStatusBadge status={record.status} />
        </div>
      </div>

      {record.status === 'REPLACED' ? (
        <div className="rounded-md border border-emerald-900 bg-emerald-950/60 p-4 text-sm text-emerald-300">
          Your SIM has been replaced. The recovery plan has been updated.
        </div>
      ) : (
        <SimStatusControl status={record.status} submitting={submitting} onChangeStatus={handleChangeStatus} />
      )}

      {actionError ? <p className="text-sm text-red-400">{actionError}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <CarrierGuideCard guide={carrierGuide} />
          <CarrierSettingsForm
            currentCarrier={device.carrier}
            currentSimType={device.simType}
            submitting={submitting}
            onSave={handleSaveCarrier}
          />
        </div>
        <SimGuidanceSections sections={guidanceSections} />
      </div>
    </div>
  );
}
