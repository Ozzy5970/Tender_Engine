-- Migration: Alert System Logic
-- Description: RPC function to check for expiring docs/tenders and generate alerts

-- 1. Create/Update Alerts Table policies if needed (already in core schema, but ensuring RLS is open for insert by system functions)

-- 2. Function to Check and Generate Alerts
CREATE OR REPLACE FUNCTION public.check_and_generate_alerts(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    doc record;
    tender record;
    alert_exists boolean;
BEGIN
    -- A. Check Compliance Documents (Expiring in 30 days)
    FOR doc IN 
        SELECT id, title, expiry_date, category 
        FROM public.compliance_documents 
        WHERE user_id = p_user_id 
        AND expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
        AND status != 'expired' -- Don't alert if already marked expired (maybe? or alert 'Expired'?)
    LOOP
        -- Check if we already alerted for this doc in the last 7 days to avoid spam
        SELECT EXISTS (
            SELECT 1 FROM public.alerts 
            WHERE user_id = p_user_id 
            AND message LIKE '%' || doc.title || '%'
            AND created_at > (CURRENT_DATE - INTERVAL '7 days')
        ) INTO alert_exists;

        IF NOT alert_exists THEN
            INSERT INTO public.alerts (user_id, priority, message, is_read)
            VALUES (
                p_user_id, 
                'HIGH', 
                'Document Expiring Soon: ' || doc.title || ' (' || doc.category || ') expires on ' || doc.expiry_date,
                false
            );
        END IF;
    END LOOP;

    -- B. Check Compliance Documents (Already Expired)
    FOR doc IN 
        SELECT id, title, expiry_date, category 
        FROM public.compliance_documents 
        WHERE user_id = p_user_id 
        AND expiry_date < CURRENT_DATE
    LOOP
        -- Check if we already alerted for this specific expiry recently
        SELECT EXISTS (
            SELECT 1 FROM public.alerts 
            WHERE user_id = p_user_id 
            AND message LIKE 'EXPIRED: ' || doc.title || '%'
            AND created_at > (CURRENT_DATE - INTERVAL '30 days') -- Remind once a month
        ) INTO alert_exists;

        IF NOT alert_exists THEN
            INSERT INTO public.alerts (user_id, priority, message, is_read)
            VALUES (
                p_user_id, 
                'HIGH', 
                'EXPIRED: ' || doc.title || ' has expired! Please renew immediately.',
                false
            );
        END IF;
    END LOOP;

    -- C. Check Tenders (Closing in 7 days)
    FOR tender IN 
        SELECT id, title, closing_date 
        FROM public.tenders 
        WHERE user_id = p_user_id 
        AND status IN ('DRAFT', 'ANALYZING', 'COMPLIANT')
        AND closing_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM public.alerts 
            WHERE user_id = p_user_id 
            AND tender_id = tender.id
            AND message LIKE 'Tender Closing Soon%'
            AND created_at > (CURRENT_DATE - INTERVAL '3 days')
        ) INTO alert_exists;

        IF NOT alert_exists THEN
            INSERT INTO public.alerts (user_id, tender_id, priority, message, is_read)
            VALUES (
                p_user_id, 
                tender.id,
                'HIGH', 
                'Tender Closing Soon: ' || tender.title || ' closes on ' || tender.closing_date,
                false
            );
        END IF;
    END LOOP;

END;
$$;
