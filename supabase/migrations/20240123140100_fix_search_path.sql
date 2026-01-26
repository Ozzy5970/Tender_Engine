-- Migration: 20240123140100_fix_search_path.sql
-- Description: Add SET search_path = public to functions to fix security warnings

-- Fix handle_new_user
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

-- Fix handle_updated_at
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
