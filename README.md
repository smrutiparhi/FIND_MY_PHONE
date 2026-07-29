# RecoverAI

RecoverAI is an AI-assisted incident-response and recovery coordinator for people who have lost
a smartphone or had one stolen. It is **not** an IMEI/phone-number tracker, spyware tool, or a
replacement for Apple Find My, Google Find Hub, telecom operators, police systems, or India's
CEIR — it guides the legitimate device owner through the correct sequence of *real, authorized*
recovery steps (device-finding, SIM protection, account recovery, financial-account protection,
police complaint drafting, CEIR/Sanchar Saathi guidance) and tracks the case to resolution.

This repository is being built in sequential parts (see `docs/`); this README covers what exists
today and how to run it. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the technical
design and [`docs/DATABASE.md`](docs/DATABASE.md) for the data model.

## Status

**Part 10 — Emergency Recovery Mode.** A focused, single-screen view (`/recovery-cases/:caseId/emergency`,
standalone with no nav chrome) for cases the Recovery Decision Engine already rates `CRITICAL` or
`HIGH` risk — no second risk-detection system, that one check *is* the master spec's trigger list
(stolen, account/SIM inaccessible, financial apps present, ...). Shows the risk level, why it's high,
a completed/total count, and exactly one current action plus a preview of what's next — never the
full checklist; the API response has no field to carry one. Completing the current action requires
an explicit two-step confirmation. A banner on the full case-detail page (Part 7) links in whenever a
case is high-risk. See [`docs/EMERGENCY_MODE.md`](docs/EMERGENCY_MODE.md) for the full design.

**Part 9 — Account Recovery Mode.** A guided flow (`/recovery-cases/:caseId/account-recovery`) for
when the owner can't sign in to the Apple/Google account tied to their device. Asks only what the
user still *has* (password, trusted device, recovery email, SIM, backup codes) — never the secret
itself — and hands back a deterministic, non-AI-generated recovery path using Apple's/Google's own
official mechanisms, clearly marked when a step depends on their process and can't be sped up.
Progress tracks through its own `NOT_STARTED/IN_PROGRESS/WAITING/RECOVERED/FAILED` states; marking
it `RECOVERED` (behind an explicit confirmation) completes the case's account-recovery action and
re-runs the Recovery Decision Engine, exactly as the master spec requires. See
[`docs/ACCOUNT_RECOVERY.md`](docs/ACCOUNT_RECOVERY.md) for the full design.

