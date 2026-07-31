# SIM/eSIM Protection Center (Part 11)

Guides a case owner through blocking a compromised SIM, understanding eSIM-specific risk, getting a
replacement, and knowing exactly when OTP-based recovery (Apple/Google account recovery, banking)
comes back online - without RecoverAI ever claiming to have blocked anything itself.

## RecoverAI never blocks a SIM

The master spec is explicit: "Do not pretend RecoverAI itself blocked a SIM unless a legitimate
carrier API confirms the action." No such API integration exists (or is claimed to exist) anywhere
in this app. `CarrierGuideCard.tsx` says so directly and only ever links to the carrier's own
official website/phone number; every status transition in `sim_protection_records` is the user
reporting what *they* did (`source: 'USER'`, `verificationStatus: 'USER_REPORTED'` on every
resulting `TimelineEvent`), never RecoverAI attesting to an action it performed.

## A dedicated status, distinct from the RecoveryAction - and from itself

`sim_status` (`ACTIVE/BLOCK_REQUESTED/BLOCKED/REPLACEMENT_PENDING/REPLACED/UNKNOWN`) is its own enum
for the same reason `AccountRecoveryStatus` and `CeirStatus` are: the generic
`RecoveryActionStatus` lifecycle the Recovery Decision Engine (Part 6) governs can't express
"carrier confirmed blocked" vs. "replacement requested but not in hand yet." Worth calling out
explicitly: `sim_status.BLOCKED` and `recovery_action_status.BLOCKED` share a name but mean opposite
things - one says the SIM itself has been blocked by the carrier (good, secured), the other says a
recovery action is stuck waiting on an unmet dependency (not started). They're never compared to
each other; nothing in this codebase reads one enum's value against the other's.

## Store only necessary carrier/SIM metadata

`sim_protection_records` has exactly two real columns: `status` and `notes`. Carrier name and SIM
type already live on `devices` (Part 2) and are read from there (`services/simProtection/
carrierDirectory.ts`, `generateSimGuidance.ts`) - never duplicated onto a second table, per the
master spec's explicit "store only necessary carrier/SIM metadata."

This surfaced a real gap while building this part: the incident wizard (Part 5) never collects
`carrier` at all, and no device-editing surface existed anywhere yet ("My Devices" is still a
placeholder pending a later part) - so a device's `carrier` was always `null` in practice, and
carrier-specific guidance would never actually activate. `PATCH /api/devices/:deviceId`
(`updateDeviceSimInfoSchema`) closes that gap, but deliberately narrowly: it only accepts `carrier`
and `simType`, the two fields this part needs editable, not a general "edit device" endpoint - full
device management stays deferred to whenever that gets built out on its own.

## Carrier-specific instructions come from maintained configuration

`carrierDirectory.ts` is a small, hand-maintained list (Jio, Airtel, Vi, BSNL) matching a device's
free-text `carrier` field by whole word (never a raw substring - "Virgin Mobile" doesn't
false-positive match "Vi"), each entry carrying an independently-verified official website and,
where a stable one exists, a phone number. BSNL's toll-free number varies by telecom circle in
India, so none is hardcoded there - the official website is given instead rather than guessing.
An unrecognized or missing carrier falls back to generic guidance ("check your carrier's official
app/website/bill") rather than fabricating a channel. This is exactly the master spec's "carrier-
specific instructions should come from maintained configuration/content" - a config list a future
content update can extend without touching the request-handling logic around it.

## Guidance content, deterministic

`generateSimGuidance()` is a pure function - the same "rules, not a prompt" discipline as Part 9's
account-recovery path - covering the master spec's Part 11 checklist verbatim: SIM blocking, eSIM
considerations, replacement SIM, mobile-number recovery, impact on OTPs, and account recovery after
number restoration. Content adapts to the device's real `simType` (a physical SIM gets told eSIM
risk doesn't apply, rather than an irrelevant eSIM section) and `incidentType` (STOLEN gets more
urgent framing on the blocking step than LOST).

## When status changes

Master spec, verbatim: "When status changes, create TimelineEvent and recalculate the Recovery
Decision Engine." `updateSimProtectionRecord.ts` does both on every write. `BLOCKED` and `REPLACED`
both mean the original SIM can no longer be used against the owner, so either one completes the
case's `SIM_PROTECTION` action and persists `simAccessStatus: 'SIM_ALREADY_BLOCKED'` through
`recalculateRecoveryCase()`'s overrides (the same mechanism Part 7's Recovery Agent and Part 9's
account-recovery flow use) - robust even on a case with no `SIM_PROTECTION` action to complete.
This has a real, testable knock-on effect: an `ACCOUNT_RECOVERY` action that Part 6 made dependent
on SIM access (`simAccess === 'LOST_WITH_PHONE'`) flips from `BLOCKED` to `PENDING` the moment the
SIM is secured.

## API

- `GET /api/recovery-cases/:caseId/sim-protection` - lazily creates the record if needed, returns it
  plus the carrier guide, guidance sections, and a freshly recalculated case/plan.
- `PATCH /api/recovery-cases/:caseId/sim-protection` - updates `status` (`BLOCK_REQUESTED`/
  `BLOCKED`/`REPLACEMENT_PENDING`/`REPLACED`/`UNKNOWN` - `ACTIVE` is never client-settable) and/or
  `notes`. `BLOCKED` and `REPLACED` require an explicit two-step confirmation on the frontend before
  the request is even sent, since both are "critical external actions" per the master spec.
