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

**Part 2 — Database.** The full PostgreSQL schema (14 migrations, 12 core entities), a
repository layer with ownership scoping baked into every query, IMEI/serial encryption, demo
seed data, and 62 tests run against a real Postgres instance. No user-facing recovery-case
functionality exists yet — that starts in Part 3 (Authentication) and Part 4 (Dashboard).

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

## Database setup

Any Postgres works — a disposable local one is easiest for development:

```bash
docker run -d --name recoverai-postgres \
  -e POSTGRES_USER=recoverai -e POSTGRES_PASSWORD=recoverai_dev_only -e POSTGRES_DB=recoverai \
  -p 55432:5432 postgres:16-alpine
```

Then in `apps/api/.env`:

```
DATABASE_URL=postgresql://recoverai:recoverai_dev_only@localhost:55432/recoverai
ENCRYPTION_KEY=<output of: openssl rand -base64 32>
```

```bash
npm run db:migrate -w apps/api   # applies every migration in apps/api/src/db/migrations
npm run db:seed -w apps/api      # two fictional demo users/cases - see docs/DATABASE.md
npm run test -w apps/api         # 62 tests against the real database above
```

See [`docs/DATABASE.md`](docs/DATABASE.md) for the schema, an ER diagram, and the design
rationale (encryption, ownership scoping, cascade rules).

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
  encryption key (Part 2), Supabase project (Part 3 — see Auth architecture note below), AI
  provider (Part 7), map provider (Part 8).
- `apps/web/.env.example` — API base URL. Only `VITE_`-prefixed variables are ever exposed to the
  browser; never put secrets here.

### Why Supabase for auth

The master spec explicitly says: "Do not build custom authentication where a configured managed
authentication provider already safely handles the responsibility." RecoverAI stores sensitive
recovery data (device identifiers, incident details, evidence); hand-rolling password hashing,
session management, and account-recovery flows is exactly the kind of risk a managed provider
exists to remove. Part 3 wires up Supabase Auth on both frontend and backend. The database layer
itself only needs a standard `DATABASE_URL` connection string, so it works identically whether
Postgres is Supabase-managed or self-hosted.

## Code quality

TypeScript runs in strict mode everywhere (`strict`, `noUncheckedIndexedAccess`,
`noUnusedLocals`, `noPropertyAccessFromIndexSignature`, ...). ESLint (flat config) and Prettier
are configured at the repo root and apply to every workspace.
