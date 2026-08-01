import type { ReactElement, ReactNode, RefObject } from 'react';

interface AgentPanelProps {
  title: string;
  badge?: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  footer: ReactNode;
  error?: ReactNode;
}

/** Presentational chrome for the AI Recovery Agent chat - message state/sending logic stays with the caller. */
export function AgentPanel({ title, badge, scrollRef, children, footer, error }: AgentPanelProps): ReactElement {
  return (
    <div className="glass-panel flex h-[32rem] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <h2 className="font-display text-sm font-semibold text-slate-200">{title}</h2>
        {badge}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {children}
      </div>

      {error ? <div className="border-t border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">{error}</div> : null}

      <div className="border-t border-white/10 p-3">{footer}</div>
    </div>
  );
}
