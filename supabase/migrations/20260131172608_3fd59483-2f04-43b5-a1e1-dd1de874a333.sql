-- Adicionar coluna facebook_lead_id para armazenar o ID do lead do Facebook
ALTER TABLE public.leads_juridicos 
ADD COLUMN IF NOT EXISTS facebook_lead_id text;

-- Criar índice para buscas por facebook_lead_id
CREATE INDEX IF NOT EXISTS idx_leads_facebook_lead_id 
ON public.leads_juridicos(facebook_lead_id) 
WHERE facebook_lead_id IS NOT NULL;