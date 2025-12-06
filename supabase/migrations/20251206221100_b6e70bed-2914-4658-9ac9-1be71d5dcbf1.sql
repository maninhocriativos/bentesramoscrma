-- Add origem column to leads_juridicos table
ALTER TABLE public.leads_juridicos 
ADD COLUMN IF NOT EXISTS origem text DEFAULT 'Site';

-- Fix RLS policy to be permissive (the current RESTRICTIVE policy may block access)
DROP POLICY IF EXISTS "Acesso total" ON public.leads_juridicos;

-- Create a permissive policy for authenticated users
CREATE POLICY "Authenticated users full access" 
ON public.leads_juridicos 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Also allow anon access for now (you can restrict later)
CREATE POLICY "Anon read access" 
ON public.leads_juridicos 
FOR SELECT 
TO anon
USING (true);