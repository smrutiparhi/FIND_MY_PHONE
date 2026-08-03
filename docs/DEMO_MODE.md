# Demo Mode (Part 22)

A clearly labeled, self-contained "Android stolen at Hyderabad Metro" walkthrough for portfolio
demonstrations - the master spec's own worked example, driven through the guided 10-stage sequence
it names verbatim: Report Stolen Phone → Risk Assessment → Location Screen → Recovery Decision
Engine → Secure Device → Protect SIM → Generate Police Complaint → CEIR Assistant → Timeline →
Device Recovered.

## It's the real app, not a mockup

`demoService.ts` never invents fake demo-only logic. Every stage action calls the exact same
service function every real page already calls - `updateSimProtectionRecord`, `createPoliceReport`
/ `approvePoliceReport` / `markPoliceReportSubmitted`, `updateCeirRecord`,
`updateDeviceRecoveryChecklist` - and the guided stepper simply navigates to the same real pages
(`/recovery-cases/:id/location`, `/sim`, `/police-report`, `/ceir`, `/timeline`, `/recovered`) a
user would visit themselves. A portfolio viewer clicking "Next" is watching the actual product work,
not a scripted animation.

## Isolation: one boolean, checked everywhere it matters

A single `recovery_cases.is_demo` boolean (migration `0023`) is the whole isolation mechanism - not
replicated per table, since every other case-scoped table already cascades from `recovery_cases` via
`ON DELETE CASCADE`. Three places enforce it:

- **Dashboard/list queries** - `listByUser` and `listDashboardSummariesByUser` filter
  `AND is_demo = false`, so a demo case never appears next to a user's real cases.
- **Demo endpoints** - `assertDemoCase()` throws `ForbiddenError` if a real case ID is ever passed
  to `/api/demo/*`, even for its own owner.
- **Deletion** - `deleteDemoCase`'s own SQL carries a redundant `AND is_demo = true`, so even a bug
  upstream of it can't delete a real case.

**Notifications are suppressed entirely** for demo-case events (checked once, centrally, in
`createNotification`) - not just the outbound email, the in-app row itself never gets created. A
demo walkthrough must never touch a real external account or a real user's notification feed.

## Resuming after a refresh: derived, not stored

There's no `current_stage` column. `deriveCurrentStage()` inspects the case's actual state - status,
device recovery checklist, CEIR status, police report status, SIM status, the `SECURE_DEVICE`
action's status, and whether a location observation exists - in the same priority order the stages
themselves run, and returns the furthest stage whose evidence already exists. Refreshing mid-demo,
or re-entering `/demo` later, resumes at the real progress instead of restarting or drifting out of
sync with what's actually in the database.

## Idempotent by construction

Every `performStageAction` branch checks current state before writing (create a location observation
only if none exists yet, request a SIM block only if not already blocked, approve a police report
only while it's still `DRAFT`, ...). Advancing to an already-completed stage, double-clicking "Next",
or resuming a half-finished demo never duplicates rows or throws.

## Entry points

- Landing page (signed out): "Try the guided demo" under the hero CTAs, linking to `/demo`.
- Dashboard (signed in): "🎬 View demo" next to "Report Lost or Stolen Phone".
- `/demo` is a `ProtectedRoute` like everything else - a signed-out visitor is redirected to
  `/login` first. Login now honors `location.state.from` on a successful sign-in (previously it
  always sent every login to `/dashboard`, which would have silently dropped a signed-out visitor's
  demo request); this fix is what makes the landing-page CTA actually land where it says it will.

## The stepper

`DemoModeBar` renders in `AppLayout` whenever the current route's `:caseId` resolves to a demo case
(a 403/404 from `GET /api/demo/:caseId` means "not a demo case," and the bar renders nothing) - this
covers every `/recovery-cases/:id/...` page automatically without editing each one individually.
Every simulated item also carries a `DemoDataBadge` ("🎬 Demo data") - the case header shows one
whenever `recoveryCase.isDemo` is true.

Each "Next" click is a real multi-step write against the same live database every other part uses -
some stages chain three or four service calls in sequence (e.g. stage 7 creates, approves, and
submits a police report), each of which independently recalculates the Recovery Decision Engine, so
a single click can take several seconds. The button shows "Advancing..." while busy rather than just
going inert, so a live demo never looks stalled.

## API

- `POST /api/demo/start` - resumes the caller's existing demo case if one exists, otherwise creates
  a fresh one (device, case, engine evaluation, `CASE_CREATED` timeline event) and returns it at
  stage 2.
- `GET /api/demo/:caseId` - returns the current derived state; 403 if the case isn't a demo case.
- `POST /api/demo/:caseId/advance` - `{ stage }`, clamped to `[1, 10]`; runs that stage's action (if
  any) and returns the resulting state.
- `DELETE /api/demo/:caseId` - deletes the demo case (cascades to every row it owns) and its device.

## What isolated verification found

Backend: 9 tests in `tests/services/demoService.test.ts` cover case creation at CRITICAL/HIGH risk
isolated from the real dashboard, resume-not-duplicate, per-stage idempotency, the full stage 2→10
progression (SIM blocked, police report submitted, CEIR processing, case `RECOVERED`),
stage-derivation after partial progress, notification suppression (against a real-case control),
`ForbiddenError` on a real case, reset-and-restart, and cross-user isolation.

Browser: driving the full flow end-to-end (landing page → login redirect → demo entry → all 10
stages → restart) surfaced two real issues, both fixed before this part shipped:

1. `LoginPage`'s submit handler ignored `location.state.from` and always navigated to `/dashboard`
   on success - only the "already signed in" early-return respected it. Fixed so both paths use the
   same redirect target.
2. `DemoModeBar`'s "Next" button gave no feedback beyond going disabled during the multi-second
   stage-advance writes described above. Fixed with an "Advancing..." label while busy.
