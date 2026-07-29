import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { LocationObservation, MapClientConfig, RecordLocationObservationInput, RecoveryCase, RecoveryPlan } from '@recoverai/shared';
import { ApiClientError, apiGet, apiPost } from '../lib/apiClient';
import { DeviceMap } from '../components/recoveryLocation/DeviceMap';
import { RecordLocationForm } from '../components/recoveryLocation/RecordLocationForm';
import { LocationHistoryList } from '../components/recoveryLocation/LocationHistoryList';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'success';
      recoveryCase: RecoveryCase;
      recoveryPlan: RecoveryPlan;
      observations: LocationObservation[];
      mapConfig: MapClientConfig;
    };

export function RecoveryLocationPage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pickModeActive, setPickModeActive] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    Promise.all([
      apiGet<RecoveryCase>(`/api/recovery-cases/${caseId}`),
      apiGet<RecoveryPlan>(`/api/recovery-cases/${caseId}/recovery-plan`),
      apiGet<LocationObservation[]>(`/api/recovery-cases/${caseId}/locations`),
      apiGet<MapClientConfig>('/api/map/config'),
    ])
      .then(([recoveryCase, recoveryPlan, observations, mapConfig]) => {
        setState({ status: 'success', recoveryCase, recoveryPlan, observations, mapConfig });
      })
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRecord(input: RecordLocationObservationInput): Promise<void> {
    if (!caseId || state.status !== 'success') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await apiPost<{ locationObservation: LocationObservation; recoveryCase: RecoveryCase; recoveryPlan: RecoveryPlan }>(
        `/api/recovery-cases/${caseId}/locations`,
        input,
      );
      setState({
        status: 'success',
        recoveryCase: result.recoveryCase,
        recoveryPlan: result.recoveryPlan,
        observations: [result.locationObservation, ...state.observations],
        mapConfig: state.mapConfig,
      });
      setPickModeActive(false);
      setPickedCoords(null);
    } catch (err) {
      setSubmitError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return <div className="text-sm text-slate-400">Loading location data...</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950 p-5 text-sm text-red-300">
        <p className="font-medium">Couldn&apos;t load this case&apos;s location data.</p>
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

  const { recoveryCase, recoveryPlan, observations, mapConfig } = state;
  const findingAction = recoveryPlan.orderedActions.find((a) => a.type === 'LOCATE_DEVICE');
  const showSafetyWarning = recoveryCase.incidentType === 'STOLEN' && observations.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/recovery-cases/${recoveryCase.id}`} className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to case
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Device location</h1>
        <p className="text-sm text-slate-400">
          RecoverAI does not independently track this device - every location below came from an authorized
          integration or was reported by you.
        </p>
      </div>

      {findingAction?.officialExternalAction?.url ? (
        <a
          href={findingAction.officialExternalAction.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
        >
          {findingAction.officialExternalAction.label}
        </a>
      ) : null}

      {showSafetyWarning ? (
        <div className="rounded-md border border-red-900 bg-red-950/60 p-4 text-sm text-red-300">
          If this device appears at an unfamiliar location, do not go there or confront a suspected thief - share
          the information with the police instead.
        </div>
      ) : null}

      <DeviceMap
        config={mapConfig}
        observations={observations}
        onPickLocation={pickModeActive ? (lat, lng) => setPickedCoords({ lat, lng }) : undefined}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecordLocationForm
          onSubmit={handleRecord}
          submitting={submitting}
          pickedCoords={pickedCoords}
          pickModeActive={pickModeActive}
          onTogglePickMode={() => setPickModeActive((v) => !v)}
        />
        <LocationHistoryList observations={observations} />
      </div>

      {submitError ? <p className="text-sm text-red-400">{submitError}</p> : null}
    </div>
  );
}
