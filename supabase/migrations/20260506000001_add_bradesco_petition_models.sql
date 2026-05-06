-- Add five Bradesco petition templates provided by the office.

INSERT INTO public.action_types (slug, nome, descricao, icone, cor, ativo)
VALUES
  ('vendas_casadas', 'Venda Casada', 'Ações contra venda casada de seguros ou serviços vinculados a contratos bancários', 'ShoppingCart', 'pink', true),
  ('tarifa_bancaria', 'Tarifa Bancária', 'Ações de repetição de indébito por cobrança indevida de tarifas bancárias', 'CreditCard', 'cyan', true),
  ('descontos_indevidos', 'Descontos Indevidos', 'Ações contra descontos bancários ou associativos não reconhecidos', 'Receipt', 'orange', true)
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
        'Venda Casada - Bradesco (Anderson)',
        'venda-casada-bradesco-anderson',
        'Modelo inicial Bradesco para venda casada em contrato bancário.',
        ARRAY['Bancário','Bradesco','Venda Casada']::text[],
        '/templates/venda-casada-bradesco-anderson.docx',
        true,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'tarifa_bancaria',
        'Tarifa Bancária - Bradesco (Andrea)',
        'tarifa-bancaria-bradesco-andrea',
        'Modelo inicial Bradesco para cobrança indevida de tarifa bancária.',
        ARRAY['Bancário','Bradesco','Tarifa Bancária']::text[],
        '/templates/tarifa-bancaria-bradesco-andrea.docx',
        false,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'descontos_indevidos',
        'Descontos Indevidos - Bradesco (Edite)',
        'descontos-indevidos-bradesco-edite',
        'Modelo inicial Bradesco para descontos indevidos em conta ou benefício.',
        ARRAY['Bancário','Bradesco','Descontos Indevidos']::text[],
        '/templates/descontos-indevidos-bradesco-edite.docx',
        false,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'descontos_indevidos',
        'Descontos Indevidos - Bradesco e APEAM (Paulo)',
        'descontos-indevidos-bradesco-apeam-paulo',
        'Modelo inicial contra Bradesco e associação APEAM para descontos indevidos.',
        ARRAY['Bancário','Bradesco','APEAM','Descontos Indevidos']::text[],
        '/templates/descontos-indevidos-bradesco-apeam-paulo.docx',
        false,
        'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, qualificação das partes, pedidos e fundamentos. Substitua somente os marcadores do template com os dados informados.'
      ),
      (
        'descontos_indevidos',
        'Descontos Indevidos - Bradesco e APEAM (Paulo V2)',
        'descontos-indevidos-bradesco-apeam-paulo-v2',
        'Segunda versão do modelo contra Bradesco e associação APEAM para descontos indevidos.',
        ARRAY['Bancário','Bradesco','APEAM','Descontos Indevidos']::text[],
        '/templates/descontos-indevidos-bradesco-apeam-paulo-v2.docx',
        false,
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
