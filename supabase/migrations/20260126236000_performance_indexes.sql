-- Migration: Add Performance Indexes
-- Description: Optimizes query speed for dashboards and filtering.

-- 1. TENDERS: Index for fast filtering and sorting
create index if not exists idx_tenders_sector on public.tenders(sector);
create index if not exists idx_tenders_closing_date on public.tenders(closing_date);

-- 2. FEEDBACK: Index for Admin Dashboard joins
create index if not exists idx_feedback_tender_id on public.user_feedback(tender_id);
create index if not exists idx_feedback_user_id on public.user_feedback(user_id);

-- 3. PROFILES: Index for Admin User Search
create index if not exists idx_profiles_company_name on public.profiles(company_name);

-- 4. ERROR LOGS: Index for filtering by date and severity (Admin Dashboard)
create index if not exists idx_error_logs_created_severity on public.error_logs(created_at, severity);

-- 5. SUBSCRIPTION HISTORY: Ensure filtering by plan/status is fast
create index if not exists idx_sub_history_plan on public.subscription_history(plan_name);
