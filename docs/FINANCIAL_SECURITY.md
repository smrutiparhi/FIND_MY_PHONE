# Financial Security Center (Part 12)

Helps a case owner prioritize protecting whatever financial apps, wallets, cards, and accounts were
on the lost device - without RecoverAI ever collecting the secrets that would actually let anyone
into them.

## Never collect financial secrets

The master spec names them explicitly: "Never ask for: UPI PIN, ATM PIN, CVV, bank password, full
card number, OTP." There is no field for any of them anywhere in this part - `financial_protection_items`
has exactly `category`, `label` (free text, optional - "record institutions/apps generically or by
name"), `status`, and `notes`. A test (`financialCategoryGuides.test.ts`) scans every category's
guidance text for language that could be mistaken for soliciting one of those secrets.

## A user-built list, not a single status

Unlike Account Recovery Mode (Part 9) or the SIM Protection Center (Part 11) - each exactly one
record per case - `financial_protection_items` has **many** rows per case, since a device can have
several banking apps, wallets, and cards that each need tracking independently. The checklist itself
(`UPI`, `BANKING_APP`, `DIGITAL_WALLET`, `SAVED_CARD`, `BANKING_EMAIL`, `PASSWORD_MANAGER`) is
deliberately its own enum, not a reuse of Part 5's coarser wizard `SensitiveAppType` checklist -
digital wallets and saved cards have no equivalent there, and this table tracks per-item progress
the wizard never needed to.

## Seeded once from the wizard, then the user's own

The three wizard-checklist items that do overlap (`BANKING` → `BANKING_APP`, `UPI` → `UPI`,
`PASSWORD_MANAGER` → `PASSWORD_MANAGER`) are auto-seeded as generic, `NOT_STARTED` items the first
time this page loads for a case with an empty list - so the user doesn't have to re-enter what they
already told the wizard. This only ever happens once: the moment the list is non-empty (the user
added or removed anything), seeding never runs again, even if it would now produce a different
result. Digital wallets, saved cards, and banking email have no wizard equivalent and are only ever
user-added here.

## Status tracking, verbatim from the spec

`NOT_STARTED → IN_PROGRESS → CONFIRMED_BY_USER`, plus `CONFIRMED_BY_INTEGRATION` reserved for a real
banking/UPI integration that doesn't exist yet (no code path sets it today - the same pattern as
`LocationSource.AUTHORIZED_INTEGRATION` before Part 8 had a real device-finding API). Marking
something secured requires an explicit two-step confirmation on the frontend, the same "critical
external action" discipline as Parts 9-11.

## Syncing with the Recovery Decision Engine

The case's `FINANCIAL_PROTECTION` action completes only once **every** tracked item is confirmed
(`CONFIRMED_BY_USER` or `CONFIRMED_BY_INTEGRATION`) - never inferred any other way. This is the
direct implementation of the master spec's "do not claim financial accounts are secure merely
because the phone was locked": `financialAccountsSecured` in the Recovery Decision Engine's input is
purely derived from that action's completion (see `gatherEngineInputForExistingCase.ts`), so nothing
about screen-lock status can short-circuit it.

Every mutation (add, status change, delete) re-checks all-confirmed and, if a case that was fully
protected gets a new or reopened item, **reopens** the `FINANCIAL_PROTECTION` action back to
`PENDING` - so the engine's claim never lags behind the user's own list. This is tested directly:
confirming the one seeded item completes the action and flips `financialAccountsSecured`; adding a
new unconfirmed item immediately after reopens it.

## Strong warnings

"Include strong warnings when the device may have been stolen while unlocked" - the API computes
this independently of Part 6's own engine warnings (which check `deviceSecured`, a different,
remote-lock concept): `incidentType === 'STOLEN' && screenLockEnabled !== 'YES'` surfaces a
dedicated warning telling the user to treat every financial app and saved card as exposed.

## API

- `GET /api/recovery-cases/:caseId/financial-security` - lazily seeds from the wizard if the list is
  still empty, returns the item list, the six category guides, warnings, and a freshly recalculated
  case/plan.
- `POST /api/recovery-cases/:caseId/financial-security/items` - add an item (`category` + optional
  `label`).
- `PATCH /api/recovery-cases/:caseId/financial-security/items/:itemId` - update `status`
  (`NOT_STARTED`/`IN_PROGRESS`/`CONFIRMED_BY_USER` - `CONFIRMED_BY_INTEGRATION` is never
  client-settable), `label`, and/or `notes`.
- `DELETE /api/recovery-cases/:caseId/financial-security/items/:itemId` - remove an item.
