# RecoverAI — Architecture (Part 1)

This document captures the technical design decisions made while scaffolding the project. It
will grow with each part and gets finalized in Part 24 (Final audit and deployment).

## Monorepo strategy

npm workspaces (`apps/*`, `packages/*`). No extra monorepo tool (Turborepo/Nx) — the project is
small enough that plain workspaces plus a few root scripts (`npm run dev`, `build`, `typecheck`)
are sufficient without adding another layer of configuration to reason about.

`packages/shared`, `packages/config`, and `packages/ui` have **no build step of their own**.
Their `package.json` `main`/`types` point straight at `src/index.ts`. Both dev tools consume that
source directly:

- `apps/web` — Vite/esbuild transpiles it like any other TS module (instant HMR, no stale dist).
- `apps/api` — `tsx` (dev) transpiles TS on the fly the same way; `tsup` (production build)
  bundles the API into a single `dist/server.js`, inlining workspace source at bundle time.

This avoids the classic monorepo foot-gun of forgetting to rebuild an internal package before its
consumer picks up a change. Trade-off: these packages aren't independently publishable without
adding a build step later — acceptable since they're `"private": true` and only ever consumed
inside this repo.

## Directory structure

```
apps/
  web/src/
    pages/         Route-level components
    routes/         Router configuration
    lib/             API client, env validation, other frontend utilities
    components/     Reusable presentational components (grows through later parts)
    styles/         Tailwind entry point
  api/src/
    routes/         Express Router definitions — thin, no logic
    controllers/     Request/response handling — parses input, calls services, shapes output
    services/        Business logic and external-provider abstractions (ai/, maps/, external/)
    middleware/      Cross-cutting request handling (errors, validation, rate limiting)
    lib/             Logger, error classes, small framework-agnostic helpers
    db/               Database connection layer (repository layer added in Part 2)
    config/           Environment loading
    validation/       Zod request schemas (populated starting Part 3)
    types/            Ambient type declarations (Express augmentation)
packages/
  shared/src/types/   Types shared between apps/web and apps/api
  config/src/         Environment schema/validation
  ui/src/             Shared React components (Part 23)
```

`routes → controllers → services → db` is a one-directional dependency chain: routes never
contain logic, controllers never touch `pg` directly, services never know about `Request`/
`Response`. Part 2 adds a repository layer between `services` and `db` so SQL lives in one place
instead of scattered across controllers (explicit master-spec requirement).

## Backend architecture

- **Framework**: Express 4 + TypeScript, ESM (`"type": "module"`).
- **App factory pattern**: `createApp()` in `app.ts` builds and returns the Express app;
  `server.ts` is the only file that calls `.listen()`. This makes the app importable by tests
  (Part 21) without binding a port.
- **Middleware order**: request-id/logging (`pino-http`) → `helmet` → `cors` → JSON body parsing
  → baseline rate limiting → API routes → 404 handler → central error handler.
