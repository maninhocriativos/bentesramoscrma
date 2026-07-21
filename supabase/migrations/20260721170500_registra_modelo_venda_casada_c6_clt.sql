-- Quinto modelo novo: venda casada CLT contra Banco C6 Consignado, com DOIS
-- contratos de empréstimo (campos numerados _1/_2 no template).

INSERT INTO public.petition_models_v2
  (action_type_id, nome, slug, descricao, tags, template_file_url, is_active, is_default,
   requires_bank_data, requires_financial_data, requires_contract_data, requires_special_requests,
   print_slots_json)
VALUES
  (
    '759f61dd-0c8d-4cf4-beb7-b66a59e0946d',
    'Venda Casada (CLT) - Banco C6 Consignado (2 contratos)',
    'venda-casada-clt-c6',
    'Petição inicial de venda casada (seguro embutido) em DOIS empréstimos consignados CLT - Banco C6 Consignado.',
    ARRAY['Bancário', 'CLT', 'Venda Casada', 'C6 Consignado', 'Múltiplos Contratos'],
    '/templates/venda-casada-clt-c6.docx',
    true, false, true, true, true, false,
    '[
      {"label": "CCB - Contrato 1", "media_target": "media/image1.png"},
      {"label": "CCB - Contrato 2", "media_target": "media/image2.png"}
    ]'::jsonb
  );
