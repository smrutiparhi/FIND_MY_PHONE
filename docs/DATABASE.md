# RecoverAI — Database (Part 2)

PostgreSQL schema for RecoverAI, applied through 20 hand-written SQL migrations
(`apps/api/src/db/migrations/`) run by a minimal custom runner
(`apps/api/src/db/migrate.ts`) — see [`ARCHITECTURE.md`](ARCHITECTURE.md) for
why this project uses plain SQL + a repository layer instead of an ORM.

## Entity-relationship diagram

```mermaid
erDiagram
    USERS ||--o{ DEVICES : owns
    USERS ||--o{ RECOVERY_CASES : owns
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_EVENTS : "acted as (nullable)"
    DEVICES ||--o{ RECOVERY_CASES : "is subject of"
    RECOVERY_CASES ||--o{ INCIDENT_ASSESSMENTS : "has history of"
    RECOVERY_CASES ||--o{ RECOVERY_ACTIONS : "sequences"
    RECOVERY_CASES ||--o{ LOCATION_OBSERVATIONS : "has log of"
    RECOVERY_CASES ||--o{ EVIDENCE : "stores"
    RECOVERY_CASES ||--o{ TIMELINE_EVENTS : "narrates"
    RECOVERY_CASES ||--o{ POLICE_REPORTS : "may have"
    RECOVERY_CASES ||--o| CEIR_RECORDS : "has at most one"
    RECOVERY_CASES ||--o| ACCOUNT_RECOVERY_ATTEMPTS : "has at most one"
    RECOVERY_CASES ||--o| SIM_PROTECTION_RECORDS : "has at most one"
    RECOVERY_CASES ||--o{ FINANCIAL_PROTECTION_ITEMS : "tracks"
    RECOVERY_CASES ||--o{ NOTIFICATIONS : "may relate to"
    RECOVERY_CASES }o--o| RECOVERY_ACTIONS : "currentRecommendedAction"
    RECOVERY_ACTIONS ||--o{ RECOVERY_ACTIONS : "depends on (join table)"
    POLICE_REPORTS ||--o{ POLICE_REPORT_VERSIONS : "has draft history"
    TIMELINE_EVENTS }o--o| RECOVERY_ACTIONS : references
    TIMELINE_EVENTS }o--o| LOCATION_OBSERVATIONS : references
    TIMELINE_EVENTS }o--o| EVIDENCE : references
    TIMELINE_EVENTS }o--o| POLICE_REPORTS : references
    TIMELINE_EVENTS }o--o| CEIR_RECORDS : references

    USERS {
        uuid id PK "= Supabase Auth user id (Part 3)"
        text email UK
        text full_name
    }
    DEVICES {
        uuid id PK
        uuid user_id FK
        text nickname
        platform_type platform
        text phone_number_masked "full number never stored"
        text imei1_encrypted "AES-256-GCM ciphertext"
        text imei2_encrypted
        text serial_number_encrypted
        sim_type sim_type
    }
    RECOVERY_CASES {
        uuid id PK
        uuid user_id FK
        uuid device_id FK
        incident_type incident_type
        case_status status
        risk_level risk_level
        uuid current_recommended_action_id FK
        timestamptz closed_at
    }
    INCIDENT_ASSESSMENTS {
        uuid id PK
        uuid case_id FK
        risk_level risk_level
        text_array risk_reasons
        "append-only history" note
    }
    RECOVERY_ACTIONS {
        uuid id PK
        uuid case_id FK
        recovery_action_type type
        int priority
        recovery_action_status status
        jsonb official_external_action
    }
    LOCATION_OBSERVATIONS {
        uuid id PK
        uuid case_id FK
        numeric latitude
        numeric longitude
        location_source source
        verification_status verification_status
        "never continuous tracking" note
    }
    EVIDENCE {
        uuid id PK
        uuid case_id FK
        uuid uploaded_by_user_id FK
        evidence_category category
        text storage_key "private, never a public URL"
        timestamptz deleted_at "soft delete"
    }
    TIMELINE_EVENTS {
        uuid id PK
        uuid case_id FK
        timeline_event_type type
        timeline_event_source source
        verification_status verification_status
    }
    POLICE_REPORTS {
        uuid id PK
        uuid case_id FK
        police_report_status status "never claims submission"
        text draft_text
    }
    CEIR_RECORDS {
        uuid id PK
        uuid case_id FK UK "one per case"
        ceir_status status
        text ceir_request_id "user-entered only"
    }
    ACCOUNT_RECOVERY_ATTEMPTS {
        uuid id PK
        uuid case_id FK UK "one per case"
        account_recovery_status status
        account_access_signal_array available_signals "possession only, never a secret"
    }
    SIM_PROTECTION_RECORDS {
        uuid id PK
        uuid case_id FK UK "one per case"
        sim_status status "distinct meaning from recovery_action_status.BLOCKED"
    }
    FINANCIAL_PROTECTION_ITEMS {
        uuid id PK
        uuid case_id FK "many per case, unlike the *_RECORDS/*_ATTEMPTS tables"
        financial_item_category category
        text label "generic or by name, optional"
        financial_protection_status status
    }
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        uuid case_id FK
        notification_type type
        bool is_read
    }
    AUDIT_EVENTS {
        uuid id PK
        uuid user_id FK "nullable"
        text action "free text, not enum"
        inet ip_address
    }
```

