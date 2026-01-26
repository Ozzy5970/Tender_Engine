-- Migration: Add Profile Details
-- Description: Add fields for Name, Phone, Address, Location

alter table public.profiles 
add column if not exists full_name text,
add column if not exists phone text,
add column if not exists address text,
add column if not exists location text;

-- Policy update not needed as users can updated own profiles already
