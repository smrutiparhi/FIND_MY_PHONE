# CEIR Assistant for India (Part 14)

Helps a case owner prepare for and track the official Government of India CEIR/Sanchar Saathi
IMEI-blocking process - the checklist, the real portal links, and a place to record what actually
happened there - without RecoverAI ever claiming to have blocked an IMEI itself.

## The schema already existed - Part 14 is the service layer on top

`ceir_records` (`0011_ceir_records.sql`) and `CeirRecordRepository` were both built in Part 2, well
before this part - the same pattern as `police_report_versions` before Part 13 and
`sim_protection_records` before Part 11: the full data model ships early, and each numbered part
adds the service/controller/route/frontend layer that actually uses it. The repository's own doc
comment already stated the ground rule this part had to honor: "`ceir_request_id` is purely
user-entered ... never generated or fabricated by RecoverAI."

## RecoverAI never blocks an IMEI

The master spec: "Never claim RecoverAI can directly block an IMEI unless a legitimate government
integration explicitly supports it and confirmation is received." No such integration exists.
Every field on the record - `status`, `ceirRequestId`, `submissionDate`, `notes` - comes straight
from the request body in `ceirService.ts`'s `updateCeirRecord()`; nothing is inferred, generated, or
defaulted to a "success" value. `CeirOfficialLinksCard.tsx` says this directly and only ever links
out to the real CEIR portal and the parent Sanchar Saathi citizen portal
(`services/ceir/ceirOfficialLinks.ts`) - both independently verified Government of India URLs, the
same "verified official destinations, never fabricated" discipline as Part 11's carrier directory.

## Real device identifiers, decrypted for the owner

The checklist's "IMEI information" item needs more than a yes/no - the CEIR form itself asks the
owner to type the actual IMEI in. `ceirService.ts` reuses Part 13's `buildDeviceDescriptionSnapshot`
(the same ownership-scoped `getDecryptedImei1/2/SerialNumber` accessors, no new decryption path) to
return the real values as `CeirState.deviceIdentifiers`, and `CeirDeviceIdentifiersCard.tsx` renders
them for the owner to copy straight into the government form - exactly the "must display the real
value" case `docs/DATABASE.md`'s encryption section already called out for this part. The checklist
hint itself stays a cheap presence check (`device.imei1Encrypted !== null`, no decryption) since it's
only ever used as a boolean "on file" badge, not displayed - decrypting is reserved for the one place
the real value is actually needed.

## Checklist hints are informational, never authoritative

The master spec's checklist (IMEI, mobile number, device details, police report, identity document,
purchase invoice, replacement SIM status, other) is stored as a plain user-toggled array on the
record (`checklist_completed_items`), exactly like Part 9's account-access signals - RecoverAI never
auto-checks a box on the user's behalf. `buildCeirChecklistHints.ts` separately computes, fresh on
every read, whether real data already on file for the case *would* cover each item - IMEI on the
device, a filed police complaint (Part 13), a resolved SIM status (Part 11), a purchase invoice
already in the Evidence Vault (Part 13's pattern for creating Evidence rows) - and surfaces it as an
"on file" hint next to the checkbox. Two items (identity document, other) have no equivalent
anywhere in this app and are always reported unsatisfied - that's accurate reporting, not a bug. The
hint is read-only content; it is never written into `checklist_completed_items` itself.

## Guidance content, deterministic

`generateCeirGuidance()` is a pure function - the same "rules, not a prompt" discipline as Parts
9/11 - covering what CEIR does, why a filed police complaint has to come first (cross-referencing
Part 13's status), what the form asks for, what happens after submission, and - the master spec's
explicit "when the device is recovered, explain the legitimate unblocking workflow" - a section on
requesting an unblock once the device is back in hand. That section is always present rather than
gated behind a "case marked recovered" feature (no such toggle exists yet anywhere in the app) -
it's naturally relevant once a case has reached `BLOCKED` or beyond, and harmless to show earlier.

## Status transitions, mirrored from Part 11's SIM Protection pattern

`NOT_READY` is the only status never client-settable (mirrors `SimStatus.ACTIVE`). Reaching
`SUBMITTED`, `PROCESSING`, `BLOCKED`, or `UNBLOCKED` for the first time - the same set
`evaluateRecoveryDecision.ts` already uses to decide the `CEIR_SUBMISSION` action is no longer an
open candidate - completes that action and recalculates the engine, exactly like Part 13's
`markPoliceReportSubmitted`. The frontend requires an explicit two-step confirmation before sending
`SUBMITTED`, `BLOCKED`, or `UNBLOCKED` (`CeirStatusControl.tsx`), since each is a "critical external
action" per the master spec's cross-part confirmation requirement.

The very first arrival at `SUBMITTED` - and only that transition - logs a `CEIR_SUBMITTED` timeline
event and, if a Request ID has actually been recorded, creates an `Evidence` row
(`category: 'CEIR_ACKNOWLEDGEMENT'`) linked to it via `evidenceId`, the same "add to the Evidence
Vault where appropriate" pattern Part 13 established for approved complaints - "where appropriate"
here means only once there is something concrete to acknowledge. Every other status change logs a
plain `CEIR_STATUS_UPDATED` event instead. Both event types, and the completion check, are gated on
`input.status !== undefined && input.status !== existing.status` - an update that only edits notes
or the checklist never re-fires them, so re-saving the same status twice can't duplicate a timeline
entry or re-attempt completing an already-completed action.

## A pre-existing patch-construction bug, avoided here (and worth fixing elsewhere)

While wiring `updateCeirRecord()`, a real bug surfaced in the established
`field: 'field' in input ? input.field : undefined` idiom used by Part 9's account recovery, Part
11's SIM protection, and Part 12's financial security to build a partial-update patch object: in
JavaScript, an object literal that explicitly assigns a key - even to `undefined` - still satisfies
`'field' in patch` on the receiving repository, which those repositories use as their own
presence-check for "was this field actually meant to change." The result: any update that omits an
optional field (e.g. changing only `status`) silently wipes that field to `null`, because the
service-constructed patch object always carries the key. `ceirService.ts` avoids this by building
its patch with conditional spreads (`...(field !== undefined ? { field } : {})`) so an omitted field
is truly absent from the object, not just `undefined` - verified by
`ceirService.test.ts`'s "an update that omits a field never wipes what was already recorded for it".
The three earlier call sites still have the original bug and were left as-is, since fixing them is
outside this part's scope.

## API

- `GET /api/recovery-cases/:caseId/ceir` - lazily creates the record if needed, returns it plus
  checklist hints, guidance sections, official links, and a freshly recalculated case/plan.
- `PATCH /api/recovery-cases/:caseId/ceir` - updates any of `status` (`READY`/`SUBMITTED`/
  `PROCESSING`/`BLOCKED`/`UNBLOCK_REQUESTED`/`UNBLOCKED`/`UNKNOWN` - `NOT_READY` is never
  client-settable), `ceirRequestId`, `submissionDate`, `notes`, and `checklistCompletedItems`,
  independently.
