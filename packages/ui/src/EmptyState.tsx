import type { ReactElement, ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps): ReactElement {
  return (
    <div className="glass-panel flex flex-col items-center gap-2 p-10 text-center">
      {icon ? (
        <div className="mb-1 text-3xl opacity-70" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-base font-semibold text-white">{title}</p>
      {description ? <p className="max-w-sm text-sm text-slate-400">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
