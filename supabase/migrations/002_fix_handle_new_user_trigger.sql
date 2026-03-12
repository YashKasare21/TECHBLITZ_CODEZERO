-- Fix: handle_new_user trigger fails when role metadata is empty string
-- The cast ''::user_role errors before COALESCE can provide a default

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role user_role := 'patient';
  _raw_role text;
BEGIN
  _raw_role := NEW.raw_user_meta_data->>'role';
  IF _raw_role IS NOT NULL AND _raw_role != '' THEN
    _role := _raw_role::user_role;
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
