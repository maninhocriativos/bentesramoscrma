-- Adicionar flag de atendimento humano para pausar Isa
ALTER TABLE public.manychat_subscribers 
ADD COLUMN IF NOT EXISTS atendimento_humano boolean DEFAULT false;

-- Adicionar timestamp de quando entrou atendimento humano
ALTER TABLE public.manychat_subscribers 
ADD COLUMN IF NOT EXISTS atendimento_humano_desde timestamp with time zone;

-- Comentário explicativo
COMMENT ON COLUMN public.manychat_subscribers.atendimento_humano IS 'Quando true, Isa não responde automaticamente';
COMMENT ON COLUMN public.manychat_subscribers.atendimento_humano_desde IS 'Timestamp de quando o atendimento humano foi ativado';