import type { ReactElement } from 'react';
import type { LocationObservation } from '@recoverai/shared';
import { VerificationTag, type VerificationKind } from '../recoveryCase/VerificationTag';
import { formatRelativeTime } from '../../lib/formatRelativeTime';

const SOURCE_LABELS: Record<LocationObservation['source'], string> = {
  AUTHORIZED_INTEGRATION: 'Authorized integration',
  USER_CONFIRMED: 'Confirmed in Find My / Find Hub',
  USER_ENTERED: 'Entered from memory',
  OTHER_VERIFIED_SOURCE: 'Verified source',
};

const VERIFICATION_KIND: Record<LocationObservation['verificationStatus'], VerificationKind> = {
  SYSTEM_VERIFIED: 'system',
  USER_REPORTED: 'user',
  AI_GENERATED: 'ai',
  EXTERNAL_VERIFIED: 'external',
  UNVERIFIED: 'user',
};

/** Independent rows, not a route/track - this is a log of individual reports, each with its own provenance (master spec: never present as continuous tracking). */
export function LocationHistoryList({ observations }: { observations: LocationObservation[] }): ReactElement {
  if (observations.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-sm text-slate-500">
        Current location unavailable - no observations have been recorded yet for this case.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300">Location history</h2>
      <ul className="mt-3 space-y-2">
        {observations.map((obs) => (
          <li key={obs.id} className="rounded-md border border-slate-800 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-200">
                {obs.latitude.toFixed(5)}, {obs.longitude.toFixed(5)}
                {obs.accuracyMeters ? <span className="text-slate-500"> (&plusmn;{obs.accuracyMeters}m)</span> : null}
              </p>
              <VerificationTag kind={VERIFICATION_KIND[obs.verificationStatus]} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {SOURCE_LABELS[obs.source]} &middot; {formatRelativeTime(obs.observedAt)}
            </p>
            {obs.notes ? <p className="mt-1 text-xs text-slate-400">{obs.notes}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
