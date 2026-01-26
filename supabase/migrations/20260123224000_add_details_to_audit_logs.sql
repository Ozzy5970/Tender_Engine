-- Migration: 20260123224000_add_details_to_audit_logs.sql
-- Description: Add details column to audit_logs to match function implementation

alter table public.audit_logs
add column if not exists details jsonb default '{}'::jsonb;
