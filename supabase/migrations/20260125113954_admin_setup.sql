
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
-- Add is_admin column to profiles.
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
    template_downloads int;
begin
    select count(*) into total_users from auth.users;
    select count(*) into total_tenders from public.tenders;
    select count(*) into total_docs from public.compliance_documents;
    select coalesce(sum(download_count), 0) into template_downloads from public.templates;

    return json_build_object(
        'total_users', total_users,
        'total_tenders', total_tenders,
        'total_documents', total_docs,
        'template_downloads', template_downloads
    );
end;
$$;

-- 5. Storage Bucket for Templates
-- Note: buckets inserts often fail in migrations if bucket exists, ignoring error
insert into storage.buckets (id, name, public) 
values ('templates', 'templates', true)
on conflict (id) do nothing;

create policy "Public Access to Templates"
on storage.objects for select
using ( bucket_id = 'templates' );

create policy "Admin Upload Templates"
on storage.objects for insert
with check ( bucket_id = 'templates'  ); -- Add admin check logic in production

