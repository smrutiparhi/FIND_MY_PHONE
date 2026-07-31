import type { PoliceReport, PoliceReportVersion } from './domain';

/**
 * "Collect verified information" (master spec Part 13) - only the facts
 * that genuinely need the user's own attestation live here. Device details
 * (manufacturer/model/IMEI/serial), incident type, and location
 * observations are never client-supplied - the service assembles those
 * itself from already-verified system records (see
 * services/policeReport/buildDeviceDescriptionSnapshot.ts), so nothing fed
 * to the draft generator is something a client could fabricate.
 */
export interface CreatePoliceReportInput {
  ownerFullName: string;
  ownerContact: string;
  incidentDateTime?: string | null;
  lastKnownPlace?: string | null;
  incidentDescription: string;
}

/** Same shape as creation - "regenerate" means re-running the AI draft against corrected/updated facts, not a different kind of input. */
export type RegeneratePoliceReportDraftInput = CreatePoliceReportInput;

export interface UpdatePoliceReportDraftInput {
  draftText: string;
}

export interface MarkPoliceReportSubmittedInput {
  externalReferenceNumber?: string | null;
}

export interface PoliceReportState {
  report: PoliceReport;
  versions: PoliceReportVersion[];
  /** True whenever the current draft came from MockAiProvider (no real key configured) - shown as a demo badge, same convention as Part 7's chat. */
  isSimulated: boolean;
}
