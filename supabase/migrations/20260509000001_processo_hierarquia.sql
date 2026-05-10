-- ============================================================
-- Hierarquia de processos: processo_pai_id (auto-referencial)
-- Permite vincular processos derivados (cumprimento, recursal, etc.)
-- ============================================================

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS processo_pai_id UUID
    REFERENCES public.processos(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_processos_pai_id
  ON public.processos(processo_pai_id);

-- Comentário no catálogo
COMMENT ON COLUMN public.processos.processo_pai_id IS
  'ID do processo principal que originou este. NULL = processo raiz.';
