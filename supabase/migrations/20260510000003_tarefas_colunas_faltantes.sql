-- Adiciona colunas ausentes na tabela tarefas referenciadas no código
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS horario        TIME,
  ADD COLUMN IF NOT EXISTS prazo_seguranca DATE,
  ADD COLUMN IF NOT EXISTS prazo_fatal    DATE;

COMMENT ON COLUMN public.tarefas.horario         IS 'Horário específico para a tarefa (HH:MM)';
COMMENT ON COLUMN public.tarefas.prazo_seguranca IS 'Data de prazo de segurança (antes do prazo fatal)';
COMMENT ON COLUMN public.tarefas.prazo_fatal     IS 'Data limite absoluta — prazo fatal';
