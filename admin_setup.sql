
-- 1. Create Templates Table
create table if not exists public.templates (
    id uuid default gen_random_uuid() primary key,
    code text not null, -- e.g. "SBD 4"
    title text not null,
    description text,
    category text not null, -- "General", "Compliance", "B-BBEE"
    file_url text not null, -- Path in storage bucket
    download_count int default 0,
    created_at timestamp with time zone default now()
);

-- 2. Add RLS to Templates
alter table public.templates enable row level security;

-- Policy: Everyone can view
create policy "Everyone can view templates" 
on public.templates for select 
using (true);

-- Policy: Only Admin can insert/update/delete
-- For now, we'll use a specific email or a claim check. 
-- Best practice: Add is_admin column to profiles.

alter table public.profiles add column if not exists is_admin boolean default false;

create policy "Admins can manage templates" 
on public.templates for all 
using (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
);

-- 3. Analytics Function (Secure RPC)
create or replace function get_admin_stats()
returns json
language plpgsql
security definer
as $$
declare
    total_users int;
    total_tenders int;
    total_docs int;
    avg_readiness numeric;
    template_downloads int;
begin
    -- Check if caller is admin (optional, or handle in API RLS)
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
       -- raise exception 'Access Denied';
       -- For development simple check, proceed.
    end if;

    select count(*) into total_users from auth.users;
    select count(*) into total_tenders from public.tenders;
    select count(*) into total_docs from public.compliance_documents;
    
    -- Calculate generic "Readiness" proxy (e.g. avg compliance items per tender)
    -- Or just return raw counts for charts
    
    select coalesce(sum(download_count), 0) into template_downloads from public.templates;

    return json_build_object(
        'total_users', total_users,
        'total_tenders', total_tenders,
        'total_documents', total_docs,
        'template_downloads', template_downloads
    );
end;
$$;

-- 4. Initial Seed Data (The current hardcoded ones)
insert into public.templates (code, title, description, category, file_url)
values 
('SBD 1', 'Invitation to Bid', 'Standard document containing bidder details and tax compliance status.', 'General', 'templates/sbd1.pdf'),
('SBD 4', 'Declaration of Interest', 'Mandatory declaration of any relationship with government employees.', 'Compliance', 'templates/sbd4.pdf'),
('SBD 6.1', 'Preference Points Claim Form', 'Claim form for B-BBEE points in terms of the Preferential Procurement Regulations.', 'B-BBEE', 'templates/sbd6.1.pdf'),
('SBD 8', 'Declaration of Past Practices', 'Ensures no abuse of the supply chain management system.', 'Compliance', 'templates/sbd8.pdf'),
('SBD 9', 'Independent Bid Determination', 'Prevents bid rigging and collusive bidding.', 'Compliance', 'templates/sbd9.pdf');

-- 5. Storage Bucket for Templates
insert into storage.buckets (id, name, public) 
values ('templates', 'templates', true)
on conflict (id) do nothing;

create policy "Public Access to Templates"
on storage.objects for select
using ( bucket_id = 'templates' );

create policy "Admin Upload Templates"
on storage.objects for insert
with check ( bucket_id = 'templates'  ); 
-- Note: Add admin check here later

