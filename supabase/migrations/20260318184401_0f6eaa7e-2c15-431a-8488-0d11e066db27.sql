ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS cpf_cliente text;
CREATE INDEX IF NOT EXISTS idx_processos_cpf_cliente ON public.processos (cpf_cliente) WHERE cpf_cliente IS NOT NULL;