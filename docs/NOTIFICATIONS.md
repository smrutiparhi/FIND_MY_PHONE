# Notifications (Part 19)

In-app notifications for the seven master-spec event types, per-user preferences (muting, quiet
hours, channel toggles), and a scheduler-free way to surface the three reminder types that only make
sense relative to elapsed time.

## The seven types, and where each one really fires

Verbatim from the master spec: `CRITICAL_ACTION_PENDING`, `ACCOUNT_RECOVERY_UPDATE`,
`SIM_STATUS_UPDATE`, `CEIR_FOLLOWUP_REMINDER`, `CASE_INACTIVITY`, `EVIDENCE_REMINDER`,
`DEVICE_RECOVERY_CHECKLIST`. Four are wired at a real, immediate state transition; three are
time-elapsed and have no single trigger point (see below).

| Type | Trigger |
| --- | --- |
| `CRITICAL_ACTION_PENDING` | `applyEngineResult.ts`, on the transition *into* `CRITICAL`/`HIGH` risk (not merely "currently at") |
| `ACCOUNT_RECOVERY_UPDATE` | `updateAccountRecoveryAttempt.ts`, on `RECOVERED` and on `FAILED` |
| `SIM_STATUS_UPDATE` | `updateSimProtectionRecord.ts`, on the transition into a secured SIM state |
| `DEVICE_RECOVERY_CHECKLIST` | `deviceRecoveryService.ts`, on the first confirmation of possession |
| `CASE_INACTIVITY` | reminder check, see below |
| `CEIR_FOLLOWUP_REMINDER` | reminder check, see below |
| `EVIDENCE_REMINDER` | reminder check, see below |

Every trigger reuses the same `wasX`/`isNowX` transition-detection idiom already established
throughout the recovery engine and status-update services (e.g. `SIM_PROTECTION_STARTED` firing only
on the first transition out of `ACTIVE`) - a notification marks a change, never a poll of current
state, so re-saving the same status twice never double-fires.

## Reminders without a scheduler

This app has no background job runner anywhere in its 18 prior parts, and Part 19 doesn't invent one
for three notification types. Instead, `checkReminderNotifications()` runs opportunistically inside
`listNotifications()` - every time a user actually opens their notification list, every one of their
active (non-terminal) cases is checked against three thresholds:

- **`CASE_INACTIVITY`** - `recovery_cases.updated_at` untouched for 7+ days.
- **`CEIR_FOLLOWUP_REMINDER`** - a `SUBMITTED`/`PROCESSING` CEIR record untouched for 3+ days.
- **`EVIDENCE_REMINDER`** - an open (not `COMPLETED`/`SKIPPED`) `EVIDENCE_COLLECTION` action on a
  case that's 2+ days old.

A per-case, per-type 3-day cooldown (`notifications.existsRecentForCase`) prevents re-opening the
list five times in a morning from creating five copies of the same reminder. A failure checking one
case is caught locally and never blocks the others or the list itself - this is a best-effort side
effect of a read, not something the page's success should depend on.

This is also why the master spec's "do not generate fake device-moved notifications" clause needed
no code: there is no eighth, location-based notification type in `NOTIFICATION_TYPES` to begin with.

## One record per user, not per case

Every prior part's settings/state table (CEIR records, SIM protection records, device recovery
checklists, ...) is one row per *case* via `getOrCreateForCase`. `notification_preferences` is the
first one-row-per-*user* table (`getOrCreateForUser`, a `UNIQUE (user_id)` constraint) - preferences
apply across every case a user has, not to one incident.

## `CRITICAL_ACTION_PENDING` can never be muted or quiet-houred

"Except for user-selected critical recovery alerts" (master spec) is enforced at the application
layer, not just the UI: `isMutableNotificationType()` hard-codes `CRITICAL_ACTION_PENDING` as the one
non-mutable type, `shouldCreateNotification()` always returns `true` for it regardless of muted types
or quiet hours, and `updateNotificationPreferences()` silently strips it out of any client-submitted
`mutedTypes` array rather than rejecting the request - a client bug or a stale form can't accidentally
suppress a critical alert. The preferences form disables its checkbox and shows it as permanently on.

## Channel providers: one real, two honestly inert

`NotificationChannelProvider` is a small interface (`channel`, `send()`) so email/push/SMS are
interchangeable from `createNotification()`'s point of view. Only email is wired to actually attempt
a send, using the user's own real Supabase Auth email - the one address this app has ever collected.
Push and SMS have the same interface but are never invoked, because no device-token or phone-number
storage exists anywhere in the app; inventing a fake target address just to exercise the abstraction
would be worse than leaving it honestly unused. The email attempt is best-effort and wrapped in
`try/catch` - a delivery failure never blocks or rolls back the in-app notification row, which is
always the source of truth.

## API

- `GET /api/notifications` - `?unreadOnly=true` to filter; also runs the three reminder checks first.
- `POST /api/notifications/read-all` - marks every unread notification read for the caller.
- `PATCH /api/notifications/:id/read` - marks one read; 404s (not 403s) for another user's notification.
- `GET /api/notifications/preferences` - lazily creates default preferences on first read.
- `PATCH /api/notifications/preferences` - partial update; omitted fields are left untouched, and
  `CRITICAL_ACTION_PENDING` is stripped from any submitted `mutedTypes`.

## A real bug the browser screenshot caught

`AppLayout.tsx` fetches `unreadCount` for the nav badge once, in a mount-only effect - fine as long
as the layout remounts whenever the count could have changed. It doesn't: `AppLayout` wraps every
authenticated route via `<Outlet />` and stays mounted across client-side navigation (React Router
never tears it down between sibling routes), so marking notifications read on the Notifications page
and then clicking to another page left the badge showing the old count - only a hard browser reload
ever refreshed it. Confirmed with Playwright by driving a real nav-link click (not `page.goto`,
which forces a full reload and would have masked the bug) after mark-all-read: the badge still read
the stale count until this was fixed. Fixed by adding `location.pathname` (via `useLocation()`) as an
effect dependency, so the count refetches on every route change - the same lightweight,
no-global-state approach the rest of the app already uses, rather than introducing a shared
notifications context just for this.

## A real bug this part's tests caught

The three reminder tests initially backdated timestamps with a raw
`UPDATE recovery_cases SET updated_at = $1 ...` (and the same for `ceir_records`) to simulate a case
gone quiet for a week. Every table in this schema carries a `BEFORE UPDATE` trigger
(`set_updated_at()`, see `0001_extensions_and_functions.sql`) that unconditionally forces
`NEW.updated_at = now()` - so the backdate was silently overwritten back to "now" by the trigger on
the same statement that tried to set it, and the reminder never fired within the test. Fixed by
disabling the row's `updated_at` trigger for that one write (`ALTER TABLE ... DISABLE/ENABLE
TRIGGER`), the same pattern any test backdating a triggered timestamp needs going forward - a test
bug, not an application bug, but one that would have silently made the reminder tests pass-for-the-
wrong-reason (or rather, fail loudly, which is what actually happened) had it gone unnoticed.
