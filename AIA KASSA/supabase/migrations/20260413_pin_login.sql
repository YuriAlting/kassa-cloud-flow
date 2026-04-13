-- Run this in your Supabase SQL editor

-- 1. Add pin_code column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_code TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2. RPC: verify name + PIN, return email if valid
CREATE OR REPLACE FUNCTION public.verify_pin_login(
  p_display_name TEXT,
  p_pin_code TEXT
)
RETURNS TEXT  -- returns auth email if valid, null if not
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT au.email INTO v_email
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE (p.display_name = p_display_name OR p.full_name = p_display_name)
    AND p.pin_code = p_pin_code
    AND p.role IN ('owner', 'staff')
  LIMIT 1;

  RETURN v_email;
END;
$$;