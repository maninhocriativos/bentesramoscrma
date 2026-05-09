ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS prazo_seguranca DATE,
  ADD COLUMN IF NOT EXISTS prazo_fatal DATE;

CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_prazo_fatal
  ON public.tarefas (responsavel_id, prazo_fatal)
  WHERE status NOT IN ('Concluida', 'Concluída', 'Cancelada');

COMMENT ON COLUMN public.tarefas.prazo_seguranca IS 'Prazo interno de segurança para conclusão antes do vencimento final.';
COMMENT ON COLUMN public.tarefas.prazo_fatal IS 'Prazo fatal informado pelo advogado para a tarefa.';
