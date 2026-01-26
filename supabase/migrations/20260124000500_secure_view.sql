-- Migration: Secure Compliance View
-- Description: Ensure the compliance summary view respects RLS policies of the underlying table.

ALTER VIEW public.view_compliance_summary SET (security_invoker = true);
