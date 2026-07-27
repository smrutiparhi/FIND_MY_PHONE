# RecoverAI

RecoverAI is an AI-assisted incident-response and recovery coordinator for people who have lost
a smartphone or had one stolen. It is **not** an IMEI/phone-number tracker, spyware tool, or a
replacement for Apple Find My, Google Find Hub, telecom operators, police systems, or India's
CEIR — it guides the legitimate device owner through the correct sequence of *real, authorized*
recovery steps (device-finding, SIM protection, account recovery, financial-account protection,
police complaint drafting, CEIR/Sanchar Saathi guidance) and tracks the case to resolution.

This repository is being built in sequential parts (see `docs/`); this README covers what exists
today and how to run it. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the technical
design.

## Status

**Part 1 — Project architecture.** The monorepo, tooling, health-check API, and a minimal
frontend that verifies the backend connection are in place. No recovery-case functionality
exists yet — that starts in Part 2 (Database) and Part 3 (Authentication).

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
optional until the parts that use them (Database: Part 2, AI Recovery Agent: Part 7, Device
Location + Map: Part 8). `/api/health/ready` reports each dependency's status honestly (e.g.
`database: "not_configured"`) rather than pretending they're connected.

## Scripts

Run from the repo root (npm workspaces):

| Script | What it does |
| --- | --- |
| `npm run dev` | Runs the API and web dev servers together |
| `npm run build` | Typechecks `packages/*`, then production-builds `apps/api` and `apps/web` |
| `npm run typecheck` | `tsc --noEmit` across every workspace |
| `npm run lint` | ESLint across the repo |
| `npm run format` | Prettier write across the repo |

Per-workspace: `npm run dev -w apps/api`, `npm run build -w apps/web`, etc.

## Environment variables

Each app has its own `.env.example` documenting every variable it will ever read, including ones
that only become required in a later part (clearly commented with which part introduces them).
Never commit a real `.env` file — `.gitignore` already excludes it.

- `apps/api/.env.example` — server port, CORS origin, log level, database connection string
  (Part 2), Supabase project (Part 3 — see Auth architecture note below), AI provider (Part 7),
  map provider (Part 8).
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
