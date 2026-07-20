-- Registra os 3 primeiros modelos novos de peticao inicial (retemplatizados
-- com marcadores {{}} a partir de peticoes reais, PII removido). Os modelos
-- antigos equivalentes (cartao-consignado-rcc, cartao-consignado-rmc) ja
-- foram desativados em 2026-07-19 e permanecem no banco so como historico.

INSERT INTO public.petition_models_v2
  (action_type_id, nome, slug, descricao, tags, template_file_url, is_active, is_default,
   requires_bank_data, requires_financial_data, requires_contract_data, requires_special_requests,
   print_slots_json)
VALUES
  (
    '4d90f91a-45fd-4e0f-96e7-fee6f468aaf7',
    'Cartão de Crédito Consignado - RCC (INSS)',
    'cartao-rcc-inss',
    'Petição inicial referente a desconto indevido de RCC (Reserva de Cartão Consignado) no benefício INSS.',
    ARRAY['Bancário', 'RCC', 'Cartão Consignado', 'INSS'],
    '/templates/cartao-rcc-inss.docx',
    true, false, true, true, true, false,
    '[
      {"label": "Extrato INSS - Histórico de Créditos", "media_target": "media/image1.png"},
      {"label": "Planilha de Cálculo dos Descontos", "media_target": "media/image2.png"}
    ]'::jsonb
  ),
  (
    '4d90f91a-45fd-4e0f-96e7-fee6f468aaf7',
    'Cartão de Crédito Consignado - RMC (INSS)',
    'cartao-rmc-inss',
    'Petição inicial referente a desconto indevido de RMC (Reserva de Margem Consignável) no benefício INSS.',
    ARRAY['Bancário', 'RMC', 'Cartão Consignado', 'INSS'],
    '/templates/cartao-rmc-inss.docx',
    true, false, true, true, true, false,
    '[
      {"label": "Extrato INSS - Histórico de Créditos", "media_target": "media/image1.png"},
      {"label": "Planilha de Cálculo dos Descontos", "media_target": "media/image2.png"}
    ]'::jsonb
  ),
  (
    'eae7953c-6a23-4a20-b9b5-35918fd6e050',
    'Seguro Prestamista - Cancelamento de Apólice (SUSEP)',
    'seguro-susep-apolice',
    'Petição inicial contra seguradora para cancelamento de apólice de seguro prestamista vendido casado a empréstimo consignado, com exibição de documentos via SUSEP.',
    ARRAY['Seguro', 'SUSEP', 'Apólice', 'Venda Casada'],
    '/templates/seguro-susep-apolice.docx',
    true, false, true, true, false, false,
    '[
      {"label": "Consulta SUSEP - Apólices de Seguro", "media_target": "media/image1.png"}
    ]'::jsonb
  );
