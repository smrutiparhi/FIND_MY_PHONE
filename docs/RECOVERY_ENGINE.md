# The Recovery Decision Engine (Part 6)

The master spec calls this "the most important engineering part" and is explicit about what it
must **not** be: "Do NOT implement this as a simple chatbot prompt." This document describes the
deterministic rule set that exists instead.

- Pure function: [`services/recoveryEngine/evaluateRecoveryDecision.ts`](../apps/api/src/services/recoveryEngine/evaluateRecoveryDecision.ts)
- Types: [`services/recoveryEngine/types.ts`](../apps/api/src/services/recoveryEngine/types.ts)
- Tests: [`tests/services/recoveryEngine.test.ts`](../apps/api/tests/services/recoveryEngine.test.ts) (40 scenarios)

## Contract

**Input** — the master spec's 17 dimensions, verbatim (`RecoveryEngineInput`):

`incidentType`, `timeSinceIncident`, `platform`, `accountAccess`, `simAccess`, `screenLockStatus`,
`deviceFindingAvailability`, `locationStatus`, `financialAppsPresent`, `authenticatorPresent`,
`passwordManagerPresent`, `workAccountPresent`, `deviceSecured`, `simSecured`,
`financialAccountsSecured`, `policeReportStatus`, `ceirStatus` — plus `existingActions` (this
app's own addition: the current status of every action already created for the case, so
recalculation can preserve user progress instead of starting over).

**Output** (`RecoveryEngineResult`): `riskLevel`, `riskReasons`, `orderedActions`,
`currentRecommendedAction`, `blockedActions`, `warnings`. Every action carries `id` (a stable
`RecoveryActionType`, not a random id - see "Identity" below), `priority`, `title`, `reason`,
`instructions`, `status`, `dependencies`, and `officialExternalAction` if applicable - the exact
field list the master spec requires.

`evaluateRecoveryDecision` calls nothing outside itself: no database, no clock (`timeSinceIncident`
is a bucket the *caller* computes, once, from a real timestamp - see
[`timeSinceIncident.ts`](../apps/api/src/services/recoveryEngine/timeSinceIncident.ts)), no AI
provider. Identical input always produces byte-identical output. The AI layer (Part 7) may only
ever read this function's output to explain a recommendation in natural language; it has no path
to change `riskLevel`, `orderedActions`, `currentRecommendedAction`, or `blockedActions`.

## How ordering works: candidates + tiers

Every action the engine might propose is generated as a "candidate" tagged with a priority
**tier** (lower = more urgent). Candidates are sorted by tier (a stable sort, so push order breaks
ties), merged against `existingActions`, and re-numbered into a gap-free `1, 2, 3, ...` sequence.

| Tier | Action(s) | Condition |
| --- | --- | --- |
| 0 | `FINANCIAL_PROTECTION` | Financial emergency: STOLEN + financial apps present + device not yet secured |
| 1 | `LOCATE_DEVICE`, `RING_DEVICE`, `NEARBY_SEARCH` | Device-finding confidently available (`deviceFindingAvailability === 'YES'`); ring/nearby-search only for LOST |
| 2 | `SECURE_DEVICE` | Device not secured, and account access already works |
| 3 | `SIM_PROTECTION` | SIM not already blocked/secured, and "at risk" (see below) |
| 4 | `ACCOUNT_RECOVERY` | Account access is not confirmed YES |
| 5 | `SECURE_DEVICE` | Device not secured, but account access is *not* confirmed - gated behind recovering it first |
| 6 | `LOCATE_DEVICE` | Device-finding uncertain (`UNSURE`) - gated behind account recovery only if access isn't already confirmed |
| 7 | `FINANCIAL_PROTECTION` | General account protection: sensitive apps present, or the case is STOLEN at all |
| 8 | `EVIDENCE_COLLECTION` | STOLEN or UNSURE |
| 9 | `POLICE_REPORT` | STOLEN or UNSURE, not yet filed |
| 10 | `CEIR_SUBMISSION` | STOLEN or UNSURE, not yet submitted/processing/blocked/unblocked |
| 11 | `MONITOR` | Always |

This tier scheme exists to reproduce the master spec's own worked examples exactly:

- **"LOST + nearby + device finding available"** → Locate (tier 1) → Ring (tier 1, depends on
  Locate) → Nearby Search (tier 1, depends on Ring). No SIM step, because a plain LOST case with
  an unaffected phone number is not "SIM at risk" (see below).
- **"STOLEN + account access + location available"** → Locate (1) → Secure Device (2, account
  access already works) → Protect SIM (3) → Protect Critical Accounts (7) → Police (9) → CEIR
  (10).
- **"STOLEN + no account access + SIM lost"** → Protect/Recover SIM (3) → Recover Platform
  Account (4, depends on SIM - OTP-based recovery needs the phone number back) → Secure Device
  (5) → Attempt Authorized Device Finding (6, both gated behind Account Recovery) → Protect
  Critical Accounts (7) → Police (9) → CEIR (10).
- **"STOLEN + banking apps + unlocked device"** → the financial-emergency gate (tier 0) fires,
  so `FINANCIAL_PROTECTION` becomes the single highest-priority action, ahead of everything else.

### SIM protection's "at risk" gate

A plain LOST device with the owner's number still working elsewhere
(`simAccess === 'ANOTHER_DEVICE_HAS_ACCESS'`) gets no SIM step - the master spec's first example
confirms this. But a thief has physical possession of the SIM regardless of what the owner's
`simAccess` answer was, so **any** STOLEN or UNSURE case is treated as SIM-at-risk even without
`LOST_WITH_PHONE`/`UNSURE`:

