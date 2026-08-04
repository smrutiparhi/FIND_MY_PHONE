# Deployment (Part 24)

RecoverAI is a split-stack app - a static frontend (`apps/web`, Vite build) and a long-lived Node
server (`apps/api`, Express) - deployed as two separate services from the same GitHub repo:
**Vercel** for the frontend, **Render** for the backend. Both connect directly to this repo's
`master` branch and redeploy on every push; there's no CI pipeline of its own to maintain.

**Every service used here has a genuinely free tier with no expiring trial credit and no card
required** - this was a deliberate choice, not the default. The one cost of "free forever" instead
of a paid always-on host: Render's free web services sleep after 15 minutes with no traffic and take
30-60 seconds to wake up on the next request. For a portfolio project that isn't hit constantly,
that's the right trade - see "Why Render, not Railway" below for the reasoning.

No Vercel/Render/GitHub CLI is required - both platforms are set up entirely through their web
dashboards, since the initial account connection is an OAuth flow only you can complete.

## Why two platforms, not one

Vercel's model is built for static builds and serverless functions - a great fit for `apps/web`'s
Vite output, but not for `apps/api`'s long-lived Express server (session-mode Postgres pooling,
`app.listen()`, in-process rate limiting all assume one continuously running process, which
serverless cold-starts and per-request isolation would fight against). Render runs a persistent
container instead, which is what this backend was actually built for.

## Why Render, not Railway

Railway was the first choice, but its free tier is a one-time $5 usage credit that expires in 30
days - after that, keeping the API running requires a card on file and the paid Hobby plan
($5/month minimum). Render's free Web Service tier has no expiring credit and no card requirement:
750 hours/month of compute (enough for one service running continuously), 512 MB RAM, 0.1 vCPU. The
tradeoff is that a free Render service **sleeps after 15 minutes of no incoming requests** and takes
30-60 seconds to respond to the request that wakes it back up - the first visitor after a quiet
period waits; everyone after that, until it goes idle again, gets normal response times. For a
project meant to stay free indefinitely rather than double as an always-instant production service,
that's the right trade.

## Repo layout Vercel/Render need to understand

This is an npm-workspaces monorepo - `apps/web` and `apps/api` both depend on sibling packages
(`@recoverai/shared`, `@recoverai/ui`, `@recoverai/config`) that are consumed as raw TypeScript
source (`"main": "./src/index.ts"`, no build step of their own - see `ARCHITECTURE.md`). That means
both deploys need `npm install` run from the **repo root**, not from inside `apps/web` or
`apps/api`, so the workspace symlinks resolve. `vercel.json` and `render.yaml` at the repo root
already encode this - see below.

## Vercel setup (frontend)

