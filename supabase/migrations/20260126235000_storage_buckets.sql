-- Migration: Create Storage Bucket for Tenders
-- Description: Sets up 'tenders_documents' bucket and RLS policies.

-- 1. Create Bucket (if not exists)
insert into storage.buckets (id, name, public)
values ('tenders_documents', 'tenders_documents', false)
on conflict (id) do nothing;

-- 2. Enable RLS on Objects (Should be on by default, but ensuring)
alter table storage.objects enable row level security;

-- 3. Policy: Authenticated users can upload (INSERT)
-- They can upload to their own folder: user_id/*
create policy "Users can upload their own documents"
on storage.objects for insert
with check (
    bucket_id = 'tenders_documents' 
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Policy: Users can view their own documents (SELECT)
create policy "Users can view their own documents"
on storage.objects for select
using (
    bucket_id = 'tenders_documents' 
    and auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Policy: Admins can view ALL documents (SELECT)
create policy "Admins can view all documents"
on storage.objects for select
using (
    bucket_id = 'tenders_documents' 
    and exists (
        select 1 from public.profiles
        where id = auth.uid()
        and is_admin = true
    )
);

-- 6. Policy: Users can Output (Download) - Same as Select usually, but for 'storage.objects', SELECT covers headers/metadata.
-- 'storage.objects' SELECT policy is sufficient for downloading in Supabase Client usually.
