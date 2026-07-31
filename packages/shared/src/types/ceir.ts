import type { CeirChecklistItem, CeirRecord, RecoveryCase } from './domain';
import type { RecoveryPlan } from './recoveryEngine';

/**
 * "Provide links/actions only to verified official government destinations
 * configured by the application" (master spec) - every entry here is a real,
 * independently-verified government URL as of this writing, the same
 * discipline as Part 11's carrier directory. Never fabricated or guessed.
 */
export interface CeirOfficialLink {
  key: string;
  label: string;
  url: string;
  description: string;
}

/** Deterministic content (submission, processing, blocking, unblocking) - never AI-generated, same discipline as Parts 9/11's guidance sections. */
export interface CeirGuidanceSection {
  key: string;
  title: string;
  body: string;
}

/**
 * Decrypted, ownership-scoped device identifiers - the same accessors and
 * "identifying device information" framing as Part 13's
 * DeviceIdentifyingFacts - shown so the owner can copy them straight into
 * the real CEIR form rather than having to dig them up elsewhere.
 */
export interface CeirDeviceIdentifiers {
  imei1: string | null;
  imei2: string | null;
  serialNumber: string | null;
}

/**
 * A checklist item is "satisfied" when real data already on file for this
 * case would cover it - computed fresh on every read, never persisted or
 * used to auto-check the user's own checklist (see
 * services/ceir/buildCeirChecklistHints.ts). Purely informational: it never
 * blocks a status change and is never treated as if the user confirmed it.
 */
export interface CeirChecklistHint {
  item: CeirChecklistItem;
  label: string;
  satisfied: boolean;
  detail: string;
}

/** NOT_READY is only ever the initial default - never a client-chosen transition, mirrors SimStatus's ACTIVE. */
export const USER_SETTABLE_CEIR_STATUSES = [
  'READY',
  'SUBMITTED',
  'PROCESSING',
  'BLOCKED',
  'UNBLOCK_REQUESTED',
  'UNBLOCKED',
  'UNKNOWN',
] as const;
export type UserSettableCeirStatus = (typeof USER_SETTABLE_CEIR_STATUSES)[number];

export interface UpdateCeirRecordInput {
  status?: UserSettableCeirStatus;
  /** The id issued by the real CEIR/Sanchar Saathi portal - purely user-entered, this app never generates or fabricates one. */
  ceirRequestId?: string | null;
  submissionDate?: string | null;
  notes?: string | null;
  checklistCompletedItems?: CeirChecklistItem[];
}

/**
 * Returned by both GET and PATCH ceir - recoveryCase/recoveryPlan are always
 * freshly recalculated (cheap, idempotent when nothing changed), exactly like
 * every other Part 9/11/12/13 status endpoint.
 */
export interface CeirState {
  record: CeirRecord;
  deviceIdentifiers: CeirDeviceIdentifiers;
  checklistHints: CeirChecklistHint[];
  guidanceSections: CeirGuidanceSection[];
  officialLinks: CeirOfficialLink[];
  recoveryCase: RecoveryCase;
  recoveryPlan: RecoveryPlan;
}
