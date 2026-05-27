-- ═══════════════════════════════════════════════════════════════════════════
-- Histórico de atendimento por conversa
-- Permite rastrear quem atendeu/está atendendo cada cliente no chat.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Campos permanentes de "último atendente" em manychat_subscribers
--    (attending_by/nome/since já existem para presença em tempo real,
--     estes novos campos ficam preenchidos mesmo após o usuário sair)
ALTER TABLE public.manychat_subscribers
  ADD COLUMN IF NOT EXISTS last_attended_by   uuid,
  ADD COLUMN IF NOT EXISTS last_attended_nome text,
  ADD COLUMN IF NOT EXISTS last_attended_at   timestamptz;

-- 2. Tabela de log de atendimento
CREATE TABLE IF NOT EXISTS public.chat_atendimento_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id       text        NOT NULL,
  user_id             uuid        NOT NULL,
  user_nome           text        NOT NULL,
  previous_user_id    uuid,
  previous_user_nome  text,
  -- 'primeiro_atendimento' = ninguém havia atendido antes
  -- 'assumiu'              = outro usuário havia atendido antes
  -- 'retomou'              = o mesmo usuário abre a conversa novamente
  action              text        NOT NULL DEFAULT 'assumiu',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_atendimento_log_subscriber
  ON public.chat_atendimento_log (subscriber_id, created_at DESC);

-- 3. RLS
ALTER TABLE public.chat_atendimento_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read atendimento log"
  ON public.chat_atendimento_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert atendimento log"
  ON public.chat_atendimento_log FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Realtime para que todos os usuários online vejam novos logs ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_atendimento_log;
