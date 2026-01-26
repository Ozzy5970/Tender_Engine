-- Fixed Migration: Performance Indexes + Missing Tender Columns
-- Ensures columns exist before indexing.

-- 1. Ensure columns exist on Tenders
alter table public.tenders 
add column if not exists sector text,
add column if not exists closing_date timestamptz;

-- 2. TENDERS: Index for fast filtering and sorting
create index if not exists idx_tenders_sector on public.tenders(sector);
create index if not exists idx_tenders_closing_date on public.tenders(closing_date);

-- 3. FEEDBACK: Fast admin stats
create index if not exists idx_feedback_tender_id on public.user_feedback(tender_id);
create index if not exists idx_feedback_user_id on public.user_feedback(user_id);

-- 4. USERS: Search by company
create index if not exists idx_profiles_company_name on public.profiles(company_name);

-- 5. ERROR LOGS: Fast filtering
create index if not exists idx_error_logs_created_severity on public.error_logs(created_at, severity);
