-- CLEANUP ORPHANS V3
-- Generated at: 2026-02-07

BEGIN;

-- Drop orphaned policies referencing company_documents (if table was dropped but policies lingered)
-- Policies on dropped tables are dropped automatically.

-- Drop Legacy Functions strictly if new ones are in place
DROP FUNCTION IF EXISTS public.check_is_admin();
DROP FUNCTION IF EXISTS public.is_admin_check();

-- Drop Legacy Views (Explicit drop, if not replaced)
DROP VIEW IF EXISTS public.admin_users_view_legacy;

COMMIT;