## Design decisions

### Why plain SQL migrations, not an ORM

Consistent with Part 1's provider-agnostic `DATABASE_URL` decision: a
hand-written migration runner (`migrate.ts`) applies numbered `.sql` files in
order, tracked in a `schema_migrations` table. No ORM/query-builder
dependency, full control over Postgres-specific features (enums, arrays,
`CASE WHEN` upserts), and every query in the repository layer is plain,
readable, parameterized SQL.

### Repository layer, not SQL in controllers

Every table has a matching `apps/api/src/db/repositories/*Repository.ts`
class (`createRepositories()` in `repositories/index.ts` wires them all to a
shared `Queryable` - either the connection pool or a transaction client, so a
future caller can wrap several repository calls in one transaction). No route
or controller will ever contain raw SQL.

### Ownership scoping (IDOR prevention)

This is the schema's central security property, and it's enforced at two
layers:

1. **Directly-owned tables** (`devices`, `recovery_cases`, `notifications`) -
   every repository method takes the acting user's id and filters by
   `user_id = $ownerUserId` in the query itself. There is deliberately no
   unscoped `findById`.
2. **Case-scoped child tables** (`incident_assessments`, `recovery_actions`,
   `location_observations`, `evidence`, `timeline_events`, `police_reports`,
   `ceir_records`) - the normal path is "verify case ownership once via
   `RecoveryCaseRepository`, then treat `case_id` as already-authorized."
   For the tables most exposed to direct by-id access from a route (actions,
   locations, evidence, timeline events, police reports, CEIR records), each
   repository *also* exposes a `findByIdForUser` (and equivalent mutation
   methods) that joins to `recovery_cases` and checks `user_id` in the same
   query, as defense-in-depth against a route handler that forgets the
   first check.

`tests/repositories/ownership.test.ts` exercises every one of these paths
against a real Postgres instance: a second "stranger" user is created, and
every read/update/delete method is asserted to refuse them exactly as if the
resource didn't exist.

Postgres row-level security (`RLS`) was deliberately **not** added in Part 2,
reasoning that this app's browser never talks to Postgres except through the
Express API, so per-row RLS *policies* would be inert defense-in-depth with
no session context to key off until Part 3's auth pipeline exists.

Part 3 revisited this, but landed somewhere more specific than "add
policies": once `DATABASE_URL` points at a real Supabase project (Part 3's
setup), that Postgres instance auto-exposes every `public` schema table over
a REST API (PostgREST), reachable with the project's `anon` key - which is
not a secret, it ships inside the frontend's JS bundle by design. Without
RLS, anyone could extract that key and query e.g. `/rest/v1/devices`
directly, bypassing this app's Express backend and its ownership-scoped
repository methods entirely. Migration `0016_enable_row_level_security.sql`
enables RLS with **zero policies** on every table - a blanket default-deny
that locks PostgREST out completely, since only a table's owner (or a role
with `BYPASSRLS`) can read through RLS with no policies, and this app's own
`DATABASE_URL` connects as exactly that owning role. Fine-grained per-row
*policies* remain unnecessary for the reason originally given: the only
client that's supposed to read this data is the Express API, which bypasses
RLS entirely by virtue of the role it connects as, not by a policy granting
it access.

