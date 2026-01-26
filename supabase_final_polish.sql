-- FINAL PRE-PRODUCTION SCHEMA UPDATE
-- Accessorize the tables to support full validation.

-- 1. TENDERS: Add Requirements Columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenders' AND column_name='required_cidb_grade') THEN
        ALTER TABLE public.tenders ADD COLUMN required_cidb_grade integer default 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenders' AND column_name='compulsory_briefing') THEN
        ALTER TABLE public.tenders ADD COLUMN compulsory_briefing boolean default false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenders' AND column_name='briefing_date') THEN
        ALTER TABLE public.tenders ADD COLUMN briefing_date timestamp with time zone;
    END IF;
END $$;

-- 2. PROFILES: Add Missing Company Details
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='trading_name') THEN
        ALTER TABLE public.profiles ADD COLUMN trading_name text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='contact_person') THEN
        ALTER TABLE public.profiles ADD COLUMN contact_person text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='directors') THEN
        ALTER TABLE public.profiles ADD COLUMN directors jsonb default '[]'::jsonb;
    END IF;
END $$;
