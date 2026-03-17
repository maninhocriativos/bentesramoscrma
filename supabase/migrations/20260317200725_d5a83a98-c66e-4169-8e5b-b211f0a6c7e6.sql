
-- =============================================
-- PETIÇÕES INICIAIS V3 - Schema Completo
-- =============================================

-- Enum para status da petição
CREATE TYPE public.petition_status_v3 AS ENUM (
  'rascunho', 'gerando', 'gerado', 'revisao', 'aprovado', 'exportado', 'arquivado'
);

-- 1. Categorias de petição
CREATE TABLE public.petition_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text,
  icone text DEFAULT 'Folder',
  cor text DEFAULT 'slate',
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tipos de petição (dentro de categorias)
CREATE TABLE public.petition_types_v3 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.petition_categories(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text,
  icone text DEFAULT 'FileText',
  cor text DEFAULT 'blue',
  field_schema jsonb DEFAULT '{}',
  agent_prompt text,
  agent_model text DEFAULT 'google/gemini-3-flash-preview',
  template_docx_url text,
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Casos de petição (petições em si)
CREATE TABLE public.petition_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  petition_type_id uuid REFERENCES public.petition_types_v3(id) NOT NULL,
  titulo text,
  status public.petition_status_v3 DEFAULT 'rascunho',
  -- Bloco A: Dados do cliente
  cliente_nome text,
  cliente_nacionalidade text DEFAULT 'brasileiro(a)',
  cliente_naturalidade text,
  cliente_estado_civil text,
  cliente_profissao text,
  cliente_rg text,
  cliente_cpf text,
  cliente_data_nascimento date,
  cliente_idade integer,
  cliente_endereco text,
  cliente_bairro text,
  cliente_cidade text,
  cliente_uf text DEFAULT 'AM',
  cliente_cep text,
  cliente_telefone text,
  cliente_email text,
  cliente_condicao_especial text,
  -- Bloco B: Dados do réu
  reu_nome text,
  reu_cnpj text,
  reu_tipo text,
  reu_endereco text,
  reu_natureza_relacao text,
  -- Bloco C: Competência
  comarca text,
  estado text DEFAULT 'Amazonas',
  vara text,
  tipo_vara text,
  tramitacao_preferencial boolean DEFAULT false,
  fundamento_prioridade text,
  -- Bloco D: Dados fáticos (variáveis por tipo)
  dados_faticos jsonb DEFAULT '{}',
  -- Bloco E: Pedidos
  pedir_tutela_urgencia boolean DEFAULT false,
  pedir_repeticao_indebito boolean DEFAULT false,
  pedir_danos_morais boolean DEFAULT false,
  valor_dano_moral numeric,
  pedir_inversao_onus boolean DEFAULT true,
  pedir_justica_gratuita boolean DEFAULT true,
  tentativa_administrativa boolean DEFAULT false,
  desinteresse_conciliacao boolean DEFAULT false,
  -- Bloco F: Observações
  documentos_anexados text[],
  observacoes_advogado text,
  fatos_adicionais text,
  -- Geração
  generated_content jsonb,
  generated_docx_url text,
  generated_pdf_url text,
  current_step integer DEFAULT 1,
  -- Meta
  lead_id uuid REFERENCES public.leads_juridicos(id),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Versões de geração
CREATE TABLE public.petition_generation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.petition_cases(id) ON DELETE CASCADE NOT NULL,
  version integer DEFAULT 1,
  content_json jsonb NOT NULL DEFAULT '{}',
  docx_url text,
  pdf_url text,
  generated_by text DEFAULT 'ia',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 5. Log de status
CREATE TABLE public.petition_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.petition_cases(id) ON DELETE CASCADE NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_petition_types_v3_category ON public.petition_types_v3(category_id);
CREATE INDEX idx_petition_cases_type ON public.petition_cases(petition_type_id);
CREATE INDEX idx_petition_cases_status ON public.petition_cases(status);
CREATE INDEX idx_petition_cases_created ON public.petition_cases(created_at DESC);
CREATE INDEX idx_petition_gen_versions_case ON public.petition_generation_versions(case_id);

-- RLS
ALTER TABLE public.petition_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_types_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_generation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_status_logs ENABLE ROW LEVEL SECURITY;

-- Policies: Categories (read all, admin manage)
CREATE POLICY "Authenticated can view petition_categories" ON public.petition_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage petition_categories" ON public.petition_categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'Administrador'::app_role)) WITH CHECK (has_role(auth.uid(), 'Administrador'::app_role));

-- Policies: Types (read all, admin manage)
CREATE POLICY "Authenticated can view petition_types_v3" ON public.petition_types_v3 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage petition_types_v3" ON public.petition_types_v3 FOR ALL TO authenticated USING (has_role(auth.uid(), 'Administrador'::app_role)) WITH CHECK (has_role(auth.uid(), 'Administrador'::app_role));

-- Policies: Cases (authenticated CRUD)
CREATE POLICY "Authenticated can view petition_cases" ON public.petition_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert petition_cases" ON public.petition_cases FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update petition_cases" ON public.petition_cases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete petition_cases" ON public.petition_cases FOR DELETE TO authenticated USING (has_role(auth.uid(), 'Administrador'::app_role));

-- Policies: Versions
CREATE POLICY "Authenticated can view petition_gen_versions" ON public.petition_generation_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert petition_gen_versions" ON public.petition_generation_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Policies: Status logs
CREATE POLICY "Authenticated can view petition_status_logs" ON public.petition_status_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert petition_status_logs" ON public.petition_status_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger updated_at
CREATE TRIGGER update_petition_cases_updated_at BEFORE UPDATE ON public.petition_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_petition_categories_updated_at BEFORE UPDATE ON public.petition_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_petition_types_v3_updated_at BEFORE UPDATE ON public.petition_types_v3 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SEED: Categorias e Tipos
-- =============================================

INSERT INTO public.petition_categories (nome, slug, descricao, icone, cor, ordem) VALUES
  ('Bancário / Consumidor', 'bancario-consumidor', 'Ações contra bancos e instituições financeiras', 'Landmark', 'amber', 1),
  ('Fazenda Pública / Servidor', 'fazenda-publica-servidor', 'Ações contra entes públicos e em favor de servidores', 'Building2', 'emerald', 2),
  ('Transporte Aéreo / Consumo', 'transporte-aereo-consumo', 'Ações envolvendo companhias aéreas e direito do consumidor', 'Plane', 'sky', 3);

-- Bancário / Consumidor
INSERT INTO public.petition_types_v3 (category_id, nome, slug, descricao, icone, cor, ordem, field_schema) VALUES
  ((SELECT id FROM public.petition_categories WHERE slug = 'bancario-consumidor'), 'Venda Casada', 'venda-casada', 'Cobrança de seguro/serviço embutido em contrato', 'ShieldAlert', 'red', 1, '{"contrato": true, "banco": true, "valor_cobrado": true, "parcelas": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'bancario-consumidor'), 'Seguro Não Contratado', 'seguro-nao-contratado', 'Cobrança de seguro prestamista sem autorização', 'ShieldX', 'orange', 2, '{"contrato": true, "banco": true, "valor_cobrado": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'bancario-consumidor'), 'Tarifa Bancária Indevida', 'tarifa-bancaria', 'Cobrança de tarifas não autorizadas', 'Receipt', 'yellow', 3, '{"banco": true, "valor_cobrado": true, "periodo": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'bancario-consumidor'), 'RMC - Reserva de Margem Consignável', 'rmc', 'Empréstimo consignado com cartão RMC', 'CreditCard', 'purple', 4, '{"beneficio_inss": true, "banco": true, "contrato": true, "valor_cobrado": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'bancario-consumidor'), 'Empréstimo Fraudulento', 'emprestimo-fraudulento', 'Empréstimo consignado não reconhecido', 'AlertTriangle', 'red', 5, '{"beneficio_inss": true, "banco": true, "contrato": true, "valor_cobrado": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'bancario-consumidor'), 'Renovação Fraudulenta', 'renovacao-fraudulenta', 'Renovação de empréstimo sem autorização', 'RefreshCw', 'rose', 6, '{"beneficio_inss": true, "banco": true, "contrato": true, "valor_cobrado": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'bancario-consumidor'), 'Revisão Contratual', 'revisao-contratual', 'Revisão de cláusulas abusivas', 'FileSearch', 'indigo', 7, '{"banco": true, "contrato": true, "valor_cobrado": true, "parcelas": true}');

-- Fazenda Pública / Servidor
INSERT INTO public.petition_types_v3 (category_id, nome, slug, descricao, icone, cor, ordem, field_schema) VALUES
  ((SELECT id FROM public.petition_categories WHERE slug = 'fazenda-publica-servidor'), 'Diferença Salarial Retroativa', 'diferenca-salarial', 'Cobrança de diferenças salariais retroativas', 'DollarSign', 'green', 1, '{"matricula": true, "periodo_retroativo": true, "cargo": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'fazenda-publica-servidor'), 'Promoção Funcional', 'promocao-funcional', 'Promoção de servidor por merecimento ou antiguidade', 'TrendingUp', 'teal', 2, '{"matricula": true, "cargo": true, "decreto": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'fazenda-publica-servidor'), 'Policial Militar', 'policial-militar', 'Ações específicas para policiais militares', 'Shield', 'zinc', 3, '{"matricula": true, "patente": true, "decreto": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'fazenda-publica-servidor'), 'Professor', 'professor', 'Ações em favor de professores da rede pública', 'GraduationCap', 'blue', 4, '{"matricula": true, "nivel": true, "periodo_retroativo": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'fazenda-publica-servidor'), 'Servidor SES / Estadual', 'servidor-ses', 'Ações de servidores da saúde e estaduais', 'Stethoscope', 'emerald', 5, '{"matricula": true, "orgao": true, "periodo_retroativo": true}');

-- Transporte Aéreo / Consumo
INSERT INTO public.petition_types_v3 (category_id, nome, slug, descricao, icone, cor, ordem, field_schema) VALUES
  ((SELECT id FROM public.petition_categories WHERE slug = 'transporte-aereo-consumo'), 'Cancelamento de Voo', 'cancelamento-voo', 'Cancelamento ou alteração unilateral de voo', 'PlaneTakeoff', 'sky', 1, '{"localizador": true, "data_voo": true, "origem_destino": true, "companhia": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'transporte-aereo-consumo'), 'Atraso de Voo', 'atraso-voo', 'Atraso superior a 4 horas', 'Clock', 'blue', 2, '{"localizador": true, "data_voo": true, "origem_destino": true, "tempo_atraso": true}'),
  ((SELECT id FROM public.petition_categories WHERE slug = 'transporte-aereo-consumo'), 'Danos Morais por Falha no Serviço', 'danos-morais-servico', 'Danos morais por falha na prestação do serviço', 'Frown', 'violet', 3, '{"descricao_falha": true, "data_ocorrencia": true}');
