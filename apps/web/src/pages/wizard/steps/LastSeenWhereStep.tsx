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
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
      />
      <p className="mt-1 text-xs text-slate-500">Leave this blank if you&apos;re not sure.</p>
    </div>
  );
}
