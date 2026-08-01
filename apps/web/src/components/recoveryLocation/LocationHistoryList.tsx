import type { ReactElement } from 'react';
import type { LocationObservation } from '@recoverai/shared';
import { LocationCard } from '@recoverai/ui';

/** Independent rows, not a route/track - this is a log of individual reports, each with its own provenance (master spec: never present as continuous tracking). */
export function LocationHistoryList({ observations }: { observations: LocationObservation[] }): ReactElement {
  if (observations.length === 0) {
    return (
      <div className="glass-panel p-5 text-sm text-slate-500">
        Current location unavailable - no observations have been recorded yet for this case.
      </div>
    );
  }

  return (
    <div className="glass-panel p-5">
      <h2 className="font-display text-sm font-semibold text-slate-300">Location history</h2>
      <ul className="mt-3 space-y-2">
        {observations.map((obs) => (
          <LocationCard key={obs.id} observation={obs} />
        ))}
      </ul>
    </div>
  );
}
