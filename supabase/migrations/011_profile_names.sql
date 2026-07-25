-- Helm PM: Migration 011 — profile first/last name

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Backfill from existing full_name when possible (first token / rest)
UPDATE profiles
SET
  first_name = COALESCE(
    first_name,
    NULLIF(trim(split_part(full_name, ' ', 1)), '')
  ),
  last_name = COALESCE(
    last_name,
    NULLIF(
      trim(substring(full_name from length(split_part(full_name, ' ', 1)) + 2)),
      ''
    )
  )
WHERE full_name IS NOT NULL
  AND (first_name IS NULL OR last_name IS NULL);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first TEXT;
  v_last TEXT;
  v_full TEXT;
BEGIN
  v_first := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  v_last := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), '');
  v_full := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');

  IF v_full IS NULL AND (v_first IS NOT NULL OR v_last IS NOT NULL) THEN
    v_full := trim(concat_ws(' ', v_first, v_last));
  END IF;

  IF v_first IS NULL AND v_full IS NOT NULL THEN
    v_first := NULLIF(trim(split_part(v_full, ' ', 1)), '');
  END IF;

  IF v_last IS NULL AND v_full IS NOT NULL THEN
    v_last := NULLIF(
      trim(substring(v_full from length(split_part(v_full, ' ', 1)) + 2)),
      ''
    );
  END IF;

  INSERT INTO public.profiles (id, email, first_name, last_name, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    v_first,
    v_last,
    COALESCE(v_full, NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
