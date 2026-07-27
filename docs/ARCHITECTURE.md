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
  middleware factory. No route needs input validation yet (health check takes none) — the
  mechanism exists so Part 3 onward has one consistent pattern instead of ad hoc checks inside
  controllers.
- **Rate limiting**: a generous app-wide baseline (`express-rate-limit`) so nothing is ever
  completely unprotected; Part 3 adds a strict limiter specifically on auth endpoints
  (brute-force / enumeration protection).

## Frontend architecture

- **Framework**: React 19 + TypeScript + Vite 6 + Tailwind CSS 4 (`@tailwindcss/vite`, no
  separate `tailwind.config.js`/PostCSS config needed for v4's Vite plugin) + React Router 7.
- **Routing**: `AppRoutes.tsx` holds the route table. Route guards / auth-aware routing land in
  Part 3.
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
/api/devices/*           Part 2 + Part 4
/api/recovery-cases/*    Part 2, 5, 17
/api/recovery-cases/:id/location, /sim, /account-recovery, /financial, /police, /ceir, /evidence,
  /timeline                nested under the owning case (Parts 8–16)
```

Every response body — success or error — uses the shared envelope from `packages/shared`:

```ts
{ success: true, data: T } | { success: false, error: { code, message, details? } }
```

## Authentication architecture (decision made now, implemented in Part 3)

Supabase Auth, per the master spec's explicit instruction not to hand-roll authentication where a
managed provider already safely handles it. The frontend will use `@supabase/supabase-js` for
sign-in/sign-up flows; the backend verifies the Supabase-issued JWT on protected routes and uses
it to resolve the authenticated user id for row-ownership checks. `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are already reserved in `apps/api/.env.example` (server-only, never
exposed to the frontend).

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

`services/ai/AiProvider.ts` defines the interface (`generateCompletion`); `services/ai/index.ts`
is the factory that selects an implementation from `AI_PROVIDER`. Only `MockAiProvider` exists
today — it never calls a real model, returns a response explicitly flagged `isSimulated: true`
and prefixed `[DEMO AI PROVIDER]`, and requires no API key. Real providers (Anthropic, OpenAI)
are added in Part 7 once the Recovery Agent has concrete prompts and tool definitions. Per the
master spec, the AI layer may only ever *explain* a recommendation — the deterministic Recovery
Decision Engine (Part 6) never depends on this interface and cannot be overridden by it.

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
a Zod validation pattern ready for input-bearing routes, structured logging with secret
redaction, a baseline rate limiter, and (Part 2) ownership-scoped repository methods for every
entity plus AES-256-GCM encryption for IMEI/serial fields - see `DATABASE.md`. Auth-specific rate
limiting, route-level authorization (there are no routes yet to protect), IDOR/XSS/CSRF/SSRF/
file-upload hardening, and a full threat model arrive alongside the features they protect (Parts
3, 15, 20).

## Environment configuration

`packages/config` defines a single Zod schema (`serverEnvSchema`) documenting every server-side
environment variable the whole project will ever use, most marked `.optional()` until the part
that introduces them. `loadServerEnv()` validates `process.env` at boot and throws a readable
error listing exactly which variables are invalid — configuration mistakes fail immediately
instead of surfacing as confusing runtime errors later. The frontend's env surface is
intentionally smaller and handled directly in `apps/web/src/lib/env.ts` (only `VITE_`-prefixed
variables are ever readable by browser code).
