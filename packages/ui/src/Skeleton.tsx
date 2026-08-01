import type { ReactElement } from 'react';

export function Skeleton({ className = '' }: { className?: string }): ReactElement {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }): ReactElement {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

/** Generic loading placeholder shaped like a GlassCard - wrap the page section in role="status" for a11y. */
export function SkeletonCard({ className = '' }: { className?: string }): ReactElement {
  return (
    <div className={`glass-panel p-5 ${className}`.trim()}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-6 w-2/3" />
      <SkeletonText lines={2} className="mt-4" />
    </div>
  );
}

/** Wrap any loading section with this so screen readers announce "Loading" once, while the visual skeletons stay decorative. */
export function LoadingRegion({ label = 'Loading', children }: { label?: string; children: ReactElement }): ReactElement {
  return (
    <div role="status" aria-label={label}>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
