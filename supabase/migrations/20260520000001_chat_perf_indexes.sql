-- Índices compostos para acelerar queries de chat (subscriber_id + created_at e lead_id + created_at)
-- Os índices simples existentes não são eficientes para ORDER BY + LIMIT combinados
CREATE INDEX IF NOT EXISTS idx_manychat_mensagens_sub_created
  ON public.manychat_mensagens(subscriber_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manychat_mensagens_lead_created
  ON public.manychat_mensagens(lead_id, created_at DESC);
