import type { IncidentType } from '@recoverai/shared';

/**
 * Everything the draft generator is allowed to know, in one place - the
 * literal boundary of "use only supplied/verified facts" (master spec).
 * Nothing outside this interface ever reaches the prompt.
 */
export interface PoliceComplaintFacts {
  ownerFullName: string;
  ownerContact: string;
  incidentType: IncidentType;
  incidentDateTime: string | null;
  lastKnownPlace: string | null;
  incidentDescription: string;
  deviceDescriptionSnapshot: string;
  imei1: string | null;
  imei2: string | null;
  serialNumber: string | null;
  /** Formatted, or null when no observation exists - never fabricated coordinates (master spec, Part 8's rule applies here too). */
  locationObservationSummary: string | null;
}
