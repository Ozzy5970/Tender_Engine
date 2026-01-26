-- Fixed Migration: Create Storage Bucket & Policies
-- Skips 'ALTER TABLE' on storage.objects to avoid permission errors (RLS is usually on by default).

-- 1. Create Bucket
insert into storage.buckets (id, name, public)
values ('tenders_documents', 'tenders_documents', false)
on conflict (id) do nothing;

-- 2. Drop existing policies to avoid conflicts if retrying
drop policy if exists "Users can upload their own documents" on storage.objects;
drop policy if exists "Users can view their own documents" on storage.objects;
drop policy if exists "Admins can view all documents" on storage.objects;

-- 3. Create Policy: Upload (INSERT)
create policy "Users can upload their own documents"
on storage.objects for insert
with check (
    bucket_id = 'tenders_documents' 
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Create Policy: View Own (SELECT)
create policy "Users can view their own documents"
on storage.objects for select
using (
    bucket_id = 'tenders_documents' 
    and auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Create Policy: Admin View All (SELECT)
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
