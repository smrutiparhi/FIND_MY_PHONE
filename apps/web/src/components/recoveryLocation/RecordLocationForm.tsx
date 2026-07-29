import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import type { LocationSource, RecordLocationObservationInput } from '@recoverai/shared';

const SOURCE_OPTIONS: { value: Extract<LocationSource, 'USER_CONFIRMED' | 'USER_ENTERED' | 'OTHER_VERIFIED_SOURCE'>; label: string; hint: string }[] = [
  {
    value: 'USER_CONFIRMED',
    label: 'I just checked Find My / Find Hub',
    hint: 'This exact location is what Apple/Google is showing right now.',
  },
  {
    value: 'OTHER_VERIFIED_SOURCE',
    label: 'A verified source told me',
    hint: 'e.g. a carrier or the police shared this location with you.',
  },
  {
    value: 'USER_ENTERED',
    label: "I'm entering it from memory",
    hint: 'A screenshot, a place you remember, or a rough guess - not live GPS.',
  },
];

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface RecordLocationFormProps {
  onSubmit: (input: RecordLocationObservationInput) => Promise<void>;
  submitting: boolean;
  pickedCoords: { lat: number; lng: number } | null;
  pickModeActive: boolean;
  onTogglePickMode: () => void;
}

export function RecordLocationForm({ onSubmit, submitting, pickedCoords, pickModeActive, onTogglePickMode }: RecordLocationFormProps): ReactElement {
  const [source, setSource] = useState<(typeof SOURCE_OPTIONS)[number]['value']>('USER_CONFIRMED');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [accuracyMeters, setAccuracyMeters] = useState('');
  const [observedAt, setObservedAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pickedCoords) {
      setLatitude(pickedCoords.lat.toFixed(6));
      setLongitude(pickedCoords.lng.toFixed(6));
    }
  }, [pickedCoords]);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError('Enter a valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }
    const accuracy = accuracyMeters.trim() === '' ? null : Number(accuracyMeters);
    if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy <= 0)) {
      setError('Accuracy must be a positive number of meters, or left blank.');
      return;
    }

    await onSubmit({
      latitude: lat,
      longitude: lng,
      accuracyMeters: accuracy,
      observedAt: new Date(observedAt).toISOString(),
      source,
      notes: notes.trim() === '' ? null : notes.trim(),
    });
    setLatitude('');
    setLongitude('');
    setAccuracyMeters('');
    setNotes('');
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300">Record a location</h2>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-slate-400">Where did this information come from?</legend>
        {SOURCE_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-800 p-2.5 hover:bg-slate-800/50">
            <input
              type="radio"
              name="source"
              value={opt.value}
              checked={source === opt.value}
              onChange={() => setSource(opt.value)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm text-slate-200">{opt.label}</span>
              <span className="block text-xs text-slate-500">{opt.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-400">
          Latitude
          <input
            type="text"
            inputMode="decimal"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          Longitude
          <input
            type="text"
            inputMode="decimal"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onTogglePickMode}
        className={`w-full rounded-md border px-3 py-1.5 text-xs font-medium ${
          pickModeActive ? 'border-sky-700 bg-sky-950 text-sky-300' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
        }`}
      >
        {pickModeActive ? 'Click the map to set this location...' : 'Pick on map instead'}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-400">
          Accuracy (meters, optional)
          <input
            type="text"
            inputMode="decimal"
            value={accuracyMeters}
            onChange={(e) => setAccuracyMeters(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          When observed
          <input
            type="datetime-local"
            value={observedAt}
            onChange={(e) => setObservedAt(e.target.value)}
            max={toDatetimeLocalValue(new Date())}
            required
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
          />
        </label>
      </div>

      <label className="block text-xs text-slate-400">
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
        />
      </label>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Save location'}
      </button>
    </form>
  );
}
