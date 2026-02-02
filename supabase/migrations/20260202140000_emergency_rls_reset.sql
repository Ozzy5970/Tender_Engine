-- Emergency Reset for RLS to cure Loading Hangs
-- 1. Ensure Admins Table Exists (The Anchor)
CREATE TABLE IF NOT EXISTS public.admins (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- 2. Open Admins Table for Reads (Non-Blocking)
DROP POLICY IF EXISTS "Public read for admins table" ON public.admins;
CREATE POLICY "Public read for admins table" ON public.admins FOR SELECT USING (true);

-- 3. Reset Profiles Policies (The Deadlock Source)
DROP POLICY IF EXISTS "profiles_select_final" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_final" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_final" ON public.profiles;
-- Drop any legacies
DROP POLICY IF EXISTS "admins_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_logic" ON public.profiles;

-- 4. Apply The Clean Policy
CREATE POLICY "profiles_select_final" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
    );

CREATE POLICY "profiles_update_final" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())
    );

CREATE POLICY "profiles_insert_final" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Sync Admins (Bootstrap)
INSERT INTO public.admins (id)
SELECT id FROM public.profiles WHERE is_admin = true
ON CONFLICT (id) DO NOTHING;
