-- Campo para o grafico "Idade dos Clientes" no Painel de Dados.
-- Segue o mesmo padrao de nome_cliente/cpf_cliente/categoria_beneficiario:
-- dado do cliente capturado no cadastro do PROCESSO (ProcessoModalExpanded),
-- nao em leads_juridicos. Nao existe fonte automatica (DJEN/DataJud nao expoe
-- data de nascimento por privacidade) — precisa ser preenchido manualmente.
alter table public.processos add column if not exists data_nascimento_cliente date;
