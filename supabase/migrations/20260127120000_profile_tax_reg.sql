-- Migration: Add Tax and Registration Numbers to Profiles
-- Description: Adds columns for company registration and tax details

alter table public.profiles
add column if not exists tax_reference_number text,
add column if not exists registration_number text;
