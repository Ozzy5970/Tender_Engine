
-- Add versioning and active status to templates
alter table public.templates 
add column if not exists is_active boolean default true,
add column if not exists archive_date timestamp with time zone;

-- Index for fast filtering of active templates
create index if not exists idx_templates_active on public.templates(is_active);
