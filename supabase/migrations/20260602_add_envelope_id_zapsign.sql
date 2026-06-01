-- Adicionar envelope_id para agrupar documentos de um mesmo envelope
ALTER TABLE contract_reminders_zapsign
  ADD COLUMN IF NOT EXISTS envelope_id UUID,
  ADD COLUMN IF NOT EXISTS is_main_doc BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_zapsign_envelope_id ON contract_reminders_zapsign(envelope_id);

COMMENT ON COLUMN contract_reminders_zapsign.envelope_id IS 'ID do envelope (mesmo UUID para todos os docs do mesmo envelope)';
COMMENT ON COLUMN contract_reminders_zapsign.is_main_doc IS 'true = documento principal do envelope (exibir link)';
