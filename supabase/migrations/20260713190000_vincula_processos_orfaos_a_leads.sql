-- Vincula processos sem cliente_id a um lead, de forma precisa e sem apagar
-- nada. leads_juridicos.cpf esta 100% vazio hoje, entao o casamento por CPF
-- direto contra leads nao funciona (ja tentamos, 0 matches) — o criterio
-- disponivel e nome do cliente (processos.nome_cliente).
--
-- Passo 1: vincula so quando o nome normalizado bate com EXATAMENTE UM lead
-- (sem ambiguidade — nomes duplicados entre leads ficam de fora, para nao
-- arriscar vincular ao cliente errado).
--
-- Passo 2: para o restante (nenhum lead com esse nome existe), cria um lead
-- novo a partir dos proprios dados do processo (nome + CPF, quando valido).
-- Sao clientes reais — o processo ja existe e esta em andamento — que nunca
-- passaram pelo funil de leads. status = 'Contrato Assinado' (mesmo status
-- predominante entre os leads ja vinculados a processos), nao 'Lead Frio'
-- (padrao da tabela), para nao poluir metricas de funil comercial.

with sem_link as (
  select id, upper(trim(regexp_replace(nome_cliente, '\s+', ' ', 'g'))) as nome_norm
  from processos
  where cliente_id is null and nome_cliente is not null and nome_cliente <> ''
),
leads_norm as (
  select id, upper(trim(regexp_replace(nome, '\s+', ' ', 'g'))) as nome_norm,
         count(*) over (partition by upper(trim(regexp_replace(nome, '\s+', ' ', 'g')))) as dup_count
  from leads_juridicos
  where nome is not null and nome <> ''
)
update processos p
set cliente_id = l.id
from sem_link s
join leads_norm l on l.nome_norm = s.nome_norm and l.dup_count = 1
where p.id = s.id;

with orfaos as (
  select p.id as processo_id, p.nome_cliente, p.cpf_cliente,
         upper(trim(regexp_replace(p.nome_cliente, '\s+', ' ', 'g'))) as nome_norm
  from processos p
  where p.cliente_id is null and p.nome_cliente is not null and p.nome_cliente <> ''
    and not exists (
      select 1 from leads_juridicos l
      where upper(trim(regexp_replace(l.nome, '\s+', ' ', 'g'))) = upper(trim(regexp_replace(p.nome_cliente, '\s+', ' ', 'g')))
    )
),
novos_leads as (
  insert into leads_juridicos (nome, cpf, status, origem, canal_origem, tipo_origem)
  select distinct on (nome_norm)
    nome_cliente,
    case when cpf_cliente is not null and length(regexp_replace(cpf_cliente, '\D', '', 'g')) = 11
         then regexp_replace(cpf_cliente, '\D', '', 'g') else null end,
    'Contrato Assinado',
    'Processo Existente',
    'backfill_processo_2026_07_13',
    'escritorio'
  from orfaos
  returning id, nome
)
update processos p
set cliente_id = nl.id
from orfaos o
join novos_leads nl on upper(trim(regexp_replace(nl.nome, '\s+', ' ', 'g'))) = o.nome_norm
where p.id = o.processo_id;
