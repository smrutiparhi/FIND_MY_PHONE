# Recovery Dashboard (Part 17)

The main case page — everything about one case in one view: a top summary, a Recovery Progress
checklist with the engine's current recommendation as the largest call to action, one card per main
section, the full detailed plan, and the AI Recovery Agent as an assistant panel.

## Pure assembly, no new backend

Every field this page needs already had a GET endpoint from an earlier part - `RecoveryCase`,
`RecoveryPlan`, `LocationObservation[]`, `TimelineEvent[]`, `Device[]`. Part 17 adds zero new API
routes; it's entirely a frontend rebuild of `RecoveryCaseDetailPage.tsx`, fetching five endpoints in
parallel the same way `RecoveryLocationPage.tsx` already did.

## Sections read directly from the engine's own actions, never recomputed

"Main sections: LOCATION / SECURITY / SIM / ACCOUNTS / FINANCIAL PROTECTION / POLICE / CEIR /
EVIDENCE / TIMELINE" (master spec). Eight of the nine map onto a `RecoveryActionType` one-to-one
(`dashboardSections.ts`), so each section card's status badge is read straight off that action's
own `status` - never a second, parallel computation that could drift from what the Recovery Plan
panel below it says. SECURITY (`SECURE_DEVICE`) has no dedicated in-app page - Part 8 only ever
built device *finding*, not a device-securing flow - so its card falls back to the action's own
`officialExternalAction` link instead of linking to a page that doesn't exist. TIMELINE has no
backing action type; its card shows the 3 most recent events from the same `GET .../timeline?order=
desc` call the header's "last update" stat already needed, so no extra request.

## Recovery Progress is a checklist, not a percentage

"Display a Recovery Progress indicator based on meaningful required actions, not arbitrary
percentages" - taken literally. `RecoveryProgressCard.tsx` renders exactly the master spec's own
worked example: a checkmark-or-pending line per action (`MONITOR` excluded - it's a perpetual
catch-all, never a discrete milestone), then a "NEXT ACTION" block sized and colored to be the
obvious largest click on the page, driven by `RecoveryPlan.currentRecommendedAction`. Its button
resolves in priority order: an in-app route if the action has a dedicated page, else the action's
own official external link, else (for `MONITOR`) a link to the Timeline, else a direct "Mark as
done" button hitting the same generic action-status endpoint Part 10's Emergency Mode already uses.

## A real bug this page's own screenshot caught

Verifying this page against the running app (not just `tsc`/tests) surfaced a genuine, pre-existing
Recovery Decision Engine defect: a completed action whose triggering state no longer applied
(e.g. `SECURE_DEVICE` after the device is secured) fell back to `evaluateRecoveryDecision.ts`'s
"orphaned existing action" path, which had always hard-coded `title: existing.type` - the literal
string `"SECURE_DEVICE"` - and a generic reason, discarding the action's real persisted text. This
existed since Part 6 but was easy to miss: it only affects a *completed* action whose state has
since changed, and the raw enum string was buried in `RecoveryPlanPanel`'s detail list rather than
surfaced anywhere prominent. Part 17's own progress checklist put it front and center - a real user
would have seen a literal `SECURE_DEVICE ✓` line. Fixed by threading the action's real
`title`/`reason`/`instructions` through `RecoveryEngineInput.existingActions` (previously just
`{type, status}`) from `gatherEngineInputForExistingCase.ts`, so the pure engine function has the
real text on hand instead of only the type and falling back to it. A regression test
(`recoveryEngine.test.ts`) locks this in.

## Distinguishing verified from user-reported

Every status shown - the risk assessment (`VerificationTag kind="system"`, already established by
`RecoveryPlanPanel`) versus every action completion (inherently self-reported, since this app never
marks anything done without an explicit user confirmation anywhere in the product) - already carries
this distinction through components built in earlier parts; Part 17 doesn't introduce a new
verification concept, just puts more of the existing one on one page.
