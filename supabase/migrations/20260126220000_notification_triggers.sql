-- Migration: Notification Triggers
-- Description: Function to call the Edge Function on INSERT

-- 1. Enable HTTP extension (if not enabled, though usually enabled on Supabase, but strictly we use pg_net)
-- NOTE: In Supabase standard helpers, we often use `supabase_functions.http_request` if available, or just `pg_net`.
-- However, creating a TRIGGER that calls an edge function usually involves `pg_net`.

-- Easier approach: A Database Webhook via the Dashboard is the "Low Code" way, but here we want SQL.
-- We can create a Trigger Function that uses `pg_net` to call the function.

create extension if not exists pg_net;

create or replace function public.trigger_admin_notification()
returns trigger
language plpgsql
security definer
as $$
declare
    payload json;
    request_id bigint;
begin
    -- Construct Payload based on Table
    if TG_TABLE_NAME = 'user_feedback' then
        payload = json_build_object(
            'type', 'FEEDBACK',
            'record', row_to_json(NEW)
        );
    elsif TG_TABLE_NAME = 'error_logs' then
        -- Only trigger for critical (Optimization to reduce Edge Function calls, though Edge Function does double check)
        if NEW.severity = 'critical' then
            payload = json_build_object(
                'type', 'ERROR',
                'record', row_to_json(NEW)
            );
        else
            return NEW;
        end if;
    else
        return NEW;
    end if;

    -- Call Edge Function (Replace URL with your project URL)
    -- We assume the function is named 'notify-admin'
    
    -- NOTE: In local dev or real deploy, the URL differs. 
    -- We'll use a placeholder or assume the user configures the webhook in dashboard.
    -- BUT the user requested "Implemented logs".
    -- A pure SQL trigger using `pg_net` to call localhost:54321/functions/v1/notify-admin usually works in local.
    
    -- For safety and stability in this context, we will rely on the USER mapping the webhook in the Supabase Dashboard UI 
    -- -> "Database" -> "Webhooks" -> "Create Webhook".
    -- HOWEVER, I can provide the SQL that WOULD work if pg_net is configured.
    
    -- Let's provide the TRIGGER definition but maybe purely logical logs if we can't guarantee `pg_net`.
    -- Actually, Supabase `hooks` table approach is deprecated.
    
    -- Alternative: Use `pg_net` to POST.
    
    select net.http_post(
        url := 'https://PROJECT_REF.supabase.co/functions/v1/notify-admin', -- User must update this
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}',
        body := payload
    ) into request_id;

    return NEW;
end;
$$;

-- 2. Create Triggers

-- Trigger for Feedback
drop trigger if exists on_feedback_created on public.user_feedback;
create trigger on_feedback_created
    after insert on public.user_feedback
    for each row
    execute function public.trigger_admin_notification();

-- Trigger for Errors
drop trigger if exists on_error_logged on public.error_logs;
create trigger on_error_logged
    after insert on public.error_logs
    for each row
    execute function public.trigger_admin_notification();
