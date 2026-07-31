import { useState, type FormEvent, type ReactElement } from 'react';
import type { CreatePoliceReportInput } from '@recoverai/shared';

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface PoliceReportFactsFormProps {
  title: string;
  submitLabel: string;
  submitting: boolean;
  initial: {
    ownerFullName: string;
    ownerContact: string;
    incidentDateTime: string | null;
    lastKnownPlace: string | null;
    incidentDescription: string;
  };
  onSubmit: (input: CreatePoliceReportInput) => Promise<void>;
}

/**
 * "Collect verified information" (master spec) - every field here is
 * either the owner's own attestation (name, contact, description) or
 * something they're confirming/correcting (date, place). Device details,
 * incident type, and location observations are never asked for here - the
 * backend assembles those itself from already-verified records.
 */
export function PoliceReportFactsForm({ title, submitLabel, submitting, initial, onSubmit }: PoliceReportFactsFormProps): ReactElement {
  const [ownerFullName, setOwnerFullName] = useState(initial.ownerFullName);
  const [ownerContact, setOwnerContact] = useState(initial.ownerContact);
  const [incidentDateTime, setIncidentDateTime] = useState(toDatetimeLocalValue(initial.incidentDateTime));
  const [lastKnownPlace, setLastKnownPlace] = useState(initial.lastKnownPlace ?? '');
  const [incidentDescription, setIncidentDescription] = useState(initial.incidentDescription);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (incidentDescription.trim().length < 10) {
      setError('Please describe what happened in a bit more detail.');
      return;
    }
    await onSubmit({
      ownerFullName: ownerFullName.trim(),
      ownerContact: ownerContact.trim(),
      incidentDateTime: incidentDateTime ? new Date(incidentDateTime).toISOString() : null,
      lastKnownPlace: lastKnownPlace.trim() === '' ? null : lastKnownPlace.trim(),
      incidentDescription: incidentDescription.trim(),
    });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300">{title}</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-400">
          Your full name
          <input
            type="text"
            value={ownerFullName}
            onChange={(e) => setOwnerFullName(e.target.value)}
            required
            maxLength={150}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          Contact information
          <input
            type="text"
            value={ownerContact}
            onChange={(e) => setOwnerContact(e.target.value)}
            required
            maxLength={200}
            placeholder="phone number or email"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-400">
          Incident date/time (if known)
          <input
            type="datetime-local"
            value={incidentDateTime}
            onChange={(e) => setIncidentDateTime(e.target.value)}
            max={toDatetimeLocalValue(new Date().toISOString())}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          Last known place (if known)
          <input
            type="text"
            value={lastKnownPlace}
            onChange={(e) => setLastKnownPlace(e.target.value)}
            maxLength={300}
            placeholder="leave blank if unclear"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600"
          />
        </label>
      </div>

      <label className="block text-xs text-slate-400">
        What happened, in your own words
        <textarea
          value={incidentDescription}
          onChange={(e) => setIncidentDescription(e.target.value)}
          required
          rows={5}
          maxLength={3000}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
        />
      </label>

      <p className="text-xs text-slate-500">
        Device details, IMEI/serial (if on file), and any recorded location come from your case automatically -
        you don&apos;t need to re-enter them here.
      </p>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Working...' : submitLabel}
      </button>
    </form>
  );
}
