-- Migration 031: Allow members to link auth_id once during self-signup

CREATE OR REPLACE FUNCTION public.members_self_write_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  request_role text;
BEGIN
  request_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    ''
  );

  IF request_role IN ('service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Allow null auth_id (for members created by admins who haven't logged in yet)
    -- For non-null auth_id, it must match the authenticated user
    IF NEW.auth_id IS NOT NULL THEN
      IF NEW.auth_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'auth_id must match authenticated user';
      END IF;
    END IF;
    IF NEW.pin_hash IS NOT NULL THEN
      NEW.pin_hash := NULL;
    END IF;
    IF NEW.role IS DISTINCT FROM 'member' THEN
      NEW.role := 'member';
    END IF;
    IF NEW.status IS NULL THEN
      NEW.status := 'active';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.auth_id IS DISTINCT FROM OLD.auth_id THEN
    IF NOT (OLD.auth_id IS NULL AND NEW.auth_id = auth.uid()) THEN
      RAISE EXCEPTION 'auth_id is immutable';
    END IF;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role is immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'status is immutable';
  END IF;
  IF NEW.pin_hash IS DISTINCT FROM OLD.pin_hash THEN
    RAISE EXCEPTION 'pin_hash is immutable';
  END IF;

  RETURN NEW;
END;
$function$;