- **Error handling**: a typed `AppError` hierarchy (`NotFoundError`, `ValidationError`,
  `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `TooManyRequestsError`) plus a single
  `errorHandler` middleware that translates any thrown error (including raw `ZodError`s) into the
  shared `ApiErrorResponse` envelope. Production responses never leak internal error messages or
  stack traces; development responses do, to keep debugging fast.
- **Async routes**: wrapped with `asyncHandler()` so a rejected promise reaches `errorHandler`
  instead of crashing the process or hanging the request.
- **Logging**: `pino`, JSON in production / pretty-printed in development, with a redaction list
  covering auth headers, cookies, and common secret field names. Part 20 (Security hardening)
  extends the redaction list as IMEI, precise-location, and financial fields are introduced.
- **Validation strategy**: `zod` schemas, applied via a generic `validate(schema, target)`
  middleware factory - `PATCH /api/auth/me`'s `updateProfileSchema` (Part 3) is the first route to
  use it; every input-bearing route from here on follows the same pattern instead of ad hoc checks
  inside controllers.
- **Rate limiting**: a generous app-wide baseline (`express-rate-limit`) so nothing is ever
  completely unprotected. No stricter *auth-specific* limiter was added on top of it: credentials
  never reach this backend (see "Authentication architecture"), so there's no login/signup
  endpoint here to brute-force in the first place - that protection lives on Supabase's side.

## Frontend architecture

- **Framework**: React 19 + TypeScript + Vite 6 + Tailwind CSS 4 (`@tailwindcss/vite`, no
  separate `tailwind.config.js`/PostCSS config needed for v4's Vite plugin) + React Router 7.
- **Routing**: `AppRoutes.tsx` holds the route table. `/login`, `/register`, `/forgot-password`,
  and `/reset-password` are public; everything else is nested under `<ProtectedRoute />`, which
  redirects to `/login` (preserving the attempted path in router state) when `useAuth()` has no
  session (Part 3). Authenticated routes are further nested under `<AppLayout />` (Part 4), the
  persistent shell with the master spec's six nav items - except `/status`, a Part 1/3 API+DB+auth
  diagnostics page kept around unlisted for debugging, not part of the nav.
- **API access**: a single `apiGet`/`apiClient` helper (`lib/apiClient.ts`) that unwraps the
  shared `ApiResponse<T>` envelope and throws a typed `ApiClientError` on failure, so components
  handle one error shape everywhere instead of parsing `fetch` responses ad hoc.
- **Env validation**: `lib/env.ts` reads `import.meta.env.VITE_API_BASE_URL`, falling back to
  `http://localhost:4000` in development and throwing at boot if unset in a production build
  (fail fast instead of silently calling the wrong origin).

## REST API structure

All routes are mounted under `/api`. Convention going forward:

```
/api/health              liveness (Part 1)
/api/health/ready        dependency readiness (Part 1)
/api/auth/*              Part 3
/api/recovery-cases      GET (Part 4 - dashboard summaries), POST (Part 5 - incident wizard)
/api/devices             GET only (Part 5 - the wizard's device picker); no POST/PATCH/DELETE -
                         device creation happens inline in POST /api/recovery-cases instead
                         (mode: 'new'), matching the wizard's own "select existing or add
                         device" step. Standalone device management stays a nav placeholder.
/api/recovery-cases/:id/location, /sim, /account-recovery, /financial, /police, /ceir, /evidence,
  /timeline                nested under the owning case (Parts 8–16)
```

Every response body — success or error — uses the shared envelope from `packages/shared`:

```ts
{ success: true, data: T } | { success: false, error: { code, message, details? } }
```

## Authentication architecture

Supabase Auth, per the master spec's explicit instruction not to hand-roll authentication where a
managed provider already safely handles it.

**Credentials never touch the Express backend.** The frontend's `lib/supabaseClient.ts` is the
only place that talks to Supabase directly - registration, login, logout, password reset request/
confirmation, and session persistence (including token auto-refresh) all go through
`@supabase/supabase-js`, using the `anon` key. Email verification and password-reset emails are
Supabase's own hosted feature (configured in the Supabase dashboard, not built by this app) -
this is what the master spec's "email verification architecture" and "forgot password" ask for
without requiring any email-sending infrastructure of our own. Because auth requests never reach
our backend, our `express-rate-limit` baseline never sees them either; Supabase's platform rate-
limits and brute-force-protects its own Auth API, which is exactly what "use a managed provider"
is supposed to buy.

**The backend's only job is verifying already-issued tokens.** `middleware/authenticate.ts`'s
`requireAuth` extracts the `Authorization: Bearer <token>` header and calls Supabase's
`auth.getUser(token)` (via `lib/supabaseAdmin.ts`, service-role key, server-only) rather than
decoding the JWT locally - a revoked/signed-out session is rejected immediately instead of
staying valid until it expires. On success it sets `req.user = { id, email }`, which every
protected route and repository call downstream uses for ownership scoping (Part 2 already built
every repository method to take an owner id; Part 3 is what actually supplies one).

**`public.users` sync**: since credentials/signup flow through Supabase directly, not through a
backend registration endpoint, something has to create the matching `public.users` row.
`requireAuth` does this on every authenticated request via `UserRepository.syncFromAuth()` - an
idempotent upsert, not a DB trigger. A trigger (`0015_supabase_auth_sync.sql`) exists too but
turned out to be unreliable in practice; see `DATABASE.md` for why and what actually works.

**Account deletion** (`DELETE /api/auth/account`) is the one identity-related operation that does
require the backend: it needs the service-role admin API to delete the actual Supabase identity,
which the `anon` key can't do. It deletes application data first (cascading through the whole
schema - see `DATABASE.md`), then the Supabase identity, in that order deliberately: if the
second step fails, the user is left with an empty, harmless Supabase account rather than
application data outliving a deleted identity.

