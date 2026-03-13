-- Fix: handle_new_user trigger fails because:
-- 1. No INSERT policy on profiles (RLS blocks the trigger's INSERT)
-- 2. Unqualified user_role type may not resolve if search_path differs at runtime
--
-- Uses Supabase-recommended pattern: SECURITY DEFINER + SET search_path = ''
-- with fully-qualified types, plus an INSERT policy as safety net.

-- Recreate with fully qualified types and empty search_path (Supabase recommended)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
  _role public.user_role := 'patient';
  _raw_role text;
BEGIN
  _raw_role := NEW.raw_user_meta_data->>'role';
  IF _raw_role IS NOT NULL AND _raw_role != '' THEN
    _role := _raw_role::public.user_role;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    _role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add INSERT policy so the trigger can insert profiles even without bypassrls.
-- The service_role (used by auth internals) needs to be able to insert.
CREATE POLICY "Allow trigger and service role to insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);
