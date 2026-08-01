import type { ReactElement } from 'react';

export function OfflineBanner(): ReactElement {
  return (
    <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-300 backdrop-blur-sm">
      You&apos;re offline. Showing the last information that was loaded.
    </div>
  );
}
