-- Add user-friendly notification preferences
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notify_tender_updates boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_compliance_expiry boolean DEFAULT true;
