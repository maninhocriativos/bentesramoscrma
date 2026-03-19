
-- Update categories and markers for all 17 models
UPDATE modelos_peticao SET categoria = 'Bancário', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Venda Casada — Banco Santander%';
UPDATE modelos_peticao SET categoria = 'Bancário', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Tarifa Bancária%';
UPDATE modelos_peticao SET categoria = 'Bancário', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Seguro Não Contratado%';
UPDATE modelos_peticao SET categoria = 'Bancário', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Caixa Econômica%';
UPDATE modelos_peticao SET categoria = 'Bancário', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Financiamento Veículo%';
UPDATE modelos_peticao SET categoria = 'Bancário', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Crefisa%';
UPDATE modelos_peticao SET categoria = 'INSS', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","IDOSO_IDADE","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Fraudulento — INSS%';
UPDATE modelos_peticao SET categoria = 'INSS', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","IDOSO_IDADE","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Renovação%';
UPDATE modelos_peticao SET categoria = 'INSS', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","IDOSO_IDADE","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Facta%';
UPDATE modelos_peticao SET categoria = 'INSS', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","IDOSO_IDADE","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Idoso INSS%';
UPDATE modelos_peticao SET categoria = 'INSS', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","IDOSO_IDADE","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Servidor Aposentado%';
UPDATE modelos_peticao SET categoria = 'Servidor Público', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG_MILITAR","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Policial Militar%';
UPDATE modelos_peticao SET categoria = 'Servidor Público', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Diferença Salarial%';
UPDATE modelos_peticao SET categoria = 'Servidor Público', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Promoção — SES%';
UPDATE modelos_peticao SET categoria = 'Servidor Público', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Daycoval%';
UPDATE modelos_peticao SET categoria = 'Aviação', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Azul%';
UPDATE modelos_peticao SET categoria = 'Aviação', marcadores = '["NOME_COMPLETO","QUALIFICACAO","RG","CPF","ENDERECO_CLIENTE","VARA_JUIZO","COMARCA","REU_NOME","REU_CNPJ","REU_ENDERECO","TIPO_ACAO","INFORMACOES_ADICIONAIS"]'::jsonb WHERE nome LIKE '%Avianca%';

-- Also update names to match user's exact naming
UPDATE modelos_peticao SET nome = 'Venda Casada – Banco Santander (Parintins)' WHERE nome LIKE '%Venda Casada — Banco Santander%';
UPDATE modelos_peticao SET nome = 'Tarifa Bancária – Banco Bradesco' WHERE nome LIKE '%Tarifa Bancária%';
UPDATE modelos_peticao SET nome = 'Seguro Não Contratado – Banco Bradesco (Fonte Boa)' WHERE nome LIKE '%Seguro Não Contratado%';
UPDATE modelos_peticao SET nome = 'Venda Casada – Caixa Econômica Federal' WHERE nome LIKE '%Caixa Econômica%';
UPDATE modelos_peticao SET nome = 'Venda Casada Financiamento Veículo – Banco Votorantim' WHERE nome LIKE '%Financiamento Veículo%';
UPDATE modelos_peticao SET nome = 'Revisão de Contrato – Crefisa' WHERE nome LIKE '%Crefisa%';
UPDATE modelos_peticao SET nome = 'Empréstimo Fraudulento INSS – Itaú Consignado' WHERE nome LIKE '%Fraudulento — INSS%';
UPDATE modelos_peticao SET nome = 'Renovação Fraudulenta INSS – Itaú Consignado' WHERE nome LIKE '%Renovação%';
UPDATE modelos_peticao SET nome = 'Venda Casada INSS – Facta Financeira' WHERE nome LIKE '%Facta%';
UPDATE modelos_peticao SET nome = 'Empréstimo RMC – Banco Santander (Idoso INSS)' WHERE nome LIKE '%Idoso INSS%';
UPDATE modelos_peticao SET nome = 'Empréstimo Servidor Aposentado Idoso – Banco Industrial' WHERE nome LIKE '%Servidor Aposentado%';
UPDATE modelos_peticao SET nome = 'Promoção Policial Militar – Estado AM' WHERE nome LIKE '%Policial Militar%';
UPDATE modelos_peticao SET nome = 'Diferença Salarial – Professor – Estado AM' WHERE nome LIKE '%Diferença Salarial%';
UPDATE modelos_peticao SET nome = 'Promoção SES – Estado AM' WHERE nome LIKE '%Promoção — SES%';
UPDATE modelos_peticao SET nome = 'Empréstimo Servidor Público – Banco Daycoval' WHERE nome LIKE '%Daycoval%';
UPDATE modelos_peticao SET nome = 'Cancelamento de Voo – Azul' WHERE nome LIKE '%Azul%';
UPDATE modelos_peticao SET nome = 'Cancelamento de Voo – Avianca' WHERE nome LIKE '%Avianca%';
