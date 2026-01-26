-- Migration: 20240123120000_core_schema.sql
-- Description: Complete V1 Schema for Tender Readiness Engine

-- 0. CLEANUP (Fix conflicts with init migration)
drop table if exists public.audit_logs cascade;
drop table if exists public.alerts cascade;
drop table if exists public.ai_drafts cascade;
drop table if exists public.compliance_checks cascade;
drop table if exists public.compliance_requirements cascade;
drop table if exists public.compliance_rules cascade; -- Old schema
drop table if exists public.tender_documents cascade;
drop table if exists public.tenders cascade;
drop table if exists public.company_documents cascade;
drop table if exists public.profiles cascade;

drop type if exists public.tender_status cascade;
drop type if exists public.readiness_level cascade;
drop type if exists public.compliance_status cascade;
drop type if exists public.draft_status cascade;
drop type if exists public.doc_category cascade;
drop type if exists public.company_doc_type cascade;

-- 1. EXTENSIONS & SETUP
create extension if not exists "uuid-ossp";
create extension if not exists "pg_net"; -- For async webhooks/alerts

-- 2. ENUMS
create type public.tender_status as enum (
    'DRAFT', 'ANALYZING', 'COMPLIANT', 'SUBMITTED', 'ARCHIVED', 'NO_GO'
);

create type public.readiness_level as enum (
    'RED', 'AMBER', 'GREEN'
);

create type public.compliance_status as enum (
    'PASS', 'FAIL', 'WARNING'
);

create type public.draft_status as enum (
    'GENERATING', 'REVIEW_PENDING', 'APPROVED', 'REJECTED'
);

create type public.doc_category as enum (
    'TENDER_SPEC', 'BOQ', 'RETURNABLE', 'DRAWING', 'ADDENDUM'
);

create type public.company_doc_type as enum (
    'TAX_CLEARANCE', 'COID', 'CSD_REPORT', 'BBBEE_CERT', 'FINANCIAL_STATEMENTS'
);

-- 3. TABLES

