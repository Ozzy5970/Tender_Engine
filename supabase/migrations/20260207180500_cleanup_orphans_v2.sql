-- CLEANUP ORPHANS V2
-- Generated at: 2026-02-07

BEGIN;

-- Drop orphaned policies referencing company_documents (if table was dropped but policies lingered specifically on other tables/roles - usually CASCADE handles this but good to specific checks)
-- Policies on dropped tables are dropped automatically.

-- Drop Legacy Functions that might be confused with new ones
DROP FUNCTION IF EXISTS public.check_is_admin();
DROP FUNCTION IF EXISTS public.is_admin_check();

-- Drop Legacy Views
DROP VIEW IF EXISTS public.admin_users_view_legacy;

-- Standardize: If we moved to admins table, remove trigger that syncs IS_ADMIN column if strictly not needed, 
-- but we might want to keep it to keep profiles.is_admin in sync with admins table for redundancy/backward compat.
-- We will keeping sync_is_admin_to_table().

COMMIT;
