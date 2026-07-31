# Police Complaint Generator (Part 13)

Drafts a formal police complaint for a lost or stolen phone from verified facts, with the user
approving the final text before anything is treated as ready to file - RecoverAI never files it,
and never claims to have.

## The one part that's genuinely AI-generated

Every other guided flow in this app (Account Recovery Mode, the SIM Protection Center, the
Financial Security Center) is deliberately deterministic - "rules, not a prompt" - because their
output is a small, enumerable set of instructional steps. A police complaint isn't: it's a coherent
narrative document combining structured facts into formal prose, which is exactly the kind of
language task an LLM is suited for. The master spec agrees explicitly here: "Generate a professional
complaint draft... The AI must..." - so Part 13 is the first (and, by design, only) part that routes
actual case content through the Part 7 `AiProvider` abstraction to generate prose, rather than
selecting from pre-written text.

## Grounding: only supplied/verified facts

Every fact the model can possibly see lives in one interface,
`services/policeReport/policeComplaintFacts.ts`'s `PoliceComplaintFacts` - nothing outside it ever
reaches the prompt. Two kinds of facts populate it, and both are genuinely trustworthy:

- **User-attested** (`ownerFullName`, `ownerContact`, `incidentDateTime`, `lastKnownPlace`,
  `incidentDescription`): whatever the user just typed into the form, sent as-is.
- **System-verified** (device details, IMEI/serial, incident type, the latest location
  observation): assembled server-side by `buildDeviceDescriptionSnapshot.ts` from the case's own
  records - never client-supplied, so a request body has no way to inject a fact the system doesn't
  actually have on file. IMEI/serial come from the same ownership-scoped decrypt accessors Part 2
  built (`getDecryptedImei1/2/SerialNumber`).

Every missing fact is explicitly labeled `not provided` in the prompt (`policeComplaintSystemPrompt.ts`'s
`factLine()`) rather than omitted - an LLM is far less likely to invent something when the absence
is stated plainly than when a field is just missing from context.

## The system prompt is the primary control; the output guard is the backstop

`policeComplaintSystemPrompt.ts` states the master spec's "The AI must" list nearly verbatim: never
invent an IMEI, an address, or a suspect; never state theft as settled fact unless the incident type
is actually `STOLEN`; represent uncertainty as uncertainty. `policeComplaintOutputGuard.ts` then
mechanically re-checks the generated text against the same facts it was given - a long digit run
when no IMEI was supplied, theft language when the incident type isn't `STOLEN`, address-shaped text
when no last known place was given, or suspect-naming phrasing. This mirrors Part 7's
`outputGuard.ts` exactly: a backstop for the most literal violations, not a substitute for the
prompt or for human review.

When the guard trips, the draft is **kept**, not discarded - the user's already-submitted facts
shouldn't be lost - but prefixed with a plain-text `REVIEW REQUIRED` notice naming what looked
suspicious. This is a genuine extra signal on top of what the master spec already requires
regardless: "the user must approve the final text," so nothing generated here is ever treated as
final without a human reading it first.

## Preview, Edit, Save, Export, versions

All four master-spec-named actions map onto the same repository Part 2 already built:
`updateDraft()` (manual edits) and the new `regenerate()` (re-running the AI against corrected
facts) both append a `police_report_versions` row rather than overwriting text in place - "store
complaint versions" was already true before this part existed. `is_simulated` was added to that
table this part (`0020_police_report_versions_is_simulated.sql`, extending an earlier-part table via
`ALTER TABLE`, the same pattern `0007_recovery_actions.sql` used) so a reloaded page still shows an
accurate demo badge for whichever version came from `MockAiProvider`. Export is a client-side
`.txt` download - the draft text is already in hand, no server round trip needed.

## Never claims submission

`PoliceReportStatus` (`DRAFT`/`APPROVED`/`USER_MARKED_SUBMITTED`) has no `SUBMITTED` state - Part 2
designed it this way specifically so the master spec's "do not claim the complaint has been
submitted unless an official integration confirms submission" can never be violated by construction.
`USER_MARKED_SUBMITTED` records only the user's own attestation that *they* filed it, with an
optional reference number they provide - RecoverAI's role ends at approval.

## Evidence Vault and Timeline linkage

"Add the approved complaint to the Evidence Vault and Timeline" - on every approval (including a
re-approval after an edit reopened the report to `DRAFT`), a real `Evidence` row is created with
`category: 'POLICE_COMPLAINT'` (already declared in Part 2's schema). No object-storage backend
exists yet (Part 15 owns building one), so rather than fabricate a file path, `storageKey` uses a
clearly-marked internal reference (`internal:police-report-version:{reportId}:{versionNumber}`) -
the complaint's authoritative text already lives durably in `police_reports`/`police_report_versions`.
Part 15's future signed-URL logic will need to special-case this prefix to serve the text back out
instead of hitting real object storage. Each approval creates its own Evidence row rather than
updating one in place, matching Evidence's immutable-per-row, upload-like model and giving the Vault
a real history of every version that was ever approved.

## Recovery Decision Engine integration

Marking a report `USER_MARKED_SUBMITTED` is the only lifecycle transition that touches the engine:
it completes the case's `POLICE_REPORT` action and recalculates, which is what actually unblocks a
`CEIR_SUBMISSION` action Part 6 made dependent on it. Mere approval doesn't - approving just means
"this text is accurate," not "I've been to the station."

## API

- `GET /api/recovery-cases/:caseId/police-reports` - list all reports for the case.
- `POST /api/recovery-cases/:caseId/police-reports` - collect facts, generate the first draft.
- `GET /api/recovery-cases/:caseId/police-reports/:reportId` - one report + its full version history.
- `POST .../police-reports/:reportId/regenerate` - update facts, generate a new version.
- `PATCH .../police-reports/:reportId/draft` - manual text edit, new version.
- `POST .../police-reports/:reportId/approve` - approve, create Evidence + Timeline entries.
- `POST .../police-reports/:reportId/mark-submitted` - user attestation, completes the action.
