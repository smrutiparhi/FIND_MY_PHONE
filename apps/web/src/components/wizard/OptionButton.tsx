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
          ? 'border-cyan-400 bg-cyan-400/10 text-white'
          : 'border-white/15 bg-white/[0.04] text-slate-200 hover:border-white/30'
      }`}
    >
      <span className="block text-sm font-medium">{label}</span>
      {description ? <span className="mt-0.5 block text-xs text-slate-400">{description}</span> : null}
    </button>
  );
}
