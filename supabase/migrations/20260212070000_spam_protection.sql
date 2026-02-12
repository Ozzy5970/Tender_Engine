-- Migration: Spam Protection (Rate Limiting)
-- Description: Adds rate limiting to prevent spam in error_logs and user_feedback.

-- 1. Create Rate Limit Tracking Table (if not exists)
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
    key text PRIMARY KEY,
    hits int DEFAULT 1,
    window_start timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '1 hour')
);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- Internal usage only, no direct access
REVOKE ALL ON public.rate_limit_hits FROM anon, authenticated, public;

-- 2. Helper Function: Check Rate Limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_action text,
    p_identifier text,
    p_max_hits int,
    p_window interval
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_key text := p_action || ':' || COALESCE(p_identifier, 'anon');
    v_now timestamptz := now();
    v_window_start timestamptz;
    v_hits int;
BEGIN
    -- Cleanup expired entries (lazy cleanup)
    -- Occasionally cleaning up old entries (1 in 10 chance to keep it light)
    IF (random() < 0.1) THEN
        DELETE FROM public.rate_limit_hits WHERE expires_at < v_now;
    END IF;

    -- Upsert hit count
    INSERT INTO public.rate_limit_hits (key, hits, window_start, expires_at)
    VALUES (v_key, 1, v_now, v_now + p_window)
    ON CONFLICT (key)
    DO UPDATE SET
        hits = CASE 
            WHEN rate_limit_hits.expires_at < excluded.window_start THEN 1 -- Reset if expired
            ELSE rate_limit_hits.hits + 1 
        END,
        window_start = CASE 
            WHEN rate_limit_hits.expires_at < excluded.window_start THEN excluded.window_start 
            ELSE rate_limit_hits.window_start 
        END,
        expires_at = CASE 
            WHEN rate_limit_hits.expires_at < excluded.window_start THEN excluded.expires_at 
            ELSE rate_limit_hits.expires_at 
        END
    RETURNING hits INTO v_hits;

    RETURN v_hits <= p_max_hits;
END;
$$;

-- 3. Trigger Function: Enforce Error Limit
CREATE OR REPLACE FUNCTION public.fn_guard_error_logs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Limit: 20 errors per user per hour
    -- If unknown user (null), limit by IP if we had it, but for now we share a bucket or ignore
    -- We'll limit per user_id, generic for null.
    IF NOT public.check_rate_limit(
        'error_log',
        COALESCE(auth.uid()::text, 'anon_global'),
        20,
        interval '1 hour'
    ) THEN
        -- Silently ignore spam (return NULL cancels insert)
        -- Or raise exception? Silent ignore is better for error logging to avoid cascading errors.
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_error_logs ON public.error_logs;
CREATE TRIGGER trg_guard_error_logs
BEFORE INSERT ON public.error_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_error_logs();

-- 4. Trigger Function: Enforce User Feedback Limit
CREATE OR REPLACE FUNCTION public.fn_guard_user_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Limit: 5 feedback items per user per hour
    IF NOT public.check_rate_limit(
        'feedback',
        auth.uid()::text,
        5,
        interval '1 hour'
    ) THEN
        RAISE EXCEPTION 'Rate limit exceeded: You are sending feedback too quickly.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_feedback ON public.user_feedback;
CREATE TRIGGER trg_guard_user_feedback
BEFORE INSERT ON public.user_feedback
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_user_feedback();
