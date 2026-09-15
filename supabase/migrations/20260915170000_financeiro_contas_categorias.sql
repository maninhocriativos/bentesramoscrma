-- Expansão do módulo Financeiro (contas bancárias, categorias, vínculo
-- honorários/despesas/parcelas → categoria e conta). Até agora não existia
-- conta bancária nem categoria estruturada — despesas usavam um array
-- hardcoded no componente (TIPOS_DESPESA), sem persistência real, e
-- honorários não tinham nenhum conceito de categoria de receita.

CREATE TABLE public.contas_bancarias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  banco         text,
  tipo          text NOT NULL DEFAULT 'Corrente' CHECK (tipo IN ('Corrente','Poupança','Caixa','Outra')),
  saldo_inicial numeric(12,2) NOT NULL DEFAULT 0,
  ativa         boolean NOT NULL DEFAULT true,
  observacoes   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.categorias_financeiras (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  tipo       text NOT NULL CHECK (tipo IN ('receita','despesa')),
  cor        text,
  ordem      integer NOT NULL DEFAULT 0,
  ativa      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome, tipo)
);

ALTER TABLE public.honorarios ADD COLUMN categoria_id      uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;
ALTER TABLE public.despesas   ADD COLUMN categoria_id      uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;
ALTER TABLE public.despesas   ADD COLUMN conta_bancaria_id uuid REFERENCES public.contas_bancarias(id)      ON DELETE SET NULL;
ALTER TABLE public.parcelas   ADD COLUMN conta_bancaria_id uuid REFERENCES public.contas_bancarias(id)      ON DELETE SET NULL;

CREATE INDEX idx_honorarios_categoria       ON public.honorarios (categoria_id);
CREATE INDEX idx_despesas_categoria         ON public.despesas (categoria_id);
CREATE INDEX idx_despesas_conta             ON public.despesas (conta_bancaria_id);
CREATE INDEX idx_parcelas_conta             ON public.parcelas (conta_bancaria_id);
CREATE INDEX idx_parcelas_vencimento_status ON public.parcelas (data_vencimento, status); -- painel de inadimplência

-- Seed: migra os 9 tipos hoje hardcoded em TIPOS_DESPESA (DespesaModal.tsx)
-- como categorias de despesa, + categorias de receita razoáveis pro lado
-- de honorários (que nunca teve categoria nenhuma antes).
INSERT INTO public.categorias_financeiras (nome, tipo, ordem) VALUES
  ('Honorários Contratuais',            'receita', 1),
  ('Honorários de Êxito',               'receita', 2),
  ('Honorários Sucumbenciais',          'receita', 3),
  ('Consultoria Jurídica',              'receita', 4),
  ('Outros (Receita)',                  'receita', 5),
  ('Custas Processuais',                'despesa', 1),
  ('Diligências',                       'despesa', 2),
  ('Honorários de Perito',              'despesa', 3),
  ('Honorários de Assistente Técnico',  'despesa', 4),
  ('Despesas de Correio',               'despesa', 5),
  ('Certidões e Documentos',            'despesa', 6),
  ('Despesas de Viagem',                'despesa', 7),
  ('Publicações',                       'despesa', 8),
  ('Outros',                            'despesa', 9)
ON CONFLICT (nome, tipo) DO NOTHING;

-- Backfill: classifica retroativamente as despesas já existentes comparando
-- o texto livre `tipo` com o nome da categoria seedada correspondente —
-- sem isso o DRE nasceria com todo o histórico em "sem categoria".
UPDATE public.despesas d
SET categoria_id = c.id
FROM public.categorias_financeiras c
WHERE c.tipo = 'despesa' AND c.nome = d.tipo AND d.categoria_id IS NULL;

ALTER TABLE public.contas_bancarias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

-- Mesmos cargos que já leem `parcelas` (Secretaria inclusa — precisa ver
-- contas/categorias pra dar baixa em pagamento) e que já gerenciam
-- honorários/despesas.
CREATE POLICY "View contas_bancarias" ON public.contas_bancarias FOR SELECT USING (
  has_role(auth.uid(),'Administrador'::app_role) OR has_role(auth.uid(),'Gerente'::app_role) OR
  has_role(auth.uid(),'Advogado'::app_role) OR has_role(auth.uid(),'Secretaria'::app_role)
);
CREATE POLICY "Insert contas_bancarias" ON public.contas_bancarias FOR INSERT WITH CHECK (
  has_role(auth.uid(),'Administrador'::app_role) OR has_role(auth.uid(),'Gerente'::app_role)
);
CREATE POLICY "Update contas_bancarias" ON public.contas_bancarias FOR UPDATE USING (
  has_role(auth.uid(),'Administrador'::app_role) OR has_role(auth.uid(),'Gerente'::app_role)
);
CREATE POLICY "Delete contas_bancarias" ON public.contas_bancarias FOR DELETE USING (
  has_role(auth.uid(),'Administrador'::app_role)
);

CREATE POLICY "View categorias_financeiras" ON public.categorias_financeiras FOR SELECT USING (
  has_role(auth.uid(),'Administrador'::app_role) OR has_role(auth.uid(),'Gerente'::app_role) OR
  has_role(auth.uid(),'Advogado'::app_role) OR has_role(auth.uid(),'Secretaria'::app_role)
);
CREATE POLICY "Insert categorias_financeiras" ON public.categorias_financeiras FOR INSERT WITH CHECK (
  has_role(auth.uid(),'Administrador'::app_role) OR has_role(auth.uid(),'Gerente'::app_role)
);
CREATE POLICY "Update categorias_financeiras" ON public.categorias_financeiras FOR UPDATE USING (
  has_role(auth.uid(),'Administrador'::app_role) OR has_role(auth.uid(),'Gerente'::app_role)
);
CREATE POLICY "Delete categorias_financeiras" ON public.categorias_financeiras FOR DELETE USING (
  has_role(auth.uid(),'Administrador'::app_role)
);

CREATE TRIGGER set_contas_bancarias_updated_at
  BEFORE UPDATE ON public.contas_bancarias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_categorias_financeiras_updated_at
  BEFORE UPDATE ON public.categorias_financeiras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
