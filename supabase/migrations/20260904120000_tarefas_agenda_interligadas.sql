-- =============================================================================
-- Tarefas <-> Agenda interligadas + múltiplos responsáveis + link de audiência
-- + busca de processo por número sem pontuação
-- =============================================================================
--
-- Pedido do usuário (2026-09-04): no modal do processo / página de Tarefas /
-- Agenda não dava pra escolher mais de um responsável, não tinha campo pro
-- link da audiência virtual, e o que era criado numa tela não aparecia na
-- outra. Além disso a busca por número de processo só funcionava com a
-- pontuação exata do CNJ (0000000-00.0000.0.00.0000).
--
-- 1. `responsaveis_ids uuid[]` em tarefas e compromissos. `responsavel_id`
--    continua existindo como "responsável principal" (= primeiro do array),
--    mantido em sincronia por trigger nos dois sentidos — assim todo código
--    antigo (edge functions, relatórios, RLS de compromissos) continua
--    funcionando sem alteração, e o código novo lê o array.
-- 2. `tarefas.tipo` (Reunião/Audiência/Prazo/Tarefa/Outro — mesmo vocabulário
--    de compromissos.tipo) e `compromissos.link_audiencia`, pra os dois lados
--    terem os mesmos campos e a sincronização ser 1:1.
-- 3. Sincronização bidirecional por trigger (não código de aplicação, pra
--    valer pra qualquer tela que crie/edite hoje ou no futuro):
--      tarefa  -> compromisso: insert E update (antes só insert; editar prazo
--                  ou título da tarefa não refletia na Agenda). Tarefa que
--                  ganha prazo depois passa a aparecer; que perde prazo sai;
--                  cancelada marca o compromisso como cancelado.
--      compromisso -> tarefa: compromisso criado pela tela da Agenda
--                  (origem = 'agenda') vira tarefa; editar/cancelar/excluir
--                  na Agenda reflete na tarefa.
--    Guarda anti-loop via set_config('app.sync_origem') transacional.
-- 4. `processos.numero_processo_digits` — coluna GERADA só com os dígitos do
--    número, pra buscar "70491919220268220001" ou "7049191" sem pontuação.
--    NÃO reaproveita `cnj_normalizado` porque essa tem índice UNIQUE e a
--    semântica "só quando tem 20 dígitos" (chave de dedupe do DataJud).
-- =============================================================================

-- ─── 1. Colunas ──────────────────────────────────────────────────────────────

alter table public.tarefas
  add column if not exists responsaveis_ids uuid[] not null default '{}',
  add column if not exists tipo text not null default 'Tarefa';

alter table public.compromissos
  add column if not exists responsaveis_ids uuid[] not null default '{}',
  add column if not exists link_audiencia text;

comment on column public.tarefas.responsaveis_ids is 'Todos os responsáveis pela tarefa. responsavel_id = o primeiro deles (mantido por trigger, compat com código antigo).';
comment on column public.tarefas.tipo is 'Reunião | Audiência | Prazo | Tarefa | Outro — mesmo vocabulário de compromissos.tipo.';
comment on column public.compromissos.responsaveis_ids is 'Todos os responsáveis pelo compromisso. responsavel_id = o primeiro deles (mantido por trigger).';
comment on column public.compromissos.link_audiencia is 'Link da audiência virtual (Zoom/Lifesize/etc). Espelhado de/para tarefas.link_audiencia quando vinculado.';

-- Backfill: quem já tinha responsável único vira array de 1.
update public.tarefas
   set responsaveis_ids = array[responsavel_id]
 where responsavel_id is not null and cardinality(responsaveis_ids) = 0;

update public.compromissos
   set responsaveis_ids = array[responsavel_id]
 where responsavel_id is not null and cardinality(responsaveis_ids) = 0;

-- Tarefas antigas de audiência (o lembrete de WhatsApp já as identifica pelo
-- título) ganham o tipo certo.
update public.tarefas
   set tipo = 'Audiência'
 where tipo = 'Tarefa' and titulo ilike '%udiênc%';

create index if not exists idx_tarefas_responsaveis_ids
  on public.tarefas using gin (responsaveis_ids);
create index if not exists idx_compromissos_responsaveis_ids
  on public.compromissos using gin (responsaveis_ids);

-- ─── 2. responsavel_id <-> responsaveis_ids (mesma função pras duas tabelas) ─

create or replace function public.sync_responsaveis_legado()
returns trigger
language plpgsql
as $$
declare
  v_limpo uuid[];
