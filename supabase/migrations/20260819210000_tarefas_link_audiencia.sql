-- Campo dedicado pro link da audiência virtual, em vez de extrair via regex
-- do texto livre de "descricao" (risco de pegar link errado ou nenhum).
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS link_audiencia TEXT;

COMMENT ON COLUMN public.tarefas.link_audiencia IS 'Link da audiência virtual (Zoom/LifesizeCloud/etc), preenchido explicitamente — usado no lembrete de WhatsApp em vez de extrair do texto da descrição.';
