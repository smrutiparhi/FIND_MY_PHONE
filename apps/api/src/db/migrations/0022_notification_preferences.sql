-- Part 19 - Notifications. "Allow notification preferences and quiet
-- settings except for user-selected critical recovery alerts" - muted_types
-- is a plain array rather than a per-type join table (mirrors
-- ceir_records.checklist_completed_items); CRITICAL_ACTION_PENDING is never
-- allowed into it - enforced at the application layer
-- (services/notifications/notificationPreferences.ts), not by a CHECK
-- constraint, since Postgres can't easily check "array does not contain
-- this specific enum value" without a function-based constraint.
-- email/push/sms_enabled are forward-looking toggles for the provider
-- abstractions this part designs but does not wire up to a real send -
-- see services/notifications/channels/.
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_types notification_type[] NOT NULL DEFAULT '{}',
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Minutes since local midnight (0-1439), not a TIME column, so "22:00-06:00 wraps past midnight" is
  -- just "start > end" in application logic rather than a Postgres time-arithmetic edge case.
  quiet_hours_start_minute SMALLINT,
  quiet_hours_end_minute SMALLINT,
  timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_notification_preferences_user_id UNIQUE (user_id),
  CONSTRAINT chk_notification_preferences_quiet_start_range
    CHECK (quiet_hours_start_minute IS NULL OR (quiet_hours_start_minute >= 0 AND quiet_hours_start_minute < 1440)),
  CONSTRAINT chk_notification_preferences_quiet_end_range
    CHECK (quiet_hours_end_minute IS NULL OR (quiet_hours_end_minute >= 0 AND quiet_hours_end_minute < 1440))
);

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- See 0016_enable_row_level_security.sql for why every table gets this.
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
