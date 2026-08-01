import { useState, type FormEvent, type ReactElement } from 'react';
import { NOTIFICATION_TYPES, type NotificationPreferences, type NotificationType, type UpdateNotificationPreferencesInput } from '@recoverai/shared';
import { NOTIFICATION_TYPE_LABELS } from './notificationTypeLabels';

const NON_MUTABLE_TYPE: NotificationType = 'CRITICAL_ACTION_PENDING';
const MUTABLE_TYPES = NOTIFICATION_TYPES.filter((t) => t !== NON_MUTABLE_TYPE);

function minutesToTimeInput(minutes: number | null): string {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function timeInputToMinutes(value: string): number | null {
  if (!value) return null;
  const parts = value.split(':').map(Number);
  const h = parts[0];
  const m = parts[1];
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

interface NotificationPreferencesFormProps {
  preferences: NotificationPreferences;
  submitting: boolean;
  onSave: (input: UpdateNotificationPreferencesInput) => Promise<void>;
}

/** "Allow notification preferences and quiet settings except for user-selected critical recovery alerts" (master spec) - CRITICAL_ACTION_PENDING never appears as a mutable checkbox here. */
export function NotificationPreferencesForm({ preferences, submitting, onSave }: NotificationPreferencesFormProps): ReactElement {
  const [mutedTypes, setMutedTypes] = useState<NotificationType[]>(preferences.mutedTypes);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(preferences.quietHoursEnabled);
  const [quietStart, setQuietStart] = useState(minutesToTimeInput(preferences.quietHoursStartMinute));
  const [quietEnd, setQuietEnd] = useState(minutesToTimeInput(preferences.quietHoursEndMinute));
  const [timezone, setTimezone] = useState(preferences.timezone ?? '');
  const [emailEnabled, setEmailEnabled] = useState(preferences.emailEnabled);

  function toggleMuted(type: NotificationType): void {
    setMutedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    await onSave({
      mutedTypes,
      quietHoursEnabled,
      quietHoursStartMinute: timeInputToMinutes(quietStart),
      quietHoursEndMinute: timeInputToMinutes(quietEnd),
      timezone: timezone.trim() === '' ? null : timezone.trim(),
      emailEnabled,
    });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300">Notification preferences</h2>

      <div>
        <p className="text-xs font-medium text-slate-400">Notification types</p>
        <div className="mt-2 space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked disabled className="h-4 w-4 rounded border-slate-700 bg-slate-800" />
            {NOTIFICATION_TYPE_LABELS[NON_MUTABLE_TYPE]} (always on - cannot be muted)
          </label>
          {MUTABLE_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={!mutedTypes.includes(type)}
                onChange={() => toggleMuted(type)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
              />
              {NOTIFICATION_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <input
            type="checkbox"
            checked={quietHoursEnabled}
            onChange={(e) => setQuietHoursEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900"
          />
          Quiet hours (does not apply to critical alerts)
        </label>
        {quietHoursEnabled ? (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-400">
              Start
              <input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
              />
            </label>
            <label className="text-xs text-slate-400">
              End
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
              />
            </label>
            <label className="text-xs text-slate-400">
              Timezone
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. Asia/Kolkata"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div>
        <p className="text-xs font-medium text-slate-400">Other channels</p>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900"
          />
          Email (coming soon - no email provider is connected yet, so this has no effect)
        </label>
        <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" disabled className="h-4 w-4 rounded border-slate-700 bg-slate-800" />
          Push notifications (not available yet)
        </label>
        <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" disabled className="h-4 w-4 rounded border-slate-700 bg-slate-800" />
          SMS (not available yet)
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save preferences
      </button>
    </form>
  );
}
