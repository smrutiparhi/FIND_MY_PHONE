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
        checked ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/15 bg-white/[0.04] hover:border-white/30'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-white/5 text-sky-500 focus:ring-cyan-400"
      />
      <span className="text-sm font-medium text-slate-100">{label}</span>
    </label>
  );
}
