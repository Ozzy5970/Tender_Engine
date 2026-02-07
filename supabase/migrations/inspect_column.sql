-- INSPECT COLUMN: public.compliance_documents.doc_type

WITH col_info AS (
    SELECT 
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        t.typtype AS type_code -- 'e' for enum
    FROM information_schema.columns c
    JOIN pg_type t ON t.typname = c.udt_name
    WHERE c.table_schema = 'public' 
      AND c.table_name = 'compliance_documents' 
      AND c.column_name = 'doc_type'
),
enum_vals AS (
    SELECT 
        string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = (SELECT udt_name FROM col_info)
),
deps AS (
    -- Views that use this column
    SELECT 
        'VIEW' as dep_type,
        v.table_schema || '.' || v.table_name as dep_name,
        -- definitions can be long, just taking first 100 chars or full if needed
        substring(v.view_definition from 1 for 200) || '...' as detail
    FROM information_schema.view_column_usage u
    JOIN information_schema.views v ON v.table_schema = u.view_schema AND v.table_name = u.view_name
    WHERE u.table_schema = 'public' 
      AND u.table_name = 'compliance_documents' 
      AND u.column_name = 'doc_type'
    
    UNION ALL
    
    -- Constraints involving this column
    SELECT 
        'CONSTRAINT' as dep_type,
        tc.constraint_name as dep_name,
        COALESCE(cc.check_clause, 'Key Constraint') as detail
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON tc.constraint_name = kcu.constraint_name
    LEFT JOIN information_schema.check_constraints cc ON cc.constraint_name = tc.constraint_name
    WHERE kcu.table_schema = 'public' 
      AND kcu.table_name = 'compliance_documents' 
      AND kcu.column_name = 'doc_type'
)
SELECT 
    ci.data_type,
    ci.udt_name,
    CASE WHEN ci.type_code = 'e' THEN 'YES' ELSE 'NO' END as is_enum,
    ev.enum_values,
    json_agg(json_build_object('type', d.dep_type, 'name', d.dep_name, 'detail', d.detail)) FILTER (WHERE d.dep_type IS NOT NULL) as dependencies
FROM col_info ci
LEFT JOIN enum_vals ev ON true
LEFT JOIN deps d ON true
GROUP BY ci.data_type, ci.udt_name, ci.type_code, ev.enum_values;

-- If you are not seeing any output, it means the column or table does not exist or has a different name
