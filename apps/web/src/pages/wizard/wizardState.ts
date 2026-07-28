import type {
  CreateRecoveryCaseWizardInput,
  DeviceId,
  IncidentType,
  PlatformType,
  SensitiveAppType,
  SimAccessStatus,
  TriStateAnswer,
} from '@recoverai/shared';

export interface WizardState {
  incidentType: IncidentType | null;
  deviceMode: 'existing' | 'new' | null;
  existingDeviceId: string | null;
  newDevice: {
    nickname: string;
    manufacturer: string;
    model: string;
    platform: PlatformType | null;
  };
  /** datetime-local input value (e.g. "2026-07-28T14:30") or null if unknown - never forced. */
  lastSeenAt: string | null;
  lastSeenDescription: string;
  accountAccessStatus: TriStateAnswer | null;
  simAccessStatus: SimAccessStatus | null;
  screenLockEnabled: TriStateAnswer | null;
  sensitiveApps: SensitiveAppType[];
  deviceFindingAvailable: TriStateAnswer | null;
}

export const INITIAL_WIZARD_STATE: WizardState = {
  incidentType: null,
  deviceMode: null,
  existingDeviceId: null,
  newDevice: { nickname: '', manufacturer: '', model: '', platform: null },
  lastSeenAt: null,
  lastSeenDescription: '',
  accountAccessStatus: null,
  simAccessStatus: null,
  screenLockEnabled: null,
  sensitiveApps: [],
  deviceFindingAvailable: null,
};

/** Builds the POST /api/recovery-cases body. Only called once every required field is known to be filled. */
export function buildWizardPayload(state: WizardState): CreateRecoveryCaseWizardInput {
  if (!state.incidentType) throw new Error('incidentType is required');
  if (!state.accountAccessStatus) throw new Error('accountAccessStatus is required');
  if (!state.simAccessStatus) throw new Error('simAccessStatus is required');
  if (!state.screenLockEnabled) throw new Error('screenLockEnabled is required');
  if (!state.deviceFindingAvailable) throw new Error('deviceFindingAvailable is required');

  const device: CreateRecoveryCaseWizardInput['device'] =
    state.deviceMode === 'existing' && state.existingDeviceId
      ? { mode: 'existing', deviceId: state.existingDeviceId as DeviceId }
      : {
          mode: 'new',
          nickname: state.newDevice.nickname.trim(),
          manufacturer: state.newDevice.manufacturer.trim(),
          model: state.newDevice.model.trim(),
          platform: state.newDevice.platform ?? 'OTHER',
        };

  return {
    incidentType: state.incidentType,
    device,
    lastSeenAt: state.lastSeenAt ? new Date(state.lastSeenAt).toISOString() : null,
    lastSeenDescription: state.lastSeenDescription.trim() || null,
    accountAccessStatus: state.accountAccessStatus,
    simAccessStatus: state.simAccessStatus,
    screenLockEnabled: state.screenLockEnabled,
    sensitiveApps: state.sensitiveApps,
    deviceFindingAvailable: state.deviceFindingAvailable,
  };
}
