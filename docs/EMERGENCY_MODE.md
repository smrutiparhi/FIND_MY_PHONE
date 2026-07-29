# Emergency Recovery Mode (Part 10)

A focused, minimal view for high-risk cases — one screen, one action, no checklist. Master spec:
"The user should never be overwhelmed with twenty instructions immediately... Display a focused
emergency interface... Do not display a huge checklist during emergency mode."

## No second risk-detection system

The master spec lists trigger conditions verbatim: "device stolen, account inaccessible, SIM
inaccessible, device unlocked or screen-lock unknown, financial apps present,
authenticator/password manager present." Those are exactly the inputs the Recovery Decision Engine
(Part 6) already scores in `computeRisk()`. Rather than re-implementing a second, parallel
risk-detection system, `services/emergencyMode/deriveEmergencyModeState.ts` defines emergency mode
as nothing more than `riskLevel === 'CRITICAL' || riskLevel === 'HIGH'` — a one-line derivation from
the engine's own output, always in sync with it by construction, never a separately-stored flag.

## Two numbers and two actions, never the full list

`deriveEmergencyModeState()` is a pure function over a `RecoveryPlan` and returns:

- `completedCount` / `totalCount` — a progress number ("3 of 8 protections completed"), not the
  list itself.
- `currentAction` — `RecoveryPlan.currentRecommendedAction`, passed straight through; this is still
  the engine's own prioritization, Part 10 adds no new ordering logic (the master spec is explicit:
  "The exact order must come from the Recovery Decision Engine based on dependencies and risk").
- `nextAction` — the next action after `currentAction`, by priority, that isn't `COMPLETED` or
  `SKIPPED`. It can be `BLOCKED` (waiting on `currentAction`) - that's intentional: it answers "what
  happens once I finish this," not "what could I theoretically do in parallel."

The API response (`GET /api/recovery-cases/:caseId/emergency`) literally cannot carry the full
action list even if the frontend wanted to render one - `EmergencyModeState` has no `orderedActions`
field. `RecoveryCaseDetailPage` (Part 7) still exists for anyone who wants the complete plan; a
banner there links into emergency mode when the case is high-risk, and emergency mode links back out
to the full plan for anyone who wants more than the one next step.

## Confirmation before completing

Every "mark as done" in `EmergencyActionCard.tsx` goes through a two-step confirm (`Mark as done` →
`Yes, this is done` / `Cancel`) before the existing `PATCH /:caseId/actions/:actionId` endpoint is
called — master spec: "Require confirmation before marking critical external actions completed."
Enforced at the UI layer, not with new backend validation: everything shown in emergency mode is, by
definition, the one critical action, so there's no subset of action types to special-case the way
Part 9's account-recovery confirmation is scoped to just the `RECOVERED` transition.

## Route

`/recovery-cases/:caseId/emergency` renders standalone, outside the app's normal nav chrome - the
same treatment as the incident wizard (`/recovery/new`), since both are explicitly meant to be
distraction-free per the master spec's product principle.
