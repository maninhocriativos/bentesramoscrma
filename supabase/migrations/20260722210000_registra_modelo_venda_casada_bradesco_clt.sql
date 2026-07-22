-- Sexto modelo novo: venda casada em emprestimo consignado de servidor
-- publico contra o Bradesco, com DOIS contratos e prioridade de tramitacao
-- por idoso (campos idade_numerica/idade_extenso/idade_min_extenso).

INSERT INTO public.petition_models_v2
  (action_type_id, nome, slug, descricao, tags, template_file_url, is_active, is_default,
   requires_bank_data, requires_financial_data, requires_contract_data, requires_special_requests,
   print_slots_json)
VALUES
  (
    '759f61dd-0c8d-4cf4-beb7-b66a59e0946d',
    'Venda Casada (CLT/Servidor Público) - Bradesco (2 contratos)',
    'venda-casada-clt-bradesco',
    'Petição inicial de venda casada (seguro proteção financeira embutido) em DOIS empréstimos consignados de servidor público - Bradesco, com pedido de prioridade de tramitação por idoso.',
    ARRAY['Bancário', 'CLT', 'Servidor Público', 'Venda Casada', 'Bradesco', 'Idoso', 'Múltiplos Contratos'],
    '/templates/venda-casada-clt-bradesco.docx',
    true, false, true, true, true, false,
    '[
      {"label": "CCB - Contrato 1", "media_target": "media/image1.png"},
      {"label": "CCB - Contrato 2", "media_target": "media/image2.png"}
    ]'::jsonb
  );
