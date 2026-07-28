import type { ReactElement } from 'react';

interface CheckboxOptionProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function CheckboxOption({ checked, onChange, label }: CheckboxOptionProps): ReactElement {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
        checked ? 'border-sky-500 bg-sky-950/60' : 'border-slate-700 bg-slate-900 hover:border-slate-600'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
      />
      <span className="text-sm font-medium text-slate-100">{label}</span>
    </label>
  );
}
