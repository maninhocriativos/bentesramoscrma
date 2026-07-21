-- Quarto modelo novo de peticao inicial retemplatizado: venda casada em
-- emprestimo consignado CLT contra o Banco PAN (single-contrato).

INSERT INTO public.petition_models_v2
  (action_type_id, nome, slug, descricao, tags, template_file_url, is_active, is_default,
   requires_bank_data, requires_financial_data, requires_contract_data, requires_special_requests,
   print_slots_json)
VALUES
  (
    '759f61dd-0c8d-4cf4-beb7-b66a59e0946d',
    'Venda Casada (CLT) - Banco PAN',
    'venda-casada-clt-pan',
    'Petição inicial de venda casada (seguro/produto embutido) em empréstimo consignado CLT - Banco PAN.',
    ARRAY['Bancário', 'CLT', 'Venda Casada', 'Banco PAN'],
    '/templates/venda-casada-clt-pan.docx',
    true, false, true, true, true, false,
    '[
      {"label": "CCB - Cédula de Crédito Bancário (Demonstrativo CET)", "media_target": "media/image1.png"}
    ]'::jsonb
  );
