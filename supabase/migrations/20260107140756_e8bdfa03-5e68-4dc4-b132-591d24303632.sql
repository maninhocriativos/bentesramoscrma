-- Adicionar campo de confirmação aos compromissos
ALTER TABLE public.compromissos 
ADD COLUMN IF NOT EXISTS confirmacao_status text DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS confirmado_em timestamp with time zone,
ADD COLUMN IF NOT EXISTS confirmacao_resposta text;

-- Valores possíveis: 'pendente', 'confirmado', 'remarcado', 'cancelado'
COMMENT ON COLUMN public.compromissos.confirmacao_status IS 'Status da confirmação: pendente, confirmado, remarcado, cancelado';
COMMENT ON COLUMN public.compromissos.confirmado_em IS 'Timestamp de quando foi confirmado/respondido';
COMMENT ON COLUMN public.compromissos.confirmacao_resposta IS 'Texto da resposta original do lead';