import type { ReactElement, ReactNode } from 'react';

interface EmergencyBannerProps {
  title: string;
  description?: string;
  cta?: ReactNode;
}

/** Urgent, high-contrast call-to-action for CRITICAL/HIGH-risk moments - Emergency Mode, and any page that should surface it. */
export function EmergencyBanner({ title, description, cta }: EmergencyBannerProps): ReactElement {
  return (
    <div className="glass-panel-critical pulse-critical flex flex-wrap items-center justify-between gap-4 p-4" role="alert">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-lg" aria-hidden="true">
          ⚠
        </span>
        <div>
          <p className="text-sm font-semibold text-rose-200">{title}</p>
          {description ? <p className="mt-0.5 text-xs text-rose-300/80">{description}</p> : null}
        </div>
      </div>
      {cta ? <div className="shrink-0">{cta}</div> : null}
    </div>
  );
}
