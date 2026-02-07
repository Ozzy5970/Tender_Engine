-- INSPECTION QUERY: List all views, definitions, and dependencies
-- Run this in your SQL Editor to get the current state of views in the public schema.

WITH view_deps AS (
    SELECT 
        v.oid AS view_oid,
        v.relname AS view_name,
        d.refobjid AS user_table_oid,
        t.relname AS table_name,
        a.attname AS column_name
    FROM pg_class v
    JOIN pg_rewrite r ON r.ev_class = v.oid
    JOIN pg_depend d ON d.objid = r.oid
    JOIN pg_class t ON t.oid = d.refobjid
    LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE v.relkind = 'v' 
    AND v.relnamespace = 'public'::regnamespace
    AND d.classid = 'pg_rewrite'::regclass 
    AND d.refclassid = 'pg_class'::regclass
    AND d.deptype = 'n'
)
SELECT 
    v.table_name,
    v.view_definition,
    array_agg(DISTINCT vd.table_name || COALESCE('.' || vd.column_name, '')) FILTER (WHERE vd.table_name IS NOT NULL) as dependencies
FROM information_schema.views v
LEFT JOIN pg_class c ON c.relname = v.table_name AND c.relnamespace = 'public'::regnamespace
LEFT JOIN view_deps vd ON vd.view_oid = c.oid
WHERE v.table_schema = 'public'
GROUP BY v.table_name, v.view_definition
ORDER BY v.table_name;
