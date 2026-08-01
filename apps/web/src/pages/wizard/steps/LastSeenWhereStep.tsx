import type { ReactElement } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function LastSeenWhereStep({ value, onChange }: Props): ReactElement {
  return (
    <div>
      <label htmlFor="lastSeenDescription" className="mb-1 block text-sm font-medium text-slate-300">
        Where do you think it was? (optional)
      </label>
      <textarea
        id="lastSeenDescription"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder="e.g. On the train platform, or at home in the living room"
        className="w-full rounded-md input-field px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
      />
      <p className="mt-1 text-xs text-slate-500">Leave this blank if you&apos;re not sure.</p>
    </div>
  );
}
