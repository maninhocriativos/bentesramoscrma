-- Add new fields to office_settings table for petition generation
ALTER TABLE public.office_settings 
ADD COLUMN IF NOT EXISTS oab_number TEXT,
ADD COLUMN IF NOT EXISTS oab_state TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT;