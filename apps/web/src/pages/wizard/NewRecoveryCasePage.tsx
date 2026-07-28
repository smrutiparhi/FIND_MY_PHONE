import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Device, DeviceId } from '@recoverai/shared';
import { ApiClientError, apiGet, apiPost } from '../../lib/apiClient';
import { WizardShell } from '../../components/wizard/WizardShell';
import { IncidentTypeStep } from './steps/IncidentTypeStep';
import { DeviceStep } from './steps/DeviceStep';
import { LastSeenWhenStep } from './steps/LastSeenWhenStep';
import { LastSeenWhereStep } from './steps/LastSeenWhereStep';
import { AccountAccessStep } from './steps/AccountAccessStep';
import { SimAccessStep } from './steps/SimAccessStep';
import { ScreenLockStep } from './steps/ScreenLockStep';
import { SensitiveAppsStep } from './steps/SensitiveAppsStep';
import { DeviceFindingStep } from './steps/DeviceFindingStep';
import { ReviewStep } from './steps/ReviewStep';
import { INITIAL_WIZARD_STATE, buildWizardPayload, type WizardState } from './wizardState';

const STEP_IDS = [
  'incident',
  'device',
  'lastSeenWhen',
  'lastSeenWhere',
  'accountAccess',
  'simAccess',
  'screenLock',
  'sensitiveApps',
  'deviceFinding',
  'review',
] as const;

type StepId = (typeof STEP_IDS)[number];

const STEP_META: Record<StepId, { title: string; subtitle?: string }> = {
  incident: { title: 'What happened?', subtitle: 'This helps us figure out what to do first.' },
  device: { title: 'Which device?', subtitle: 'Pick an existing device, or tell us about a new one.' },
  lastSeenWhen: { title: 'When did you last have it?' },
  lastSeenWhere: { title: 'Where did you last have it?' },
  accountAccess: {
    title: 'Can you access your Google or Apple account?',
    subtitle: 'The account signed in on this device.',
  },
  simAccess: { title: 'Can you access this phone number?' },
  screenLock: { title: 'Was a screen lock enabled?' },
  sensitiveApps: { title: 'Does the device have any sensitive apps?', subtitle: "We'll help you protect these." },
  deviceFinding: {
    title: 'Can you use Find My or Find Hub?',
    subtitle: 'Can you sign in to Apple Find My or Google Find Hub from another device?',
  },
  review: { title: 'Review and report', subtitle: 'Check everything looks right before we create your case.' },
};

function isStepValid(stepId: StepId, state: WizardState): boolean {
  switch (stepId) {
    case 'incident':
      return state.incidentType !== null;
    case 'device':
      if (state.deviceMode === 'existing') return state.existingDeviceId !== null;
      if (state.deviceMode === 'new') {
        return (
          state.newDevice.nickname.trim() !== '' &&
          state.newDevice.manufacturer.trim() !== '' &&
          state.newDevice.model.trim() !== '' &&
          state.newDevice.platform !== null
        );
      }
      return false;
    case 'lastSeenWhen':
    case 'lastSeenWhere':
    case 'sensitiveApps':
    case 'review':
      return true;
    case 'accountAccess':
      return state.accountAccessStatus !== null;
    case 'simAccess':
      return state.simAccessStatus !== null;
    case 'screenLock':
      return state.screenLockEnabled !== null;
    case 'deviceFinding':
      return state.deviceFindingAvailable !== null;
  }
}

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

type DevicesLoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; devices: Device[] };

export function NewRecoveryCasePage(): ReactElement {
  const navigate = useNavigate();
  const [devicesState, setDevicesState] = useState<DevicesLoadState>({ status: 'loading' });
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Device[]>('/api/devices')
      .then((devices) => {
        if (cancelled) return;
        setDevicesState({ status: 'success', devices });
        if (devices.length === 0) {
          setState((s) => ({ ...s, deviceMode: 'new' }));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setDevicesState({ status: 'error', message: describeError(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const devices = useMemo(() => (devicesState.status === 'success' ? devicesState.devices : []), [devicesState]);
  const stepId = STEP_IDS[stepIndex] as StepId;
  const meta = STEP_META[stepId];
  const canAdvance = isStepValid(stepId, state);
  const isLastStep = stepIndex === STEP_IDS.length - 1;

  const deviceLabel = useMemo(() => {
    if (state.deviceMode === 'existing' && state.existingDeviceId) {
      const device = devices.find((d) => d.id === state.existingDeviceId);
      return device ? `${device.nickname} (${device.manufacturer} ${device.model})` : 'Selected device';
    }
    if (state.newDevice.nickname) {
      return `${state.newDevice.nickname} (${state.newDevice.manufacturer} ${state.newDevice.model})`;
    }
    return 'Not selected';
  }, [state.deviceMode, state.existingDeviceId, state.newDevice, devices]);

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = buildWizardPayload(state);
      await apiPost('/api/recovery-cases', payload);
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitting(false);
      setSubmitError(describeError(err));
    }
  }

  function handleNext(): void {
    if (isLastStep) {
      void handleSubmit();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEP_IDS.length - 1));
  }

  function handleBack(): void {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  if (devicesState.status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Loading...
      </main>
    );
  }

  if (devicesState.status === 'error') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-sm text-red-400">Couldn&apos;t start the wizard: {devicesState.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <WizardShell
      title={meta.title}
      subtitle={meta.subtitle}
      stepNumber={stepIndex + 1}
      totalSteps={STEP_IDS.length}
      onBack={stepIndex > 0 ? handleBack : undefined}
      onNext={handleNext}
      nextDisabled={!canAdvance || submitting}
      nextLabel={isLastStep ? (submitting ? 'Reporting...' : 'Report this device') : undefined}
    >
      {stepId === 'incident' ? (
        <IncidentTypeStep value={state.incidentType} onChange={(incidentType) => setState((s) => ({ ...s, incidentType }))} />
      ) : null}

      {stepId === 'device' ? (
        <DeviceStep
          devices={devices}
          deviceMode={state.deviceMode}
          existingDeviceId={state.existingDeviceId as DeviceId | null}
          newDevice={state.newDevice}
          onSelectExisting={(deviceId) => setState((s) => ({ ...s, deviceMode: 'existing', existingDeviceId: deviceId }))}
          onSelectNew={() => setState((s) => ({ ...s, deviceMode: 'new', existingDeviceId: null }))}
          onChangeNewDevice={(patch) => setState((s) => ({ ...s, newDevice: { ...s.newDevice, ...patch } }))}
        />
      ) : null}

      {stepId === 'lastSeenWhen' ? (
        <LastSeenWhenStep value={state.lastSeenAt} onChange={(lastSeenAt) => setState((s) => ({ ...s, lastSeenAt }))} />
      ) : null}

      {stepId === 'lastSeenWhere' ? (
        <LastSeenWhereStep
          value={state.lastSeenDescription}
          onChange={(lastSeenDescription) => setState((s) => ({ ...s, lastSeenDescription }))}
        />
      ) : null}

      {stepId === 'accountAccess' ? (
        <AccountAccessStep
          value={state.accountAccessStatus}
          onChange={(accountAccessStatus) => setState((s) => ({ ...s, accountAccessStatus }))}
        />
      ) : null}

      {stepId === 'simAccess' ? (
        <SimAccessStep value={state.simAccessStatus} onChange={(simAccessStatus) => setState((s) => ({ ...s, simAccessStatus }))} />
      ) : null}

      {stepId === 'screenLock' ? (
        <ScreenLockStep
          value={state.screenLockEnabled}
          onChange={(screenLockEnabled) => setState((s) => ({ ...s, screenLockEnabled }))}
        />
      ) : null}

      {stepId === 'sensitiveApps' ? (
        <SensitiveAppsStep value={state.sensitiveApps} onChange={(sensitiveApps) => setState((s) => ({ ...s, sensitiveApps }))} />
      ) : null}

      {stepId === 'deviceFinding' ? (
        <DeviceFindingStep
          value={state.deviceFindingAvailable}
          onChange={(deviceFindingAvailable) => setState((s) => ({ ...s, deviceFindingAvailable }))}
        />
      ) : null}

      {stepId === 'review' ? (
        <ReviewStep state={state} deviceLabel={deviceLabel} submitting={submitting} error={submitError} />
      ) : null}
    </WizardShell>
  );
}
