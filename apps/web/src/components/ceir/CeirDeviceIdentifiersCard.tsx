import type { ReactElement } from 'react';
import type { CeirDeviceIdentifiers } from '@recoverai/shared';

const ROWS: { key: keyof CeirDeviceIdentifiers; label: string }[] = [
  { key: 'imei1', label: 'IMEI 1' },
  { key: 'imei2', label: 'IMEI 2' },
  { key: 'serialNumber', label: 'Serial number' },
];

/** Decrypted only for the confirmed owner (see repos.devices.getDecryptedImei1/2/SerialNumber) - shown so it can be copied straight into the CEIR form. */
export function CeirDeviceIdentifiersCard({ identifiers }: { identifiers: CeirDeviceIdentifiers }): ReactElement {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300">Your device identifiers</h2>
      <p className="mt-1 text-xs text-slate-500">Copy these into the CEIR form.</p>
      <dl className="mt-3 space-y-2">
        {ROWS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className={`text-sm ${identifiers[key] ? 'font-mono text-white' : 'text-slate-600'}`}>
              {identifiers[key] ?? 'not on file'}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
