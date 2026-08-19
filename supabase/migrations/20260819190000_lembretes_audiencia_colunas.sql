-- Colunas de controle (dedup) para os lembretes de audiência via WhatsApp,
-- enviados 15/7/3 dias antes da data da audiência. Mesmo padrão das colunas
-- lembrete_24h_enviado_em/etc já usadas em compromissos para consultas.

ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS lembrete_15d_enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lembrete_7d_enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lembrete_3d_enviado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.tarefas.lembrete_15d_enviado_em IS 'Timestamp do envio do lembrete de audiência 15 dias antes (WhatsApp)';
COMMENT ON COLUMN public.tarefas.lembrete_7d_enviado_em IS 'Timestamp do envio do lembrete de audiência 7 dias antes (WhatsApp)';
COMMENT ON COLUMN public.tarefas.lembrete_3d_enviado_em IS 'Timestamp do envio do lembrete de audiência 3 dias antes (WhatsApp)';
