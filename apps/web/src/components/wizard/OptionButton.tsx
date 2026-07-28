import type { ReactElement, ReactNode } from 'react';

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: ReactNode;
}

export function OptionButton({ selected, onClick, label, description }: OptionButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-sky-500 bg-sky-950/60 text-white'
          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600'
      }`}
    >
      <span className="block text-sm font-medium">{label}</span>
      {description ? <span className="mt-0.5 block text-xs text-slate-400">{description}</span> : null}
    </button>
  );
}
