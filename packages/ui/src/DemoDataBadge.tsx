import type { ReactElement } from 'react';

/** "Every simulated item must visibly display: DEMO DATA" (master spec, Part 22, verbatim). */
export function DemoDataBadge({ className = '' }: { className?: string }): ReactElement {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-fuchsia-400/50 bg-fuchsia-400/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-fuchsia-200 uppercase ${className}`}
    >
      <span aria-hidden="true">🎬</span> Demo data
    </span>
  );
}
