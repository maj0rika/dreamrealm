-- Lock client-writable billing/quota fields and provide an atomic quota consumer.

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can update own profile display fields"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_generation_quota()
RETURNS TABLE (
    plan TEXT,
    daily_generations_used INTEGER,
    daily_generation_limit INTEGER,
    daily_generations_reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_row public.profiles%ROWTYPE;
    quota_limit INTEGER;
    effective_used INTEGER;
    effective_reset_at TIMESTAMPTZ;
    user_id UUID;
BEGIN
    user_id := auth.uid();

    IF user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;

    SELECT *
    INTO profile_row
    FROM public.profiles
    WHERE id = user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PROFILE_NOT_FOUND';
    END IF;

    quota_limit := CASE profile_row.plan
        WHEN 'free' THEN 5
        WHEN 'pro' THEN 50
        ELSE 999
    END;

    IF profile_row.daily_generations_reset_at <= now() THEN
        effective_used := 0;
        effective_reset_at := now() + interval '1 day';
    ELSE
        effective_used := profile_row.daily_generations_used;
        effective_reset_at := profile_row.daily_generations_reset_at;
    END IF;

    IF effective_used >= quota_limit THEN
        RAISE EXCEPTION 'GENERATION_QUOTA_EXCEEDED';
    END IF;

    UPDATE public.profiles
    SET
        daily_generations_used = effective_used + 1,
        daily_generations_reset_at = effective_reset_at,
        updated_at = now()
    WHERE id = user_id
    RETURNING
        profiles.plan,
        profiles.daily_generations_used,
        quota_limit,
        profiles.daily_generations_reset_at
    INTO
        consume_generation_quota.plan,
        consume_generation_quota.daily_generations_used,
        consume_generation_quota.daily_generation_limit,
        consume_generation_quota.daily_generations_reset_at;

    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_generation_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_generation_quota() TO authenticated;
