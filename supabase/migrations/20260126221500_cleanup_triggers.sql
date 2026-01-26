-- Cleanup: Remove manual triggers to use Dashboard Webhooks instead
-- Run this in the SQL Editor to clear the path.

drop trigger if exists on_feedback_created on public.user_feedback;
drop trigger if exists on_error_logged on public.error_logs;
drop function if exists public.trigger_admin_notification();