### Encryption vs. masking

Two different strategies for two different sensitivity profiles:

- **IMEI / serial number** (`imei1_encrypted`, `imei2_encrypted`,
  `serial_number_encrypted`): reversible AES-256-GCM
  (`apps/api/src/lib/encryption.ts`), because Part 13 (police complaints) and
  Part 14 (CEIR) must display the real value. The general read path
  (`findById`, `listByUser`, ...) returns ciphertext; a device's real IMEI is
  only ever recovered through an explicit, ownership-scoped
  `getDecryptedImei1/2/SerialNumber` call, never implicitly.
- **Phone number** (`phone_number_masked`): the full number is **never
  persisted at all** - `lib/encryption.ts`'s `maskPhoneNumber()` reduces it to
  a display-safe string (e.g. `+91••••••3210`) before it ever reaches a
  repository.

`ENCRYPTION_KEY` (32 bytes, base64) is required to create a device with
IMEI/serial values; see `apps/api/.env.example`.

### Supabase Auth sync

`public.users` still has no foreign key to `auth.users` (see 0003_users.sql)
- this schema stays portable to a self-hosted Postgres that has no `auth`
schema at all. `0015_supabase_auth_sync.sql` adds triggers on `auth.users`
(INSERT, UPDATE OF email, DELETE) to keep the two in sync, guarded by an
existence check so the migration is a safe no-op on any Postgres that isn't
Supabase-managed.

**These triggers turned out to be best-effort, not what this app actually
relies on.** Verified empirically against a real Supabase project: a real
sign-up through `supabase-js` never produced a matching `public.users` row,
while manually re-running the identical `INSERT` outside the trigger worked
immediately - Supabase's Auth service writes to `auth.users` in a way that
default-firing ("origin") triggers don't run for. The standard fix,
`ALTER TABLE auth.users ENABLE ALWAYS TRIGGER ...`, isn't available to this
app: the connecting Postgres role doesn't *own* `auth.users`
(`supabase_auth_admin` does), and that `ALTER` requires ownership, not just
the `TRIGGER` privilege `CREATE TRIGGER` itself needed.

The INSERT/UPDATE cases are instead handled reliably at the application
layer: `UserRepository.syncFromAuth()` upserts `public.users` on **every**
authenticated request, called from `requireAuth`
(`middleware/authenticate.ts`) before any ownership-scoped repository call
that would otherwise fail its foreign key. The DB triggers are left in place
as a harmless bonus in case they ever do fire (a future Supabase change, or
a self-hosted Supabase stack). The DELETE case has no equivalent
application-layer fallback - there's no future request from a deleted user
to hang a check on - so a user removed directly via the Supabase dashboard
(bypassing this app's own account-deletion endpoint) may leave a stale
`public.users` row behind if that trigger doesn't fire either.

### Append-only history over mutable single rows

`incident_assessments` never updates a row in place - the Recovery Decision
Engine (Part 6) inserts a new row whenever a recalculation actually changes
the computed risk level or reasons (not on every recalculation - most just
re-order/unblock actions with the risk unchanged), so a case's risk
trajectory over time stays fully auditable without a row per no-op run.
`recovery_cases.risk_level` is a denormalized cache of the latest
assessment, kept in sync by the service layer, so dashboard reads (Part 4/17)
don't need to join assessment history. The same pattern applies to
`police_report_versions`: every draft edit appends a new version row rather
than overwriting `police_reports.draft_text` in place.

### Soft delete for evidence only

`evidence.deleted_at` is a soft delete - evidence can carry legal/audit
significance even after a user removes it from their active view. Every
other table either has no delete path at all (`incident_assessments`,
`location_observations`, `timeline_events` except `USER_NOTE` rows) or is
hard-deleted because there's no reason to keep it around (`devices` with no
case history, `users` on account deletion, which cascades everywhere).

