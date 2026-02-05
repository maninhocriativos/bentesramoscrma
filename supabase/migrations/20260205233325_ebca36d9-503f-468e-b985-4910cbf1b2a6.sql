-- Adicionar novos campos ao processos
ALTER TABLE public.processos
ADD COLUMN IF NOT EXISTS tribunal text,
ADD COLUMN IF NOT EXISTS vara_comarca text,
ADD COLUMN IF NOT EXISTS assunto text,
ADD COLUMN IF NOT EXISTS valor_causa numeric,
ADD COLUMN IF NOT EXISTS data_ajuizamento timestamptz,
ADD COLUMN IF NOT EXISTS data_ultima_atualizacao timestamptz,
ADD COLUMN IF NOT EXISTS orgao_julgador text,
ADD COLUMN IF NOT EXISTS grau text,
ADD COLUMN IF NOT EXISTS classe_cnj text,
ADD COLUMN IF NOT EXISTS status_detalhado text,
ADD COLUMN IF NOT EXISTS partes_json jsonb,
ADD COLUMN IF NOT EXISTS movimentos_json jsonb,
ADD COLUMN IF NOT EXISTS dados_datajud jsonb,
ADD COLUMN IF NOT EXISTS ultima_consulta_api_at timestamptz;

-- Comentários
COMMENT ON COLUMN public.processos.tribunal IS 'Sigla do tribunal (ex: TRT11, TJAM)';
COMMENT ON COLUMN public.processos.vara_comarca IS 'Vara ou comarca do processo';
COMMENT ON COLUMN public.processos.assunto IS 'Assunto principal do processo';
COMMENT ON COLUMN public.processos.valor_causa IS 'Valor da causa em reais';
COMMENT ON COLUMN public.processos.data_ajuizamento IS 'Data de distribuição/ajuizamento';
COMMENT ON COLUMN public.processos.data_ultima_atualizacao IS 'Última atualização do DataJud';
COMMENT ON COLUMN public.processos.orgao_julgador IS 'Órgão julgador responsável';
COMMENT ON COLUMN public.processos.grau IS 'Grau de jurisdição (1º grau, 2º grau, etc)';
COMMENT ON COLUMN public.processos.classe_cnj IS 'Classe processual CNJ';
COMMENT ON COLUMN public.processos.partes_json IS 'JSON com todas as partes do processo';
COMMENT ON COLUMN public.processos.movimentos_json IS 'JSON com últimas movimentações';
COMMENT ON COLUMN public.processos.dados_datajud IS 'Dados brutos do DataJud';
COMMENT ON COLUMN public.processos.ultima_consulta_api_at IS 'Última consulta à API DataJud';