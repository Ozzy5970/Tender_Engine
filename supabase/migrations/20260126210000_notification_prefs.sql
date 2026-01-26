-- Migration: Add Notification Preferences
-- Description: Boolean flags for Tier 2/3 support, WhatsApp reminders, and Critical Errors

alter table public.profiles 
add column if not exists notify_email_tier_support boolean default false,
add column if not exists notify_whatsapp_tier_reminders boolean default false,
add column if not exists notify_email_critical_errors boolean default false,
add column if not exists whatsapp_number text;
