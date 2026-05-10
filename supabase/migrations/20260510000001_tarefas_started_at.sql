-- Rastreio de tempo de execução das tarefas
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tarefas.started_at IS
  'Momento em que a tarefa foi iniciada (status → Em Andamento)';
