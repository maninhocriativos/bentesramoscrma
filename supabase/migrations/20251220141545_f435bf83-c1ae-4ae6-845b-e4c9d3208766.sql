-- Add external_id column for Advbox/Google IDs
ALTER TABLE public.compromissos 
ADD COLUMN IF NOT EXISTS external_id text UNIQUE;

-- Add source column to identify origin
ALTER TABLE public.compromissos 
ADD COLUMN IF NOT EXISTS origem text DEFAULT 'local';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_compromissos_external_id ON public.compromissos(external_id);
CREATE INDEX IF NOT EXISTS idx_compromissos_origem ON public.compromissos(origem);