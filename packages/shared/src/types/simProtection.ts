import type { RecoveryCase, SimProtectionRecord, SimType } from './domain';
import type { RecoveryPlan } from './recoveryEngine';

/**
 * The wizard (Part 5) never collects carrier at all, and there's no other
 * device-editing surface yet - this is the one place a user can set it,
 * since it's the one place it's actually needed. Deliberately narrower than
 * a general "edit device" input.
 */
export interface UpdateDeviceSimInfoInput {
  carrier?: string | null;
  simType?: SimType;
}

/**
 * "Carrier-specific instructions should come from maintained configuration/
 * content and should clearly link/route users to official carrier channels
 * where applicable" (master spec) - the API only ever hands back real,
 * verified official URLs (see services/simProtection/carrierDirectory.ts on
 * the backend), never a fabricated or guessed one. `phone` is omitted
 * entirely (not a placeholder) for carriers whose support number isn't
 * confidently stable (e.g. varies by circle).
 */
export interface CarrierGuide {
  carrierKey: string;
  displayName: string;
  websiteUrl: string | null;
  phone: string | null;
  phoneNote: string | null;
}

/** Deterministic content (blocking, eSIM, replacement, OTP impact, number recovery) - never AI-generated, same discipline as Part 9's recovery path. */
export interface SimGuidanceSection {
  key: string;
  title: string;
  body: string;
}

/** ACTIVE is only ever the initial default - never a client-chosen transition, mirrors AccountRecoveryStatus's NOT_STARTED. */
export const USER_SETTABLE_SIM_STATUSES = ['BLOCK_REQUESTED', 'BLOCKED', 'REPLACEMENT_PENDING', 'REPLACED', 'UNKNOWN'] as const;
export type UserSettableSimStatus = (typeof USER_SETTABLE_SIM_STATUSES)[number];

export interface UpdateSimProtectionRecordInput {
  status?: UserSettableSimStatus;
  notes?: string | null;
}

export interface SimProtectionState {
  record: SimProtectionRecord;
  carrierGuide: CarrierGuide;
  guidanceSections: SimGuidanceSection[];
  recoveryCase: RecoveryCase;
  recoveryPlan: RecoveryPlan;
}