1. [vercel.com](https://vercel.com) → New Project → import `smrutiparhi/FIND_MY_PHONE` from GitHub.
2. Vercel will detect `vercel.json` at the repo root automatically:
   ```json
   {
     "buildCommand": "npm run build -w apps/web",
     "installCommand": "npm install",
     "outputDirectory": "apps/web/dist",
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
   The `rewrites` rule is what makes client-side routes (`/dashboard`, `/recovery-cases/:id`, ...)
   work on a hard refresh or direct link - without it, Vercel would 404 on anything but `/`.
3. **Root Directory**: leave as the repo root (do not point it at `apps/web`) - the workspace
   install needs the full monorepo.
4. Environment variables (Project Settings → Environment Variables), all three required or the app
   throws on boot (`apps/web/src/lib/env.ts` - `VITE_API_BASE_URL must be set in production builds`):
   | Variable | Value |
   | --- | --- |
   | `VITE_API_BASE_URL` | Your Render API URL once deployed (e.g. `https://recoverai-api.onrender.com`) - see "the ordering problem" below |
   | `VITE_SUPABASE_URL` | Same value as `apps/web/.env`'s `VITE_SUPABASE_URL` |
   | `VITE_SUPABASE_ANON_KEY` | Same value as `apps/web/.env`'s `VITE_SUPABASE_ANON_KEY` - this is the public anon key, safe to expose client-side by design |
5. Deploy. Vercel gives you a `*.vercel.app` URL (or attach a custom domain under Project Settings →
   Domains) - free on the Hobby plan either way.

## Render setup (backend)

1. [render.com](https://render.com) → sign up (no card required) → New → Blueprint → connect
   `smrutiparhi/FIND_MY_PHONE` from GitHub.
2. Render detects `render.yaml` at the repo root and pre-fills the service from it:
   ```yaml
   services:
     - type: web
       name: recoverai-api
       runtime: node
       plan: free
       rootDir: .
       buildCommand: npm install && npm run build -w apps/api
       startCommand: npm run start -w apps/api
       healthCheckPath: /api/health
   ```
   `npm run start -w apps/api` runs `node dist/server.js` against the `tsup` bundle produced by the
   build step - `tsup` inlines the workspace packages directly into `dist/server.js` (~250 KB, no
   separate `node_modules` resolution needed at runtime for `@recoverai/shared`/`@recoverai/config`).
   Confirm **plan: Free** is selected before the first deploy - Render's Blueprint flow can default
   to a paid instance type if changed in the dashboard.
3. Render auto-injects `PORT` - `apps/api/src/config/env.ts`'s `PORT` schema already reads
   `process.env.PORT` (`z.coerce.number()...default(4000)`), so no manual `PORT` variable is needed.
4. `render.yaml` lists every other variable the app needs but marks the secrets `sync: false`, so
   Render will prompt you to fill these in during the Blueprint setup (or later under the service's
   Environment tab):
   | Variable | Value | Note |
   | --- | --- | --- |
   | `WEB_ORIGIN` | Your Vercel URL, e.g. `https://find-my-phone.vercel.app` | **Not** `localhost:5173` - see below. CORS (`cors({ origin: env.WEB_ORIGIN })`) allows exactly one origin, no wildcard |
   | `DATABASE_URL` | Same as local `apps/api/.env` | Same Supabase project as local dev, by deliberate choice - see "Accepted risk" below |
   | `ENCRYPTION_KEY` | Same as local `apps/api/.env` | Must stay identical to whatever encrypted the IMEI values already in the database - do not regenerate |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Same as local `apps/api/.env` | |
   | `MAP_API_KEY` | Same as local `apps/api/.env` | Consider adding a domain/referrer restriction on this key in your MapTiler dashboard once the Vercel domain is known |

   `NODE_ENV=production`, `LOG_LEVEL=info`, `AI_PROVIDER=mock`, and `MAP_PROVIDER=maptiler` are
   already set as plain values in `render.yaml` - deliberate choices carried over from the original
   plan (mock AI so a public demo can never rack up a real API bill).
5. Deploy. Render gives you a `*.onrender.com` URL (or attach a custom domain under Settings →
   Custom Domains - free on Render too).

## The ordering problem: two URLs that reference each other

`WEB_ORIGIN` (Render) needs the Vercel URL, and `VITE_API_BASE_URL` (Vercel) needs the Render URL -
neither exists until the other side has deployed once. Break the cycle like this:

1. Deploy Render first with a placeholder `WEB_ORIGIN` (anything valid, e.g. `http://localhost:5173`
   - it'll reject cross-origin requests until corrected, but the server still boots).
2. Deploy Vercel with `VITE_API_BASE_URL` set to the real Render URL from step 1.
3. Go back to Render, set `WEB_ORIGIN` to the real Vercel URL, and redeploy (Render redeploys
   automatically on a variable change, or trigger one manually from the dashboard).
4. Sign in on the live Vercel URL and confirm requests to the Render API succeed (no CORS error in
   the browser console). If the API had gone to sleep, this first request is the slow 30-60s one -
   that's expected, not a bug.

## Accepted risk: production shares the local dev/test Supabase project

This deployment deliberately reuses the same Supabase project as local development, rather than
provisioning a separate production database - the simplest option, and a reasonable one **as long
as you remember one consequence**: `apps/api/tests/setup.ts` runs `TRUNCATE TABLE users CASCADE`
before every test (see `TESTING.md`) - cascading through foreign keys to erase every row in every
table, real or seeded. Once real visitors can sign up on the live site, **running `npm test` locally
will delete their accounts and cases along with your own test data.** If this project ever needs to
carry real user data safely, the fix is a second Supabase project for production with its own
`DATABASE_URL`/`SUPABASE_*` values and the same 23 migrations + `npm run db:seed -w apps/api` run
against it - nothing else about the deploy config above would need to change.

Separately: Supabase's own free tier auto-pauses a project after 7 days with no API traffic (data is
retained, but the project goes offline until manually resumed from the Supabase dashboard). If both
Vercel and Render go quiet for a week, the database itself - not just the sleeping API - will need a
manual "resume" click before the app works again.

## Post-deploy checklist

- [ ] `curl https://<render-url>/api/health/ready` returns `"status":"ready"` with
      `database: connected` (the first request may take 30-60s if the service was asleep).
- [ ] Visit the Vercel URL, confirm the landing page loads and "Try the guided demo" reaches
      `/login` (not a CORS error in the console).
- [ ] Sign in as `demo.login@example.com` and confirm the dashboard loads real data from Render.
- [ ] Check the Recovery Location map renders real tiles (confirms `MAP_API_KEY` made it through).
- [ ] `npm run db:seed -w apps/api` (from your local machine, against the shared `DATABASE_URL`) if
      the two seeded demo accounts (`demo.priya@example.com`, `demo.aarav@example.com`) aren't
      already present.

## What Part 24 deliberately does not include

- **No WAF/CDN/DDoS layer** - `SECURITY.md` already calls this out as infrastructure-level, out of
  scope for this app's own code; Vercel's and Render's platform-level protections are what's actually
  in front of this deployment.
- **No custom domain, no staging environment** - both are one dashboard click away later (Vercel and
  Render both support attaching a domain post-deploy, free of charge) but weren't part of what was
  asked for here.
- **No containerization** - Render's Node runtime handles the build directly from `render.yaml`; a
  Dockerfile would be redundant unless a future need (a different host, more build control) actually
  requires one.
- **No paid "always-on" tier to skip the cold start** - Render offers one, but it isn't free, and
  free-forever was the explicit goal for this deployment.
