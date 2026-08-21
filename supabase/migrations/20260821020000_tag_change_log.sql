-- Registro de auditoria de mudanças de tag por conversa.
-- subscriber_tags nunca guardou quem/quando removeu uma tag (delete físico
-- da linha, sem rastro) -- essa tabela existe só pra registrar cada
-- adição/remoção, sem afetar o comportamento atual de subscriber_tags.
CREATE TABLE public.tag_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id text NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.chat_tags(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('added', 'removed')),
  changed_by uuid REFERENCES public.perfis(id),
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_tag_change_log_subscriber ON public.tag_change_log(subscriber_id);
CREATE INDEX idx_tag_change_log_tag ON public.tag_change_log(tag_id);
CREATE INDEX idx_tag_change_log_created_at ON public.tag_change_log(created_at);

ALTER TABLE public.tag_change_log ENABLE ROW LEVEL SECURITY;

-- Mesmo modelo de permissão de subscriber_tags: qualquer usuário autenticado
-- pode ler e escrever (é log interno da equipe, não dado sensível de cliente).
CREATE POLICY "Users can view tag change log"
ON public.tag_change_log
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert tag change log"
ON public.tag_change_log
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
