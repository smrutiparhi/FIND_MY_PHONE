import type { ReactElement, ReactNode } from 'react';

interface NextActionCardProps {
  title: string;
  reason?: string | null;
  cta?: ReactNode;
  compact?: boolean;
}

/** "The largest CTA should always be the Recovery Decision Engine's current recommended action" (master spec). */
export function NextActionCard({ title, reason, cta, compact = false }: NextActionCardProps): ReactElement {
  return (
    <div className={`glass-panel-inset relative overflow-hidden ${compact ? 'p-3' : 'p-4'}`}>
      <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl" aria-hidden="true" />
      <p className="text-[11px] font-semibold tracking-wide text-cyan-300 uppercase">Next action</p>
      <p className={`mt-1 font-display font-semibold text-white ${compact ? 'text-sm' : 'text-base'}`}>{title}</p>
      {reason ? <p className="mt-1 text-xs text-slate-400">{reason}</p> : null}
      {cta ? <div className="mt-3">{cta}</div> : null}
    </div>
  );
}
