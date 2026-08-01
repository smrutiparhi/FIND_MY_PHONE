import type { ReactElement } from 'react';
import type { LocationObservation } from '@recoverai/shared';
import { VerificationTag, type VerificationKind } from './VerificationTag';
import { formatRelativeTime } from '@recoverai/shared';

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

/** One independent report, never a route/track point (master spec: never present as continuous tracking). */
export function LocationCard({ observation }: { observation: LocationObservation }): ReactElement {
  return (
    <li className="glass-panel-inset rounded-2xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono-data text-sm text-slate-200">
          {observation.latitude.toFixed(5)}, {observation.longitude.toFixed(5)}
          {observation.accuracyMeters ? <span className="text-slate-500"> (&plusmn;{observation.accuracyMeters}m)</span> : null}
        </p>
        <VerificationTag kind={VERIFICATION_KIND[observation.verificationStatus]} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {SOURCE_LABELS[observation.source]} &middot; {formatRelativeTime(observation.observedAt)}
      </p>
      {observation.notes ? <p className="mt-1 text-xs text-slate-400">{observation.notes}</p> : null}
    </li>
  );
}
