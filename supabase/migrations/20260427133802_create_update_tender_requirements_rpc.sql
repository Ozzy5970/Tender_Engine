-- Migration: create_update_tender_requirements_rpc

CREATE OR REPLACE FUNCTION public.update_tender_requirements(
  p_tender_id uuid,
  p_requirements jsonb
) RETURNS boolean AS $$
DECLARE
  v_tender_owner uuid;
BEGIN
  -- 1. Verify authenticated user owns the tender
  SELECT user_id INTO v_tender_owner
  FROM public.tenders
  WHERE id = p_tender_id;

  IF v_tender_owner IS NULL OR v_tender_owner != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to modify this tender or tender does not exist';
  END IF;

  -- 2. Delete existing compliance_requirements for that tender
  DELETE FROM public.compliance_requirements
  WHERE tender_id = p_tender_id;

  -- 3. Insert new requirements from p_requirements jsonb
  IF p_requirements IS NOT NULL THEN
    IF jsonb_typeof(p_requirements) != 'array' THEN
      RAISE EXCEPTION 'p_requirements must be a JSON array';
    END IF;

    IF jsonb_array_length(p_requirements) > 0 THEN
      INSERT INTO public.compliance_requirements (tender_id, rule_category, description, target_value, is_killer)
      SELECT 
        p_tender_id,
        req->>'rule_category',
        req->>'description',
        req->'target_value',
        (req->>'is_killer')::boolean
      FROM jsonb_array_elements(p_requirements) AS req;
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
