-- Etapa 1: Adicionar campos de controle de follow-up na tabela lead_followups
-- e criar estrutura para controle FAST/SLOW

-- Adicionar novos campos de controle na tabela lead_followups
ALTER TABLE public.lead_followups
ADD COLUMN IF NOT EXISTS last_outbound_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_isa_outbound_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_inbound_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS waiting_reply boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS followup_stage_fast integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS followup_stage_slow integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_followup_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_followup_type text, -- 'FAST' | 'SLOW' | null
ADD COLUMN IF NOT EXISTS followup_lock_reason text,
ADD COLUMN IF NOT EXISTS retomada_1_enviado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS retomada_1_enviado_em timestamp with time zone,
ADD COLUMN IF NOT EXISTS retomada_2_enviado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS retomada_2_enviado_em timestamp with time zone,
ADD COLUMN IF NOT EXISTS retomada_3_enviado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS retomada_3_enviado_em timestamp with time zone;

-- Criar índice para otimizar busca de follow-ups pendentes
CREATE INDEX IF NOT EXISTS idx_lead_followups_next_followup 
ON public.lead_followups (next_followup_at) 
WHERE next_followup_at IS NOT NULL AND status != 'concluido';

-- Criar índice para buscar por status do lead rapidamente
CREATE INDEX IF NOT EXISTS idx_lead_followups_status 
ON public.lead_followups (status);

-- Atualizar lead_followups existentes: marcar como concluído todos os leads que NÃO são Lead Frio
UPDATE public.lead_followups lf
SET 
  status = 'concluido',
  followup_lock_reason = 'Lead não é mais Lead Frio - status atualizado',
  next_followup_at = NULL,
  next_followup_type = NULL
FROM public.leads_juridicos l
WHERE lf.lead_id = l.id 
  AND l.status NOT IN ('Lead Frio')
  AND lf.status != 'concluido';

-- Comentário explicativo sobre os campos
COMMENT ON COLUMN public.lead_followups.last_outbound_at IS 'Timestamp da última mensagem enviada (Isa ou humano)';
COMMENT ON COLUMN public.lead_followups.last_isa_outbound_at IS 'Timestamp da última mensagem enviada pela Isa';
COMMENT ON COLUMN public.lead_followups.last_inbound_at IS 'Timestamp da última mensagem recebida do lead';
COMMENT ON COLUMN public.lead_followups.waiting_reply IS 'Se está aguardando resposta do lead';
COMMENT ON COLUMN public.lead_followups.followup_stage_fast IS 'Estágio do follow-up FAST (0-3)';
COMMENT ON COLUMN public.lead_followups.followup_stage_slow IS 'Estágio do follow-up SLOW (0-3)';
COMMENT ON COLUMN public.lead_followups.next_followup_at IS 'Quando o próximo follow-up deve ser enviado';
COMMENT ON COLUMN public.lead_followups.next_followup_type IS 'Tipo do próximo follow-up: FAST ou SLOW';
COMMENT ON COLUMN public.lead_followups.followup_lock_reason IS 'Razão do bloqueio de follow-ups';