begin
  if new.responsaveis_ids is null then
    new.responsaveis_ids := '{}';
  end if;

  -- Remove nulos e duplicatas preservando a ordem (o 1º é o "principal").
  select coalesce(array_agg(x order by ord), '{}')
    into v_limpo
    from (
      select distinct on (x) x, ord
        from unnest(new.responsaveis_ids) with ordinality as u(x, ord)
       where x is not null
       order by x, ord
    ) s;
  new.responsaveis_ids := v_limpo;

  if tg_op = 'UPDATE' then
    if new.responsaveis_ids is distinct from old.responsaveis_ids then
      -- Tela nova mexeu no array: ele é a fonte de verdade.
      if cardinality(new.responsaveis_ids) = 0 then
        new.responsavel_id := null;
      elsif new.responsavel_id is null or not (new.responsavel_id = any(new.responsaveis_ids)) then
        new.responsavel_id := new.responsaveis_ids[1];
      end if;
    elsif new.responsavel_id is distinct from old.responsavel_id then
      -- Código antigo mexeu só no campo único: array segue ele.
      new.responsaveis_ids := case when new.responsavel_id is null then '{}'::uuid[] else array[new.responsavel_id] end;
    end if;
  else
    if cardinality(new.responsaveis_ids) = 0 then
      if new.responsavel_id is not null then
        new.responsaveis_ids := array[new.responsavel_id];
      end if;
    elsif new.responsavel_id is null or not (new.responsavel_id = any(new.responsaveis_ids)) then
      new.responsavel_id := new.responsaveis_ids[1];
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tarefas_sync_responsaveis on public.tarefas;
create trigger trg_tarefas_sync_responsaveis
  before insert or update on public.tarefas
  for each row execute function public.sync_responsaveis_legado();

drop trigger if exists trg_compromissos_sync_responsaveis on public.compromissos;
create trigger trg_compromissos_sync_responsaveis
  before insert or update on public.compromissos
  for each row execute function public.sync_responsaveis_legado();

-- ─── 3a. Tarefa -> Compromisso (substitui criar_compromisso_da_tarefa) ───────
--
-- SECURITY DEFINER de propósito: a RLS de compromissos só deixa Admin/Gerente/
-- Secretaria ou o próprio responsável atualizar, e só Admin excluir. Sem isso,
-- um estagiário editando a própria tarefa falharia ao espelhar no compromisso
-- e o UPDATE da tarefa inteira seria rejeitado. A função só toca a linha
-- vinculada por tarefa_id, nada além.

create or replace function public.sync_compromisso_da_tarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comp_id uuid;
  v_inicio  timestamptz;
  v_tipo    text;
begin
  if coalesce(current_setting('app.sync_origem', true), '') = 'compromisso' then
    return new;
  end if;

  select id into v_comp_id from compromissos where tarefa_id = new.id limit 1;

  perform set_config('app.sync_origem', 'tarefa', true);

  if new.status = 'Cancelada' then
    if v_comp_id is not null then
      update compromissos
         set confirmacao_status = 'cancelado'
       where id = v_comp_id and coalesce(confirmacao_status, '') <> 'cancelado';
    end if;

  elsif new.prazo_fatal is null then
    -- Sem data não tem lugar na Agenda (tarefa perdeu o prazo → sai de lá).
    if v_comp_id is not null then
      delete from compromissos where id = v_comp_id;
    end if;

  else
    v_inicio := (new.prazo_fatal + coalesce(new.horario, '09:00'::time)) at time zone 'America/Manaus';
    v_tipo   := case when new.intimacao_id is not null then 'Intimação'
                     else coalesce(nullif(new.tipo, ''), 'Tarefa') end;

    if v_comp_id is null then
      insert into compromissos (
        titulo, descricao, data_inicio, tipo,
        lead_id, processo_id, responsavel_id, responsaveis_ids, link_audiencia,
        origem, tarefa_id, confirmacao_status
      ) values (
        new.titulo, new.descricao, v_inicio, v_tipo,
        new.cliente_id, new.processo_id, new.responsavel_id, new.responsaveis_ids, new.link_audiencia,
        'tarefa', new.id, 'pendente'
      );
    else
      update compromissos c
         set titulo             = new.titulo,
             descricao          = new.descricao,
             data_inicio        = v_inicio,
             tipo               = v_tipo,
             lead_id            = new.cliente_id,
             processo_id        = new.processo_id,
             responsavel_id     = new.responsavel_id,
             responsaveis_ids   = new.responsaveis_ids,
             link_audiencia     = new.link_audiencia,
             -- tarefa reativada depois de cancelada volta a ficar pendente
             confirmacao_status = case when c.confirmacao_status = 'cancelado' then 'pendente' else c.confirmacao_status end
       where c.id = v_comp_id
         and (
           row(c.titulo, c.descricao, c.data_inicio, c.tipo, c.lead_id, c.processo_id,
               c.responsavel_id, c.responsaveis_ids, c.link_audiencia)
           is distinct from
           row(new.titulo, new.descricao, v_inicio, v_tipo, new.cliente_id, new.processo_id,
               new.responsavel_id, new.responsaveis_ids, new.link_audiencia)
           or c.confirmacao_status = 'cancelado'
         );
    end if;
  end if;

  perform set_config('app.sync_origem', '', true);
  return new;
