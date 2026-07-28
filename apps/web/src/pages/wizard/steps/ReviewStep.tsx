import type { ReactElement } from 'react';
import type { WizardState } from '../wizardState';

interface Props {
  state: WizardState;
  deviceLabel: string;
  submitting: boolean;
  error: string | null;
}

const INCIDENT_LABELS: Record<string, string> = {
  LOST: 'Lost',
  STOLEN: 'Stolen',
  UNSURE: "Not sure what happened",
};

const TRI_STATE_LABELS: Record<string, string> = { YES: 'Yes', NO: 'No', UNSURE: 'Not sure' };

const SIM_ACCESS_LABELS: Record<string, string> = {
  ANOTHER_DEVICE_HAS_ACCESS: 'Another device has access',
  LOST_WITH_PHONE: 'Lost with the phone',
  SIM_ALREADY_BLOCKED: 'Already blocked',
  UNSURE: 'Not sure',
};

const SENSITIVE_APP_LABELS: Record<string, string> = {
  BANKING: 'Banking',
  UPI: 'UPI',
  EMAIL: 'Email',
  SOCIAL_MEDIA: 'Social media',
  PASSWORD_MANAGER: 'Password manager',
  AUTHENTICATOR: 'Authenticator',
  WORK_ACCOUNTS: 'Work accounts',
};

function ReviewRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-200">{value}</dd>
    </div>
  );
}

export function ReviewStep({ state, deviceLabel, submitting, error }: Props): ReactElement {
  return (
    <div className="space-y-3">
      <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900 px-4 text-sm">
        <ReviewRow label="What happened" value={INCIDENT_LABELS[state.incidentType ?? ''] ?? 'Unknown'} />
        <ReviewRow label="Device" value={deviceLabel} />
        <ReviewRow
          label="Last seen"
          value={state.lastSeenAt ? new Date(state.lastSeenAt).toLocaleString() : "Don't know"}
        />
        <ReviewRow label="Location" value={state.lastSeenDescription.trim() || "Don't know"} />
        <ReviewRow label="Account access" value={TRI_STATE_LABELS[state.accountAccessStatus ?? ''] ?? '-'} />
        <ReviewRow label="SIM/phone number" value={SIM_ACCESS_LABELS[state.simAccessStatus ?? ''] ?? '-'} />
        <ReviewRow label="Screen lock" value={TRI_STATE_LABELS[state.screenLockEnabled ?? ''] ?? '-'} />
        <ReviewRow
          label="Sensitive apps"
          value={
            state.sensitiveApps.length > 0 ? state.sensitiveApps.map((app) => SENSITIVE_APP_LABELS[app]).join(', ') : 'None'
          }
        />
        <ReviewRow label="Device-finding available" value={TRI_STATE_LABELS[state.deviceFindingAvailable ?? ''] ?? '-'} />
      </div>

      {error ? (
        <div className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </div>
      ) : null}
      {submitting ? <p className="text-sm text-slate-400">Creating your case and working out what to do first...</p> : null}
    </div>
  );
}
