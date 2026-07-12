-- Adicionar configuração de template Zapsign em modelos_contratos
ALTER TABLE public.modelos_contratos
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS campos_variaveis JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS zapsign_template_id TEXT;

COMMENT ON COLUMN public.modelos_contratos.template_key IS 'Chave interna do template (ex: contrato-honorarios)';
COMMENT ON COLUMN public.modelos_contratos.campos_variaveis IS 'JSON com definição dos campos variáveis do template';
COMMENT ON COLUMN public.modelos_contratos.zapsign_template_id IS 'ID do template no Zapsign (opcional - para usar create-doc-from-template)';

CREATE INDEX IF NOT EXISTS idx_modelos_contratos_template_key ON public.modelos_contratos(template_key);
