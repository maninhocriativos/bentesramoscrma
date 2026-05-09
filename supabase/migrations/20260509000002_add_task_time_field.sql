ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS horario TIME;

COMMENT ON COLUMN public.tarefas.horario IS 'Horario opcional associado a tarefa, especialmente para audiencias.';
