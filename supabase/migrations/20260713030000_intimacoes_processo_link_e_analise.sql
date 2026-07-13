-- Suporte a: (1) vinculo persistido entre intimacao e processo (hoje some ao
-- fechar o modal, so vive em estado local do React); (2) cache da analise de
-- IA (resumo/recomendacao/acoes) pra nao depender de clique manual toda vez.
alter table public.intimacoes
  add column if not exists processo_id uuid references public.processos(id) on delete set null,
  add column if not exists analise_ia jsonb,
  add column if not exists analisado_em timestamptz;

create index if not exists intimacoes_processo_id_idx on public.intimacoes(processo_id);

-- Backfill gratuito (so casamento de CNJ, sem custo de IA): vincula as
-- intimacoes cujo processo ja existe no cadastro.
update public.intimacoes i
set processo_id = p.id
from public.processos p
where i.processo_id is null
  and i.processo_cnj is not null
  and regexp_replace(i.processo_cnj, '\D', '', 'g') = p.cnj_normalizado;