end;
$$;

drop trigger if exists trg_tarefa_cria_compromisso on public.tarefas;
drop function if exists public.criar_compromisso_da_tarefa();

drop trigger if exists trg_tarefa_sync_compromisso on public.tarefas;
create trigger trg_tarefa_sync_compromisso
  after insert or update on public.tarefas
  for each row execute function public.sync_compromisso_da_tarefa();

-- ─── 3b. Compromisso -> Tarefa ───────────────────────────────────────────────
--
-- Só compromissos criados pela tela da Agenda (origem = 'agenda', que o
-- CompromissoModal passa a enviar) viram tarefa. Consultas agendadas pelo
-- chat/Isa (origem 'local' com modalidade), Google ('google'), Cal.com,
-- importação AdvBox etc. NÃO — senão a página de Tarefas viraria um espelho
-- de toda a agenda de atendimentos.

create or replace function public.sync_tarefa_do_compromisso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarefa_id uuid;
  v_data      date;
  v_hora      time;
  v_tipo      text;
begin
  if coalesce(current_setting('app.sync_origem', true), '') = 'tarefa' then
    return coalesce(new, old);
  end if;

  perform set_config('app.sync_origem', 'compromisso', true);

  if tg_op = 'DELETE' then
    if old.tarefa_id is not null then
      update tarefas
         set status = 'Cancelada'
       where id = old.tarefa_id and status not in ('Concluída', 'Cancelada');
    end if;
    perform set_config('app.sync_origem', '', true);
    return old;
  end if;

  v_data := (new.data_inicio at time zone 'America/Manaus')::date;
  v_hora := (new.data_inicio at time zone 'America/Manaus')::time;
  v_tipo := case when new.tipo in ('Reunião', 'Audiência', 'Prazo', 'Tarefa', 'Outro') then new.tipo else null end;

  if tg_op = 'INSERT' then
    if new.tarefa_id is null and new.origem = 'agenda' then
      insert into tarefas (
        titulo, descricao, tipo, status, prioridade,
        prazo_fatal, data_limite, horario,
        processo_id, cliente_id, responsavel_id, responsaveis_ids, link_audiencia
      ) values (
        new.titulo, new.descricao, coalesce(v_tipo, 'Outro'), 'Pendente', 'Media',
        v_data, v_data, v_hora,
        new.processo_id, new.lead_id, new.responsavel_id, new.responsaveis_ids, new.link_audiencia
      )
      returning id into v_tarefa_id;

      update compromissos set tarefa_id = v_tarefa_id where id = new.id;
    end if;

  else -- UPDATE
    if new.tarefa_id is not null then
      if new.confirmacao_status = 'cancelado' and coalesce(old.confirmacao_status, '') <> 'cancelado' then
        update tarefas
           set status = 'Cancelada'
         where id = new.tarefa_id and status not in ('Concluída', 'Cancelada');
      end if;

      if row(new.titulo, new.descricao, new.data_inicio, new.tipo, new.processo_id, new.lead_id,
             new.responsavel_id, new.responsaveis_ids, new.link_audiencia)
         is distinct from
         row(old.titulo, old.descricao, old.data_inicio, old.tipo, old.processo_id, old.lead_id,
             old.responsavel_id, old.responsaveis_ids, old.link_audiencia)
      then
        update tarefas t
           set titulo           = new.titulo,
               descricao        = new.descricao,
               tipo             = coalesce(v_tipo, t.tipo),   -- 'Intimação' não existe em tarefas: mantém
               prazo_fatal      = v_data,
               data_limite      = v_data,
               horario          = v_hora,
               processo_id      = new.processo_id,
               cliente_id       = new.lead_id,
               responsavel_id   = new.responsavel_id,
               responsaveis_ids = new.responsaveis_ids,
               link_audiencia   = new.link_audiencia
         where t.id = new.tarefa_id;
      end if;
    end if;
  end if;

  perform set_config('app.sync_origem', '', true);
  return new;
end;
$$;

drop trigger if exists trg_compromisso_sync_tarefa on public.compromissos;
create trigger trg_compromisso_sync_tarefa
  after insert or update or delete on public.compromissos
  for each row execute function public.sync_tarefa_do_compromisso();

-- ─── 4. Busca de processo por número sem pontuação ──────────────────────────

alter table public.processos
  add column if not exists numero_processo_digits text
  generated always as (nullif(regexp_replace(coalesce(numero_processo, ''), '\D', '', 'g'), '')) stored;

comment on column public.processos.numero_processo_digits is 'Só os dígitos de numero_processo (gerada). Pra busca "contém" sem pontuação — não confundir com cnj_normalizado (UNIQUE, só CNJ completo de 20 dígitos).';