```
simAtRisk = simAccess === 'LOST_WITH_PHONE' || simAccess === 'UNSURE' || incidentType !== 'LOST'
```

## Dependencies and blocking

An action can declare `dependencies: RecoveryActionType[]`. On every evaluation, any action whose
status is engine-controlled (`PENDING` or `BLOCKED` - see below) is set to `BLOCKED` if *any*
dependency isn't `COMPLETED`, else `PENDING`. A missing dependency (shouldn't normally happen)
never blocks, to avoid a permanent deadlock. `blockedActions` in the result is exactly the actions
currently in that state; `currentRecommendedAction` is the first `PENDING` or `IN_PROGRESS` action
in priority order.

## Recalculation never discards progress

`IN_PROGRESS`, `COMPLETED`, and `SKIPPED` are **never** touched by the engine -
`ENGINE_CONTROLLED_STATUSES` is only `{ PENDING, BLOCKED }`. A previously-created action whose
type no longer has a fresh candidate (state changed since it was created) is still kept in the
result rather than silently dropped - a completed `SIM_PROTECTION` action stays visible even
after `simSecured` becomes true and no fresh candidate for it is generated that round.

This app introduces **no new columns** to track "has this been secured" - it's derived by asking
whether the corresponding action is `COMPLETED`:

| Engine input | Derived from |
| --- | --- |
| `deviceSecured` | `SECURE_DEVICE` action is `COMPLETED` |
| `simSecured` | `SIM_PROTECTION` action is `COMPLETED` |
| `financialAccountsSecured` | `FINANCIAL_PROTECTION` action is `COMPLETED` |
| `accountAccess` (recalculation only) | `ACCOUNT_RECOVERY` action is `COMPLETED` → forced to `YES`, else the case's stored wizard answer |
| `policeReportStatus` | Latest `PoliceReport.status`: none → `NOT_STARTED`; `DRAFT`/`APPROVED` → `DRAFTED`; `USER_MARKED_SUBMITTED` → `FILED` |
| `ceirStatus` | The case's `CeirRecord.status`, or `NOT_READY` if none exists yet |
| `locationStatus` | `AVAILABLE` if the case has any `LocationObservation`, else `UNAVAILABLE` |

See [`gatherEngineInputForExistingCase.ts`](../apps/api/src/services/recoveryEngine/gatherEngineInputForExistingCase.ts).

The risk-scoring function (`computeRisk`) is careful not to double-penalize a dimension that's
already been mitigated: once `deviceSecured` is true, the whole account/SIM/screen-lock exposure
block is skipped entirely (a remotely-locked device can't be exploited through those anymore);
independently, a `LOST_WITH_PHONE`/`UNSURE` SIM penalty is only applied while `!simSecured`, so
completing SIM protection actually lowers risk instead of leaving a stale penalty in place.

## Persistence and API surface

- [`buildEngineInputForNewCase.ts`](../apps/api/src/services/recoveryEngine/buildEngineInputForNewCase.ts) —
  builds input straight from the wizard's ten answers (Part 5); no DB read needed since nothing
  else exists yet.
- [`gatherEngineInputForExistingCase.ts`](../apps/api/src/services/recoveryEngine/gatherEngineInputForExistingCase.ts) —
  builds input from a case's live state, for recalculation.
- [`applyEngineResult.ts`](../apps/api/src/services/recoveryEngine/applyEngineResult.ts) — persists
  one `RecoveryEngineResult`: creates newly-surfaced actions (resolving `dependencies` to real row
  ids as it goes, since a dependency's tier is always ≤ its dependent's), updates existing actions'
  priority/status, appends a new `IncidentAssessment` row only when risk actually changed (kept
  append-only per `docs/DATABASE.md`), and points the case at the new recommended action. Shared
  by case creation and recalculation, so both write identically.
- [`recalculateRecoveryCase.ts`](../apps/api/src/services/recoveryEngine/recalculateRecoveryCase.ts) —
  gather → evaluate → apply, in one transaction.

Two endpoints (`apps/api/src/routes/recoveryCase.routes.ts`):

- `PATCH /api/recovery-cases/:caseId/actions/:actionId` — updates one action's status (only
  `PENDING`/`IN_PROGRESS`/`COMPLETED`/`SKIPPED` are user-settable; `BLOCKED` is engine-only), then
  recalculates and returns the updated case and plan. This is the "recalculate whenever a recovery
  action changes state" trigger the master spec requires.
- `GET /api/recovery-cases/:caseId/recovery-plan` — recalculates and returns the live plan,
  including `blockedActions`/`warnings`. Recalculating on every read (rather than only reading
  back the persisted rows) keeps this endpoint the single place a client always gets a plan where
  every action has a real, referenceable id - repeat reads are cheap because they're idempotent.

`RecoveryPlan`/`RecoveryPlanAction` (`packages/shared/src/types/recoveryEngine.ts`) are the
API-facing shape: the same fields as `RecoveryEngineResult`/`EngineAction`, with a real
`RecoveryActionId` attached in place of the pure engine's `RecoveryActionType` identity (see
[`toRecoveryPlan.ts`](../apps/api/src/services/recoveryEngine/toRecoveryPlan.ts)).

### Identity

Inside the pure engine, an action's identity *is* its `RecoveryActionType` - a case can only ever
have one `SIM_PROTECTION` action, so there's no need for a synthetic id until the result is
persisted. `applyEngineResult.ts` builds the `RecoveryActionType → RecoveryActionId` map as it
writes, and `toRecoveryPlan.ts` uses that same map to attach real ids for the API response.
