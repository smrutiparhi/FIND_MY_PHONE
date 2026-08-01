# Timeline + Case Tracking (Part 16)

A chronological (and reverse-chronological) record of everything that happened on a case, plus a
sanitized export a user can hand to someone else without leaking IMEI, exact location, or file
contents.

## Almost everything already existed

`timeline_events`, its full event-type enum, and the repository were all built in Part 2 -
`updateUserNote`/`deleteUserNote` already guarded `type = 'USER_NOTE'` directly in their SQL WHERE
clauses, and every part from 6 through 15 was already calling `repos.timelineEvents.create()` at
its own significant moments. Part 16 is mostly the presentation layer this data was always waiting
for: a route, chronological/reverse-chronological listing, note editing, and export. See
`services/timeline/timelineService.ts`.

## Two gaps this part closed

Auditing the master spec's own "automatically create events for..." list against what actually
fires turned up two real gaps - both `DEVICE_FINDING_OPENED` and `DEVICE_SECURED` are named in the
spec but, unlike every other event type, had no code path that ever created them. Every other
automatic event is logged by a dedicated per-feature flow (SIM Protection, Account Recovery, ...),
but `LOCATE_DEVICE` and `SECURE_DEVICE` have no dedicated flow anywhere in the app - the only place
either action is ever actually transitioned is the generic `PATCH /:caseId/actions/:actionId`
endpoint (`updateActionStatus` in `recoveryCase.controller.ts`). That's where the fix belongs:
transitioning `LOCATE_DEVICE` into `IN_PROGRESS` now logs `DEVICE_FINDING_OPENED`, and transitioning
`SECURE_DEVICE` into `COMPLETED` now logs `DEVICE_SECURED` - both gated on the specific transition
(previous status differs from the new one) so a redundant PATCH never double-logs.

`DEVICE_RECOVERED`, `DEVICE_ERASED`, and `CASE_CLOSED` are deliberately **not** wired up here -
nothing in the app can transition a case into those states yet, because that's explicitly Part 18's
job ("Device recovered workflow"). Their timeline event types already exist in the enum, waiting for
Part 18 the same way `ceir_records` waited for Part 14.

## Immutable system events, editable user notes

"Allow user notes but prevent users from modifying immutable system audit events" (master spec) -
enforced twice. The repository's `updateUserNote`/`deleteUserNote` only ever touch a row where
`type = 'USER_NOTE'`, so a system event can't be altered even by a future bug in calling code.
`timelineService.ts` checks the type *before* attempting the mutation and throws a `ForbiddenError`
(403) rather than a misleading `NotFoundError` (404) when it isn't a note - a client (or a user
poking the API directly) gets a clear "this is immutable" signal instead of "doesn't exist."

## Sanitized export: correct by construction, not by redaction

"Export a sanitized case summary that excludes secrets and unnecessary sensitive data." The
straightforward approach would be a redaction pass - walk every field, strip anything sensitive.
`buildSanitizedCaseSummary.ts` doesn't need one, because of a privacy boundary every earlier part
already built for an unrelated reason: a `TimelineEvent`'s own `title`/`description` never embed a
raw IMEI, exact coordinates, or file contents - those live only in the *linked* rows
(`location_observations`, `evidence`, `ceir_records`, ...), reached only through a separate,
explicit, ownership-scoped call. `recordLocationObservation.ts`'s timeline title is the generic
"Location observation recorded," never the coordinates; Part 15's `EVIDENCE_UPLOADED` title names
only the category, never the filename or file bytes; Part 14's CEIR events never embed the Request
ID in their own title text. `buildSanitizedCaseSummary()` builds its output purely from
`TimelineEvent` rows' own fields plus a short device block (nickname/manufacturer/model/platform/
carrier - deliberately never `imei1Encrypted`/`imei2Encrypted`/`serialNumberEncrypted`, not even in
encrypted form). Because it never joins out to the sensitive linked tables at all, there's no
secret-bearing field available to leak by forgetting to redact it - the sanitization is a property
of what data the function has access to, not a filter it has to remember to apply. A unit test
proves this holds even when the input `Device` carries populated encrypted IMEI/serial fields.

## Export format and delivery

The summary is a single plain-text string, generated fresh on every request (never cached, since
the underlying timeline can change), returned as JSON and turned into a `.txt` download client-side
via a Blob - the same pattern Part 13 already used for exporting a police complaint draft.

## API

- `GET /api/recovery-cases/:caseId/timeline?order=asc|desc` - list events (default `desc`, newest
  first).
- `POST /api/recovery-cases/:caseId/timeline/notes` - add a `USER_NOTE`.
- `PATCH /api/recovery-cases/:caseId/timeline/notes/:eventId` - edit a note (403 on a system event).
- `DELETE /api/recovery-cases/:caseId/timeline/notes/:eventId` - delete a note (403 on a system
  event).
- `GET /api/recovery-cases/:caseId/timeline/export` - the sanitized summary, `{ summary,
  generatedAt }`.
