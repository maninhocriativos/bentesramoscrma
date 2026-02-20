
-- Add task delivery and approval workflow columns
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS entrega_texto text,
  ADD COLUMN IF NOT EXISTS entrega_anexo_url text,
  ADD COLUMN IF NOT EXISTS entregue_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS aprovacao_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aprovacao_nota integer,
  ADD COLUMN IF NOT EXISTS aprovacao_feedback text,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamp with time zone;

-- aprovacao_status values: NULL (not submitted), 'aguardando_aprovacao', 'aprovada', 'devolvida'
-- aprovacao_nota: 1-5 score given by manager

COMMENT ON COLUMN public.tarefas.aprovacao_status IS 'NULL=not submitted, aguardando_aprovacao, aprovada, devolvida';
COMMENT ON COLUMN public.tarefas.aprovacao_nota IS 'Score 1-5 given by manager';
