-- Migration: 20260316000000_structured_company_profiles_v2.sql
-- Description: Implement structured profile data with exact legacy mappings

-- 1. Ensure required base columns exist
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS tax_reference_number text,
  ADD COLUMN IF NOT EXISTS tax_reference text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS location text;

-- 2. Add new structured address columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS suburb text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'South Africa';

-- 3. Backfill tax_reference_number from tax_reference
UPDATE public.profiles
SET tax_reference_number = tax_reference
WHERE (tax_reference_number IS NULL OR trim(tax_reference_number) = '') 
  AND tax_reference IS NOT NULL;

-- 4. Normalize BOTH tax columns to digits-only
UPDATE public.profiles 
SET tax_reference_number = regexp_replace(tax_reference_number, '[^0-9]', '', 'g')
WHERE tax_reference_number IS NOT NULL;

UPDATE public.profiles 
SET tax_reference = regexp_replace(tax_reference, '[^0-9]', '', 'g')
WHERE tax_reference IS NOT NULL;

-- 5. Clean up Registration Numbers 
UPDATE public.profiles
SET registration_number = trim(registration_number)
WHERE registration_number IS NOT NULL;

-- 6. Backfill address_line_1 from legacy address/location
-- First from address
UPDATE public.profiles
SET address_line_1 = address
WHERE (address_line_1 IS NULL OR trim(address_line_1) = '')
  AND address IS NOT NULL;

-- Then from location if still empty
UPDATE public.profiles
SET address_line_1 = location
WHERE (address_line_1 IS NULL OR trim(address_line_1) = '')
  AND location IS NOT NULL;

-- 7. Apply DB Constraints safely
DO $$ 
BEGIN
  -- Tax Reference Number Constraint (Canonical)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_tax_number') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_tax_number CHECK (
      tax_reference_number IS NULL OR 
      tax_reference_number = '' OR
      (char_length(tax_reference_number) = 10 AND tax_reference_number ~ '^[0-9]+$')
    );
  END IF;

  -- Regex matches South African style format YYYY/NNNNNN/NN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_reg_number') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_reg_number CHECK (
      registration_number IS NULL OR 
      registration_number = '' OR
      registration_number ~ '^[0-9]{4}/[0-9]{6}/[0-9]{2}$'
    );
  END IF;

  -- Country cannot be pure empty space
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_country') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_country CHECK (
      country IS NULL OR char_length(trim(country)) > 0
    );
  END IF;
END $$;
