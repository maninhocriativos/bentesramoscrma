-- Chat interno da equipe
CREATE TABLE IF NOT EXISTS public.chat_mensagens (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id  UUID        NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  conteudo   TEXT        NOT NULL CHECK (char_length(conteudo) <= 2000),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_leitura"  ON public.chat_mensagens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "chat_escrita"  ON public.chat_mensagens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_chat_created_at
  ON public.chat_mensagens(created_at DESC);

COMMENT ON TABLE public.chat_mensagens IS
  'Mensagens do chat interno da equipe — canal único global.';
