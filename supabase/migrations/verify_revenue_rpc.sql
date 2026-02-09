-- Verify Revenue RPC Output
-- Run this in Supabase SQL Editor to see the exact JSON structure returned.

SELECT public.get_admin_revenue_ledger(
    now() - interval '30 days', -- Start Date
    now(),                      -- End Date
    10,                         -- Limit
    0                           -- Offset
);