### Cascade rules, and a bug this schema's own tests caught

- `devices.user_id`, `recovery_cases.user_id`, and every case-scoped child's
  `case_id` are `ON DELETE CASCADE` - deleting a user (Part 3's "account
  deletion") removes everything that belongs to them.
- `recovery_cases.device_id` is `ON DELETE RESTRICT` - a device with
  recovery-case history can't be deleted out from under it (this is a
  deliberate, tested block on *directly* deleting a device, not related to
  account deletion).
- `evidence.uploaded_by_user_id` and `police_reports.created_by_user_id`
  were originally also `ON DELETE RESTRICT` "for audit safety," which turned
  out to be a real bug: `tests/repositories/cascade.test.ts` caught that it
  made whole-account deletion impossible for any user who had ever uploaded
  evidence or filed a complaint, because Postgres evaluates that direct FK
  independently of the `case_id` cascade path that would otherwise remove
  the same row. Both are now `ON DELETE CASCADE` - the row is already
  guaranteed to disappear via its case when the owning user is deleted, so
  `RESTRICT` there only ever blocked account deletion, never protected
  anything.

### Two Postgres gotchas worth documenting for future migrations

- **Enum literals inside `COALESCE`/`CASE WHEN` need an explicit cast.**
  `COALESCE($1, 'SOME_ENUM_VALUE')` fails with "column is of type x but
  expression is of type text" unless written `COALESCE($1::the_enum_type,
  'SOME_ENUM_VALUE')` - an untyped string literal defaults to `text`, not
  the enum, so Postgres can't unify the two branches on its own.
- **Custom enum array types need a runtime type-parser registered.**
  `node-pg` ships default parsers for built-in array types (`text[]`,
  `int[]`, ...) but has no way to know about `sensitive_app_type[]` or
  `ceir_checklist_item[]` ahead of time - their array OIDs are assigned
  per-database at `CREATE TYPE` time. Without a parser, those columns come
  back as raw Postgres literals (`"{BANKING,UPI}"`) instead of JS arrays.
  `apps/api/src/db/arrayTypeParsers.ts` looks up the OIDs from `pg_type` and
  registers parsers once per process; `runMigrations()` calls it
  automatically after migrations apply, and `server.ts` also calls it
  (best-effort, non-blocking) at boot for the case where migrations run as a
  separate deploy step.

## Seed data

`apps/api/src/db/seed.ts` (`npm run db:seed` from `apps/api`) creates two
fully fictional demo users/cases with no real personal information, matching
two of the master spec's example workflows:

- **Priya Iyer (demo)** - lost Android at home, device-finding available:
  exercises the `Locate → Ring → Nearby Search` action sequence with a
  `USER_CONFIRMED` location observation.
- **Aarav Mehta (demo)** - stolen Android, no account access, SIM lost with
  the phone: exercises the `SIM protection → Account recovery → Financial
  protection → Police → CEIR` sequence, a `CRITICAL` risk assessment, and
  deliberately has **no** location observation (device-finding unavailable),
  demonstrating the "current location unavailable" state from Part 8.

Re-running the seed script is safe: demo rows are identified by their
`@example.com` email and deleted (cascading through every table) before
being recreated.

## Testing

`apps/api/tests/` (`npm run test` from `apps/api`, or the root's `npm run
test`) runs 62 tests across 15 files against a real, disposable Postgres
instance (a local Docker container in development) - never mocked SQL,
never an in-memory substitute. `tests/setup.ts` runs migrations once and
truncates every table (`TRUNCATE TABLE users CASCADE`, which fans out
through the whole schema) before each test for isolation. Coverage:

- **`ownership.test.ts`** - the master spec's central authorization
  requirement, exercised for every entity a stranger might try to reach.
- One file per repository covering the behaviors specific to that table:
  encryption round-tripping, append-only history, soft delete, versioning,
  dependency graphs, cascade/restrict FK behavior, CHECK constraints
  (latitude/longitude ranges, positive file size, non-self-referential
  dependencies), unique constraints (one CEIR record per case, unique
  email), and default values.
- **`cascade.test.ts`** - full-schema integrity check that deleting a user
  removes everything that belongs to them.