**Row-level security**: adopting real Supabase in Part 3 also meant enabling RLS (default-deny,
no policies) on every table, to close off Supabase's auto-generated public REST API - see
`DATABASE.md` for why this is a different concern from the ownership scoping above, not a
replacement for it.

## The Recovery Decision Engine (Part 6)

`services/recoveryEngine/evaluateRecoveryDecision.ts` is the master spec's "most important
engineering part": a pure, deterministic function - no database, clock, or LLM call inside it -
over the spec's full 17-dimension input space (incidentType, timeSinceIncident, platform,
accountAccess, simAccess, screenLockStatus, deviceFindingAvailability, locationStatus,
financialAppsPresent, authenticatorPresent, passwordManagerPresent, workAccountPresent,
deviceSecured, simSecured, financialAccountsSecured, policeReportStatus, ceirStatus), returning
`{ riskLevel, riskReasons, orderedActions, currentRecommendedAction, blockedActions, warnings }`.
See [`RECOVERY_ENGINE.md`](RECOVERY_ENGINE.md) for the full rule set, tier scheme, and how it
reproduces the master spec's own worked examples exactly.

Two builders turn real state into that input without adding any new columns:
`buildEngineInputForNewCase.ts` reads the wizard's ten answers directly (nothing else exists yet
for a brand-new case); `gatherEngineInputForExistingCase.ts` reads a case's live state for
recalculation - critically, `deviceSecured` / `simSecured` / `financialAccountsSecured` /
`accountAccess` are *derived*, not stored: "has the device been secured" is read back from
whether the `SECURE_DEVICE` recovery action is `COMPLETED`, because that completion is what
securing it means in this app. `applyEngineResult.ts` persists a result (creating new actions,
updating existing ones' priority/status without ever touching IN_PROGRESS/COMPLETED/SKIPPED
rows, appending a new `IncidentAssessment` row only when risk actually changed) and is shared by
both case creation and recalculation, so both paths write identically. `createRecoveryCaseFromWizard.ts`
now calls this engine directly - the provisional Part 5 scoring function it originally called is
gone.

Recalculation - "whenever a recovery action changes state" - is a real, wired-up flow: `PATCH
/api/recovery-cases/:caseId/actions/:actionId` updates one action's status, then re-runs the
engine and persists the outcome; `GET /api/recovery-cases/:caseId/recovery-plan` does the same
and returns the live plan, including `blockedActions`/`warnings`, which have no table of their
own since they're a function of current state, not history worth persisting. Verified against the
master spec's three worked examples plus 37 further scenarios (40 total,
`tests/services/recoveryEngine.test.ts`) and end to end against a real Supabase project, including
the full dependency-unblocking cascade (SIM → account recovery → device securing / device
finding) and the resulting risk-level drop.

## The AI Recovery Agent (Part 7)

