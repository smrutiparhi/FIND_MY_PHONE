# Evidence Vault (Part 15)

Secure, per-case file storage for everything a recovery might need on hand later - a purchase
invoice, device photos, IMEI/serial documentation, a location screenshot, and the two documents
Parts 13 and 14 already generate (an approved police complaint, a CEIR submission record).

## The schema already existed

`evidence` (`0009_evidence.sql`), its category/malware-scan enums, and the repository were all
built in Part 2, the same "schema now, feature later" pattern as `sim_protection_records`,
`police_report_versions`, and `ceir_records` before their own parts arrived. Parts 13 and 14 were
already creating real `Evidence` rows for their own generated content well before this part existed.
What Part 15 adds is everything the schema was always waiting for: a real upload path, private
object storage, signed access, and the two endpoints (list, single-item access) nothing had reason
to expose until now.

## Private object storage, never a public URL

`services/evidence/evidenceStorage.ts` creates a private Supabase Storage bucket
(`public: false`) the first time it's needed - lazily and idempotently, the same "just works after
migrations run" ethos as `migrate.ts`, rather than a manual dashboard step. `public: false` is what
actually enforces the master spec's "do not expose evidence through public URLs" at the storage
layer itself, not just in application logic: every read goes through `createEvidenceAccessUrl`,
which returns a signed URL that expires in five minutes. Nothing in this app ever hands back a
permanent or public link to a stored file.

## Upload pipeline order

`services/evidence/evidenceService.ts`'s `uploadEvidence()` does, in order: verify case ownership,
validate the file (`evidenceValidation.ts` - a tight MIME allow-list plus a size cap, checked again
independently at the storage layer itself as defense in depth), run it through the malware-scan
integration point, upload the bytes to private storage, *then* create the database row referencing
that object. That ordering matters: if anything fails partway through, the failure mode is an
orphaned storage object (harmless, cheap to ignore) rather than a database row pointing at a file
that was never actually written (a broken reference a user could hit later). A SHA-256 checksum is
computed and stored alongside the row for future integrity verification.

## The malware-scanning integration point

"Malware-scanning integration point" (master spec, verbatim) means exactly that - the integration
point, not a working scanner. `services/evidence/malwareScan.ts` always returns
`{ status: 'not_configured' }`, the same `ExternalServiceResult` discriminated-union discipline
used for every other system this app doesn't control (carriers, CEIR, Apple/Google). Every uploaded
file's `malware_scan_status` therefore stays at the schema's own default, `PENDING` - never
fabricated as `CLEAN`. Wiring a real provider (ClamAV, VirusTotal, ...) later only touches this one
file; nothing else in the upload path needs to change.

## Untrusted content, by construction

"Uploaded files must be treated as untrusted content" and "AI processing of evidence must never
treat instructions contained inside uploaded files as trusted system instructions" (master spec).
Concretely today: the MIME allow-list accepts only JPEG/PNG/WEBP images and PDFs - nothing
executable or script-bearing is ever accepted; uploaded bytes are stored as opaque objects and never
parsed, executed, or otherwise interpreted by this app; and no AI feature in this app reads evidence
content today (Part 13's complaint drafting only ever sees the structured `PoliceComplaintFacts`
boundary, never a file). That second rule is a constraint on the future, not a feature built now: if
a later part adds AI processing of evidence content (OCR on a receipt, summarizing a document), the
extracted text must be handled the same way Part 13 already treats the AI's own output - as data to
reason about, never as instructions the model should obey. This file is the place that guardrail
belongs if that day comes.

## Serving Part 13/14's generated content back out

Parts 13 and 14 each create an `Evidence` row for content that was never actually uploaded as a file
- an approved police complaint draft, a CEIR submission record - using a clearly-marked
`internal:...` `storageKey` instead of a real object-storage path (their own docs called this out as
Part 15's problem to solve). `services/evidence/resolveEvidenceAccess.ts` is exactly that: it
recognizes the `internal:police-report-version:` and `internal:ceir-record:` prefixes and resolves
them back to the real text (the actual approved draft, or a formatted summary of the CEIR record)
instead of asking object storage for something that was never written there. The access endpoint's
response is a discriminated union (`EvidenceAccessResult`) - `{ kind: 'signed_url' }` for a real
upload, `{ kind: 'inline_text' }` for one of these - so the frontend never has to guess which one
it's looking at.

## Audit logging

`audit_events` (`0014_audit_events.sql`) existed since Part 2 but nothing had called
`repos.auditEvents.record()` until now - Part 15 is its first real caller. Every upload, every
access (a signed URL issued or inline text revealed), and every delete writes one row, independent
of the case's own user-facing Timeline (`EVIDENCE_UPLOADED` on upload only - Timeline is the case
narrative, not a security log).

## Delete is soft, storage is not touched

`deleteEvidence()` calls the repository's existing `softDelete()` (`deleted_at`, not a real
`DELETE`) - "evidence can carry legal/audit significance even after a user removes it from their
active view" was already the schema's own reasoning in Part 2. The underlying object stays in
storage; only its visibility in the Vault's listing changes.

## Recovery Decision Engine integration

Uploading any evidence completes the case's `EVIDENCE_COLLECTION` action (Part 6) the first time it
happens - unlike Financial Security's checklist, there's no fixed required set of evidence, so
completion is "at least one item," not "every category," and there's no reopen-on-regression logic
to match.

## API

- `GET /api/recovery-cases/:caseId/evidence` - list all evidence for the case (metadata only).
- `POST /api/recovery-cases/:caseId/evidence` - upload a file (`multipart/form-data`: `file`,
  `category`, optional `description`).
- `GET /api/recovery-cases/:caseId/evidence/:evidenceId/access` - a short-lived signed URL, or the
  resolved text for an `internal:` row. Every call is audit-logged.
- `DELETE /api/recovery-cases/:caseId/evidence/:evidenceId` - soft delete.