-- 3.1 PROFILES (Companies)
create table public.profiles (
    id uuid references auth.users on delete cascade not null primary key,
    company_name text not null check (char_length(company_name) >= 2),
    
    -- CIDB Grading (e.g., 6GB)
    cidb_grade_grading int check (cidb_grade_grading between 1 and 9),
    cidb_grade_class text check (cidb_grade_class ~* '^(GB|CE|ME|EP|EB|SO|SQ|SH|SI|SJ|SK|SL)$'),
    
    bbbee_level int check (bbbee_level between 1 and 8),
    
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 3.2 COMPANY DOCUMENTS (Statutory)
create table public.company_documents (
    id uuid default gen_random_uuid() primary key,
    profile_id uuid references public.profiles(id) on delete cascade not null,
    
    doc_type public.company_doc_type not null,
    file_path text not null, -- Supabase Storage path
    expiry_date date not null,
    is_verified boolean default false,
    
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 3.3 TENDERS
create table public.tenders (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    
    title text not null,
    client_name text,
    reference_number text,
    closing_date timestamp with time zone not null,
    
    status public.tender_status default 'DRAFT',
    readiness public.readiness_level default 'RED',
    compliance_score int default 0 check (compliance_score between 0 and 100),
    
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 3.4 TENDER DOCUMENTS (Ingested)
create table public.tender_documents (
    id uuid default gen_random_uuid() primary key,
    tender_id uuid references public.tenders(id) on delete cascade not null,
    
    file_path text not null,
    file_name text not null,
    doc_category public.doc_category default 'TENDER_SPEC',
    
    extracted_text text, -- Searchable text
    metadata jsonb default '{}'::jsonb, -- Raw extraction data
    
    created_at timestamp with time zone default now()
);

-- 3.5 COMPLIANCE REQUIREMENTS (Rules)
create table public.compliance_requirements (
    id uuid default gen_random_uuid() primary key,
    tender_id uuid references public.tenders(id) on delete cascade not null,
    
    rule_category text not null, -- 'CIDB', 'BBBEE', 'MANDATORY_DOC'
    description text,
    target_value jsonb not null, -- Schema depends on category
    
    is_killer boolean default true, -- If true, fail = NO_GO
    
    created_at timestamp with time zone default now()
);

-- 3.6 COMPLIANCE CHECKS (Results)
create table public.compliance_checks (
    id uuid default gen_random_uuid() primary key,
    tender_id uuid references public.tenders(id) on delete cascade not null,
    requirement_id uuid references public.compliance_requirements(id) on delete cascade not null,
    
    status public.compliance_status default 'FAIL',
    actual_value jsonb, -- What we found in profile/docs
    failure_reason text,
    
    checked_at timestamp with time zone default now()
);

-- 3.7 AI DRAFTS (Versioning)
create table public.ai_drafts (
    id uuid default gen_random_uuid() primary key,
    tender_id uuid references public.tenders(id) on delete cascade not null,
    
    section_name text not null, -- e.g., 'Method Statement - Safety'
    version int default 1 not null,
    
    content_markdown text,
    status public.draft_status default 'GENERATING',
    user_feedback text,
    
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    
    unique(tender_id, section_name, version)
);

-- 3.8 ALERTS
create table public.alerts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    tender_id uuid references public.tenders(id) on delete set null,
    
    priority text check (priority in ('HIGH', 'MEDIUM', 'LOW')),
    message text not null,
    is_read boolean default false,
    
    created_at timestamp with time zone default now()
);

-- 3.9 AUDIT LOGS
create table public.audit_logs (
    id uuid default gen_random_uuid() primary key,
    actor_id uuid references auth.users(id) on delete set null, -- Nullable for system events
    tender_id uuid references public.tenders(id) on delete set null,
    
    action text not null,
    old_state jsonb,
    new_state jsonb,
    severity text default 'INFO',
    ip_address inet,
    
    created_at timestamp with time zone default now()
);

-- 4. INDEXING
create index idx_profiles_cidb on public.profiles(cidb_grade_grading, cidb_grade_class);
create index idx_company_docs_expiry on public.company_documents(expiry_date);
create index idx_tenders_user on public.tenders(user_id);
create index idx_tenders_status_date on public.tenders(status, closing_date);
create index idx_tender_docs_tender on public.tender_documents(tender_id);
create index idx_compliance_checks_tender on public.compliance_checks(tender_id);
create index idx_compliance_checks_req on public.compliance_checks(requirement_id);
create index idx_ai_drafts_tender on public.ai_drafts(tender_id);
create index idx_alerts_user_unread on public.alerts(user_id) where is_read = false;

-- 5. RLS POLICIES

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.company_documents enable row level security;
alter table public.tenders enable row level security;
alter table public.tender_documents enable row level security;
alter table public.compliance_requirements enable row level security;
alter table public.compliance_checks enable row level security;
alter table public.ai_drafts enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: View Own, Update Own
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Company Docs: View Own, Manage Own
create policy "company_docs_access_own" on public.company_documents 
    using (profile_id = auth.uid());

-- Tenders: View Own, Manage Own
create policy "tenders_access_own" on public.tenders 
    using (user_id = auth.uid());

-- Tender Docs: Access via Tender Ownership
create policy "tender_docs_access_own" on public.tender_documents
    using (exists (select 1 from public.tenders where id = tender_documents.tender_id and user_id = auth.uid()));

-- Compliance: Access via Tender Ownership
create policy "reqs_access_own" on public.compliance_requirements
    using (exists (select 1 from public.tenders where id = compliance_requirements.tender_id and user_id = auth.uid()));

create policy "checks_access_own" on public.compliance_checks
    using (exists (select 1 from public.tenders where id = compliance_checks.tender_id and user_id = auth.uid()));

-- AI Drafts: Access via Tender Ownership
create policy "drafts_access_own" on public.ai_drafts
    using (exists (select 1 from public.tenders where id = ai_drafts.tender_id and user_id = auth.uid()));

-- Alerts: View Own
create policy "alerts_access_own" on public.alerts 
    using (user_id = auth.uid());

-- Audit Logs: View Own Actions or Tenders
create policy "logs_access_own" on public.audit_logs
    using (actor_id = auth.uid() or exists (select 1 from public.tenders where id = audit_logs.tender_id and user_id = auth.uid()));

-- 6. TRIGGERS

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, company_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'company_name', 'New Company'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-timestamp updates
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_timestamp_profiles before update on public.profiles for each row execute procedure public.handle_updated_at();
create trigger set_timestamp_tenders before update on public.tenders for each row execute procedure public.handle_updated_at();
create trigger set_timestamp_drafts before update on public.ai_drafts for each row execute procedure public.handle_updated_at();