**Part 8 — Device Location + Map.** RecoverAI does not independently track phones — the new
`/recovery-cases/:caseId/location` page points the user at the official Apple Find My / Google Find
Hub link (from Part 6's `LOCATE_DEVICE` action) and gives them a safe way to record what they saw
there as a `LocationObservation`. Verification status is always derived server-side from the claimed
source, never client-submitted — a hand-typed guess can never be mislabeled as verified. Recording a
location re-runs the Recovery Decision Engine (`locationStatus` is one of its 17 inputs). The map
(plain Leaflet, `MAP_PROVIDER=maptiler` or `mapbox`) draws every observation as an independent
marker — no connecting line, since that would imply continuous tracking; with no provider configured
(the default) the page still shows every observation's coordinates, timestamp, and source as text,
just without the map graphic. A fixed safety warning appears for any stolen case with a recorded
location, telling the user not to confront a suspected thief. See
[`docs/DEVICE_LOCATION.md`](docs/DEVICE_LOCATION.md) for the full design.

**Part 7 — AI Recovery Agent.** A conversational assistant scoped to one case, with a chat panel on
the new `/recovery-cases/:caseId` detail page (linked from every dashboard case card). It explains
the Recovery Decision Engine's current recommendation and can update an action's status or record a
corrected incident detail (e.g. "I have UPI apps on it") through two tools, both requiring explicit
confirmation checked two independent ways, and both ending by re-running the real engine — it never
overrides `riskLevel` or `orderedActions` itself. Conversation history lives only in the browser tab
(never the database); every real change the agent makes is instead recorded as a `TimelineEvent`.
Real providers (`AI_PROVIDER=anthropic` or `openai`, both needing `AI_API_KEY`) sit behind the same
`MockAiProvider` fallback as before — the default `mock` needs no key and is clearly labeled
"DEMO AI PROVIDER" in the UI. See [`docs/AI_RECOVERY_AGENT.md`](docs/AI_RECOVERY_AGENT.md) for the
full design, including the prompt-injection fencing and output-safety guard.

**Part 6 — Recovery Decision Engine.** The master spec's "most important engineering part": a
pure, deterministic rule engine (`services/recoveryEngine/evaluateRecoveryDecision.ts`) over the
spec's full 17-dimension input space, reproducing its worked examples exactly — see
[`docs/RECOVERY_ENGINE.md`](docs/RECOVERY_ENGINE.md) for the full rule set. It replaces Part 5's
provisional scoring function everywhere: `createRecoveryCaseFromWizard.ts` now calls it directly
at case creation, and two new endpoints wire up real recalculation — `PATCH
/api/recovery-cases/:caseId/actions/:actionId` (update an action's status, then recalculate) and
`GET /api/recovery-cases/:caseId/recovery-plan` (the live plan, including ephemeral
`blockedActions`/`warnings`). Dependency-aware blocking (e.g. account recovery blocked until SIM
protection completes) and risk-level recalculation are both verified end to end against a real
Supabase project, on top of 40 unit test scenarios covering the spec's three worked examples plus
edge cases. The AI layer (Part 7) will only ever explain this engine's output — it has no path to
override `riskLevel`, `orderedActions`, or `blockedActions`.

**Part 5 — Report lost/stolen wizard.** `/recovery/new` is a real, working 10-step incident
wizard (what happened → device → when/where last seen → account access → SIM access → screen
lock → sensitive apps → device-finding → review) that creates an actual case: `POST
/api/recovery-cases` transactionally creates the device (or reuses an existing one), the case,
and (as of Part 6) the real Recovery Decision Engine's risk assessment and ordered actions with
dependencies, plus the opening timeline events. Redirects to the dashboard on success, where the
new case now shows up as a real active case card.

**Part 4 — Main dashboard.** The authenticated app shell: a responsive nav (Dashboard, My
Devices, Recovery Cases, Evidence, Notifications, Settings — the five non-Dashboard items are
honest "coming soon" placeholders until their own parts land), and `/dashboard` backed by `GET
/api/recovery-cases`, which assembles each case's device, latest location, current recommended
action, and security-progress counts in one query. Handles loading, error (with retry), empty,
offline, and populated states. Settings has real sign-out and account deletion (moved here from
the Part 3 diagnostics page, now at `/status`).

Auth (Part 3): Supabase Auth wired up end to end — registration, login, logout, password reset,
and session persistence all happen client-side via `supabase-js`; the backend verifies tokens via
`requireAuth` and never sees a password. Row-level security is enabled (default-deny) on every
table. `DATABASE_URL` points at Supabase's managed Postgres — see "Database setup" below.

## Monorepo layout

```
apps/
  web/            React + TypeScript + Vite + Tailwind CSS frontend
  api/             Node.js + Express + TypeScript backend
packages/
  shared/          Types shared between frontend and backend (API envelope, health types, ...)
  config/          Environment-variable schema/validation (zod)
  ui/               Shared React component library (built out in Part 23)
docs/               Architecture and design documentation
```

Frontend and backend each consume `packages/*` directly from TypeScript source (no separate
build step for internal packages) — Vite and `tsx` both transpile on the fly, and the API's
production bundle is produced by `tsup`, which inlines workspace source at build time. See
`docs/ARCHITECTURE.md` for the reasoning.

## Prerequisites

- Node.js 20 or later (developed on Node 22)
- npm 10 or later

## Setup

```bash
npm install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

npm run dev
```

This starts the API on `http://localhost:4000` and the frontend on `http://localhost:5173`. Open
the frontend — it calls `GET /api/health` and `GET /api/health/ready` on the API and displays the
result, confirming the two apps can talk to each other.

The API boots without a database, AI provider key, or map provider key configured — those are
optional until the parts that use them (AI Recovery Agent: Part 7, Device Location + Map: Part 8).
`/api/health/ready` reports each dependency's status honestly (e.g. `database: "not_configured"`)
rather than pretending they're connected.

## Database + Auth setup (Supabase)

Since Part 3, the recommended setup is a free [Supabase](https://supabase.com) project - it
provides both the managed Postgres database and the managed Auth backend this app relies on
(see "Why Supabase for auth" below).

1. Create a project at [supabase.com](https://supabase.com/dashboard) (free tier).
2. From **Project Settings → API**, copy the **Project URL**, **anon public** key, and
   **service_role** key.
3. From **Project Settings → Database → Connection string**, switch to **Session pooler** mode
   (not "Direct connection" - that needs IPv6, which most networks don't have) and copy the URI,
   substituting in your real database password.
4. Fill in `apps/api/.env`:
   ```
   DATABASE_URL=<session pooler URI, with your password substituted in>
   ENCRYPTION_KEY=<output of: openssl rand -base64 32>
   SUPABASE_URL=<project URL>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key - backend only, never in apps/web>
   ```
5. Fill in `apps/web/.env`:
   ```
   VITE_SUPABASE_URL=<same project URL>
   VITE_SUPABASE_ANON_KEY=<anon public key - safe for the browser, see docs/DATABASE.md>
   ```
6. Run:
   ```bash
   npm run db:migrate -w apps/api   # applies every migration, including RLS + auth-sync (Part 3)
   npm run db:seed -w apps/api      # two fictional demo users/cases - see docs/DATABASE.md
   npm run test -w apps/api         # 62 tests against the real database above
   ```

The schema itself stays portable to a self-hosted Postgres (`DATABASE_URL` is just a connection
string), but Supabase Auth specifically requires a Supabase-managed project - there's no
self-hosted equivalent this app wires up.

See [`docs/DATABASE.md`](docs/DATABASE.md) for the schema, an ER diagram, and the design
rationale (encryption, ownership scoping, cascade rules, row-level security).

## Scripts

Run from the repo root (npm workspaces):

| Script | What it does |
| --- | --- |
| `npm run dev` | Runs the API and web dev servers together |
| `npm run build` | Typechecks `packages/*`, then production-builds `apps/api` and `apps/web` |
| `npm run typecheck` | `tsc --noEmit` across every workspace |
| `npm run lint` | ESLint across the repo |
| `npm run format` | Prettier write across the repo |
| `npm run test` | Runs `apps/api`'s test suite (requires a configured `DATABASE_URL`) |

Per-workspace: `npm run dev -w apps/api`, `npm run db:migrate -w apps/api`, etc.

## Environment variables

Each app has its own `.env.example` documenting every variable it will ever read, including ones
that only become required in a later part (clearly commented with which part introduces them).
Never commit a real `.env` file — `.gitignore` already excludes it.

- `apps/api/.env.example` — server port, CORS origin, log level, database connection string and
  encryption key (Part 2), Supabase project (Part 3 — see "Why Supabase for auth" below), AI
  provider (Part 7), map provider (Part 8).
- `apps/web/.env.example` — API base URL, Supabase project URL and anon key (Part 3). Only
  `VITE_`-prefixed variables are ever exposed to the browser; never put secrets here.

### Why Supabase for auth

The master spec explicitly says: "Do not build custom authentication where a configured managed
authentication provider already safely handles the responsibility." RecoverAI stores sensitive
recovery data (device identifiers, incident details, evidence); hand-rolling password hashing,
session management, and account-recovery flows is exactly the kind of risk a managed provider
exists to remove.

Credentials never reach this app's own backend: the frontend talks to Supabase directly via
`supabase-js` for registration, login, logout, and password reset (Supabase's own hosted email
service sends the verification/reset emails - no email infrastructure of our own). The backend's
only job is verifying an already-issued token (`requireAuth`) and the one operation that genuinely
needs backend privileges: account deletion, which uses the service-role admin API to remove the
Supabase identity itself. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design,
including a real gotcha this project hit and worked around: Supabase's Auth service writes to its
`auth.users` table in a way that ordinary database triggers don't fire for, so the app relies on
an idempotent upsert in `requireAuth` instead of the trigger originally written for this.

## Code quality

TypeScript runs in strict mode everywhere (`strict`, `noUncheckedIndexedAccess`,
`noUnusedLocals`, `noPropertyAccessFromIndexSignature`, ...). ESLint (flat config) and Prettier
are configured at the repo root and apply to every workspace.
