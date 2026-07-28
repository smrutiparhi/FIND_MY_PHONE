import type { ReactElement } from 'react';

export function OfflineBanner(): ReactElement {
  return (
    <div
      role="status"
      className="rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300"
    >
      You&apos;re offline. Showing the last information that was loaded.
    </div>
  );
}
