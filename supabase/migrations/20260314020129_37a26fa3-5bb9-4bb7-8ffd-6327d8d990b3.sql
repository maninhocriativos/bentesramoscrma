
-- Drop old petition tables if they exist (clean slate)
DROP TABLE IF EXISTS petition_audit_log CASCADE;
DROP TABLE IF EXISTS petition_documents CASCADE;
DROP TABLE IF EXISTS petition_versions CASCADE;
DROP TABLE IF EXISTS petitions CASCADE;
DROP TABLE IF EXISTS petition_models CASCADE;
DROP TABLE IF EXISTS petition_model_chunks CASCADE;
DROP TABLE IF EXISTS petition_types CASCADE;
DROP TABLE IF EXISTS action_types CASCADE;

-- 1. Action Types (categories of legal actions)
CREATE TABLE public.action_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nome text NOT NULL,
  descricao text,
  icone text DEFAULT 'FileText',
  cor text DEFAULT 'slate',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.action_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view action_types" ON public.action_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage action_types" ON public.action_types
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'Administrador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Administrador'::app_role));

-- 2. Petition Models (templates within each action type)
CREATE TABLE public.petition_models_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id uuid REFERENCES public.action_types(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  slug text UNIQUE NOT NULL,
  descricao text,
  tags text[] DEFAULT '{}',
  template_file_url text,
  preview_image_url text,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  requires_bank_data boolean DEFAULT true,
  requires_financial_data boolean DEFAULT true,
  requires_contract_data boolean DEFAULT false,
  requires_special_requests boolean DEFAULT false,
  prompt_base text,
  field_schema_json jsonb DEFAULT '{}',
  version text DEFAULT '1.0',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.petition_models_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view petition_models_v2" ON public.petition_models_v2
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage petition_models_v2" ON public.petition_models_v2
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'Administrador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Administrador'::app_role));

-- 3. Petitions (actual petitions created by users)
CREATE TABLE public.petitions_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id uuid REFERENCES public.action_types(id),
  model_id uuid REFERENCES public.petition_models_v2(id),
  cliente_id uuid REFERENCES public.leads_juridicos(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'generated', 'filed', 'archived')),
  form_data_json jsonb DEFAULT '{}',
  generated_text_json jsonb DEFAULT '{}',
  generated_docx_url text,
  generated_pdf_url text,
  current_step integer DEFAULT 1,
  include_procuracao boolean DEFAULT false,
  include_hipossuficiencia boolean DEFAULT false,
  include_honorarios boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.petitions_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view petitions_v2" ON public.petitions_v2
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert petitions_v2" ON public.petitions_v2
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update petitions_v2" ON public.petitions_v2
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete petitions_v2" ON public.petitions_v2
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'Administrador'::app_role));

-- 4. Petition Versions (version history)
CREATE TABLE public.petition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  petition_id uuid REFERENCES public.petitions_v2(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  form_data_json jsonb DEFAULT '{}',
  generated_docx_url text,
  generated_pdf_url text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.petition_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view petition_versions" ON public.petition_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert petition_versions" ON public.petition_versions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Insert seed data for action types
INSERT INTO public.action_types (slug, nome, descricao, icone, cor) VALUES
  ('cancelamento_voo', 'Cancelamento de Voo', 'Ações contra companhias aéreas por cancelamento, atraso ou overbooking', 'Plane', 'sky'),
  ('cobranca_pacote_bancario', 'Cobrança de Pacote Bancário', 'Ações contra cobrança indevida de pacotes de serviços bancários', 'CreditCard', 'blue'),
  ('diferenca_salarial', 'Diferença Salarial Retroativa', 'Ações de cobrança de diferenças salariais retroativas', 'TrendingUp', 'lime'),
  ('emprestimo_fraudulento', 'Empréstimo Fraudulento', 'Ações contra empréstimos consignados fraudulentos', 'AlertTriangle', 'red'),
  ('emprestimo_nao_reconhecido', 'Empréstimo Não Reconhecido', 'Ações declaratórias de inexistência de débito por empréstimo não reconhecido', 'Ban', 'emerald'),
  ('juros_abusivos', 'Juros Abusivos', 'Ações contra cobrança de juros acima do permitido por lei', 'TrendingUp', 'rose'),
  ('negativacao_indevida', 'Negativação Indevida', 'Ações contra inscrição indevida em cadastros restritivos', 'AlertTriangle', 'violet'),
  ('servidor_publico_promocao', 'Promoção de Servidor Público', 'Ações de obrigação de fazer para promoção funcional', 'TrendingUp', 'teal'),
  ('renovacao_emprestimo', 'Renovação de Empréstimo Fraudulento', 'Ações contra renovação não autorizada de empréstimo consignado', 'AlertTriangle', 'fuchsia'),
  ('revisao_contrato_emprestimo', 'Revisão de Contrato de Empréstimo', 'Ações de revisão contratual com pedido de nulidade de cláusulas abusivas', 'FileText', 'slate'),
  ('rmc_rcc', 'RMC / RCC', 'Ações contra Reserva de Margem Consignável ou Cartão de Crédito Consignado não autorizado', 'CreditCard', 'amber'),
  ('seguro_nao_contratado', 'Seguro Não Contratado', 'Ações declaratórias de inexistência de débito por seguro não contratado', 'Package', 'orange'),
  ('tarifa_bancaria', 'Tarifa Bancária', 'Ações de repetição de indébito por cobrança indevida de tarifas', 'CreditCard', 'cyan'),
  ('vendas_casadas', 'Vendas Casadas', 'Ações contra venda casada de seguros e produtos vinculados a empréstimos', 'ShoppingCart', 'pink');