A conversational assistant scoped to exactly one `RecoveryCase`, built on the tool-calling AI
provider abstraction below. It explains what the Recovery Decision Engine currently recommends and
can update an action's status or record a corrected incident detail, but only through two narrow
tools that both require explicit user confirmation (checked twice: the model's own claim, plus an
independent server-side pattern match on the user's last message) and end by re-running the real
`evaluateRecoveryDecision()` — never by talking its way around it. Conversation history lives only
in the browser tab (`sessionStorage`), never the database: per the master spec ("store useful case
events, not unnecessary sensitive conversation data"), every state-changing tool call instead
writes a `TimelineEvent` with `source: 'AI_AGENT'`. See
[`AI_RECOVERY_AGENT.md`](AI_RECOVERY_AGENT.md) for the full design — case-context injection,
prompt-injection fencing for user-supplied free text, the output guard backstopping the "must
never" rules, and the one real engine-plumbing gap Part 7 had to close (recalculation previously
had no way to persist a corrected sensitive-app answer).

## Database access layer

Plain PostgreSQL via `pg`, addressed through a single `DATABASE_URL` — deliberately provider
agnostic, so it works the same whether Postgres is Supabase-managed or self-hosted. `db/pool.ts`
lazily creates a shared connection pool and exposes `checkDatabaseConnection()`, used by the
readiness endpoint. Part 2 built out the full schema (14 hand-written SQL migrations, no ORM), a
repository class per entity (`db/repositories/*Repository.ts`, all sharing a `Queryable`
interface so a transaction client can substitute for the pool), and 62 tests run against a real
Postgres instance. See [`DATABASE.md`](DATABASE.md) for the schema, ER diagram, and design
rationale (encryption strategy, ownership scoping, cascade rules, and two Postgres gotchas around
enum literals and custom enum array types that the test suite caught).

## AI provider abstraction

`services/ai/AiProvider.ts` defines the interface (`generateCompletion`, with tool-calling support
added in Part 7 — a request may carry `tools`, a response's `content` can mix text and `tool_use`
blocks); `services/ai/index.ts` is the factory that selects an implementation from `AI_PROVIDER`.
`AnthropicAiProvider` and `OpenAiAiProvider` (Part 7) talk to their APIs directly over `fetch` — no
SDK dependency, since the request/response shape needed here is small enough that a hand-rolled
adapter keeps `AiProvider` the one translation point. `MockAiProvider` is the default and requires
no API key — it never calls a tool, returns a response explicitly flagged `isSimulated: true` and
prefixed `[DEMO AI PROVIDER]`, and is also the automatic fallback if a real provider is requested
without its key configured. Per the master spec, the AI layer may only ever *explain* a
recommendation — the deterministic Recovery Decision Engine (see above) never depends on this
interface and cannot be overridden by it; see [`AI_RECOVERY_AGENT.md`](AI_RECOVERY_AGENT.md) for
how the Part 7 Recovery Agent enforces that with real tool boundaries rather than just a prompt.

## Mapping provider abstraction

`services/maps/MapProvider.ts` defines `getClientConfig()`, handing the frontend whatever public
config (provider name, publishable token) a real map SDK needs. It never computes or fabricates
coordinates — that would violate the master spec's "never fabricate device location" rule; it
only ever exposes configuration for rendering `LocationObservation` rows that already came from
an authorized integration or the user. `NoopMapProvider` (used when `MAP_PROVIDER=none`) reports
`isConfigured: false` so the UI can render an honest "map unavailable" state. Real providers
(Mapbox/MapTiler/Google) are added in Part 8.

## External-service abstraction

`services/external/ExternalServiceResult.ts` defines a discriminated union —
`{status: 'success'} | {status: 'not_configured'} | {status: 'error'}` — that every future
integration with a system RecoverAI doesn't control (carriers, police portals, CEIR, Apple/
Google) must return. There is no implicit "assume success" branch, which structurally enforces
the master-spec rule that RecoverAI must never claim an external action succeeded unless the
integration confirms it or the user confirms completion.

## Security architecture (baseline now, hardened per-part and again in Part 20)

Already in place: `helmet` security headers, CORS restricted to `WEB_ORIGIN`, strict TypeScript,
a Zod validation pattern for input-bearing routes, structured logging with secret redaction, a
baseline rate limiter, ownership-scoped repository methods for every entity plus AES-256-GCM
encryption for IMEI/serial fields (Part 2), and (Part 3) token-based authentication via
`requireAuth` plus RLS default-deny on every table - see `DATABASE.md` for the row-level-security
reasoning and the "Authentication architecture" section above for why auth-specific *rate*
limiting is intentionally absent from this app's own Express layer (credentials never reach it;
Supabase's platform rate-limits its own Auth API). Route-level authorization for concrete
resources (devices, cases, ...) lands in Part 4 alongside the first routes that need it -
`req.user.id` from `requireAuth` is the mechanism, already wired through to every repository
method. IDOR/XSS/CSRF/SSRF/file-upload hardening and a full threat model arrive alongside the
features they protect (Parts 15, 20).

## Environment configuration

`packages/config` defines a single Zod schema (`serverEnvSchema`) documenting every server-side
environment variable the whole project will ever use, most marked `.optional()` until the part
that introduces them. `loadServerEnv()` validates `process.env` at boot and throws a readable
error listing exactly which variables are invalid — configuration mistakes fail immediately
instead of surfacing as confusing runtime errors later. The frontend's env surface is
intentionally smaller and handled directly in `apps/web/src/lib/env.ts` (only `VITE_`-prefixed
variables are ever readable by browser code).
