-- Campo estruturado do perfil do beneficiário no processo
-- (Servidor Público / Aposentado / Pensionista / Outro).
-- Substitui a derivação frágil por texto livre da profissão do lead.
alter table processos add column if not exists categoria_beneficiario text;

-- Limpeza pontual do tipo_acao dos leads (normalização de caixa/acento + typo).
-- Aplicada uma vez sobre os dados existentes; inofensiva em base nova.
update leads_juridicos set tipo_acao = 'Consumidor'  where lower(trim(tipo_acao)) in ('cosumidor','consumidor');
update leads_juridicos set tipo_acao = 'Bancário'    where lower(trim(tipo_acao)) in ('bancario','bancário');
update leads_juridicos set tipo_acao = 'Trabalhista' where lower(trim(tipo_acao)) in ('trabalhista');
update leads_juridicos set tipo_acao = 'Cível'       where lower(trim(tipo_acao)) in ('civel','cível','civil');
