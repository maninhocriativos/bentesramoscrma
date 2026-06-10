-- Adiciona 10 modelos de petição inicial bancária fornecidos pelo escritório:
-- venda casada INSS (Facta, C6, Inbursa, Paraná x2), venda casada Bradesco,
-- descontos indevidos, tarifa bancária e cartão consignado (RMC/RCC).

INSERT INTO public.action_types (slug, nome, descricao, icone, cor, ativo)
VALUES
  ('vendas_casadas', 'Venda Casada', 'Ações contra venda casada de seguros ou serviços vinculados a contratos bancários', 'ShoppingCart', 'pink', true),
  ('tarifa_bancaria', 'Tarifa Bancária', 'Ações de repetição de indébito por cobrança indevida de tarifas bancárias', 'CreditCard', 'cyan', true),
  ('descontos_indevidos', 'Descontos Indevidos', 'Ações contra descontos bancários ou associativos não reconhecidos', 'Receipt', 'orange', true),
  ('rmc_rcc', 'Cartão Consignado (RMC/RCC)', 'Ações sobre Reserva de Margem Consignável (RMC) e cartão de crédito consignado de benefício (RCC)', 'CreditCard', 'purple', true)
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  cor = EXCLUDED.cor,
  ativo = true,
  updated_at = now();

WITH model_rows AS (
  SELECT
    at.id AS action_type_id,
    v.nome,
    v.slug,
    v.descricao,
    v.tags,
    v.template_file_url,
    v.requires_contract_data,
    v.prompt_base
  FROM (
    VALUES
      (
        'vendas_casadas',
        'Venda Casada INSS - Facta Financeira',
        'venda-casada-inss-facta',
        'Petição inicial de venda casada (seguro/produto embutido) em empréstimo consignado de aposentado/pensionista do INSS - Banco Facta Financeira.',
        ARRAY['Bancário','INSS','Venda Casada','Facta']::text[],
        '/templates/venda-casada-inss-facta.docx',
        true,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'vendas_casadas',
        'Venda Casada INSS - C6 Consignado',
        'venda-casada-inss-c6-consignado',
        'Petição inicial de venda casada em empréstimo consignado de aposentado/pensionista do INSS - Banco C6 Consignado.',
        ARRAY['Bancário','INSS','Venda Casada','C6']::text[],
        '/templates/venda-casada-inss-c6-consignado.docx',
        true,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'vendas_casadas',
        'Venda Casada INSS - Banco Inbursa',
        'venda-casada-inss-inbursa',
        'Petição inicial de venda casada em empréstimo consignado de aposentado/pensionista do INSS - Banco Inbursa.',
        ARRAY['Bancário','INSS','Venda Casada','Inbursa']::text[],
        '/templates/venda-casada-inss-inbursa.docx',
        true,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'vendas_casadas',
        'Venda Casada INSS - Paraná Banco',
        'venda-casada-inss-parana-banco',
        'Petição inicial de venda casada em empréstimo consignado de aposentado/pensionista do INSS - Paraná Banco.',
        ARRAY['Bancário','INSS','Venda Casada','Paraná Banco']::text[],
        '/templates/venda-casada-inss-parana-banco.docx',
        true,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'vendas_casadas',
        'Venda Casada INSS - Paraná Banco (modelo 2)',
        'venda-casada-inss-parana-banco-2',
        'Segundo modelo de petição inicial de venda casada em empréstimo consignado INSS - Paraná Banco.',
        ARRAY['Bancário','INSS','Venda Casada','Paraná Banco']::text[],
        '/templates/venda-casada-inss-parana-banco-2.docx',
        true,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'vendas_casadas',
        'Venda Casada - Bradesco',
        'venda-casada-bradesco-vanilza',
        'Petição inicial de venda casada em contrato bancário - Banco Bradesco.',
        ARRAY['Bancário','Bradesco','Venda Casada']::text[],
        '/templates/venda-casada-bradesco.docx',
        true,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'descontos_indevidos',
        'Descontos Indevidos em Conta Bancária',
        'descontos-indevidos-conta-bancaria',
        'Petição inicial contra descontos indevidos lançados em conta bancária.',
        ARRAY['Bancário','Descontos Indevidos','Conta Bancária']::text[],
        '/templates/descontos-indevidos-conta-bancaria.docx',
        false,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'tarifa_bancaria',
        'Tarifa Bancária em Conta',
        'tarifa-bancaria-conta',
        'Petição inicial de repetição de indébito por cobrança de tarifas bancárias em conta.',
        ARRAY['Bancário','Tarifa Bancária','Conta Bancária']::text[],
        '/templates/tarifa-bancaria-conta.docx',
        false,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'rmc_rcc',
        'Cartão de Crédito Consignado - RMC',
        'cartao-consignado-rmc',
        'Petição inicial referente a empréstimo no cartão de crédito consignado - Reserva de Margem Consignável (RMC).',
        ARRAY['Bancário','RMC','Cartão Consignado']::text[],
        '/templates/cartao-consignado-rmc.docx',
        true,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'rmc_rcc',
        'Cartão de Crédito Consignado - RCC',
        'cartao-consignado-rcc',
        'Petição inicial referente a empréstimo no cartão de crédito consignado de benefício (RCC).',
        ARRAY['Bancário','RCC','Cartão Consignado']::text[],
        '/templates/cartao-consignado-rcc.docx',
        true,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      )
  ) AS v(action_slug, nome, slug, descricao, tags, template_file_url, requires_contract_data, prompt_base)
  JOIN public.action_types at ON at.slug = v.action_slug
)
INSERT INTO public.petition_models_v2 (
  action_type_id,
  nome,
  slug,
  descricao,
  tags,
  template_file_url,
  is_active,
  is_default,
  requires_bank_data,
  requires_financial_data,
  requires_contract_data,
  requires_special_requests,
  prompt_base,
  field_schema_json,
  version
)
SELECT
  action_type_id,
  nome,
  slug,
  descricao,
  tags,
  template_file_url,
  true,
  false,
  true,
  true,
  requires_contract_data,
  false,
  prompt_base,
  '{}'::jsonb,
  '1.0'
FROM model_rows
ON CONFLICT (slug) DO UPDATE SET
  action_type_id = EXCLUDED.action_type_id,
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  tags = EXCLUDED.tags,
  template_file_url = EXCLUDED.template_file_url,
  is_active = true,
  is_default = false,
  requires_bank_data = EXCLUDED.requires_bank_data,
  requires_financial_data = EXCLUDED.requires_financial_data,
  requires_contract_data = EXCLUDED.requires_contract_data,
  requires_special_requests = EXCLUDED.requires_special_requests,
  prompt_base = EXCLUDED.prompt_base,
  field_schema_json = EXCLUDED.field_schema_json,
  version = EXCLUDED.version,
  updated_at = now();
