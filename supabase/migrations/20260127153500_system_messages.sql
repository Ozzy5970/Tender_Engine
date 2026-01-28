-- System Messages for Admin Broadcasts
create table if not exists public.system_messages (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  message text not null,
  priority text default 'INFO', -- INFO, WARNING, CRITICAL
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone,
  created_by uuid references public.profiles(id)
);

-- Enable RLS
alter table public.system_messages enable row level security;

-- Drop existing policies if they exist to avoid conflicts during manual run
drop policy if exists "Everyone can view active system messages" on system_messages;
drop policy if exists "Admins can manage system messages" on system_messages;

-- Everyone can read messages
create policy "Everyone can view active system messages" 
  on system_messages for select 
  using ( true );

-- Only admins can insert/update/delete
create policy "Admins can manage system messages"
  on system_messages for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.id = 'd027376c-3893-41a4-a299-c0ae2a8df80c' -- Hardcoded super admin for safety, or use is_admin column if it exists and is reliable
    )
    or 
    auth.uid() in (select id from profiles where is_admin = true)
  );
