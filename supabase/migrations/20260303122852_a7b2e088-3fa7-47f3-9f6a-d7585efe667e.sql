
CREATE TABLE public.notificacoes_internas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info',
  lida BOOLEAN NOT NULL DEFAULT false,
  lead_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  link TEXT,
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notificacoes_internas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notificacoes_internas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notificacoes_internas FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_notificacoes_user_lida ON public.notificacoes_internas(user_id, lida);
