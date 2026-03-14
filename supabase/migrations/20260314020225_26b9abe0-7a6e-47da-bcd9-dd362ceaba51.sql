
-- Insert petition models based on existing templates
INSERT INTO public.petition_models_v2 (action_type_id, nome, slug, descricao, tags, template_file_url, requires_bank_data, requires_financial_data, prompt_base) VALUES
-- Cancelamento de Voo
('6a67a379-2df7-4ddb-bd9a-eda7a22a3e1a', 'Cancelamento de Voo – Geral', 'cancelamento-voo-geral', 'Ação de Reparação por Danos Morais por cancelamento/atraso de voo', ARRAY['Aéreo','Juizado Especial','Danos Morais'], '/templates/cancelamento-voo.docx', false, false, 'Use o modelo jurídico selecionado como estrutura obrigatória. Preserve timbrado, organização, diagramação.'),
('6a67a379-2df7-4ddb-bd9a-eda7a22a3e1a', 'Cancelamento de Voo – Avianca', 'cancelamento-voo-avianca', 'Ação de Indenização por Danos Morais - Avianca', ARRAY['Aéreo','Avianca','Juizado Especial'], '/templates/cancelamento-voo-avianca.docx', false, false, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),

-- Diferença Salarial
('9eb478d0-52e2-42d3-8e59-63ec8a06638d', 'Diferença Salarial – Professor', 'diferenca-salarial-professor', 'Ação de Cobrança de Salário Retroativo de professor estadual', ARRAY['Professor','Fazenda Pública','Juizado Especial'], '/templates/diferenca-salarial-professor.docx', false, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),

-- Empréstimo Fraudulento
('7df3b780-8a8d-42f4-8f71-4bbd62935b75', 'Empréstimo Fraudulento – INSS', 'emprestimo-fraudulento-inss', 'Empréstimo consignado fraudulento em benefício INSS (idoso)', ARRAY['INSS','Idoso','Consignado Fraudulento'], '/templates/emprestimo-fraudulento-inss.docx', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),

-- Empréstimo Não Reconhecido
('94451c62-b13d-4be0-a626-7aea4f8378d8', 'Servidor Público – Empréstimo Não Reconhecido', 'servidor-publico-emprestimo', 'Desconto em folha não autorizado (servidor público)', ARRAY['Servidor Público','Matrícula','Desconto em Folha'], '/templates/servidor-publico-emprestimo-nao-reconhecido.docx', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),
('94451c62-b13d-4be0-a626-7aea4f8378d8', 'Servidor Aposentado Idoso', 'servidor-aposentado-idoso', 'Servidor aposentado idoso com pedido de tramitação preferencial', ARRAY['Servidor Aposentado','Idoso','Tramitação Preferencial'], '/templates/servidor-aposentado-idoso-emprestimo.docx', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),

-- Renovação Empréstimo
('043415ff-ae44-4dad-bbbd-92ac070c2a57', 'Renovação Fraudulenta – INSS', 'renovacao-emprestimo-inss', 'Renovação não autorizada de empréstimo consignado INSS', ARRAY['INSS','Idoso','Renovação Não Autorizada'], '/templates/renovacao-emprestimo-fraudulento-inss.docx', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),

-- Revisão Contrato
('f555b76a-e9cd-4b7f-b10e-0898bea31168', 'Revisão de Contrato – Crefisa', 'revisao-contrato-crefisa', 'Revisão contratual com pedido de nulidade de cláusulas abusivas', ARRAY['Crefisa','Cláusulas Abusivas','Repetição de Indébito'], '/templates/revisao-contrato-emprestimo-crefisa.doc', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),

-- RMC/RCC
('04ba8527-72eb-4795-8af1-0e376e3c158f', 'RMC – Idoso INSS', 'rmc-idoso-inss', 'Reserva de Margem Consignável não autorizada (idoso)', ARRAY['INSS','Idoso','RMC','Tramitação Preferencial'], '/templates/idoso-inss-rmc.docx', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),

-- Seguro Não Contratado
('32467fb8-b18c-4632-a93b-eeaffc9a04d1', 'Seguro Não Contratado', 'seguro-nao-contratado', 'Seguro Mais Proteção não contratado', ARRAY['Seguro','Policial Militar','Repetição de Indébito'], '/templates/seguro-nao-contratado.doc', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),

-- Tarifa Bancária
('b1ea0730-65cc-4033-8779-00e4bbcfcaee', 'Tarifa Bancária Indevida', 'tarifa-bancaria-indevida', 'Cobrança indevida de tarifas bancárias', ARRAY['Tarifa','Repetição de Indébito','Tutela de Urgência'], '/templates/tarifa-bancaria.doc', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),

-- Vendas Casadas
('f16ea10c-9586-4ea7-bda1-4ebfd986d65c', 'Venda Casada – INSS (Idoso)', 'venda-casada-inss', 'Seguro vinculado a empréstimo consignado INSS', ARRAY['INSS','Idoso','Seguro Vinculado'], '/templates/venda-casada-inss.doc', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),
('f16ea10c-9586-4ea7-bda1-4ebfd986d65c', 'Venda Casada – Geral', 'venda-casada-geral', 'Seguro vinculado a empréstimo consignado', ARRAY['Servidor Público','Seguro Vinculado'], '/templates/venda-casada.doc', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),
('f16ea10c-9586-4ea7-bda1-4ebfd986d65c', 'Venda Casada – Financiamento Veículo', 'venda-casada-financiamento-veiculo', 'Seguro vinculado a financiamento de veículo', ARRAY['Financiamento','Veículo','Seguro Vinculado'], '/templates/venda-casada-financiamento-veiculo.docx', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),
('f16ea10c-9586-4ea7-bda1-4ebfd986d65c', 'Venda Casada – CEF (Idoso)', 'venda-casada-cef-idoso', 'Venda casada CEF com tramitação preferencial (idoso)', ARRAY['CEF','Idoso','Tramitação Preferencial','Justiça Federal'], '/templates/venda-casada-cef-idoso.docx', true, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),

-- Promoção Servidor
('e474640b-8889-4084-b76a-51eda6c6bc6f', 'Promoção – Policial Militar', 'promocao-policial-militar', 'Promoção de Policial Militar (Turma 2005)', ARRAY['Policial Militar','Fazenda Pública','Diferença Salarial'], '/templates/promocao-policial-militar.docx', false, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.'),
('e474640b-8889-4084-b76a-51eda6c6bc6f', 'Promoção – Servidor SES (Idoso)', 'promocao-servidor-ses-idoso', 'Servidor SES com tramitação preferencial (idoso)', ARRAY['Servidor Público','SES','Idoso','Tramitação Preferencial'], '/templates/promocao-servidor-ses-idoso.docx', false, true, 'Use o modelo jurídico selecionado como estrutura obrigatória.');
