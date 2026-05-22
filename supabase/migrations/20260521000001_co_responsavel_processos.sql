ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS co_responsavel_id UUID REFERENCES perfis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_processos_co_responsavel ON processos(co_responsavel_id);
