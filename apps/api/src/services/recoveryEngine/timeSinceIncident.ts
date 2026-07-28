import type { TimeSinceIncidentBucket } from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Buckets a raw timestamp into the coarse ranges the engine reasons about.
 * `referenceIso` should be the best incident-time signal a case has -
 * occurredAt if known, else lastSeenAt - never invented when both are null.
 */
export function computeTimeSinceIncidentBucket(referenceIso: string | null, now: Date = new Date()): TimeSinceIncidentBucket {
  if (!referenceIso) return 'UNKNOWN';
  const referenceTime = new Date(referenceIso).getTime();
  if (Number.isNaN(referenceTime)) return 'UNKNOWN';

  const elapsedMs = now.getTime() - referenceTime;
  if (elapsedMs < HOUR_MS) return 'JUST_NOW';
  if (elapsedMs < DAY_MS) return 'TODAY';
  if (elapsedMs < 7 * DAY_MS) return 'THIS_WEEK';
  return 'OLDER';
}
