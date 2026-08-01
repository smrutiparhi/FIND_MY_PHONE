# Device Recovered Workflow (Part 18)

What happens when the user selects "I found my phone" - a guided review, not an immediate close,
ending in a final case summary and an explicit decision to close.

## Do not immediately close the case

"When the user selects 'I found my phone', do not immediately close the case" (master spec,
verbatim). Clicking the entry point (a banner on the Recovery Dashboard, visible on any
non-`CLOSED` case) never itself changes anything - it navigates to `/recovery-cases/:caseId/recovered`,
which first asks a single yes/no question: do you actually have the device in hand right now? Only
confirming that - `CONFIRM_POSSESSION` entering the checklist's `completedItems` for the first time
- is a real state change: `recovery_cases.status` moves to `RECOVERED`, a `DEVICE_RECOVERED`
timeline event is logged (the first part to ever fire it - see [`TIMELINE.md`](TIMELINE.md), which
deliberately left this event type unwired pending this part), and `recoveredAt` is stamped for the
final summary. Every other checklist item is pure self-attested bookkeeping with no side effect -
each one already has its own dedicated flow elsewhere in the app (SIM Protection, CEIR, Account
Recovery, Financial Security, Evidence Vault) that the item's own link points at; this checklist
only reminds the user to go visit them, exactly the master spec's "guide them through" framing
rather than a re-implementation of any of those flows.

## The ten-item checklist

Verbatim from the master spec, minus "Close case" (the terminal action itself, not a review item):
confirm possession, check for unexpected changes, restore SIM if appropriate, review Apple/Google
account security, review email/account sessions, review financial apps, change credentials when
warranted, handle CEIR unblocking if previously blocked, restore device settings, preserve incident
evidence. Several are explicitly conditional ("if appropriate", "if previously blocked", "when
warranted") - checking one only ever means "I reviewed this," never a claim that a specific
real-world condition was true, so the schema stores a flat `completed_items` array rather than a
three-state (done/not-applicable/pending) model for each item.

## Closing requires reviewing, not completing, unresolved actions

"Allow the user to close the case only after reviewing unresolved actions" - read literally, not as
"only after every action is complete" (a device recovered quickly might never need a police report
filed at all, so requiring full completion would be wrong). The close-case screen shows every
`RecoveryPlanAction` not yet `COMPLETED`/`SKIPPED` (excluding `MONITOR`, a perpetual catch-all, never
a discrete "unresolved" item) directly above an explicit checkbox - "I've reviewed the unresolved
actions above and want to close this case anyway" - which the API requires as
`confirmedUnresolvedActionsReviewed: true`. The server can't observe that a user actually read the
list; requiring the affirmative flag is the same pattern used for every other consequential action
in this app (marking a SIM blocked, approving a police complaint, ...).

## Two independent timestamps, not one

`recovery_cases.closed_at` already existed (Part 2) and auto-sets on the *first* transition into a
terminal status (`RECOVERED`, `ERASED`, or `CLOSED`) - fine when a case goes straight to one terminal
state, but this part's own flow deliberately goes `RECOVERED` first and `CLOSED` later, which would
otherwise conflate "recovery date" and "case closed date" into the same column. `device_recovery_
checklists` carries its own `recovered_at`/`closed_at`, set exactly once each by the service layer,
so the master spec's "incident date, recovery date" fields in the final summary are never ambiguous.

## The final case summary is not the sanitized Timeline export

Part 16 already built a "sanitized case summary" - deliberately built to omit exact location and
other sensitive data, meant for handing to someone else. Part 18's "final case summary" is a
different document with an explicit field list ("incident date, recovery date, actions completed,
important status changes, location observations, police status, CEIR status") that names *real*
location observations as a required field - so `buildFinalCaseSummary.ts` is its own pure function,
not a reuse of Part 16's redaction-by-omission approach. This is the user's own closing record, not
something designed to be shared externally.

## API

- `GET /api/recovery-cases/:caseId/device-recovery` - lazily creates the checklist, returns it plus
  the current plan and the list of unresolved actions.
- `PATCH /api/recovery-cases/:caseId/device-recovery` - update `completedItems`/`notes`; the
  `CONFIRM_POSSESSION`-first-appears transition is handled here.
- `POST /api/recovery-cases/:caseId/device-recovery/close` - requires
  `confirmedUnresolvedActionsReviewed: true`; moves the case to `CLOSED` and logs `CASE_CLOSED`.
- `GET /api/recovery-cases/:caseId/device-recovery/summary` - the final case summary, previewable
  any time after recovery, not only after closing.

## A real performance bug the browser screenshot caught

Verifying this page against the running app (not just `tsc`/tests) - clicking through the actual
flow in a headless browser - caught something the HTTP-only verification couldn't: toggling a
single checklist checkbox was taking several seconds to visibly update. The cause was
`DeviceRecoveredPage.tsx`'s original `load()` re-fetching the *final case summary* after every
single checklist mutation - an expensive call (a full Recovery Decision Engine recalculation plus
five more reads) that has nothing to do with which checklist items are checked, since
`FinalCaseSummary` doesn't include checklist state at all. Fixed by splitting the refresh into
`loadChecklistOnly()` (used by every checklist toggle) and the original `load()` (reserved for
confirming possession and closing the case, the two transitions that can actually change the
summary) - measured to roughly halve the round trip. The same browser test also caught a second,
smaller UI bug: the original always-flash-to-loading `load()` unmounted `CloseCasePanel` on every
refresh, silently resetting its local "I've reviewed the unresolved actions" confirmation checkbox
if the user had already ticked it before toggling another checklist item - fixed by only showing the
full loading state on the very first load, never on a background refresh.

## A real bug this part's tests caught

Adding `device_recovery_checklist_item[]` as a new Postgres enum array column reproduced a class of
bug this codebase has a documented fix for but requires remembering per-table: `node-pg` has no
built-in parser for a custom enum array type, so without registering one, `completed_items` came
back from every query as the raw literal string `"{}"` instead of a JS array. Caught immediately by
the first integration test (`expected '{}' to deeply equal []`) rather than shipping silently
broken. Fixed by adding `device_recovery_checklist_item` to `db/arrayTypeParsers.ts`'s registered
list, alongside the three enum array types that needed the same fix in earlier parts.
