-- Adicionar coluna 'tipo' em modelos_contratos para distinguir Clicksign vs Zapsign
ALTER TABLE public.modelos_contratos
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'clicksign';

-- Indexes para busca por tipo
CREATE INDEX IF NOT EXISTS idx_modelos_contratos_tipo ON public.modelos_contratos(tipo);

COMMENT ON COLUMN public.modelos_contratos.tipo IS 'Plataforma de assinatura: clicksign ou zapsign';
