# Account Recovery Mode (Part 9)

A guided flow for the case where the owner can't sign in to the Apple or Google account tied to
their device. It asks what the user still has, hands back a deterministic (not AI-generated) path
using only Apple's/Google's own official recovery mechanisms, and tracks progress separately from
the generic `ACCOUNT_RECOVERY` recovery action Part 6 already sequences.

## Never a secret, only possession

The checklist (`AccountAccessSignal`: `PASSWORD`, `TRUSTED_DEVICE`, `TRUSTED_PHONE_NUMBER`,
`RECOVERY_EMAIL`, `SIM`, `BACKUP_AUTH_METHOD`) only ever asks *whether the user still has something*
— never for the thing itself. There is no password, OTP, or recovery-code input field anywhere in
this flow, on either end: `generateAccountRecoveryPath.ts` is covered by a test that scans every
step's description for password/code-soliciting phrasing across every signal combination and both
platforms, and the frontend checklist (`AccessChecklistForm.tsx`) is checkboxes only.

## Its own status, separate from the RecoveryAction

`account_recovery_attempts` (one row per case, lazily created via `getOrCreateForCase` — mirrors
`ceir_records`) tracks `NOT_STARTED → IN_PROGRESS → WAITING/RECOVERED/FAILED`. This is deliberately
its own enum rather than reusing `RecoveryActionStatus`, for the same reason `PoliceReportStatus`
and `CeirStatus` are their own enums: `WAITING` and `FAILED` don't fit the generic
`PENDING/IN_PROGRESS/COMPLETED/SKIPPED` lifecycle the Recovery Decision Engine (Part 6) already
governs, and overloading that enum would mean touching Part 6's already-tested engine logic.

## The recovery path is deterministic, not AI

`generateAccountRecoveryPath(platform, availableSignals)` is a pure function — the same "rules, not
a prompt" discipline the master spec insists on for Part 6. It picks the fastest legitimate path the
user's signals actually support: `PASSWORD` → sign in directly; else `TRUSTED_DEVICE` → reset via
device; else a trusted phone number or backup code → reset via that; else a recovery email alone →
still official, but slower; with nothing at all, it falls back to Apple's/Google's full manual
identity-verification process and says so plainly — `speed: 'SLOW'`,
`dependsOnExternalProvider: true`, and copy explicitly stating this can take days and RecoverAI
can't accelerate or check on it. Every step's link comes from
`recoveryEngine/officialProviderLinks.ts` (extracted in this part so Part 6's engine and Part 9
share one source of truth for the Apple/Google URLs, instead of two copies that could drift).

## What happens when access is restored

The master spec is explicit: "When account access is restored, recalculate the Recovery Decision
Engine and continue the case." Marking an attempt `RECOVERED`
(`updateAccountRecoveryAttempt.ts`) does three things in one call: completes the case's
`ACCOUNT_RECOVERY` action if one exists (so the recovery plan's UI reflects it, not just the
engine's internal state), records an `ACCOUNT_RECOVERY_COMPLETED` timeline event, and re-runs
`recalculateRecoveryCase()` with an `accountAccessStatus: 'YES'` override (the same overrides
mechanism Part 7's Recovery Agent uses) — so accountAccess flips to `YES` for the engine even on the
rare case where no `ACCOUNT_RECOVERY` action exists to complete. `RECOVERED` requires an explicit
confirmation click on the frontend (`AccountRecoveryStatusControl.tsx`), since it has real,
non-reversible-feeling side effects.

## API

- `GET /api/recovery-cases/:caseId/account-recovery` — lazily creates the attempt if needed, returns
  it plus the freshly generated steps and a freshly recalculated case/plan (cheap to repeat, same
  pattern as Part 8's location endpoints).
- `PATCH /api/recovery-cases/:caseId/account-recovery` — updates `availableSignals`, `status`
  (`IN_PROGRESS`/`WAITING`/`RECOVERED`/`FAILED` — `NOT_STARTED` is never client-settable), and/or
  `notes`.
