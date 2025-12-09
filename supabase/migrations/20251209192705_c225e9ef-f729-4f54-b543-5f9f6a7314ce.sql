-- Add custom fields to leads_juridicos table
ALTER TABLE public.leads_juridicos
ADD COLUMN valor_causa numeric DEFAULT NULL,
ADD COLUMN tipo_acao text DEFAULT NULL;