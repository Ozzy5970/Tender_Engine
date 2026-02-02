-- Fix SECURITY DEFINER warnings by enabling security_invoker
-- This ensures the views check the permissions of the calling user (RLS) 
-- instead of the view owner.

ALTER VIEW public.weekly_stats_view SET (security_invoker = true);
ALTER VIEW public.admin_users_view SET (security_invoker = true);
