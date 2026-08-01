import type { ReactElement } from 'react';

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

function nowForInput(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function LastSeenWhenStep({ value, onChange }: Props): ReactElement {
  const unknown = value === null;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="lastSeenAt" className="mb-1 block text-sm font-medium text-slate-300">
          Date and time
        </label>
        <input
          id="lastSeenAt"
          type="datetime-local"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
          disabled={unknown}
          max={nowForInput()}
          className="w-full rounded-md input-field px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none disabled:opacity-50"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
        <input
          type="checkbox"
          checked={unknown}
          onChange={(event) => onChange(event.target.checked ? null : nowForInput())}
          className="h-4 w-4 rounded border-white/20 bg-white/5 text-sky-500 focus:ring-cyan-400"
        />
        I don&apos;t remember exactly
      </label>
    </div>
  );
}
