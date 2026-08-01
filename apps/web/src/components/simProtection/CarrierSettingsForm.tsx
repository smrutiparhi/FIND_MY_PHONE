import { useState, type FormEvent, type ReactElement } from 'react';
import type { SimType, UpdateDeviceSimInfoInput } from '@recoverai/shared';

const SIM_TYPE_OPTIONS: { value: SimType; label: string }[] = [
  { value: 'UNKNOWN', label: "I'm not sure" },
  { value: 'PHYSICAL', label: 'Physical SIM' },
  { value: 'ESIM', label: 'eSIM' },
  { value: 'DUAL', label: 'Both (dual SIM)' },
];

interface CarrierSettingsFormProps {
  currentCarrier: string | null;
  currentSimType: SimType;
  submitting: boolean;
  onSave: (input: UpdateDeviceSimInfoInput) => Promise<void>;
}

/** The wizard never asks for carrier - this is the one place it can be set, since it's the one place it's actually used (carrier-specific guidance). */
export function CarrierSettingsForm({ currentCarrier, currentSimType, submitting, onSave }: CarrierSettingsFormProps): ReactElement {
  const [carrier, setCarrier] = useState(currentCarrier ?? '');
  const [simType, setSimType] = useState<SimType>(currentSimType);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    await onSave({ carrier: carrier.trim() === '' ? null : carrier.trim(), simType });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 glass-panel p-5">
      <h2 className="text-sm font-semibold text-slate-300">Update your carrier</h2>
      <label className="block text-xs text-slate-400">
        Carrier / network provider
        <input
          type="text"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="e.g. Jio, Airtel, Vi, BSNL"
          maxLength={100}
          className="mt-1 w-full rounded-md input-field px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600"
        />
      </label>
      <label className="block text-xs text-slate-400">
        SIM type
        <select
          value={simType}
          onChange={(e) => setSimType(e.target.value as SimType)}
          className="mt-1 w-full rounded-md input-field px-2.5 py-1.5 text-sm text-white"
        >
          {SIM_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}
