-- Migrar todos os leads antigos (sem tipo_origem definido ou indefinido) para 'whatsapp_direto'
-- Isso representa os leads "Bentes & Ramos" antigos

UPDATE public.leads_juridicos
SET 
  tipo_origem = 'whatsapp_direto',
  updated_at = now()
WHERE tipo_origem IS NULL 
   OR tipo_origem = 'indefinido'
   OR tipo_origem = '';