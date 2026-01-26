-- Migration: 20240123140000_automation_views.sql

-- 1. Weekly Stats View
-- Aggregates metrics for the last 7 days to run the Monday Report
create or replace view public.weekly_stats_view as
select
    -- Tender Usage
    (select count(*) from public.tenders 
     where created_at > (now() - interval '7 days')) as new_tenders_count,
     
    -- Compliance Rates
    (select count(*) from public.tenders 
     where status = 'COMPLIANT' 
     and created_at > (now() - interval '7 days')) as compliant_count,
     
    (select count(*) from public.tenders 
     where status = 'NO_GO' 
     and created_at > (now() - interval '7 days')) as non_compliant_count,

    -- AI Health (Success vs Fallback)
    (select count(*) from public.audit_logs 
     where action = 'DRAFT_GENERATED' 
     and created_at > (now() - interval '7 days')) as ai_success_count,
     
    (select count(*) from public.audit_logs 
     where action = 'DRAFT_FALLBACK' 
     and created_at > (now() - interval '7 days')) as ai_failure_count;

-- 2. Grant Access
grant select on public.weekly_stats_view to service_role;
