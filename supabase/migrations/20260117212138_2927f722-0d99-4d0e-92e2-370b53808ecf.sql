-- =====================================================
-- TABELAS DE DICIONÁRIO CNJ (para traduzir códigos)
-- =====================================================

-- Tabela de Classes Processuais CNJ
CREATE TABLE public.cnj_classes (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Assuntos CNJ
CREATE TABLE public.cnj_assuntos (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Movimentos CNJ
CREATE TABLE public.cnj_movimentos (
  codigo TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao_padrao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABELA DE ASSUNTOS DO PROCESSO (relacionamento N:N)
-- =====================================================
CREATE TABLE public.processo_assuntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  assunto_cnj_codigo TEXT,
  assunto_nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id, assunto_cnj_codigo)
);

CREATE INDEX idx_processo_assuntos_processo ON public.processo_assuntos(processo_id);
CREATE INDEX idx_processo_assuntos_codigo ON public.processo_assuntos(assunto_cnj_codigo);

-- =====================================================
-- TABELA DE MOVIMENTAÇÕES DO PROCESSO
-- =====================================================
CREATE TABLE public.processo_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  movimento_cnj_codigo TEXT,
  movimento_titulo TEXT NOT NULL,
  movimento_descricao TEXT,
  data_movimento TIMESTAMPTZ,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_processo_movimentacoes_processo ON public.processo_movimentacoes(processo_id);
CREATE INDEX idx_processo_movimentacoes_data ON public.processo_movimentacoes(data_movimento DESC);

-- =====================================================
-- ADICIONAR NOVOS CAMPOS NA TABELA processos
-- =====================================================
ALTER TABLE public.processos 
  ADD COLUMN IF NOT EXISTS tribunal TEXT,
  ADD COLUMN IF NOT EXISTS sistema TEXT,
  ADD COLUMN IF NOT EXISTS sigilo TEXT,
  ADD COLUMN IF NOT EXISTS classe_cnj_codigo TEXT,
  ADD COLUMN IF NOT EXISTS classe_cnj_nome TEXT,
  ADD COLUMN IF NOT EXISTS orgao_julgador TEXT,
  ADD COLUMN IF NOT EXISTS grau_formato TEXT,
  ADD COLUMN IF NOT EXISTS ajuizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultima_atualizacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fonte_raw JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- =====================================================
-- RLS POLICIES (simplificadas - todos autenticados podem ler/escrever)
-- =====================================================

-- Enable RLS
ALTER TABLE public.cnj_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cnj_assuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cnj_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_assuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Políticas simples para dicionários CNJ
CREATE POLICY "Authenticated can read cnj_classes"
  ON public.cnj_classes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage cnj_classes"
  ON public.cnj_classes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read cnj_assuntos"
  ON public.cnj_assuntos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage cnj_assuntos"
  ON public.cnj_assuntos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read cnj_movimentos"
  ON public.cnj_movimentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage cnj_movimentos"
  ON public.cnj_movimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas para assuntos e movimentações de processos
CREATE POLICY "Authenticated can read processo_assuntos"
  ON public.processo_assuntos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage processo_assuntos"
  ON public.processo_assuntos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read processo_movimentacoes"
  ON public.processo_movimentacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage processo_movimentacoes"
  ON public.processo_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- SEED INICIAL DE DICIONÁRIOS CNJ
-- =====================================================
INSERT INTO public.cnj_movimentos (codigo, titulo, descricao_padrao) VALUES
  ('26', 'Distribuição', 'Distribuição por competência exclusiva'),
  ('85', 'Petição', 'Petição inicial'),
  ('132', 'Conclusão', 'Conclusos para decisão'),
  ('193', 'Despacho', 'Despacho proferido'),
  ('198', 'Sentença', 'Sentença proferida'),
  ('848', 'Audiência', 'Audiência realizada'),
  ('22', 'Intimação', 'Intimação expedida'),
  ('12', 'Citação', 'Citação expedida'),
  ('50', 'Juntada', 'Juntada de documento'),
  ('60', 'Movimento', 'Movimento processual'),
  ('246', 'Trânsito em Julgado', 'Certificado o trânsito em julgado'),
  ('14', 'Expedição', 'Expedição de documento'),
  ('861', 'Arquivamento', 'Arquivamento definitivo'),
  ('118', 'Recurso', 'Interposição de recurso');

INSERT INTO public.cnj_classes (codigo, nome) VALUES
  ('1116', 'Procedimento Comum'),
  ('436', 'Execução Fiscal'),
  ('12078', 'Cumprimento de Sentença contra a Fazenda Pública'),
  ('156', 'Ação Civil Pública'),
  ('7', 'Reclamação Trabalhista'),
  ('985', 'Mandado de Segurança'),
  ('229', 'Procedimento do Juizado Especial Cível'),
  ('12', 'Ação Penal'),
  ('1386', 'Execução de Título Extrajudicial'),
  ('159', 'Ação de Alimentos'),
  ('63', 'Execução Penal');

INSERT INTO public.cnj_assuntos (codigo, nome) VALUES
  ('1156', 'Perdas e Danos'),
  ('6220', 'Indenização por Dano Moral'),
  ('7768', 'Direito do Consumidor'),
  ('899', 'Direito Civil'),
  ('864', 'Obrigações'),
  ('10028', 'Cobrança'),
  ('7619', 'Responsabilidade Civil'),
  ('10677', 'Rescisão do Contrato de Trabalho'),
  ('2027', 'Família'),
  ('1894', 'Processo e Procedimento'),
  ('10444', 'FGTS/Fundo de Garantia por Tempo de Serviço');