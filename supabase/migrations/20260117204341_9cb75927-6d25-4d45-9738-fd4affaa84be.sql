-- Adicionar campo de frequência de notificação na tabela processos
ALTER TABLE public.processos 
ADD COLUMN IF NOT EXISTS frequencia_notificacao_dias integer DEFAULT 7,
ADD COLUMN IF NOT EXISTS ultima_notificacao_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS notificacao_ativa boolean DEFAULT true;

-- Comentários para documentação
COMMENT ON COLUMN public.processos.frequencia_notificacao_dias IS 'Frequência em dias para envio de notificações de status (7, 14, 30)';
COMMENT ON COLUMN public.processos.ultima_notificacao_at IS 'Data da última notificação enviada ao cliente';
COMMENT ON COLUMN public.processos.notificacao_ativa IS 'Se as notificações estão ativas para este processo';