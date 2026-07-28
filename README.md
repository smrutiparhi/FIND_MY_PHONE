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

**Part 3 — Authentication.** Real Supabase Auth wired up end to end: registration, login,
logout, password reset, and session persistence all happen client-side via `supabase-js`
(`apps/web/src/lib/supabaseClient.ts`); the backend verifies tokens via `requireAuth`
(`apps/api/src/middleware/authenticate.ts`) and never sees a password. Row-level security is
enabled (default-deny) on every table. `DATABASE_URL` now points at Supabase's managed Postgres
rather than a local container — see "Database setup" below. No recovery-case functionality
exists yet — that starts in Part 4 (Dashboard).

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
