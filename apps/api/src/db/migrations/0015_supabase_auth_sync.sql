-- Keeps public.users in sync with Supabase Auth's own auth.users table,
-- without a hard cross-schema foreign key (see 0003_users.sql - users.id
-- has no FK to auth.users so this schema stays portable to a self-hosted
-- Postgres that has no `auth` schema at all). This migration is a no-op
-- there: everything below is guarded by an existence check on auth.users so
-- it's always safe to run regardless of which Postgres DATABASE_URL points
-- at.
--
-- IMPORTANT - these triggers are best-effort, not the mechanism this app
-- actually relies on. Confirmed empirically against a real Supabase project:
-- Supabase's Auth service writes to auth.users in a way that default-firing
-- ("origin") triggers never run for (almost certainly session_replication_
-- role = replica on its connection) - a real signup never produced a
-- matching public.users row, while manually replicating the same INSERT
-- outside the trigger succeeded immediately. The fix would normally be
-- `ALTER TABLE auth.users ENABLE ALWAYS TRIGGER ...`, but this app's
-- Postgres role doesn't own auth.users (`supabase_auth_admin` does), so that
-- ALTER fails with "must be owner of table users" and can't be run from a
-- migration at all. The INSERT/UPDATE cases are therefore actually handled
-- by UserRepository.syncFromAuth(), called from requireAuth on every
-- authenticated request (see middleware/authenticate.ts) - that upsert is
-- what this app depends on. These triggers are left in place as a harmless
-- bonus in case they ever do fire (e.g. a future Supabase change, or a
-- self-hosted Supabase stack with different connection behavior).
--
-- The DELETE case has no equivalent application-layer fallback (there's no
-- future request from a deleted user to hang a check on), so it remains
-- best-effort only: a user deleted directly via the Supabase dashboard
-- (bypassing this app's own account-deletion endpoint) may leave a stale
-- public.users row behind if this trigger doesn't fire either.
DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    EXECUTE $trigger$
      CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
      RETURNS TRIGGER
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
      BEGIN
        INSERT INTO public.users (id, email, full_name)
        VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name')
        ON CONFLICT (id) DO NOTHING;
        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION public.handle_auth_user_email_updated()
      RETURNS TRIGGER
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
      BEGIN
        UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
      RETURNS TRIGGER
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
      BEGIN
        DELETE FROM public.users WHERE id = OLD.id;
        RETURN OLD;
      END;
      $fn$ LANGUAGE plpgsql;

      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created();

      CREATE TRIGGER on_auth_user_email_updated
        AFTER UPDATE OF email ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_email_updated();

      CREATE TRIGGER on_auth_user_deleted
        AFTER DELETE ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deleted();
    $trigger$;
  END IF;
END;
$outer$;
